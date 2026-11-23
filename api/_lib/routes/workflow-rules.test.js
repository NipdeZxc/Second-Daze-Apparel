import assert from "node:assert/strict";
import test from "node:test";
import { formActions, orderActions, refundActions, reservationActions } from "./data.js";

// Fake connection: `reads` maps a SQL fragment to the rows it returns; every other statement is recorded as a write.
function fakeConnection(reads) {
  const writes = [];
  return {
    writes,
    async query(sql, params) {
      const flat = sql.replace(/\s+/g, " ").trim();
      for (const [fragment, rows] of reads) {
        if (flat.includes(fragment)) return [typeof rows === "function" ? rows(params) : rows, []];
      }
      writes.push({ sql: flat, params });
      return [{ affectedRows: 1, insertId: 99 }, []];
    },
  };
}

const admin = { user_id: 1, role_name: "Admin" };
const sales = { user_id: 2, role_name: "Sales Management" };
const writesMatching = (conn, pattern) => conn.writes.filter((write) => pattern.test(write.sql));

test("verifying a payment deducts stock, records the sale, marks the order paid and issues an invoice (US-03, US-04)", async () => {
  const conn = fakeConnection([
    ["SELECT * FROM orders WHERE order_id", [{ order_id: 5, order_number: "ORD-1", order_status: "Pending Payment", reservation_id: null, created_by: 2 }]],
    ["SELECT payment_id FROM payments", [{ payment_id: 8 }]],
    ["SELECT product_id, quantity FROM order_items", [{ product_id: 3, quantity: 2 }]],
    ["SELECT * FROM products WHERE product_id", [{ product_id: 3, product_name: "Denim jacket", stock_quantity: 10, is_active: 1 }]],
    ["SELECT product_name, stock_quantity, low_stock_threshold", [{ product_name: "Denim jacket", stock_quantity: 8, low_stock_threshold: 2 }]],
    ["SELECT last_number FROM document_counters", [{ last_number: 4 }]],
  ]);

  await orderActions["verify-payment"](conn, admin, 5);

  const deduction = writesMatching(conn, /UPDATE products SET stock_quantity = stock_quantity - \?/);
  assert.deepEqual(deduction.map((write) => write.params), [[2, 3]]);
  const movement = writesMatching(conn, /INSERT INTO stock_movements/)[0];
  assert.deepEqual(movement.params.slice(0, 5), [3, "Sale", -2, "Order", 5]);
  assert.equal(writesMatching(conn, /UPDATE orders SET order_status = 'Paid'/).length, 1);
  assert.equal(writesMatching(conn, /UPDATE payments SET payment_status = 'Verified'/).length, 1);
  assert.deepEqual(writesMatching(conn, /INSERT INTO invoices/)[0].params, ["INV-" + new Date().getUTCFullYear() + "-00004", 5, 1]);
});

test("payment verification is refused when stock is insufficient and nothing is marked paid", async () => {
  const conn = fakeConnection([
    ["SELECT * FROM orders WHERE order_id", [{ order_id: 5, order_status: "Pending Payment", reservation_id: null }]],
    ["SELECT payment_id FROM payments", [{ payment_id: 8 }]],
    ["SELECT product_id, quantity FROM order_items", [{ product_id: 3, quantity: 5 }]],
    ["SELECT * FROM products WHERE product_id", [{ product_id: 3, product_name: "Denim jacket", stock_quantity: 1 }]],
  ]);

  await assert.rejects(orderActions["verify-payment"](conn, admin, 5), (error) => error.status === 409 && /Not enough stock/.test(error.message));
  assert.equal(writesMatching(conn, /UPDATE orders|UPDATE payments|INSERT INTO invoices/).length, 0);
});

test("a reused GCash reference number is rejected (3.3)", async () => {
  const conn = fakeConnection([
    ["SELECT * FROM orders WHERE order_id", [{ order_id: 5, order_status: "Pending Payment" }]],
    ["SELECT 1 FROM payments", []],
    ["SELECT COALESCE(SUM(quantity * unit_price)", [{ total: 500 }]],
  ]);
  conn.query = ((original) => async (sql, params) => {
    if (sql.includes("INSERT INTO payments")) throw Object.assign(new Error("duplicate"), { code: "ER_DUP_ENTRY" });
    return original(sql, params);
  })(conn.query);

  await assert.rejects(orderActions["record-payment"](conn, sales, 5, "1234567890"), (error) => error.status === 409 && /already used/.test(error.message));
});

test("an order cannot ship until the customer's information is verified (3.1)", async () => {
  const conn = fakeConnection([
    ["SELECT * FROM orders WHERE order_id", [{ order_id: 5, order_status: "Packed", customer_id: 4 }]],
    ["SELECT info_verified FROM customers", [{ info_verified: 0 }]],
  ]);

  await assert.rejects(orderActions.ship(conn, sales, 5, "JT123"), (error) => error.status === 409 && /Verify the customer/.test(error.message));
  assert.equal(writesMatching(conn, /INSERT INTO shipments|UPDATE orders/).length, 0);
});

