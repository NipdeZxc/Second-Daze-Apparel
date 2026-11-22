import assert from "node:assert/strict";
import test from "node:test";
import handler, { normalizeDataRouteUrl } from "./[...route].js";
import apiHandler from "../[...route].js";
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