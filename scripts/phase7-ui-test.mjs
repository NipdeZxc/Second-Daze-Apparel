// Phase 7 browser checks: TC-13, 14, 43, 67, 68, 77, 78, 79 (and screenshots when SHOT_DIR is set).
// Run after scripts/phase7-live-test.mjs, which creates the QA accounts and TEST orders.
//   PLAYWRIGHT_DIR  folder whose node_modules contains playwright-core (kept outside the repo)
//   BASE_URL        site to test, e.g. https://second-daze-apparel.vercel.app
//   QA_CREDS_FILE   JSON written by phase7-live-test.mjs: { qa_sales: "...", qa_inventory: "..." }
//   QA_ADMIN_PASSWORD  the qa_admin password used for the test run
//   BROWSER_PATH    optional Chromium/Edge executable
//   SHOT_DIR        optional folder for screenshots
//   UI_RESULTS_FILE optional output JSON
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(`${process.env.PLAYWRIGHT_DIR}/`);
const { chromium } = require("playwright-core");
const base = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const creds = JSON.parse(fs.readFileSync(process.env.QA_CREDS_FILE, "utf8"));
if (process.env.QA_ADMIN_PASSWORD) creds.qa_admin = process.env.QA_ADMIN_PASSWORD;
const shotDir = process.env.SHOT_DIR;
const results = [];

const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
});

async function session(user, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/");
  if (user) await login(page, user);
  errors.length = 0; // the signed-out session check and any retried sign-in log expected 401s
  return { context, page, errors };
}

// The first attempt can be lost while the app is still checking for an existing session, so retry.
async function login(page, user) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.waitForSelector('input[type="password"]', { timeout: 15000 });
    await page.fill('input[type="text"], input[name="username"]', user);
    await page.fill('input[type="password"]', creds[user]);
    await page.click('button[type="submit"]');
    try {
      await page.waitForFunction(() => !document.querySelector('input[type="password"]'), null, { timeout: 8000 });
      await page.waitForTimeout(1200);
      return;
    } catch { /* try again */ }
  }
  throw new Error(`Could not sign in as ${user}`);
}

const go = async (page, screen) => {
  await page.evaluate((id) => { location.hash = `#/${id}`; }, screen);
  await page.waitForTimeout(1500);
  return page.evaluate(() => location.hash);
};
const shot = (page, name) => shotDir && page.screenshot({ path: `${shotDir}/${name}.png` });
const record = (id, title, status, actual) => {
  results.push({ id, title, status, actual });
  console.log(`${id} ${title} ... ${status}`);
};
async function check(id, title, work) {
  try {
    const [ok, actual] = await work();
    record(id, title, ok ? "Pass" : "Fail", actual);
  } catch (error) {
    record(id, title, "Fail", `Error: ${error.message}`);
  }
}

await check("TC-13", "Sales cannot open Admin screens by URL", async () => {
  const { context, page } = await session("qa_sales");
  const out = [];
  for (const screen of ["2.1-subaccounts", "2.7-csv-import", "2.9-data-export", "7-staff-accounts"]) {
    out.push(`${screen} → ${await go(page, screen)}`);
  }
  await shot(page, "30-sales-home");
  await context.close();
  return [out.every((line) => line.endsWith("#/3-sales-dashboard")), `Redirected: ${out.join("; ")}`];
});

await check("TC-14", "Inventory cannot open customer/order/reservation screens by URL", async () => {
  const { context, page } = await session("qa_inventory");
  const out = [];
  for (const screen of ["3.11-customers", "3.9-orders-status-tracking", "5-reservations", "3.13-create-purchase-order"]) {
    out.push(`${screen} → ${await go(page, screen)}`);
  }
  await shot(page, "40-inventory-home");
  await context.close();
  return [out.every((line) => line.endsWith("#/4-inventory-dashboard")), `Redirected: ${out.join("; ")}`];
});

await check("TC-43", "Print for packer", async () => {
  const { context, page } = await session("qa_sales");
  await go(page, "3.9-orders-status-tracking");
  const row = page.locator("tr", { hasText: "TEST Ana" }).first();
  await row.getByRole("button", { name: "View" }).click();
  await shot(page, "17-order-detail");
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.getByRole("button", { name: "Print for packer" }).click()]);
  await popup.waitForLoadState();
  await popup.waitForTimeout(800);
  const text = await popup.evaluate(() => document.body.innerText);
  await shot(popup, "17b-print-for-packer");
  await context.close();
  const found = ["TEST Ana", "TEST-001"].every((part) => text.includes(part));
  return [found, `Print page (opened by Sales) shows ${["TEST Ana Cruz", "123 Test St.", "TEST-001", "TEST-002"].filter((part) => text.includes(part)).join(", ")}; quantities: ${/\b\d+\b/.test(text) ? "shown" : "missing"}.`];
});

