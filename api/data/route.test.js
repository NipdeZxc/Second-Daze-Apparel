import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import handler, { normalizeDataRouteUrl } from "./[...route].js";
import apiHandler, { routes } from "../[...route].js";
import { importProductRow, restockLabel } from "../_lib/routes/data.js";

function fakeConnection(existingProducts = [], insertId = 12) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      if (sql.includes("SELECT product_id FROM products WHERE product_code = ? FOR UPDATE")) {
        return [existingProducts, []];
      }
      if (sql.includes("INSERT INTO products")) return [{ insertId }, []];
      return [{ affectedRows: 1 }, []];
    },
  };
}

// The deployed site returned Vercel's own 404 for /api/users/:id/approve and /api/data/:kind/:id/:action
// because a [...route] file there matches exactly one segment. Every route needs a file that serves it.
test("every API route has a Vercel function file that serves its path", () => {
  const apiDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const files = [];
  (function walk(dir, prefix) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), [...prefix, entry.name]);
      else if (entry.name.endsWith(".js") && !entry.name.endsWith(".test.js")) {
        const name = entry.name.slice(0, -3);
        files.push(name === "index" ? prefix : [...prefix, name]);
      }
    }
  })(apiDir, []);
  const serves = (file, segments) => file.length === segments.length
    && file.every((part, i) => part.startsWith("[") || part === segments[i]);
  const missing = routes
    .map(([method, pattern]) => [method, pattern.split("/").map((part) => (part.startsWith(":") ? "1" : part))])
    .filter(([, segments]) => !files.some((file) => serves(file, segments)))
    .map(([method, segments]) => `${method} /api/${segments.join("/")}`);
  assert.deepEqual(missing, []);
});

test("nested API route preserves full Vercel request paths", () => {
  assert.equal(normalizeDataRouteUrl("/api/data/records?fresh=1"), "/api/data/records?fresh=1");
});

test("nested API route restores prefixes stripped by the serverless runtime", () => {
  assert.equal(normalizeDataRouteUrl("/data/records"), "/api/data/records");
  assert.equal(normalizeDataRouteUrl("/records"), "/api/data/records");
});

