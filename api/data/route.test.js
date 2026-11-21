import assert from "node:assert/strict";
import test from "node:test";
import handler, { normalizeDataRouteUrl } from "./[...route].js";
import apiHandler from "../[...route].js";

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
