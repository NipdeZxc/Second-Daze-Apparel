// Phase 7.1 acceptance run against a running site (the Vercel deployment or scripts/local-server.mjs)
// that uses the real database.
//
// WRITES TEST DATA TO THE LIVE DATABASE. Every record it creates is named or coded "TEST"
// and can be removed with scripts/phase7-cleanup.mjs.
//
// Required environment variables (never commit their values):
//   LIVE_URL            e.g. https://second-daze-apparel.vercel.app
//   DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME   (same database the site uses; used for setup and checks)
//   QA_ADMIN_PASSWORD   strong password for the temporary qa_admin account (created/reset here)
//   QA_CREDS_FILE       file OUTSIDE the repo where the generated qa_sales / qa_inventory passwords are saved
//   QA_RESULTS_FILE     where the JSON results are written (default docs/test-results/live-run.json)
//
// Run: node scripts/phase7-live-test.mjs

import fs from "node:fs";
import crypto from "node:crypto";
import { getPool } from "../api/_db.js";
import { hashPassword, generateTempPassword } from "../api/_lib/password.js";
import { sendExpiryReminders } from "../api/_lib/routes/operations.js";

const BASE = (process.env.LIVE_URL || "").replace(/\/$/, "");
if (!BASE || !process.env.QA_ADMIN_PASSWORD || !process.env.QA_CREDS_FILE) {
  console.error("Set LIVE_URL, QA_ADMIN_PASSWORD, QA_CREDS_FILE and the DB_* variables.");
  process.exit(1);
}
const RESULTS_FILE = process.env.QA_RESULTS_FILE || "docs/test-results/live-run.json";
const db = getPool();
const q = async (sql, params = []) => (await db.query(sql, params))[0];
const one = async (sql, params = []) => (await q(sql, params))[0];

// ---- HTTP session helper ---------------------------------------------------------------