const reportAdmin = await session("qa_admin");
await check("TC-67", "Reports weekly view", async () => {
  const { page } = reportAdmin;
  await go(page, "2.6-reports");
  const period = (await page.locator(".report-period").innerText()).trim();
  const weekly = await page.locator(".report-grid").innerText();
  await shot(page, "22b-reports-weekly");
  await page.locator(".report-view select").selectOption("all");
  await page.waitForTimeout(500);
  const all = await page.locator(".report-grid").innerText();
  await shot(page, "22c-reports-all-time");
  return [/Friday review/.test(period) && weekly !== all, `${period}. Switching Friday review week → All-time changes the totals (${weekly !== all ? "different" : "same"}).`];
});

await check("TC-68", "Sales, Financial, Order and Stock reports load", async () => {
  const { page, errors } = reportAdmin;
  await go(page, "2.6-reports");
  const out = [];
  for (const tab of ["Sales", "Financial", "Orders", "Stock"]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await page.waitForTimeout(400);
    const cards = await page.locator(".report-card").count();
    out.push(`${tab}: ${cards ? "loaded" : "empty"}`);
    await shot(page, `22-report-${tab.toLowerCase()}`);
  }
  return [out.every((line) => line.endsWith("loaded")) && errors.length === 0, `${out.join("; ")}; browser console errors: ${errors.length}${errors.length ? ` (${errors.join(" | ").slice(0, 300)})` : ""}.`];
});
await reportAdmin.context.close();

await check("TC-77", "No quotation wording, no pickup fields", async () => {
  const { context, page } = await session("qa_sales");
  const bad = [];
  for (const screen of ["3.3-sales-documents", "5-reservations", "5.1-new-reservation", "3.13-create-purchase-order", "3-sales-catalog"]) {
    await go(page, screen);
    const text = await page.evaluate(() => document.body.innerText);
    if (/quotation/i.test(text)) bad.push(`${screen}: quotation`);
    if (/pick-?up/i.test(text)) bad.push(`${screen}: pickup`);
  }
  await context.close();
  return [!bad.length, bad.length ? bad.join("; ") : 'Checked Sales documents, Reservations, New reservation, New purchase order and Catalog: no "quotation", no pickup fields.'];
});

await check("TC-78", "375 px layout", async () => {
  const out = [];
  let allFit = true;
  const phone = { width: 375, height: 812 };
  for (const [user, screens] of [
    ["qa_admin", ["2-admin-dashboard", "3.9-orders-status-tracking"]],
    ["qa_sales", ["3-sales-dashboard", "3.13-create-purchase-order", "5.1-new-reservation"]],
    ["qa_inventory", ["4-inventory-dashboard", "4-inventory-workspace"]],
  ]) {
    const { context, page } = await session(user, phone);
    for (const screen of screens) {
      await go(page, screen);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      if (width > 375) allFit = false;
      out.push(`${user} ${screen}: page width ${width}/375`);
    }
    await context.close();
  }
  return [allFit, `Edge 375×812 emulation: ${out.join("; ")}. Wide tables scroll inside their own box. Real-phone check still to do by the team.`];
});

await check("TC-79", "/mobile opens the same app", async () => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await page.goto(`${base}/mobile`);
  await page.waitForSelector('input[type="password"]', { timeout: 15000 });
  const hashBefore = await page.evaluate(() => location.hash);
  await login(page, "qa_sales");
  const hashAfter = await page.evaluate(() => location.hash);
  await context.close();
  return [hashBefore === "" && hashAfter === "#/3-sales-dashboard", `/mobile → sign-in form (${hashBefore ? hashBefore : "no hash"}); after sign-in as Sales → ${hashAfter}.`];
});

if (process.env.UI_RESULTS_FILE) fs.writeFileSync(process.env.UI_RESULTS_FILE, JSON.stringify(results, null, 2));
console.log("Summary:", results.reduce((sum, r) => ({ ...sum, [r.status]: (sum[r.status] || 0) + 1 }), {}));
process.exit(results.some((r) => r.status !== "Pass") ? 1 : 0);
