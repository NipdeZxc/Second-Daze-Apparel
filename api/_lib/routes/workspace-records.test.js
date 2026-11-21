import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import mysql from "mysql2/promise";
import { setSession } from "../auth.js";
import { getRecords } from "./data.js";

test("workspace loading uses a TiDB-compatible latest-payment join and preserves unpaid orders", async (t) => {
  const previousSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
  const user = {
    user_id: 1, role_id: 1, role_name: "Admin", account_status: "Active",
    password_hash: "test-session-fingerprint", must_change_password: 0,
  };
  let queriedOrders = false;
  t.mock.method(mysql, "createPool", () => ({
    async query(sql) {
      if (sql.includes("SELECT u.*, r.role_name")) return [[user]];
      if (sql.includes("FROM orders o JOIN customers")) {
        queriedOrders = true;
        if (/ON\s+pay\.payment_id\s*=\s*\(\s*SELECT/i.test(sql)) {
          throw new Error("ON condition doesn't support subqueries yet");
        }
        assert.match(sql, /MAX\(payment_id\).*FROM payments GROUP BY order_id/);
        return [[
          { id: 1, order_number: "ORD-1", status: "Pending Payment", ordered_at: "2025-01-01", total_amount: "25", cost: "10", payment_status: null },
          { id: 2, order_number: "ORD-2", status: "Paid", ordered_at: "2025-01-02", total_amount: "50", cost: "20", payment_status: "Verified" },
        ]];
      }
      if (sql.includes("FROM reservations r JOIN customers")) {
        assert.match(sql, /r\.payment_status/);
        return [[
          { id: 1, status: "Active", payment_status: "Unpaid" },
          { id: 2, status: "Active", payment_status: "Paid" },
        ]];
      }
      if (sql.includes("FROM order_items oi JOIN orders o")) return [[{ item_count: 3 }]];
      return [[]];
    },
  }));

  try {
    let cookie;
    setSession({ setHeader(name, value) { cookie = value.split(";")[0]; } }, user);
    const res = {
      status(code) { this.statusCode = code; return this; },
      setHeader() { return this; },
      json(body) { this.body = body; },
    };
    await getRecords({ headers: { cookie } }, res);

    assert.equal(queriedOrders, true);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.orders.length, 2);
    assert.equal(res.body.orders[0].payment_status, "Unpaid");
    assert.equal(res.body.orders[1].payment_status, "Verified");
    assert.equal(res.body.sales.length, 1);
    assert.equal(res.body.dashboard.unpaidReservations, 1);
    assert.equal(res.body.dashboard.itemsForShipping, 3);
    assert.deepEqual(res.body.dashboard, {
      totalSales: 50,
      totalProfit: 30,
      pendingOrders: 1,
      unpaidReservations: 0,
      itemsForShipping: 0,
      completedOrders: 0,
    });
  } finally {
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
  }
});
