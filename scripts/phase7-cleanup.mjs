// Removes the records created by scripts/phase7-live-test.mjs and disables the temporary QA accounts.
// Only TEST products (code TEST-…), the TEST customers and records linked to them are deleted.
// QA accounts are disabled, not deleted, so the audit log keeps its history.
//
// Uses the DB_* environment variables. Run: node scripts/phase7-cleanup.mjs [--dry-run] [--free-names]

import { getPool } from "../api/_db.js";

const dryRun = process.argv.includes("--dry-run");
const TEST_PHONES = ["09990001001", "+639990001002"];
const QA_USERS = ["qa_admin", "qa_sales", "qa_inventory"];

const db = getPool();
const conn = await db.getConnection();
const ids = async (sql, params) => (await conn.query(sql, params))[0].map((row) => Object.values(row)[0]);
const list = (values) => (values.length ? values : [0]);

try {
  await conn.beginTransaction();
  const products = await ids(`SELECT product_id FROM products WHERE product_code LIKE 'TEST-%'`);
  const customers = await ids(`SELECT customer_id FROM customers WHERE contact_number IN (?)`, [TEST_PHONES]);
  const qaUsers = await ids(`SELECT user_id FROM users WHERE username IN (?)`, [QA_USERS]);
  const orders = await ids(`SELECT order_id FROM orders WHERE customer_id IN (?)`, [list(customers)]);
  const reservations = await ids(`SELECT reservation_id FROM reservations WHERE customer_id IN (?)`, [list(customers)]);
  const refunds = await ids(`SELECT refund_id FROM refunds WHERE order_id IN (?)`, [list(orders)]);
  console.log({ products, customers, orders, reservations, refunds, qaUsers });

  const steps = [
    [`DELETE FROM notifications WHERE (reference_type = 'Product' AND reference_id IN (?))
        OR (reference_type = 'Order' AND reference_id IN (?)) OR (reference_type = 'Reservation' AND reference_id IN (?))
        OR (reference_type = 'Refund' AND reference_id IN (?)) OR target_user_id IN (?)`,
      [list(products), list(orders), list(reservations), list(refunds), list(qaUsers)]],
    [`DELETE FROM stock_movements WHERE product_id IN (?)`, [list(products)]],
    [`DELETE FROM refund_items WHERE refund_id IN (?)`, [list(refunds)]],
    [`DELETE FROM refunds WHERE refund_id IN (?)`, [list(refunds)]],
    [`DELETE FROM delivery_receipts WHERE order_id IN (?)`, [list(orders)]],
    [`DELETE FROM shipments WHERE order_id IN (?)`, [list(orders)]],
    [`DELETE FROM invoices WHERE order_id IN (?)`, [list(orders)]],
    [`DELETE FROM purchase_orders WHERE order_id IN (?)`, [list(orders)]],
    [`DELETE FROM payments WHERE order_id IN (?)`, [list(orders)]],
    [`DELETE FROM order_items WHERE order_id IN (?)`, [list(orders)]],
    [`DELETE FROM orders WHERE order_id IN (?)`, [list(orders)]],
    [`DELETE FROM reservation_items WHERE reservation_id IN (?)`, [list(reservations)]],
    [`DELETE FROM reservations WHERE reservation_id IN (?)`, [list(reservations)]],
    [`DELETE FROM products WHERE product_id IN (?)`, [list(products)]],
    [`DELETE FROM customers WHERE customer_id IN (?)`, [list(customers)]],
    [`DELETE FROM import_batches WHERE file_name LIKE 'TEST-%' OR imported_by IN (?)`, [list(qaUsers)]],
    [`DELETE FROM password_resets WHERE user_id IN (?)`, [list(qaUsers)]],
    // Disabled with an unusable password; kept because the audit log references them.
    [`UPDATE users SET account_status = 'Disabled', password_hash = '!disabled-after-phase7-testing' WHERE user_id IN (?)`, [list(qaUsers)]],
    // --free-names: rename the disabled Sales/Inventory accounts so a new test run can create them again.
    ...(process.argv.includes("--free-names")
      ? [[`UPDATE users SET username = CONCAT(username, '_run', user_id) WHERE user_id IN (?) AND username IN ('qa_sales', 'qa_inventory')`, [list(qaUsers)]]]
      : []),
  ];
  for (const [sql, params] of steps) {
    const [result] = await conn.query(sql, params);
    console.log(`${sql.trim().split(/\s+/).slice(0, 3).join(" ")}: ${result.affectedRows}`);
  }
  if (dryRun) {
    await conn.rollback();
    console.log("Dry run: rolled back.");
  } else {
    await conn.commit();
    console.log("Cleanup committed.");
  }
} catch (error) {
  await conn.rollback();
  throw error;
} finally {
  conn.release();
  await db.end();
}