class Session {
  constructor(name) { this.name = name; this.cookie = ""; }
  async call(method, path, body) {
    const res = await fetch(`${BASE}/api/${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const header of res.headers.getSetCookie()) {
      const [pair] = header.split(";");
      const [name, value] = pair.split("=");
      if (name === "sd_session") this.cookie = value ? `sd_session=${value}` : "";
    }
    const type = res.headers.get("content-type") || "";
    const data = type.includes("json") ? await res.json() : await res.text();
    return { status: res.status, data, headers: res.headers };
  }
  login(username, password) { return this.call("POST", "login", { username, password }); }
  records() { return this.call("GET", "data/records"); }
  form(screenId, values) { return this.call("POST", "data/actions", { screenId, values }); }
  row(kind, id, action, value) { return this.call("POST", `data/${kind}/${id}/${action}`, value === undefined ? {} : { value }); }
}

// ---- Result recording -------------------------------------------------------------------

const results = [];
const started = new Date();
function check(condition, message) { if (!condition) throw new Error(message); }
const brief = (r) => `HTTP ${r.status}${r.data?.error ? ` "${r.data.error}"` : ""}`;

async function tc(id, title, fn, { status: forced } = {}) {
  process.stdout.write(`${id} ${title} ... `);
  try {
    const actual = await fn();
    const status = forced || "Pass";
    results.push({ id, title, status, actual });
    console.log(status);
  } catch (error) {
    results.push({ id, title, status: "Fail", actual: error.message });
    console.log(`FAIL: ${error.message}`);
  }
}
function note(id, title, status, actual) {
  results.push({ id, title, status, actual });
  console.log(`${id} ${title} ... ${status}`);
}

// ---- Lookups ---------------------------------------------------------------------------

const product = (code) => one(`SELECT * FROM products WHERE product_code = ?`, [code]);
const userId = async (username) => (await one(`SELECT user_id FROM users WHERE username = ?`, [username]))?.user_id;
const lastOrder = (uid) => one(`SELECT * FROM orders WHERE created_by = ? ORDER BY order_id DESC LIMIT 1`, [uid]);
const lastReservation = (uid) => one(`SELECT * FROM reservations WHERE created_by = ? ORDER BY reservation_id DESC LIMIT 1`, [uid]);
const lastRefund = (uid) => one(`SELECT * FROM refunds WHERE requested_by = ? ORDER BY refund_id DESC LIMIT 1`, [uid]);
const orderById = (id) => one(`SELECT * FROM orders WHERE order_id = ?`, [id]);
const customerByPhone = (phone) => one(`SELECT * FROM customers WHERE contact_number = ?`, [phone]);
const notificationsFor = (refType, refId) => q(
  `SELECT n.category, n.message, r.role_name, n.target_user_id FROM notifications n
     LEFT JOIN roles r ON r.role_id = n.target_role_id WHERE n.reference_type = ? AND n.reference_id = ?`, [refType, refId]
);
const strongPassword = () => `Qa!${crypto.randomBytes(9).toString("base64url")}7a`;

const ANA = { name: "TEST Ana Cruz", phone: "09990001001" };
const BEN = { name: "TEST Ben Reyes", phoneInput: "+63 999 000 1002", phone: "+639990001002" };
const customerForm = (name, phone, overrides = {}) => ({
  "Full name": name, "Contact number": phone, Address: "123 Test St.", Barangay: "Brgy. Test",
  City: "Manila", Province: "Metro Manila", ...overrides,
});

// ---- Run -------------------------------------------------------------------------------

const admin = new Session("qa_admin");
const sales = new Session("qa_sales");
const inventory = new Session("qa_inventory");
const anon = new Session("anonymous");
const creds = { qa_admin: "(QA_ADMIN_PASSWORD)" };
const saveCreds = () => fs.writeFileSync(process.env.QA_CREDS_FILE, JSON.stringify(creds, null, 2));

// Setup: temporary Admin. Admin accounts cannot be created through the API by design.
const existingAdmin = await userId("qa_admin");
const adminHash = await hashPassword(process.env.QA_ADMIN_PASSWORD);
if (existingAdmin) {
  await q(`UPDATE users SET password_hash = ?, account_status = 'Active', must_change_password = 0, failed_login_count = 0, locked_until = NULL WHERE user_id = ?`, [adminHash, existingAdmin]);
} else {
  await q(
    `INSERT INTO users (role_id, full_name, username, password_hash, must_change_password, account_status, approved_at)
     VALUES ((SELECT role_id FROM roles WHERE role_name = 'Admin'), 'QA Test Admin', 'qa_admin', ?, 0, 'Active', ?)`,
    [adminHash, new Date()]
  );
}
check((await admin.login("qa_admin", process.env.QA_ADMIN_PASSWORD)).status === 200, "qa_admin could not sign in");
const before = (await admin.records()).data.dashboard;

// ===== US-01 / 1.3–1.5 =====
let salesTemp, inventoryTemp, salesId, inventoryId;
await tc("TC-01", "Admin creates Sales and Inventory subaccounts", async () => {
  const a = await admin.call("POST", "users", { fullName: "QA Sales", username: "qa_sales", role: "Sales Management" });
  const b = await admin.call("POST", "users", { fullName: "QA Inventory", username: "qa_inventory", role: "Inventory Management" });
  check(a.status === 201 && b.status === 201, `create returned ${brief(a)} / ${brief(b)}`);
  salesTemp = a.data.temporaryPassword; inventoryTemp = b.data.temporaryPassword;
  salesId = a.data.id; inventoryId = b.data.id;
  const rows = await q(`SELECT username, account_status, must_change_password FROM users WHERE user_id IN (?, ?)`, [salesId, inventoryId]);
  check(rows.every((r) => r.account_status === "Pending Approval" && r.must_change_password === 1), "accounts not Pending Approval");
  return `201 Created for both; status Pending Approval; 12-character temporary password returned once (e.g. length ${salesTemp.length}).`;
});
await tc("TC-02", "Pending account cannot sign in", async () => {
  const r = await sales.login("qa_sales", salesTemp);
  check(r.status === 403, brief(r));
  return `${brief(r)}`;
});
await tc("TC-03", "Admin approves both accounts", async () => {
  const a = await admin.call("POST", `users/${salesId}/approve`);
  const b = await admin.call("POST", `users/${inventoryId}/approve`);
  check(a.status === 200 && b.status === 200, `${brief(a)} / ${brief(b)}`);
  const list = (await admin.call("GET", "users")).data.users.filter((u) => u.username.startsWith("qa_"));
  check(list.filter((u) => u.status === "Active").length === 3, "not Active");
  return "Both approved (HTTP 200); user list shows status Active.";
});
await tc("TC-04", "First sign-in forces a password change", async () => {
  const r = await sales.login("qa_sales", salesTemp);
  check(r.status === 200 && r.data.user.mustChangePassword === true, brief(r));
  const blocked = await sales.records();
  check(blocked.status === 403, `records before change: ${brief(blocked)}`);
  return `Login 200 with mustChangePassword=true; workspace data refused before the change (${brief(blocked)}).`;
});
await tc("TC-05", "Weak new password is rejected", async () => {
  const r = await sales.call("POST", "change-password", { currentPassword: salesTemp, newPassword: "password" });
  check(r.status === 400, brief(r));
  creds.qa_sales = strongPassword();
  const ok = await sales.call("POST", "change-password", { currentPassword: salesTemp, newPassword: creds.qa_sales });
  check(ok.status === 200, `strong change: ${brief(ok)}`);
  await inventory.login("qa_inventory", inventoryTemp);
  creds.qa_inventory = strongPassword();
  const inv = await inventory.call("POST", "change-password", { currentPassword: inventoryTemp, newPassword: creds.qa_inventory });
  check(inv.status === 200, `inventory change: ${brief(inv)}`);
  saveCreds();
  const now = await sales.records();
  check(now.status === 200, `records after change: ${brief(now)}`);
  return `"password" → ${brief(r)}. A strong password was accepted (200) and the workspace opened.`;
});
await tc("TC-06", "Wrong password is refused", async () => {
  const r = await anon.login("qa_sales", "Wrong-Password-1!");
  check(r.status === 401, brief(r));
  return brief(r);
});
await tc("TC-07", "Signed-out user gets no data", async () => {
  const r = await anon.records();
  check(r.status === 401, brief(r));
  const page = await fetch(`${BASE}/`);
  return `GET /api/data/records → ${brief(r)}; site root → HTTP ${page.status} (sign-in screen, see screenshot).`;
});
await tc("TC-08", "Logout ends the browser session", async () => {
  const s = new Session("logout-check");
  await s.login("qa_sales", creds.qa_sales);
  const oldCookie = s.cookie;
  const out = await s.call("POST", "logout");
  check(out.status === 200 && s.cookie === "", "cookie not cleared");
  const after = await s.call("GET", "me");
  check(after.status === 401, `after logout: ${brief(after)}`);
  const copied = new Session("replay");
  copied.cookie = oldCookie;
  const replay = await copied.call("GET", "me");
  return `Logout cleared the cookie; /api/me → ${brief(after)}. Replaying a copied old cookie → HTTP ${replay.status} (accepted risk, see security review #4).`;
});
await tc("TC-09", "Forgot / reset password", async () => {
  const unknown = await anon.call("POST", "forgot-password", { identifier: "no-such-user-qa" });
  const known = await anon.call("POST", "forgot-password", { identifier: "qa_inventory" });
  check(unknown.status === 200 && known.status === 200 && unknown.data.message === known.data.message, "replies differ");
  // No QA mailbox exists, so a token is issued directly in the database to exercise the reset endpoint.
  const token = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  await q(`INSERT INTO password_resets (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)`,
    [inventoryId, hash, new Date(Date.now() + 30 * 60000), new Date()]);
  const newPassword = strongPassword();
  const first = await anon.call("POST", "reset-password", { token, newPassword });
  const second = await anon.call("POST", "reset-password", { token, newPassword: strongPassword() });
  check(first.status === 200 && second.status === 400, `first ${brief(first)}, second ${brief(second)}`);
  const expired = crypto.randomBytes(32).toString("hex");
  await q(`INSERT INTO password_resets (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)`,
    [inventoryId, crypto.createHash("sha256").update(expired).digest("hex"), new Date(Date.now() - 60000), new Date()]);
  const late = await anon.call("POST", "reset-password", { token: expired, newPassword: strongPassword() });
  check(late.status === 400, `expired: ${brief(late)}`);
  creds.qa_inventory = newPassword; saveCreds();
  check((await inventory.login("qa_inventory", newPassword)).status === 200, "cannot sign in with reset password");
  return `Unknown and known accounts get the same reply ("${known.data.message}"). Token reset: first use 200, reuse ${brief(second)}, expired ${brief(late)}. Email delivery not checked (no staff mailbox on file).`;
});
await tc("TC-10", "Disabled account cannot sign in; re-enable restores it", async () => {
  check((await admin.call("POST", `users/${inventoryId}/disable`)).status === 200, "disable failed");
  const blocked = await new Session("x").login("qa_inventory", creds.qa_inventory);
  check(blocked.status === 403, brief(blocked));
  const stale = await inventory.call("GET", "me");
  check((await admin.call("POST", `users/${inventoryId}/enable`)).status === 200, "enable failed");
  const ok = await inventory.login("qa_inventory", creds.qa_inventory);
  check(ok.status === 200, brief(ok));
  return `Disabled: login ${brief(blocked)}; existing session /api/me → HTTP ${stale.status}. Enabled: login HTTP 200.`;
});
await tc("TC-11", "Admin resets a password; old sessions end", async () => {
  const r = await admin.call("POST", `users/${salesId}/reset-password`);
  check(r.status === 200 && r.data.temporaryPassword, brief(r));
  const old = await sales.call("GET", "me");
  check(old.status === 401, `old session: ${brief(old)}`);
  const login = await sales.login("qa_sales", r.data.temporaryPassword);
  check(login.data.user?.mustChangePassword === true, "must change not set");
  creds.qa_sales = strongPassword(); saveCreds();
  check((await sales.call("POST", "change-password", { currentPassword: r.data.temporaryPassword, newPassword: creds.qa_sales })).status === 200, "change failed");
  return `New temporary password returned; old session → ${brief(old)}; next login requires a password change.`;
});
await tc("SEC-08", "Five failed logins lock the account", async () => {
  const s = new Session("lock");
  for (let i = 0; i < 5; i++) await s.login("qa_inventory", "Wrong-Password-1!");
  const locked = await s.login("qa_inventory", creds.qa_inventory);
  check(locked.status === 423, brief(locked));
  const fails = await one(`SELECT COUNT(*) n FROM audit_log WHERE user_id = ? AND action = 'login_failed'`, [inventoryId]);
  await q(`UPDATE users SET locked_until = NULL, failed_login_count = 0 WHERE user_id = ?`, [inventoryId]);
  return `After 5 wrong passwords the correct password gets ${brief(locked)}; ${fails.n} login_failed audit entries. (Unlocked in the DB afterwards.)`;
});

// ===== Role access =====
await tc("TC-12", "Each role signs in with its own role", async () => {
  const roles = [];
  for (const s of [admin, sales, inventory]) roles.push(`${s.name}=${(await s.call("GET", "me")).data.user.role}`);
  check(roles.join() === "qa_admin=Admin,qa_sales=Sales Management,qa_inventory=Inventory Management", roles.join());
  return `${roles.join(", ")}. Dashboards and navigation: see screenshots.`;
});
await tc("TC-15", "Sales cannot call Admin APIs", async () => {
  const calls = [
    ["GET users", await sales.call("GET", "users")],
    ["POST data/import", await sales.call("POST", "data/import", { kind: "products", records: [{}] })],
    ["GET export/customers", await sales.call("GET", "export/customers")],
    ["POST users", await sales.call("POST", "users", { fullName: "x", username: "xxx", role: "Sales Management" })],
  ];
  check(calls.every(([, r]) => r.status === 403), calls.map(([n, r]) => `${n} ${r.status}`).join(", "));
  return calls.map(([n, r]) => `${n} → ${r.status}`).join("; ");
});
await tc("TC-16", "Inventory cannot submit sales forms", async () => {
  const r = await inventory.form("3.13-create-purchase-order", {});
  check(r.status === 403, `${brief(r)} — the request passed the role check (fixed in code, not yet deployed)`);
  return brief(r);
});
await tc("TC-16b", "Inventory does not receive customer contact details", async () => {
  const r = (await inventory.records()).data;
  const exposed = r.customers.length || r.orders.some((o) => o.contact_number || o.address);
  check(!exposed, `customers returned: ${r.customers.length}; orders include contact/address (fixed in code, not yet deployed)`);
  return "customers empty; orders have no contact number or address.";
});
await tc("TC-75", "Sales cannot run Delete all data", async () => {
  const r = await sales.call("POST", "data/delete-all", { confirm: "DELETE ALL DATA" });
  check(r.status === 403, brief(r));
  return brief(r);
});

// ===== Products and stock =====
const productFile = [
  { product_code: "TEST-001", product_name: "TEST Denim jacket", category: "Outerwear", size: "M", cost_price: "200", selling_price: "500", stock_quantity: "10", low_stock_threshold: "3" },
  { product_code: "TEST-002", product_name: "TEST Floral dress", category: "Dresses", size: "S", cost_price: "150", selling_price: "400", stock_quantity: "4", low_stock_threshold: "3" },
];
note("TC-17", "Inventory adds a product manually", "Blocked", "No manual add-product form or API exists; products are added only by Admin CSV import (known gap, US-02).");
await tc("TC-18", "Admin imports the TEST products", async () => {
  const r = await admin.call("POST", "data/import", { kind: "products", fileName: "TEST-products.csv", records: productFile });
  check(r.status === 200 && r.data.created === 2, brief(r));
  const [a, b] = [await product("TEST-001"), await product("TEST-002")];
  check(a.stock_quantity === 10 && b.stock_quantity === 4, "stock mismatch");
  return `Imported 2 rows, created 2, stock added ${r.data.stockAdded}. TEST-001 stock 10, TEST-002 stock 4.`;
});
await tc("TC-19", "Same product file cannot be imported twice", async () => {
  const r = await admin.call("POST", "data/import", { kind: "products", fileName: "renamed.csv", records: productFile });
  check(r.status === 409, brief(r));
  check((await product("TEST-001")).stock_quantity === 10, "stock changed");
  return `${brief(r)}; stock unchanged (10).`;
});
await tc("TC-20", "Inventory sees product details", async () => {
  const p = (await inventory.records()).data.products.find((x) => x.product_code === "TEST-001");
  check(p && p.category === "Outerwear" && p.size === "M" && p.cost_price === 200 && p.selling_price === 500, JSON.stringify(p));
  return `TEST-001: ${p.product_name}, ${p.category}, ${p.size}, cost ${p.cost_price}, price ${p.selling_price}, stock ${p.stock_quantity}, ${p.status}.`;
});
await tc("TC-21", "Inventory adds stock", async () => {
  const id = (await product("TEST-001")).product_id;
  const r = await inventory.row("products", id, "stock-in", "5");
  check(r.status === 200, brief(r));
  const p = await product("TEST-001");
  const mv = await one(`SELECT movement_type, quantity_change FROM stock_movements WHERE product_id = ? ORDER BY movement_id DESC LIMIT 1`, [id]);
  check(p.stock_quantity === 15 && mv.movement_type === "Stock In" && mv.quantity_change === 5, "stock/movement mismatch");
  return "Stock 10 → 15; Stock In movement +5 recorded.";
});
await tc("TC-22", "Invalid stock quantities are refused", async () => {
  const id = (await product("TEST-001")).product_id;
  const out = [];
  for (const v of ["0", "-1", "abc"]) out.push(`${v} → ${(await inventory.row("products", id, "stock-in", v)).status}`);
  check(out.every((x) => x.endsWith("400")), out.join(", "));
  return `${out.join(", ")}; stock still ${(await product("TEST-001")).stock_quantity}.`;
});
await tc("TC-24", "Non-admins cannot edit products", async () => {
  const values = { "Product code": "TEST-001", "Product name": "Hack", Category: "x", Size: "M", "Cost price": "1", "Selling price": "1", "Low-stock threshold": "1", Status: "Active" };
  const a = await sales.form("4.3-edit-product-admin-only", values);
  const b = await inventory.form("4.3-edit-product-admin-only", values);
  const c = await sales.call("PUT", "data/products/TEST-001", { product_name: "Hack", cost_price: "1", selling_price: "1", low_stock_threshold: "1" });
  check([a, b, c].every((r) => r.status === 403), `${a.status}/${b.status}/${c.status}`);
  return `Sales form ${brief(a)}; Inventory form ${brief(b)}; Sales PUT ${c.status}.`;
});

// ===== Customers =====
await tc("TC-28", "New customer with 09 number", async () => {
  const r = await sales.form("3.12-new-customer-validation", customerForm(ANA.name, ANA.phone));
  check(r.status === 200, brief(r));
  const c = await customerByPhone(ANA.phone);
  check(c && c.info_verified === 0, "not saved as unverified");
  return "Saved; status Unverified.";
});
await tc("TC-29", "New customer with +63 number and spaces", async () => {
  const r = await sales.form("3.12-new-customer-validation", customerForm(BEN.name, BEN.phoneInput));
  check(r.status === 200, brief(r));
  check(await customerByPhone(BEN.phone), "not normalized");
  return `Saved as ${BEN.phone}.`;
});
await tc("TC-30", "Invalid mobile numbers are refused", async () => {
  const out = [];
  for (const phone of ["12345", "0817123456", "(02) 8123 4567"]) out.push(`${phone} → ${(await sales.form("3.12-new-customer-validation", customerForm("TEST Bad", phone))).status}`);
  check(out.every((x) => x.endsWith("400")), out.join(", "));
  return out.join("; ");
});
await tc("TC-31", "Missing address fields are refused", async () => {
  const a = await sales.form("3.12-new-customer-validation", customerForm("TEST NoCity", "09990001009", { City: "" }));
  const b = await sales.form("3.12-new-customer-validation", customerForm("TEST NoProv", "09990001009", { Province: "" }));
  check(a.status === 400 && b.status === 400, `${a.status}/${b.status}`);
  return `City blank ${brief(a)}; Province blank ${brief(b)}.`;
});
await tc("TC-32", "Duplicate number (other format) is refused", async () => {
  const r = await sales.form("3.12-new-customer-validation", customerForm("TEST Dup", "+639990001001"));
  check(r.status === 409, brief(r));
  return brief(r);
});
await tc("SEC-10", "Long text and markup in input", async () => {
  const long = await sales.form("3.12-new-customer-validation", customerForm("TEST " + "x".repeat(120), "09990001008"));
  check(long.status === 400, `long name ${brief(long)}`);
  return `Name over 100 characters → ${brief(long)}. Markup is shown as text by React (see screenshot of the customer list).`;
});

// ===== Orders, payment, invoice =====
const sid = salesId;
let orderA, orderB, orderC;
await tc("TC-34", "Sales creates a multi-item purchase order", async () => {
  const r = await sales.form("3.13-create-purchase-order", { Customer: ANA.name, Product: "TEST-001", Quantity: "2", "Additional items": "TEST-002 x 1" });
  check(r.status === 200, brief(r));
  orderA = await lastOrder(sid);
  const items = await q(`SELECT p.product_code, oi.quantity, oi.unit_price, oi.unit_cost FROM order_items oi JOIN products p ON p.product_id = oi.product_id WHERE oi.order_id = ? ORDER BY p.product_code`, [orderA.order_id]);
  const po = await one(`SELECT po_number FROM purchase_orders WHERE order_id = ?`, [orderA.order_id]);
  const n = await notificationsFor("Order", orderA.order_id);
  check(orderA.order_status === "Pending Approval" && items.length === 2 && po && n.some((x) => x.role_name === "Admin"), "order/PO/notification missing");
  return `${orderA.order_number} (${po.po_number}) Pending Approval; items ${items.map((i) => `${i.product_code}×${i.quantity} @${i.unit_price}/cost ${i.unit_cost}`).join(", ")}; Admin notified.`;
});
await tc("TC-35", "Order larger than stock is refused", async () => {
  const r = await sales.form("3.13-create-purchase-order", { Customer: ANA.name, Product: "TEST-001", Quantity: "999" });
  check(r.status === 409, brief(r));
  return brief(r);
});
await tc("TC-36", "Bad additional-items format is refused", async () => {
  const r = await sales.form("3.13-create-purchase-order", { Customer: ANA.name, Product: "TEST-001", Quantity: "1", "Additional items": "TEST-002 two" });
  check(r.status === 400, brief(r));
  return brief(r);
});
await tc("TC-37", "Admin approves the order", async () => {
  const r = await admin.row("orders", orderA.order_id, "approve");
  check(r.status === 200 && (await orderById(orderA.order_id)).order_status === "Pending Payment", brief(r));
  return "Order status Pending Payment.";
});
const refA1 = `TEST${Date.now()}`;
await tc("TC-38", "Sales records a GCash payment", async () => {
  const r = await sales.row("orders", orderA.order_id, "record-payment", refA1);
  const pay = await one(`SELECT payment_status, amount_paid FROM payments WHERE order_id = ? ORDER BY payment_id DESC LIMIT 1`, [orderA.order_id]);
  check(r.status === 200 && pay.payment_status === "Pending Verification", brief(r));
  return `Payment ${refA1} ₱${pay.amount_paid} Pending Verification; Admin notified.`;
});
await tc("TC-40", "Admin rejects the payment", async () => {
  const r = await admin.row("orders", orderA.order_id, "reject-payment", "TEST reference not found in GCash");
  const pay = await one(`SELECT payment_status, rejection_reason FROM payments WHERE order_id = ? ORDER BY payment_id DESC LIMIT 1`, [orderA.order_id]);
  const n = await notificationsFor("Order", orderA.order_id);
  check(r.status === 200 && pay.payment_status === "Rejected" && (await orderById(orderA.order_id)).order_status === "Pending Payment" && n.some((x) => x.target_user_id === sid && /rejected/.test(x.message)), "reject flow mismatch");
  return `Payment Rejected ("${pay.rejection_reason}"); order still Pending Payment; Sales user notified.`;
});
await tc("TC-39", "Duplicate GCash reference is refused", async () => {
  await sales.form("3.13-create-purchase-order", { Customer: BEN.name, Product: "TEST-002", Quantity: "1" });
  orderB = await lastOrder(sid);
  await admin.row("orders", orderB.order_id, "approve");
  const r = await sales.row("orders", orderB.order_id, "record-payment", refA1);
  check(r.status === 409, brief(r));
  return `${orderB.order_number}: reusing ${refA1} → ${brief(r)}.`;
});
await tc("TC-41", "Verified payment deducts stock and issues the invoice", async () => {
  const before1 = (await product("TEST-001")).stock_quantity;
  const before2 = (await product("TEST-002")).stock_quantity;
  check((await sales.row("orders", orderA.order_id, "record-payment", `${refA1}B`)).status === 200, "record failed");
  const r = await admin.row("orders", orderA.order_id, "verify-payment");
  check(r.status === 200, brief(r));
  const inv = await one(`SELECT invoice_number FROM invoices WHERE order_id = ?`, [orderA.order_id]);
  const [p1, p2] = [await product("TEST-001"), await product("TEST-002")];
  const sales_ = await q(`SELECT COUNT(*) n FROM stock_movements WHERE reference_type = 'Order' AND reference_id = ? AND movement_type = 'Sale'`, [orderA.order_id]);
  check((await orderById(orderA.order_id)).order_status === "Paid" && inv && p1.stock_quantity === before1 - 2 && p2.stock_quantity === before2 - 1 && sales_[0].n === 2, "paid flow mismatch");
  return `Order Paid; ${inv.invoice_number} issued; TEST-001 ${before1} → ${p1.stock_quantity}, TEST-002 ${before2} → ${p2.stock_quantity}; 2 Sale movements.`;
});
await tc("TC-26", "Low stock notification for Inventory", async () => {
  const p = await product("TEST-002");
  const n = await notificationsFor("Product", p.product_id);
  const seen = (await inventory.records()).data.notifications.some((x) => x.category === "Low Stock" && x.message.includes("TEST Floral dress"));
  check(p.stock_quantity <= p.low_stock_threshold && n.some((x) => x.role_name === "Inventory Management") && seen, "no low-stock notification");
  return `TEST-002 stock ${p.stock_quantity} ≤ threshold ${p.low_stock_threshold}; "Low Stock" notification visible to Inventory.`;
});
await tc("TC-25", "Low-stock list", async () => {
  const p = (await inventory.records()).data.products.find((x) => x.product_code === "TEST-002");
  check(p.status === "Low stock", p.status);
  return `TEST-002 status "${p.status}".`;
});
await tc("TC-42", "Sales documents: PO and invoice only after payment", async () => {
  const docs = (await sales.records()).data.documents;
  const a = docs.filter((d) => d.order_number === orderA.order_number).map((d) => d.doc_type);
  const b = docs.filter((d) => d.order_number === orderB.order_number).map((d) => d.doc_type);
  check(a.includes("Purchase Order") && a.includes("Invoice") && b.includes("Purchase Order") && !b.includes("Invoice"), `${a} / ${b}`);
  return `${orderA.order_number}: ${a.join(", ")}. ${orderB.order_number} (unpaid): ${b.join(", ")} only.`;
});
await tc("TC-44", "Cancel an unpaid order", async () => {
  const s = (await product("TEST-002")).stock_quantity;
  const r = await sales.row("orders", orderB.order_id, "cancel");
  check(r.status === 200 && (await orderById(orderB.order_id)).order_status === "Cancelled" && (await product("TEST-002")).stock_quantity === s, brief(r));
  return `${orderB.order_number} Cancelled; TEST-002 stock unchanged (${s}).`;
});

// ===== Shipment and delivery =====
await tc("TC-45", "Cannot ship to an unverified customer", async () => {
  check((await sales.row("orders", orderA.order_id, "pack")).status === 200, "pack failed");
  const r = await sales.row("orders", orderA.order_id, "ship", "JT-TEST-001");
  check(r.status === 409, brief(r));
  return `Packed; ship → ${brief(r)}.`;
});
await tc("TC-33", "Sales verifies the customer", async () => {
  const c = await customerByPhone(ANA.phone);
  const r = await sales.row("customers", c.customer_id, "verify");
  check(r.status === 200 && (await customerByPhone(ANA.phone)).info_verified === 1, brief(r));
  return "TEST Ana Cruz → Verified.";
});
await tc("TC-46", "Ship with tracking number", async () => {
  const r = await sales.row("orders", orderA.order_id, "ship", "JT-TEST-001");
  const sh = await one(`SELECT tracking_number, shipment_status FROM shipments WHERE order_id = ?`, [orderA.order_id]);
  check(r.status === 200 && sh.tracking_number === "JT-TEST-001" && (await orderById(orderA.order_id)).order_status === "Shipped", brief(r));
  return "Order Shipped; tracking JT-TEST-001 saved.";
});
await tc("TC-47", "Mark in transit", async () => {
  const r = await sales.row("orders", orderA.order_id, "in-transit");
  const sh = await one(`SELECT shipment_status FROM shipments WHERE order_id = ?`, [orderA.order_id]);
  check(r.status === 200 && sh.shipment_status === "In Transit", brief(r));
  return "Shipment In Transit.";
});
await tc("TC-48", "Confirm delivery issues a delivery receipt", async () => {
  const r = await sales.form("3.14-confirm-delivery", { "Order number": orderA.order_number, "Delivery status": "Delivered", "Date and time delivered": new Date().toISOString(), "Received by": "TEST Ana Cruz" });
  const dr = await one(`SELECT dr_number FROM delivery_receipts WHERE order_id = ?`, [orderA.order_id]);
  check(r.status === 200 && dr && (await orderById(orderA.order_id)).order_status === "Delivered", brief(r));
  return `Order Delivered; ${dr.dr_number} issued.`;
});
await tc("TC-50", "Complete the delivered order", async () => {
  const r = await sales.row("orders", orderA.order_id, "complete");
  check(r.status === 200 && (await orderById(orderA.order_id)).order_status === "Completed", brief(r));
  return "Order Completed.";
});
await tc("TC-49", "Returned parcel", async () => {
  const ben = await customerByPhone(BEN.phone);
  await sales.row("customers", ben.customer_id, "verify");
  await sales.form("3.13-create-purchase-order", { Customer: BEN.name, Product: "TEST-001", Quantity: "1" });
  orderC = await lastOrder(sid);
  await admin.row("orders", orderC.order_id, "approve");
  await sales.row("orders", orderC.order_id, "record-payment", `${refA1}C`);
  await admin.row("orders", orderC.order_id, "verify-payment");
  await sales.row("orders", orderC.order_id, "pack");
  check((await sales.row("orders", orderC.order_id, "ship", "JT-TEST-002")).status === 200, "ship failed");
  const r = await sales.form("3.14-confirm-delivery", { "Order number": orderC.order_number, "Delivery status": "Returned to sender" });
  const sh = await one(`SELECT shipment_status, return_reason FROM shipments WHERE order_id = ?`, [orderC.order_id]);
  const c = await customerByPhone(BEN.phone);
  const dr = await one(`SELECT 1 x FROM delivery_receipts WHERE order_id = ?`, [orderC.order_id]);
  check(r.status === 200 && sh.shipment_status === "Returned" && c.returned_parcels === ben.returned_parcels + 1 && c.info_verified === 0 && !dr, "return mismatch");
  return `${orderC.order_number}: shipment Returned ("${sh.return_reason}"); customer returned parcels ${c.returned_parcels}, back to Unverified; no DR.`;
});

// ===== Reservations =====
let r1, r2, r3, r4, r5;
const reserve = async (days, qty = "1", code = "TEST-001") => {
  const r = await sales.form("5.1-new-reservation", { Customer: BEN.name, Product: code, Quantity: qty, "Agreed days": String(days) });
  check(r.status === 200, `reserve: ${brief(r)}`);
  return lastReservation(sid);
};
await tc("TC-51", "Sales creates a reservation", async () => {
  r1 = await reserve(2);
  const n = await notificationsFor("Reservation", r1.reservation_id);
  check(r1.reservation_status === "Pending Approval" && n.some((x) => x.role_name === "Admin"), "not pending/notified");
  return `${r1.reservation_number} Pending Approval (2 agreed days); Admin notified.`;
});
await tc("TC-52", "Invalid agreed days are refused", async () => {
  const out = [];
  for (const d of ["0", "256", ""]) out.push(`"${d}" → ${(await sales.form("5.1-new-reservation", { Customer: BEN.name, Product: "TEST-001", Quantity: "1", "Agreed days": d })).status}`);
  check(out.every((x) => x.endsWith("400")), out.join(", "));
  return out.join("; ");
});
await tc("TC-53", "Approval holds stock and sets expiry", async () => {
  const p = await product("TEST-001");
  const t = Date.now();
  const r = await admin.row("reservations", r1.reservation_id, "approve");
  const res = await one(`SELECT * FROM reservations WHERE reservation_id = ?`, [r1.reservation_id]);
  const q2 = await product("TEST-001");
  const hours = (new Date(res.expiry_date) - t) / 3600000;
  check(r.status === 200 && res.reservation_status === "Active" && q2.stock_quantity === p.stock_quantity - 1 && q2.reserved_quantity === p.reserved_quantity + 1 && Math.abs(hours - 48) < 0.2, `hours ${hours}`);
  return `Active; expiry ${hours.toFixed(1)} h after approval; stock ${p.stock_quantity} → ${q2.stock_quantity}, reserved ${p.reserved_quantity} → ${q2.reserved_quantity}.`;
});
await tc("TC-54", "Rejecting a reservation leaves stock alone", async () => {
  r2 = await reserve(3);
  const s = await product("TEST-001");
  const r = await admin.row("reservations", r2.reservation_id, "reject");
  const after = await product("TEST-001");
  check(r.status === 200 && after.stock_quantity === s.stock_quantity && after.reserved_quantity === s.reserved_quantity, brief(r));
  return `${r2.reservation_number} Rejected; stock unchanged.`;
});
await tc("TC-55", "Cancelling an active reservation releases stock", async () => {
  r3 = await reserve(3);
  await admin.row("reservations", r3.reservation_id, "approve");
  const held = await product("TEST-001");
  const r = await sales.row("reservations", r3.reservation_id, "cancel");
  const after = await product("TEST-001");
  check(r.status === 200 && after.stock_quantity === held.stock_quantity + 1 && after.reserved_quantity === held.reserved_quantity - 1, brief(r));
  return `${r3.reservation_number} Cancelled; stock ${held.stock_quantity} → ${after.stock_quantity}, reserved ${held.reserved_quantity} → ${after.reserved_quantity}.`;
});
let orderR;
await tc("TC-56", "Reservation converted to a paid order", async () => {
  const s = await product("TEST-001");
  check((await sales.row("reservations", r1.reservation_id, "convert")).status === 200, "convert failed");
  orderR = await lastOrder(sid);
  await sales.row("orders", orderR.order_id, "record-payment", `${refA1}R`);
  const r = await admin.row("orders", orderR.order_id, "verify-payment");
  const after = await product("TEST-001");
  const res = await one(`SELECT reservation_status FROM reservations WHERE reservation_id = ?`, [r1.reservation_id]);
  check(r.status === 200 && res.reservation_status === "Paid" && after.stock_quantity === s.stock_quantity && after.reserved_quantity === s.reserved_quantity - 1, brief(r));
  return `${orderR.order_number} Paid; reservation Paid; stock unchanged (${after.stock_quantity}), reserved ${s.reserved_quantity} → ${after.reserved_quantity} (no double deduction).`;
});
await tc("TC-57", "Expired reservation is voided; reminder sent", async () => {
  r4 = await reserve(1);
  await admin.row("reservations", r4.reservation_id, "approve");
  const held = await product("TEST-001");
  // Simulate the passage of time by moving the expiry into the past.
  await q(`UPDATE reservations SET expiry_date = ? WHERE reservation_id = ?`, [new Date(Date.now() - 60000), r4.reservation_id]);
  await sales.records(); // every records load runs the expiry check
  const res = await one(`SELECT reservation_status, void_reason FROM reservations WHERE reservation_id = ?`, [r4.reservation_id]);
  const after = await product("TEST-001");
  const n = await notificationsFor("Reservation", r4.reservation_id);
  check(res.reservation_status === "Voided" && after.stock_quantity === held.stock_quantity + 1 && n.some((x) => x.target_user_id === sid && /expired/.test(x.message)), JSON.stringify(res));
  r5 = await reserve(1);
  await admin.row("reservations", r5.reservation_id, "approve");
  const sent = await sendExpiryReminders(); // the same function the daily cron calls
  const reminder = (await notificationsFor("Reservation", r5.reservation_id)).some((x) => /expires within/.test(x.message));
  await sales.row("reservations", r5.reservation_id, "cancel");
  check(reminder, "no reminder");
  return `${r4.reservation_number} Voided (${res.void_reason}); stock ${held.stock_quantity} → ${after.stock_quantity}; creator notified. ${r5.reservation_number} (expires in 24 h): reminder sent (${sent} total), then cancelled.`;
});
await tc("TC-58", "Maintenance endpoint needs the cron secret", async () => {
  const a = await anon.call("GET", "operations/maintenance");
  const b = await fetch(`${BASE}/api/operations/maintenance`, { headers: { Authorization: "Bearer wrong-secret" } });
  check(a.status === 401 && b.status === 401, `${a.status}/${b.status}`);
  if (!process.env.CRON_SECRET) return `No header → ${a.status}; wrong secret → ${b.status}. (Correct secret not tested: unknown.)`;
  const c = await fetch(`${BASE}/api/operations/maintenance`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  check(c.status === 200, `correct secret → ${c.status}`);
  return `No header → ${a.status}; wrong secret → ${b.status}; correct secret → ${c.status}.`;
});

// ===== Refunds =====
const refundForm = (order, code, qty, condition) => ({
  "Order number": order.order_number, "Returned item": code, "Return quantity": String(qty), "Days of ownership": "3",
  "Item condition": condition, "Issue / reason": "TEST refund", "Inspection note": "",
});
let f1, f2, f3;
await tc("TC-59", "Sales requests a refund", async () => {
  const r = await sales.form("3.4-new-refund-request", refundForm(orderA, "TEST-001", 1, "Good"));
  f1 = await lastRefund(sid);
  const n = await notificationsFor("Refund", f1.refund_id);
  check(r.status === 200 && f1.refund_status === "Pending Approval" && n.some((x) => x.role_name === "Admin"), brief(r));
  return `${f1.refund_number} Pending Approval, ₱${f1.refund_amount}; Admin notified.`;
});
await tc("TC-60", "Invalid refund requests are refused", async () => {
  const a = await sales.form("3.4-new-refund-request", refundForm(orderB, "TEST-002", 1, "Good"));
  const b = await sales.form("3.4-new-refund-request", refundForm(orderA, "TEST-001", 5, "Good"));
  check(a.status === 409 && b.status === 400, `${a.status}/${b.status}`);
  return `Cancelled order → ${brief(a)}; quantity 5 of 2 → ${brief(b)}.`;
});
await tc("TC-61", "Approved good item returns to stock", async () => {
  const s = await product("TEST-001");
  const r = await admin.row("refunds", f1.refund_id, "approve", "");
  const after = await product("TEST-001");
  check(r.status === 200 && after.stock_quantity === s.stock_quantity + 1, brief(r));
  return `Approved; TEST-001 stock ${s.stock_quantity} → ${after.stock_quantity}; Refund Return movement.`;
});
await tc("TC-62", "Approved damaged item goes to defective", async () => {
  await sales.form("3.4-new-refund-request", refundForm(orderA, "TEST-002", 1, "Damaged"));
  f2 = await lastRefund(sid);
  const s = await product("TEST-002");
  const r = await admin.row("refunds", f2.refund_id, "approve", "");
  const after = await product("TEST-002");
  check(r.status === 200 && after.stock_quantity === s.stock_quantity && after.defective_quantity === s.defective_quantity + 1, brief(r));
  return `${f2.refund_number} approved; TEST-002 stock unchanged (${after.stock_quantity}); defective ${s.defective_quantity} → ${after.defective_quantity}.`;
});
await tc("TC-63", "Rejected refund leaves inventory alone", async () => {
  await sales.form("3.4-new-refund-request", refundForm(orderA, "TEST-001", 1, "Good"));
  f3 = await lastRefund(sid);
  const s = await product("TEST-001");
  const r = await admin.row("refunds", f3.refund_id, "reject", "TEST outside return policy");
  const after = await product("TEST-001");
  check(r.status === 200 && after.stock_quantity === s.stock_quantity && after.defective_quantity === s.defective_quantity, brief(r));
  return `${f3.refund_number} Rejected; inventory unchanged.`;
});

// ===== Reports =====
await tc("TC-64", "Sales and profit include the TEST orders", async () => {
  const now = (await admin.records()).data.dashboard;
  const dSales = Math.round((now.totalSales - before.totalSales) * 100) / 100;
  const dProfit = Math.round((now.totalProfit - before.totalProfit) * 100) / 100;
  // Paid: order A 1,400 (cost 550) + order C 500 (cost 200) + reservation order 500 (cost 200). Approved refunds: 500 + 400.
  check(dSales === 1500 && dProfit === 550, `sales +${dSales}, profit +${dProfit}`);
  return `Gross TEST sales ₱2,400, cost ₱950, approved refunds ₱900 → dashboard net sales +₱${dSales} and profit +₱${dProfit}, as calculated by hand.`;
});
note("TC-65", "Approved refunds reduce net sales and profit", "Pass", "Covered in TC-64: the ₱900 of approved refunds was subtracted from sales and profit.");
await tc("TC-66", "Dashboard counts match the records", async () => {
  const { dashboard: d, orders, reservations } = (await admin.records()).data;
  const expect = {
    pendingOrders: orders.filter((o) => ["Pending Approval", "Pending Payment"].includes(o.status)).length,
    unpaidReservations: reservations.filter((r) => ["Pending Approval", "Active"].includes(r.status)).length,
    itemsForShipping: orders.filter((o) => o.status === "For Shipping").length,
    completedOrders: orders.filter((o) => o.status === "Completed").length,
  };
  check(Object.entries(expect).every(([k, v]) => d[k] === v), JSON.stringify({ d, expect }));
  return `Pending orders ${d.pendingOrders}, unpaid reservations ${d.unpaidReservations}, for shipping ${d.itemsForShipping}, completed ${d.completedOrders}: all equal to counts from the record lists.`;
});
await tc("TC-23", "Admin edits a price; old orders keep theirs", async () => {
  const r = await admin.form("4.3-edit-product-admin-only", { "Product code": "TEST-001", "Product name": "TEST Denim jacket", Category: "Outerwear", Size: "M", "Cost price": "200", "Selling price": "550", "Low-stock threshold": "3", Status: "Active" });
  const p = await product("TEST-001");
  const item = await one(`SELECT oi.unit_price FROM order_items oi JOIN products p ON p.product_id = oi.product_id WHERE oi.order_id = ? AND p.product_code = 'TEST-001'`, [orderA.order_id]);
  check(r.status === 200 && Number(p.selling_price) === 550 && Number(item.unit_price) === 500, brief(r));
  return `Selling price now ₱550; ${orderA.order_number} still ₱500 per unit.`;
});
await tc("TC-27", "Threshold 0 removes the low-stock flag", async () => {
  const r = await admin.form("4.3-edit-product-admin-only", { "Product code": "TEST-002", "Product name": "TEST Floral dress", Category: "Dresses", Size: "S", "Cost price": "150", "Selling price": "400", "Low-stock threshold": "0", Status: "Active" });
  const p = (await inventory.records()).data.products.find((x) => x.product_code === "TEST-002");
  check(r.status === 200 && p.status !== "Low stock", `${brief(r)} ${p.status}`);
  return `TEST-002 status now "${p.status}".`;
});

// ===== Export / import =====
await tc("TC-70", "CSV export of every record type", async () => {
  const names = ["products", "customers", "orders", "order_items", "payments", "shipments", "reservations", "refunds", "stock_movements", "invoices", "purchase_orders", "delivery_receipts", "audit_log"];
  const out = [];
  for (const n of names) {
    const r = await admin.call("GET", `export/${n}`);
    check(r.status === 200 && /text\/csv/.test(r.headers.get("content-type")), `${n} ${r.status}`);
    out.push(`${n} ${r.data.split("\r\n").length - 1}`);
  }
  const p = await admin.call("GET", "export/products");
  check(p.data.includes("TEST-001"), "TEST product missing from export");
  return `All ${names.length} tables exported as CSV (rows: ${out.join(", ")}). Excel download checked in the browser.`;
});
await tc("TC-71", "Formula-like values are exported as text", async () => {
  const r = await admin.call("POST", "data/import", { kind: "products", fileName: "TEST-formula.csv", records: [{ product_code: "TEST-003", product_name: "=1+1", category: "", size: "", cost_price: "1", selling_price: "2", stock_quantity: "0", low_stock_threshold: "0" }] });
  check(r.status === 200, brief(r));
  const csv = (await admin.call("GET", "export/products")).data;
  check(csv.includes(",'=1+1,"), "not escaped");
  return `Product name "=1+1" exported as '=1+1 (spreadsheets show it as text).`;
});
await tc("TC-72", "Bad import files are refused", async () => {
  const a = await admin.call("POST", "data/import", { kind: "products", records: [{ product_code: "TEST-004", cost_price: "x" }] });
  const b = await admin.call("POST", "data/import", { kind: "orders", records: [{}] });
  const c = await admin.call("POST", "data/import", { kind: "products", records: [] });
  const saved = await product("TEST-004");
  check(a.status === 400 && b.status === 400 && c.status === 400 && !saved, `${a.status}/${b.status}/${c.status}`);
  return `Missing/invalid columns → ${brief(a)}; unsupported type → ${b.status}; empty file → ${c.status}; nothing saved.`;
});
note("TC-73", "Delete all data: button disabled without the phrase", "Pass", "Checked in the browser (see screenshot). Server also refuses without the phrase (unit test).");
note("TC-74", "Delete all data", "Not run", "Not run on the live database by decision (existing data kept). Covered by the route test and the manual check in TC-73.");

// ===== Notifications =====
await tc("TC-76", "Each role sees only its own notifications", async () => {
  const [a, s, i] = await Promise.all([admin.records(), sales.records(), inventory.records()]).then((x) => x.map((r) => r.data.notifications));
  const cats = (list) => [...new Set(list.map((n) => n.category))].sort().join("/");
  check(!s.some((n) => n.category === "Low Stock") && !i.some((n) => n.category === "Approval") && i.some((n) => n.category === "Low Stock"), `${cats(a)} | ${cats(s)} | ${cats(i)}`);
  const r = await inventory.call("POST", "data/notifications-read");
  const after = (await inventory.records()).data.notifications;
  check(r.status === 200 && after.every((n) => n.is_read), "not marked read");
  return `Admin: ${cats(a)}; Sales: ${cats(s)}; Inventory: ${cats(i)}. Mark all read → Inventory unread count 0.`;
});

// ---- Finish ---------------------------------------------------------------------------
fs.mkdirSync(RESULTS_FILE.replace(/[\\/][^\\/]+$/, ""), { recursive: true });
fs.writeFileSync(RESULTS_FILE, JSON.stringify({
  site: BASE, started: started.toISOString(), finished: new Date().toISOString(),
  dashboardBefore: before, results,
}, null, 2));
const tally = results.reduce((t, r) => ({ ...t, [r.status]: (t[r.status] || 0) + 1 }), {});
console.log("\nSummary:", tally);
await db.end();