test("approving a reservation holds stock for the agreed days (4.1, 4.2)", async () => {
  const conn = fakeConnection([
    ["SELECT * FROM reservations WHERE reservation_id", [{ reservation_id: 7, reservation_number: "RES-1", reservation_status: "Pending Approval", reservation_days: 3, created_by: 2 }]],
    ["SELECT product_id, quantity FROM reservation_items", [{ product_id: 3, quantity: 2 }]],
    ["SELECT * FROM products WHERE product_id", [{ product_id: 3, product_name: "Denim jacket", stock_quantity: 10, is_active: 1 }]],
    ["SELECT product_name, stock_quantity, low_stock_threshold", [{ product_name: "Denim jacket", stock_quantity: 8, low_stock_threshold: 2 }]],
  ]);
  const before = Date.now();

  await reservationActions.approve(conn, admin, 7);

  assert.deepEqual(writesMatching(conn, /reserved_quantity = reserved_quantity \+ \?/)[0].params, [2, 2, 3]);
  assert.deepEqual(writesMatching(conn, /INSERT INTO stock_movements/)[0].params.slice(0, 5), [3, "Reservation Hold", -2, "Reservation", 7]);
  const [, , expiry] = writesMatching(conn, /SET reservation_status = 'Active'/)[0].params;
  const days = (expiry.getTime() - before) / 86400000;
  assert.ok(days >= 2.99 && days <= 3.01, `expiry should be 3 days ahead, got ${days}`);
});

test("a newly created product can be requested for reservation and is held only after approval", async () => {
  const product = { product_id: 99, product_name: "Denim jacket", product_code: "P-NEW", is_active: 1, stock_quantity: 10, selling_price: 500 };
  const conn = fakeConnection([
    ["SELECT 1 FROM products WHERE product_code", []],
    ["SELECT customer_id, full_name FROM customers", [{ customer_id: 4, full_name: "Test Customer" }]],
    ["SELECT * FROM products WHERE is_active", [product]],
    ["SELECT last_number FROM document_counters", [{ last_number: 1 }]],
    ["SELECT * FROM reservations WHERE reservation_id", [{ reservation_id: 99, reservation_number: "RES-NEW", reservation_status: "Pending Approval", reservation_days: 3, created_by: 2 }]],
    ["SELECT product_id, quantity FROM reservation_items", [{ product_id: 99, quantity: 2 }]],
    ["SELECT * FROM products WHERE product_id", [product]],
    ["SELECT product_name, stock_quantity, low_stock_threshold", [{ ...product, low_stock_threshold: 1 }]],
  ]);
  await formActions["4.4-add-product"](conn, { user_id: 3, role_name: "Inventory Management" }, {
    "Product code": "P-NEW", "Product name": product.product_name, Category: "Outerwear", Size: "M",
    "Cost price": "200", "Selling price": "500", "Starting stock": "10", "Low-stock threshold": "1",
  });
  await formActions["5.1-new-reservation"](conn, sales, { Customer: "Test Customer", Product: "P-NEW", Quantity: "2", "Agreed days": "3" });
  assert.deepEqual(writesMatching(conn, /INSERT INTO reservation_items/)[0].params, [99, 99, 2, 500]);
  assert.equal(writesMatching(conn, /UPDATE products/).length, 0, "Pending requests do not reserve stock");
  await reservationActions.approve(conn, admin, 99);
  assert.deepEqual(writesMatching(conn, /reserved_quantity = reserved_quantity \+ \?/)[0].params, [2, 2, 99]);
});

test("cancelling a converted unpaid order releases its reservation hold exactly once", async () => {
  const order = { order_id: 5, order_status: "Pending Payment", reservation_id: 7 };
  const conn = fakeConnection([
    ["SELECT * FROM orders WHERE order_id", [order]],
    ["SELECT * FROM reservations WHERE reservation_id", [{ reservation_id: 7, reservation_status: "Active" }]],
    ["FROM reservation_items", [{ product_id: 3, quantity: 2 }]],
    ["FROM stock_movements", [{ product_id: 3, held_quantity: 2 }]],
    ["FROM products WHERE product_id", [{ product_id: 3, reserved_quantity: 2 }]],
  ]);
  await orderActions.cancel(conn, sales, 5);
  assert.deepEqual(writesMatching(conn, /reserved_quantity = reserved_quantity - \?/)[0].params, [2, 2, 3]);
  assert.deepEqual(writesMatching(conn, /INSERT INTO stock_movements/)[0].params.slice(0, 5), [3, "Reservation Release", 2, "Reservation", 7]);
  assert.equal(writesMatching(conn, /SET reservation_status = 'Cancelled'/).length, 1);
  order.order_status = "Cancelled";
  const count = conn.writes.length;
  await assert.rejects(orderActions.cancel(conn, sales, 5), (error) => error.status === 409);
  assert.equal(conn.writes.length, count);
});