test("nested workspace route reaches authentication instead of returning not found", async () => {
  const req = { url: "/records", method: "GET", headers: {} };
  const res = {
    statusCode: 0,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader() {
      return this;
    },
    json(body) {
      this.body = body;
    },
  };

  await handler(req, res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Please log in." });
});

test("dataset batch import route is registered and requires an authenticated admin", async () => {
  const req = { url: "/api/data/import-batch", method: "POST", headers: {}, body: { files: [] } };
  const res = {
    statusCode: 0,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader() {
      return this;
    },
    json(body) {
      this.body = body;
    },
  };

  await apiHandler(req, res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Please log in." });
});

test("record deletion route requires an authenticated admin", async () => {
  const req = { url: "/api/data/products/10", method: "DELETE", headers: {} };
  const res = {
    statusCode: 0,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader() {
      return this;
    },
    json(body) {
      this.body = body;
    },
  };

  await apiHandler(req, res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Please log in." });
});

test("delete-all route requires an authenticated admin", async () => {
  const req = { url: "/api/data/delete-all", method: "POST", headers: {}, body: { confirm: "DELETE ALL DATA" } };
  const res = {
    statusCode: 0,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader() {
      return this;
    },
    json(body) {
      this.body = body;
    },
  };

  await apiHandler(req, res);

  assert.equal(res.statusCode, 401);
});

test("CSV import adds stock to an existing product and records the stock movement", async () => {
  const conn = fakeConnection([{ product_id: 7 }]);
  const admin = { user_id: 4 };
  const product = {
    product_code: "SKU-7", product_name: "Shirt", category: "Tops", size: "M",
    cost_price: 10, selling_price: 20, stock_quantity: 5, low_stock_threshold: 2,
  };

  const outcome = await importProductRow(conn, admin, product, "restock.csv");

  assert.equal(outcome, "existing");
  assert.equal(conn.calls.length, 3);
  assert.match(conn.calls[1].sql, /SET stock_quantity = stock_quantity \+ \?, updated_by = \?/);
  assert.deepEqual(conn.calls[1].params, [5, 4, 7]);
  assert.match(conn.calls[2].sql, /INSERT INTO stock_movements/);
  assert.deepEqual(conn.calls[2].params, [7, "Stock In", 5, "Import", null, "restock.csv", 4]);
});

test("CSV import of zero stock does not create a stock movement for an existing product", async () => {
  const conn = fakeConnection([{ product_id: 7 }]);
  const outcome = await importProductRow(conn, { user_id: 4 }, {
    product_code: "SKU-7", stock_quantity: 0,
  }, "zero-stock.csv");

  assert.equal(outcome, "existing");
  assert.equal(conn.calls.length, 1);
});

test("CSV import creates new products and records their initial stock", async () => {
  const conn = fakeConnection();
  const admin = { user_id: 4 };
  const product = {
    product_code: "SKU-8", product_name: "Dress", category: null, size: null,
    cost_price: 12, selling_price: 24, stock_quantity: 3, low_stock_threshold: 2,
  };

  const outcome = await importProductRow(conn, admin, product, "new-products.csv");

  assert.equal(outcome, "created");
  assert.match(conn.calls[1].sql, /INSERT INTO products/);
  assert.deepEqual(conn.calls[1].params, ["SKU-8", "Dress", null, null, 12, 24, 3, 2, 4]);
  assert.deepEqual(conn.calls[2].params, [12, "Stock In", 3, "Import", null, "new-products.csv", 4]);
});


test("re-importing the same restock file is rejected, even when renamed", async () => {
  const records = [{ product_code: "SKU-7", stock_quantity: "5" }, { product_code: "SKU-8", stock_quantity: "3" }];
  let tag;
  const first = { async query() { return [[]]; } };
  tag = (await restockLabel(first, records, "restock.csv")).split(" ").pop();
  assert.match(tag, /^\[#[0-9a-f]{16}\]$/);

  const seen = { async query(sql, params) { return [params[0] === `%${tag}` ? [{ 1: 1 }] : []]; } };
  await assert.rejects(
    restockLabel(seen, [...records].reverse(), "renamed.csv"),
    (error) => error.status === 409 && /already imported/.test(error.message)
  );
  const changed = [{ product_code: "SKU-7", stock_quantity: "6" }, records[1]];
  assert.match(await restockLabel(seen, changed, "restock.csv"), /^restock\.csv \[#/);
});
test("Inventory users cannot submit sales form actions or see customer contact details", async () => {
  const { getPool } = await import("../_db.js");
  const { setSession } = await import("../_lib/auth.js");
  process.env.SESSION_SECRET = "x".repeat(32);
  const inventoryUser = { user_id: 3, role_id: 3, role_name: "Inventory Management", account_status: "Active", password_hash: "h", must_change_password: 0 };
  let cookie = "";
  setSession({ setHeader: (_name, value) => { cookie = value.split(";")[0]; } }, inventoryUser);
  const pool = getPool();
  const originalQuery = pool.query;
  pool.query = async (sql) => {
    if (sql.includes("FROM users u JOIN roles")) return [[inventoryUser], []];
    if (sql.includes("FROM customers c ORDER BY")) return [[{ id: 1, full_name: "Ana", contact_number: "09123456789", info_verified: 1 }], []];
    if (sql.includes("FROM orders o JOIN customers")) return [[{ id: 1, order_number: "ORD-1", status: "Paid", contact_number: "09123456789", address: "Manila" }], []];
    return [[], []];
  };
  const call = async (method, url, body = {}) => {
    const res = { statusCode: 0, status(code) { this.statusCode = code; return this; }, setHeader() { return this; }, json(data) { this.body = data; } };
    await apiHandler({ url, method, headers: { cookie }, body }, res);
    return res;
  };
  try {
    const form = await call("POST", "/api/data/actions", { screenId: "3.14-confirm-delivery", values: {} });
    assert.equal(form.statusCode, 403);
    const records = await call("GET", "/api/data/records");
    assert.equal(records.statusCode, 200);
    assert.deepEqual(records.body.customers, []);
    assert.equal(records.body.orders[0].contact_number, undefined);
    assert.equal(records.body.orders[0].address, undefined);
  } finally {
    pool.query = originalQuery;
    delete process.env.SESSION_SECRET;
  }
});