test("refund approval returns non-defective items to stock and keeps defective items out (4.5)", async () => {
  const conn = fakeConnection([
    ["SELECT * FROM refunds WHERE refund_id", [{ refund_id: 9, refund_number: "RFD-1", refund_status: "Pending Approval", requested_by: 2 }]],
    ["FROM refund_items ri", [
      { product_id: 3, quantity: 1, is_defective: 0 },
      { product_id: 4, quantity: 2, is_defective: 1 },
    ]],
    ["SELECT * FROM products WHERE product_id", [{ product_id: 3 }]],
  ]);

  await refundActions.approve(conn, admin, 9, "");

  assert.deepEqual(writesMatching(conn, /SET stock_quantity = stock_quantity \+ \?/).map((write) => write.params), [[1, 3]]);
  assert.deepEqual(writesMatching(conn, /SET defective_quantity = defective_quantity \+ \?/).map((write) => write.params), [[2, 4]]);
  const movements = writesMatching(conn, /INSERT INTO stock_movements/).map((write) => write.params.slice(0, 3));
  assert.deepEqual(movements, [[3, "Refund Return", 1], [4, "Refund Defective", 0]]);
});

test("a rejected refund leaves inventory unchanged", async () => {
  const conn = fakeConnection([
    ["SELECT * FROM refunds WHERE refund_id", [{ refund_id: 9, refund_number: "RFD-1", refund_status: "Pending Approval", requested_by: 2 }]],
  ]);

  await refundActions.reject(conn, admin, 9, "Item was worn");

  assert.equal(writesMatching(conn, /UPDATE products|INSERT INTO stock_movements/).length, 0);
  assert.equal(writesMatching(conn, /UPDATE refunds SET refund_status/)[0].params[0], "Rejected");
});

test("the new customer form rejects invalid mobile numbers and incomplete addresses (3.1)", async () => {
  const conn = fakeConnection([["SELECT 1 FROM customers", []]]);
  const valid = { "Full name": "Ana Cruz", "Contact number": "09171234567", Address: "1 Mabini St", Barangay: "San Roque", City: "Marikina", Province: "Metro Manila" };

  await assert.rejects(formActions["3.12-new-customer-validation"](conn, sales, { ...valid, "Contact number": "12345" }), (error) => error.status === 400);
  await assert.rejects(formActions["3.12-new-customer-validation"](conn, sales, { ...valid, City: "" }), (error) => error.status === 400);
  assert.equal(conn.writes.length, 0);

  await formActions["3.12-new-customer-validation"](conn, sales, valid);
  assert.equal(writesMatching(conn, /INSERT INTO customers/).length, 1);
});

test("a returned parcel records the reason and requires the customer to be re-verified (3.5)", async () => {
  const conn = fakeConnection([
    ["SELECT * FROM orders WHERE order_number", [{ order_id: 5, order_status: "Shipped", customer_id: 4 }]],
    ["SELECT * FROM shipments WHERE order_id", [{ shipment_id: 6 }]],
  ]);

  await formActions["3.14-confirm-delivery"](conn, sales, { "Order number": "ORD-1", "Delivery status": "Returned to sender" });

  assert.deepEqual(writesMatching(conn, /SET shipment_status = 'Returned'/)[0].params.slice(0, 1), ["Returned to sender"]);
  assert.equal(writesMatching(conn, /returned_parcels = returned_parcels \+ 1, info_verified = 0/).length, 1);
  assert.equal(writesMatching(conn, /INSERT INTO delivery_receipts/).length, 0);
});

test("add product saves the product and its starting stock; duplicates and Sales users are refused (US-02, 2.1)", async () => {
  const inventory = { user_id: 3, role_name: "Inventory Management" };
  const values = { "Product code": "P-1", "Product name": "Denim jacket", Category: "Outerwear", Size: "M", "Cost price": "200", "Selling price": "500", "Starting stock": "10", "Low-stock threshold": "3" };
  const conn = fakeConnection([
    ["SELECT 1 FROM products WHERE product_code", (params) => (params[0] === "P-DUP" ? [{ 1: 1 }] : [])],
    ["SELECT product_name, stock_quantity, low_stock_threshold", [{ product_name: "Denim jacket", stock_quantity: 10, low_stock_threshold: 3 }]],
  ]);

  await formActions["4.4-add-product"](conn, inventory, values);
  assert.equal(writesMatching(conn, /INSERT INTO products/)[0].params[0], "P-1");
  assert.deepEqual(writesMatching(conn, /INSERT INTO stock_movements/)[0].params.slice(0, 4), [99, "Stock In", 10, "Manual"]);

  const before = conn.writes.length;
  await assert.rejects(formActions["4.4-add-product"](conn, inventory, { ...values, "Product code": "P-DUP" }), (error) => error.status === 409);
  await assert.rejects(formActions["4.4-add-product"](conn, inventory, { ...values, "Selling price": "-1" }), (error) => error.status === 400);
  await assert.rejects(formActions["4.4-add-product"](conn, sales, values), (error) => error.status === 403);
  assert.equal(conn.writes.length, before);
});