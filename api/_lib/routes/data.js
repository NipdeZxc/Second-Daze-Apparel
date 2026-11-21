import { getPool } from "../../_db.js";
import { HttpError, parseId, requireFields, sendJson } from "../http.js";
import { audit, requireRole, requireUser } from "../auth.js";

const ADMIN = "Admin";
const SALES = "Sales Management";
const INVENTORY = "Inventory Management";
const PAID_STATUSES = ["Paid", "Packed", "For Shipping", "Shipped", "Delivered", "Completed"];
const CONTACT_PATTERN = /^(09|\+639)[0-9]{9}$/;
const MAX_IMPORT_ROWS = 5000;

const num = (value) => Number(value ?? 0);
const text = (value) => (typeof value === "string" ? value.trim() : "");

export async function withTransaction(work) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function nextDocumentNumber(conn, type) {
  const year = new Date().getUTCFullYear();
  await conn.query(
    `INSERT INTO document_counters (doc_type, doc_year, last_number) VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE last_number = last_number + 1`,
    [type, year]
  );
  const [rows] = await conn.query(
    `SELECT last_number FROM document_counters WHERE doc_type = ? AND doc_year = ?`,
    [type, year]
  );
  return `${type}-${year}-${String(rows[0].last_number).padStart(5, "0")}`;
}

export async function notify(conn, { role = null, userId = null, category, message, refType = null, refId = null }) {
  await conn.query(
    `INSERT INTO notifications (target_role_id, target_user_id, category, message, reference_type, reference_id)
     VALUES ((SELECT role_id FROM roles WHERE role_name = ?), ?, ?, ?, ?, ?)`,
    [role, userId, category, message.slice(0, 255), refType, refId]
  );
}

async function moveStock(conn, { productId, type, change, refType, refId, remarks = null, userId }) {
  await conn.query(
    `INSERT INTO stock_movements (product_id, movement_type, quantity_change, reference_type, reference_id, remarks, performed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [productId, type, change, refType, refId, remarks, userId]
  );
}

async function notifyIfLow(conn, productId) {
  const [rows] = await conn.query(
    `SELECT product_name, stock_quantity, low_stock_threshold FROM products WHERE product_id = ?`,
    [productId]
  );
  const product = rows[0];
  if (product && product.stock_quantity <= product.low_stock_threshold) {
    await notify(conn, {
      role: INVENTORY,
      category: "Low Stock",
      message: `${product.product_name} is low on stock (${product.stock_quantity} left).`,
      refType: "Product",
      refId: productId,
    });
  }
}

// Releases the hold of reservations whose agreed days have passed without an order.
export async function voidExpiredReservations() {
  const db = getPool();
  const [due] = await db.query(
    `SELECT r.reservation_id FROM reservations r
      WHERE r.reservation_status = 'Active' AND r.expiry_date < ?
        AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.reservation_id = r.reservation_id)`,
    [new Date()]
  );
  for (const { reservation_id: id } of due) {
    await withTransaction(async (conn) => {
      const [rows] = await conn.query(
        `SELECT reservation_status, created_by FROM reservations WHERE reservation_id = ? FOR UPDATE`,
        [id]
      );
      if (rows[0]?.reservation_status !== "Active") return;
      const released = await releaseReservationStock(conn, id, null, "Reservation expired");
      await conn.query(
        `UPDATE reservations SET reservation_status = 'Voided', voided_at = ?, void_reason = 'Expired' WHERE reservation_id = ?`,
        [new Date(), id]
      );
      await notify(conn, {
        userId: rows[0].created_by,
        category: "Reservation",
        message: released
          ? "A reservation expired and its stock was released."
          : "A historical reservation expired without a recorded stock hold. Inventory was left unchanged.",
        refType: "Reservation",
        refId: id,
      });
    });
  }
}

export async function releaseReservationStock(conn, reservationId, userId, remarks) {
  const [items] = await conn.query(
    `SELECT product_id, SUM(quantity) AS quantity FROM reservation_items
      WHERE reservation_id = ? GROUP BY product_id ORDER BY product_id`,
    [reservationId]
  );
  const [holds] = await conn.query(
    `SELECT product_id, -SUM(quantity_change) AS held_quantity FROM stock_movements
      WHERE reference_type = 'Reservation' AND reference_id = ?
        AND movement_type IN ('Reservation Hold', 'Reservation Release')
      GROUP BY product_id`,
    [reservationId]
  );
  // Historical CSV snapshots may contain Active reservations that never held inventory.
  if (!holds.length) {
    await conn.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, created_at)
       VALUES (?, 'reservation_without_hold', 'reservation', ?, ?, ?)`,
      [userId, reservationId, `${remarks}: no recorded stock hold; inventory unchanged`, new Date()]
    );
    return false;
  }
  const heldByProduct = new Map(holds.map((hold) => [String(hold.product_id), Number(hold.held_quantity)]));
  if (holds.some((hold) => !items.some((item) => String(item.product_id) === String(hold.product_id)))) {
    throw new HttpError(409, `Reservation ${reservationId} has stock holds that do not match its items. Reconcile its inventory before releasing stock.`);
  }
  for (const item of items) {
    const quantity = Number(item.quantity);
    if (heldByProduct.get(String(item.product_id)) !== quantity) {
      throw new HttpError(409, `Reservation ${reservationId} has an inconsistent stock hold for product ${item.product_id}. Reconcile its inventory before releasing stock.`);
    }
    const [[product]] = await conn.query(
      `SELECT product_id, reserved_quantity FROM products WHERE product_id = ? FOR UPDATE`,
      [item.product_id]
    );
    if (!product || Number(product.reserved_quantity) < quantity) {
      throw new HttpError(409, `Reservation ${reservationId} requires ${quantity} reserved units of product ${item.product_id}. Reconcile its inventory before releasing stock.`);
    }
    await conn.query(
      `UPDATE products SET stock_quantity = stock_quantity + ?, reserved_quantity = reserved_quantity - ? WHERE product_id = ?`,
      [quantity, quantity, item.product_id]
    );
    await moveStock(conn, {
      productId: item.product_id, type: "Reservation Release", change: quantity,
      refType: "Reservation", refId: reservationId, remarks, userId,
    });
  }
  return items.length > 0;
}

const iso = (value) => (value ? new Date(value).toISOString() : "");

function rowActions(kind, row, role) {
  const admin = role === ADMIN;
  const base = `data/${kind}/${row.id}`;
  const action = (id, label, extra = {}) => ({ id, label, path: `${base}/${id}`, ...extra });
  const actions = [];
  if (kind === "products") {
    if (admin || role === INVENTORY) actions.push(action("stock-in", "Add stock", { prompt: "Quantity to add" }));
  } else if (kind === "customers") {
    if (row.status === "Unverified") actions.push(action("verify", "Verify info"));
  } else if (kind === "reservations") {
    if (row.status === "Pending Approval" && admin) {
      actions.push(action("approve", "Approve"), action("reject", "Reject"));
    }
    if (row.status === "Active") actions.push(action("convert", "Create order"));
    if (["Pending Approval", "Active"].includes(row.status)) actions.push(action("cancel", "Cancel"));
  } else if (kind === "orders") {
    if (row.status === "Pending Approval" && admin) actions.push(action("approve", "Approve"));
    if (row.status === "Pending Payment" && row.payment_status !== "Pending Verification") {
      actions.push(action("record-payment", "Record payment", { prompt: "GCash reference number" }));
    }
    if (row.payment_status === "Pending Verification" && admin) {
      actions.push(action("verify-payment", "Verify payment"), action("reject-payment", "Reject payment", { prompt: "Reason" }));
    }
    if (row.status === "Paid") actions.push(action("pack", "Mark packed"));
    if (["Packed", "For Shipping"].includes(row.status)) actions.push(action("ship", "Ship", { prompt: "J&T tracking number" }));
    if (row.status === "Shipped" && row.shipment_status === "Shipped") actions.push(action("in-transit", "Mark in transit"));
    if (row.status === "Delivered") actions.push(action("complete", "Complete"));
    if (["Pending Approval", "Pending Payment"].includes(row.status)) actions.push(action("cancel", "Cancel"));
  } else if (kind === "refunds") {
    if (row.status === "Pending Approval" && admin) {
      actions.push(action("approve", "Approve", { prompt: "Note (optional)", optional: true }), action("reject", "Reject", { prompt: "Reason" }));
    }
  } else if (kind === "accounts") {
    if (admin && row.role !== ADMIN) {
      if (row.status === "Pending Approval") actions.push({ id: "approve", label: "Approve", path: `users/${row.id}/approve` });
      if (row.status === "Active") actions.push({ id: "disable", label: "Disable", path: `users/${row.id}/disable` });
      if (row.status === "Disabled") actions.push({ id: "enable", label: "Enable", path: `users/${row.id}/enable` });
    }
  }
  return actions;
}

export async function getRecords(req, res) {
  const user = await requireUser(req);
  const role = user.role_name;
  await voidExpiredReservations();
  const db = getPool();
  const query = async (sql, params = []) => (await db.query(sql, params))[0];

  const [products, customers, orders, reservations, refunds, documents, notifications, activity, shippingItems] = await Promise.all([
    query(`SELECT product_id AS id, product_code, product_name, category, size, cost_price, selling_price,
                  stock_quantity, reserved_quantity, defective_quantity, low_stock_threshold, is_active
             FROM products ORDER BY product_code`),
    query(`SELECT c.customer_id AS id, c.customer_id, c.full_name, c.contact_number, c.street_address, c.barangay,
                  c.city_municipality, c.province, c.info_verified, c.returned_parcels
             FROM customers c ORDER BY c.customer_id DESC`),
    query(`SELECT o.order_id AS id, o.order_number, c.full_name AS customer_name, o.order_status AS status,
                  o.order_date AS ordered_at, COALESCE(t.total, 0) AS total_amount, COALESCE(t.cost, 0) AS cost,
                  pay.payment_status, pay.verified_at, pay.gcash_reference_number,
                  c.contact_number, CONCAT_WS(', ', c.street_address, c.barangay, c.city_municipality, c.province) AS address,
                  (SELECT GROUP_CONCAT(CONCAT(p.product_name, ' (', p.product_code, ') x ', oi.quantity) SEPARATOR '; ')
                     FROM order_items oi JOIN products p ON p.product_id = oi.product_id WHERE oi.order_id = o.order_id) AS items,
                  sh.tracking_number, sh.shipment_status
             FROM orders o JOIN customers c ON c.customer_id = o.customer_id
             LEFT JOIN shipments sh ON sh.order_id = o.order_id
             LEFT JOIN (SELECT order_id, SUM(quantity * unit_price) AS total, SUM(quantity * unit_cost) AS cost
                          FROM order_items GROUP BY order_id) t ON t.order_id = o.order_id
             LEFT JOIN (SELECT order_id, MAX(payment_id) AS payment_id FROM payments GROUP BY order_id) latest_pay
               ON latest_pay.order_id = o.order_id
             LEFT JOIN payments pay ON pay.payment_id = latest_pay.payment_id
            ORDER BY o.order_date DESC, o.order_id DESC`),
    query(`SELECT r.reservation_id AS id, r.reservation_number, c.full_name AS customer_name,
                  r.reservation_status AS status, r.payment_status, r.expiry_date AS expires_at, r.reservation_days,
                  (SELECT GROUP_CONCAT(CONCAT(p.product_name, ' x', ri.quantity) SEPARATOR ', ')
                     FROM reservation_items ri JOIN products p ON p.product_id = ri.product_id
                    WHERE ri.reservation_id = r.reservation_id) AS items,
                  (SELECT COALESCE(SUM(ri.quantity * ri.unit_price), 0) FROM reservation_items ri
                    WHERE ri.reservation_id = r.reservation_id) AS amount
             FROM reservations r JOIN customers c ON c.customer_id = r.customer_id
            ORDER BY r.created_at DESC, r.reservation_id DESC`),
    query(`SELECT f.refund_id AS id, f.refund_number, o.order_number, c.full_name AS customer_name,
                  f.issue_description AS reason, f.refund_amount AS amount, f.refund_status AS status, f.refund_date
             FROM refunds f JOIN orders o ON o.order_id = f.order_id JOIN customers c ON c.customer_id = f.customer_id
            ORDER BY f.refund_date DESC, f.refund_id DESC`),
    query(`SELECT * FROM (
             SELECT d.po_number AS doc_number, 'Purchase Order' AS doc_type, o.order_number, d.issued_at, u.full_name AS issued_by
               FROM purchase_orders d JOIN orders o ON o.order_id = d.order_id JOIN users u ON u.user_id = d.issued_by
             UNION ALL
             SELECT d.invoice_number, 'Invoice', o.order_number, d.issued_at, u.full_name
               FROM invoices d JOIN orders o ON o.order_id = d.order_id JOIN users u ON u.user_id = d.issued_by
             UNION ALL
             SELECT d.dr_number, 'Delivery Receipt', o.order_number, d.issued_at, u.full_name
               FROM delivery_receipts d JOIN orders o ON o.order_id = d.order_id JOIN users u ON u.user_id = d.issued_by
           ) docs ORDER BY issued_at DESC LIMIT 500`),
    query(`SELECT n.notification_id AS id, n.category, n.message, n.is_read, n.created_at
             FROM notifications n
            WHERE n.target_user_id = ? OR n.target_role_id = ?
            ORDER BY n.created_at DESC, n.notification_id DESC LIMIT 50`, [user.user_id, user.role_id]),
    query(`SELECT a.audit_id, a.action, a.entity_type, a.details, a.created_at, u.username
             FROM audit_log a LEFT JOIN users u ON u.user_id = a.user_id
            ORDER BY a.audit_id DESC LIMIT 20`),
    query(`SELECT COALESCE(SUM(oi.quantity), 0) AS item_count
         FROM order_items oi JOIN orders o ON o.order_id = oi.order_id
        WHERE o.order_status = 'For Shipping'`),
  ]);

  let accounts = [];
  if (role === ADMIN) {
    accounts = await query(
      `SELECT u.user_id AS id, u.username, u.full_name, r.role_name AS role, u.account_status AS status,
              u.last_login_at, u.created_at
         FROM users u JOIN roles r ON r.role_id = u.role_id ORDER BY u.created_at DESC`
    );
  }

  const withActions = (kind, rows) => rows.map((row) => ({ ...row, actions: rowActions(kind, row, role) }));
  const orderRows = orders.map((order) => ({
    ...order,
    total_amount: num(order.total_amount),
    cost: num(order.cost),
    ordered_at: iso(order.ordered_at),
    payment_status: order.payment_status || "Unpaid",
  }));
  const sales = orderRows
    .filter((order) => PAID_STATUSES.includes(order.status))
    .map((order) => ({
      id: order.id,
      sale_no: order.order_number,
      order_no: order.order_number,
      amount: order.total_amount,
      cost: order.cost,
      sold_at: iso(order.verified_at || order.ordered_at),
    }));
  const cents = (value) => Math.round(num(value) * 100);
  const salesCents = sales.reduce((sum, sale) => sum + cents(sale.amount), 0);
  const costCents = sales.reduce((sum, sale) => sum + cents(sale.cost), 0);
  const refundsCents = refunds
    .filter((refund) => ["Approved", "Completed"].includes(refund.status))
    .reduce((sum, refund) => sum + cents(refund.amount), 0);
  const netSalesCents = salesCents - refundsCents;
  const dashboard = {
    totalSales: netSalesCents / 100,
    totalProfit: (netSalesCents - costCents) / 100,
    pendingOrders: orderRows.filter((order) => ["Pending Approval", "Pending Payment"].includes(order.status)).length,
    unpaidReservations: reservations.filter((reservation) => reservation.status === "Active" && reservation.payment_status === "Unpaid").length,
    itemsForShipping: num(shippingItems[0]?.item_count),
    completedOrders: orderRows.filter((order) => order.status === "Completed").length,
  };
  sendJson(res, 200, {
    products: withActions("products", products.map((p) => ({
      ...p,
      cost_price: num(p.cost_price),
      selling_price: num(p.selling_price),
      status: !p.is_active ? "Inactive" : p.stock_quantity <= p.low_stock_threshold ? "Low stock" : "In stock",
    }))),
    customers: withActions("customers", customers.map((c) => ({ ...c, status: c.info_verified ? "Verified" : "Unverified" }))),
    orders: withActions("orders", orderRows),
    sales,
    dashboard,
    reservations: withActions("reservations", reservations.map((r) => ({
      ...r, expires_at: iso(r.expires_at), amount: num(r.amount), items: r.items || "",
    }))),
    refunds: withActions("refunds", refunds.map((f) => ({ ...f, amount: num(f.amount), refund_date: iso(f.refund_date) }))),
    documents: documents.map((d) => ({ ...d, issued_at: iso(d.issued_at) })),
    accounts: withActions("accounts", accounts.map((a) => ({ ...a, last_login_at: iso(a.last_login_at) }))),
    notifications: notifications.map((n) => ({ ...n, is_read: Boolean(n.is_read), created_at: iso(n.created_at) })),
    recentActivity: activity.map((a) => ({
      id: String(a.audit_id),
      message: `${a.username || "System"}: ${a.action.replaceAll("_", " ")}${a.details ? ` (${a.details})` : ""}`,
      createdAt: iso(a.created_at),
    })),
    pendingAccess: accounts.filter((a) => a.status === "Pending Approval").length,
    updatedAt: new Date().toISOString(),
  });
}

export async function markNotificationsRead(req, res) {
  const user = await requireUser(req);
  await getPool().query(
    `UPDATE notifications SET is_read = 1 WHERE target_user_id = ? OR target_role_id = ?`,
    [user.user_id, user.role_id]
  );
  sendJson(res, 200, { ok: true });
}

// ---- CSV import and record editing -------------------------------------------------

function cleanMoney(value, field) {
  const raw = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw) || Number(raw) > 99999999) {
    throw new HttpError(400, `${field} must be a non-negative amount with at most two decimals.`);
  }
  return Number(raw);
}

function cleanInt(value, field, { min = 0 } = {}) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > 99999999) {
    throw new HttpError(400, `${field} must be a whole number${min ? ` of at least ${min}` : ""}.`);
  }
  return Number(raw);
}

function cleanText(value, field, max, { optional = false } = {}) {
  const raw = text(String(value ?? ""));
  if (!raw) {
    if (optional) return null;
    throw new HttpError(400, `${field} is required.`);
  }
  if (raw.length > max) throw new HttpError(400, `${field} must be ${max} characters or fewer.`);
  return raw;
}

function cleanContact(value) {
  const raw = String(value ?? "").replace(/[\s-]/g, "");
  if (!CONTACT_PATTERN.test(raw)) {
    throw new HttpError(400, "Contact number must look like 09XXXXXXXXX or +639XXXXXXXXX.");
  }
  return raw;
}

function productFields(source, { creating }) {
  const fields = {
    product_name: cleanText(source.product_name, "Product", 120),
    category: cleanText(source.category, "Category", 50, { optional: true }),
    size: cleanText(source.size, "Size", 20, { optional: true }),
    cost_price: cleanMoney(source.cost_price, "Cost price"),
    selling_price: cleanMoney(source.selling_price, "Selling price"),
    low_stock_threshold: cleanInt(source.low_stock_threshold, "Low-stock threshold"),
  };
  if (creating) {
    fields.product_code = cleanText(source.product_code, "Product code", 30);
    fields.stock_quantity = cleanInt(source.stock_quantity, "Stock");
  }
  return fields;
}

function customerFields(source) {
  return {
    full_name: cleanText(source.full_name, "Customer", 100),
    contact_number: cleanContact(source.contact_number),
    street_address: cleanText(source.street_address, "Address", 150),
    barangay: cleanText(source.barangay, "Barangay", 80),
    city_municipality: cleanText(source.city_municipality, "City", 80),
    province: cleanText(source.province, "Province", 80),
  };
}

export async function importRecords(req, res) {
  const admin = await requireRole(req, ADMIN);
  const { kind, records } = req.body;
  const fileName = cleanText(req.body.fileName || "import.csv", "File name", 150);
  if (!["products", "customers"].includes(kind)) throw new HttpError(400, "Only products and customers can be imported.");
  if (!Array.isArray(records) || !records.length || records.length > MAX_IMPORT_ROWS) {
    throw new HttpError(400, `Import between 1 and ${MAX_IMPORT_ROWS} rows at a time.`);
  }

  const count = await withTransaction(async (conn) => {
    const seen = new Set();
    for (const [index, record] of records.entries()) {
      try {
        if (kind === "products") {
          const fields = productFields(record, { creating: true });
          const key = fields.product_code.toLowerCase();
          if (seen.has(key)) throw new HttpError(409, `Duplicate product code ${fields.product_code}.`);
          seen.add(key);
          const [exists] = await conn.query(`SELECT 1 FROM products WHERE product_code = ?`, [fields.product_code]);
          if (exists.length) throw new HttpError(409, `Product code ${fields.product_code} already exists.`);
          const [result] = await conn.query(
            `INSERT INTO products (product_code, product_name, category, size, cost_price, selling_price,
                                   stock_quantity, low_stock_threshold, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [fields.product_code, fields.product_name, fields.category, fields.size, fields.cost_price,
              fields.selling_price, fields.stock_quantity, fields.low_stock_threshold, admin.user_id]
          );
          if (fields.stock_quantity) {
            await moveStock(conn, {
              productId: result.insertId, type: "Stock In", change: fields.stock_quantity,
              refType: "Import", refId: null, remarks: fileName, userId: admin.user_id,
            });
          }
        } else {
          const fields = customerFields(record);
          if (seen.has(fields.contact_number)) throw new HttpError(409, `Duplicate contact number ${fields.contact_number}.`);
          seen.add(fields.contact_number);
          const [exists] = await conn.query(`SELECT 1 FROM customers WHERE contact_number = ?`, [fields.contact_number]);
          if (exists.length) throw new HttpError(409, `Contact number ${fields.contact_number} already exists.`);
          await conn.query(
            `INSERT INTO customers (full_name, contact_number, street_address, barangay, city_municipality, province, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [fields.full_name, fields.contact_number, fields.street_address, fields.barangay,
              fields.city_municipality, fields.province, admin.user_id]
          );
        }
      } catch (error) {
        if (error instanceof HttpError) throw new HttpError(error.status, `Data row ${index + 1}: ${error.message}`);
        throw error;
      }
    }
    await conn.query(
      `INSERT INTO import_batches (data_type, file_name, rows_imported, imported_by) VALUES (?, ?, ?, ?)`,
      [kind, fileName, records.length, admin.user_id]
    );
    return records.length;
  });

  await audit(admin.user_id, "import_csv", kind, null, `${count} rows from ${fileName}`);
  sendJson(res, 200, { imported: count });
}

export async function updateRecord(req, res, { kind, id }) {
  const admin = await requireRole(req, ADMIN);
  const db = getPool();
  if (kind === "products") {
    const fields = productFields(req.body, { creating: false });
    const stock = req.body.stock_quantity === undefined ? undefined : cleanInt(req.body.stock_quantity, "Stock");
    await withTransaction(async (conn) => {
      const [rows] = await conn.query(
        `SELECT product_id, stock_quantity FROM products WHERE product_code = ? FOR UPDATE`, [id]
      );
      if (!rows[0]) throw new HttpError(404, "The selected record no longer exists.");
      await conn.query(
        `UPDATE products SET product_name = ?, category = ?, size = ?, cost_price = ?, selling_price = ?,
                low_stock_threshold = ?, updated_by = ? WHERE product_id = ?`,
        [fields.product_name, fields.category, fields.size, fields.cost_price, fields.selling_price,
          fields.low_stock_threshold, admin.user_id, rows[0].product_id]
      );
      if (stock !== undefined && stock !== rows[0].stock_quantity) {
        await conn.query(`UPDATE products SET stock_quantity = ? WHERE product_id = ?`, [stock, rows[0].product_id]);
        await moveStock(conn, {
          productId: rows[0].product_id, type: "Adjustment", change: stock - rows[0].stock_quantity,
          refType: "Product", refId: rows[0].product_id, remarks: "Manual adjustment", userId: admin.user_id,
        });
        await notifyIfLow(conn, rows[0].product_id);
      }
    });
    await audit(admin.user_id, "edit_product", "product", null, id);
  } else if (kind === "customers") {
    const fields = customerFields(req.body);
    const [result] = await db.query(
      `UPDATE customers SET full_name = ?, contact_number = ?, street_address = ?, barangay = ?,
              city_municipality = ?, province = ? WHERE customer_id = ?`,
      [fields.full_name, fields.contact_number, fields.street_address, fields.barangay,
        fields.city_municipality, fields.province, Number(id)]
    );
    if (!result.affectedRows) throw new HttpError(404, "The selected record no longer exists.");
    await audit(admin.user_id, "edit_customer", "customer", Number(id));
  } else {
    throw new HttpError(400, "This record type cannot be edited.");
  }
  sendJson(res, 200, { ok: true });
}

const deletableRecords = {
  products: {
    table: "products", primaryKey: "product_id", label: "product",
    blockers: [
      ["SELECT 1 FROM reservation_items WHERE product_id = ? LIMIT 1", "reservation items"],
      ["SELECT 1 FROM order_items WHERE product_id = ? LIMIT 1", "order items"],
      ["SELECT 1 FROM stock_movements WHERE product_id = ? LIMIT 1", "stock movement history"],
      ["SELECT 1 FROM notifications WHERE reference_type = 'Product' AND reference_id = ? LIMIT 1", "notifications"],
    ],
  },
  customers: {
    table: "customers", primaryKey: "customer_id", label: "customer",
    blockers: [
      ["SELECT 1 FROM reservations WHERE customer_id = ? LIMIT 1", "reservations"],
      ["SELECT 1 FROM orders WHERE customer_id = ? LIMIT 1", "orders"],
      ["SELECT 1 FROM refunds WHERE customer_id = ? LIMIT 1", "refunds"],
    ],
  },
  orders: {
    table: "orders", primaryKey: "order_id", label: "order",
    blockers: [
      ["SELECT 1 FROM order_items WHERE order_id = ? LIMIT 1", "order items"],
      ["SELECT 1 FROM payments WHERE order_id = ? LIMIT 1", "payments"],
      ["SELECT 1 FROM shipments WHERE order_id = ? LIMIT 1", "shipments"],
      ["SELECT 1 FROM purchase_orders WHERE order_id = ? LIMIT 1", "purchase orders"],
      ["SELECT 1 FROM invoices WHERE order_id = ? LIMIT 1", "invoices"],
      ["SELECT 1 FROM delivery_receipts WHERE order_id = ? LIMIT 1", "delivery receipts"],
      ["SELECT 1 FROM refunds WHERE order_id = ? LIMIT 1", "refunds"],
      ["SELECT 1 FROM stock_movements WHERE reference_type IN ('Order', 'Purchase Order') AND reference_id = ? LIMIT 1", "stock movement history"],
      ["SELECT 1 FROM notifications WHERE reference_type = 'Order' AND reference_id = ? LIMIT 1", "notifications"],
    ],
  },
  reservations: {
    table: "reservations", primaryKey: "reservation_id", label: "reservation",
    blockers: [
      ["SELECT 1 FROM reservation_items WHERE reservation_id = ? LIMIT 1", "reservation items"],
      ["SELECT 1 FROM orders WHERE reservation_id = ? LIMIT 1", "orders"],
      ["SELECT 1 FROM stock_movements WHERE reference_type = 'Reservation' AND reference_id = ? LIMIT 1", "stock movement history"],
      ["SELECT 1 FROM notifications WHERE reference_type = 'Reservation' AND reference_id = ? LIMIT 1", "notifications"],
    ],
  },
  refunds: {
    table: "refunds", primaryKey: "refund_id", label: "refund",
    blockers: [
      ["SELECT 1 FROM refund_items WHERE refund_id = ? LIMIT 1", "refund items"],
      ["SELECT 1 FROM stock_movements WHERE reference_type = 'Refund' AND reference_id = ? LIMIT 1", "stock movement history"],
      ["SELECT 1 FROM notifications WHERE reference_type = 'Refund' AND reference_id = ? LIMIT 1", "notifications"],
    ],
  },
};

export async function deleteRecord(req, res, { kind, id }) {
  const admin = await requireRole(req, ADMIN);
  const spec = deletableRecords[kind];
  if (!spec) throw new HttpError(400, "This record type cannot be deleted.");
  const recordId = parseId(id);

  try {
    await withTransaction(async (conn) => {
      const [records] = await conn.query(
        `SELECT \`${spec.primaryKey}\` FROM \`${spec.table}\` WHERE \`${spec.primaryKey}\` = ? FOR UPDATE`,
        [recordId]
      );
      if (!records[0]) throw new HttpError(404, "The selected record no longer exists.");

      for (const [sql, label] of spec.blockers) {
        const [linked] = await conn.query(sql, [recordId]);
        if (linked.length) throw new HttpError(409, `Cannot delete this ${spec.label} while it has linked ${label}.`);
      }

      await conn.query(
        `DELETE FROM \`${spec.table}\` WHERE \`${spec.primaryKey}\` = ?`,
        [recordId]
      );
      await conn.query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, created_at)
         VALUES (?, 'delete_record', ?, ?, ?, ?)`,
        [admin.user_id, spec.label, recordId, `${spec.label} ${recordId} permanently deleted`, new Date()]
      );
    });
  } catch (error) {
    if (error?.code === "ER_ROW_IS_REFERENCED_2" || error?.errno === 1451) {
      throw new HttpError(409, `Cannot delete this ${spec.label} because other records depend on it.`);
    }
    throw error;
  }

  sendJson(res, 200, { ok: true });
}

// ---- Row actions (approve, verify payment, ship, ...) ----------------------------------

async function lockOrder(conn, id) {
  const [rows] = await conn.query(`SELECT * FROM orders WHERE order_id = ? FOR UPDATE`, [id]);
  if (!rows[0]) throw new HttpError(404, "Order not found.");
  return rows[0];
}

async function lockProduct(conn, productId) {
  const [rows] = await conn.query(`SELECT * FROM products WHERE product_id = ? FOR UPDATE`, [productId]);
  return rows[0];
}

function expectStatus(current, allowed, label) {
  if (!allowed.includes(current)) throw new HttpError(409, `${label} is already ${current}.`);
}

const reservationActions = {
  async approve(conn, user, id) {
    const [[reservation]] = await conn.query(`SELECT * FROM reservations WHERE reservation_id = ? FOR UPDATE`, [id]);
    if (!reservation) throw new HttpError(404, "Reservation not found.");
    expectStatus(reservation.reservation_status, ["Pending Approval"], "This reservation");
    const [items] = await conn.query(`SELECT product_id, quantity FROM reservation_items WHERE reservation_id = ?`, [id]);
    for (const item of items) {
      const product = await lockProduct(conn, item.product_id);
      if (product.stock_quantity < item.quantity) {
        throw new HttpError(409, `Not enough stock for ${product.product_name} (${product.stock_quantity} available).`);
      }
      await conn.query(
        `UPDATE products SET stock_quantity = stock_quantity - ?, reserved_quantity = reserved_quantity + ? WHERE product_id = ?`,
        [item.quantity, item.quantity, item.product_id]
      );
      await moveStock(conn, {
        productId: item.product_id, type: "Reservation Hold", change: -item.quantity,
        refType: "Reservation", refId: id, userId: user.user_id,
      });
      await notifyIfLow(conn, item.product_id);
    }
    const now = new Date();
    const expiry = new Date(now.getTime() + reservation.reservation_days * 86400000);
    await conn.query(
      `UPDATE reservations SET reservation_status = 'Active', approved_by = ?, approved_at = ?, expiry_date = ? WHERE reservation_id = ?`,
      [user.user_id, now, expiry, id]
    );
    await notify(conn, { userId: reservation.created_by, category: "Reservation", message: `${reservation.reservation_number} was approved.`, refType: "Reservation", refId: id });
    return "approve_reservation";
  },
  async reject(conn, user, id) {
    const [[reservation]] = await conn.query(`SELECT * FROM reservations WHERE reservation_id = ? FOR UPDATE`, [id]);
    if (!reservation) throw new HttpError(404, "Reservation not found.");
    expectStatus(reservation.reservation_status, ["Pending Approval"], "This reservation");
    await conn.query(`UPDATE reservations SET reservation_status = 'Rejected' WHERE reservation_id = ?`, [id]);
    await notify(conn, { userId: reservation.created_by, category: "Reservation", message: `${reservation.reservation_number} was rejected.`, refType: "Reservation", refId: id });
    return "reject_reservation";
  },
  async cancel(conn, user, id) {
    const [[reservation]] = await conn.query(`SELECT * FROM reservations WHERE reservation_id = ? FOR UPDATE`, [id]);
    if (!reservation) throw new HttpError(404, "Reservation not found.");
    expectStatus(reservation.reservation_status, ["Pending Approval", "Active"], "This reservation");
    if (reservation.reservation_status === "Active") {
      const [orders] = await conn.query(`SELECT 1 FROM orders WHERE reservation_id = ?`, [id]);
      if (orders.length) throw new HttpError(409, "This reservation already has an order.");
      await releaseReservationStock(conn, id, user.user_id, "Reservation cancelled");
    }
    await conn.query(`UPDATE reservations SET reservation_status = 'Cancelled', voided_at = ? WHERE reservation_id = ?`, [new Date(), id]);
    return "cancel_reservation";
  },
  async convert(conn, user, id) {
    const [[reservation]] = await conn.query(`SELECT * FROM reservations WHERE reservation_id = ? FOR UPDATE`, [id]);
    if (!reservation) throw new HttpError(404, "Reservation not found.");
    expectStatus(reservation.reservation_status, ["Active"], "This reservation");
    const [existing] = await conn.query(`SELECT 1 FROM orders WHERE reservation_id = ?`, [id]);
    if (existing.length) throw new HttpError(409, "This reservation already has an order.");
    const orderNumber = await nextDocumentNumber(conn, "ORD");
    const [order] = await conn.query(
      `INSERT INTO orders (order_number, customer_id, reservation_id, order_status, created_by, approved_by, approved_at)
       VALUES (?, ?, ?, 'Pending Payment', ?, ?, ?)`,
      [orderNumber, reservation.customer_id, id, user.user_id, user.user_id, new Date()]
    );
    await conn.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost)
       SELECT ?, ri.product_id, ri.quantity, ri.unit_price, p.cost_price
         FROM reservation_items ri JOIN products p ON p.product_id = ri.product_id WHERE ri.reservation_id = ?`,
      [order.insertId, id]
    );
    await conn.query(
      `INSERT INTO purchase_orders (po_number, order_id, issued_by) VALUES (?, ?, ?)`,
      [await nextDocumentNumber(conn, "PO"), order.insertId, user.user_id]
    );
    return "convert_reservation";
  },
};

async function applyPaidStock(conn, order, user) {
  const [items] = await conn.query(`SELECT product_id, quantity FROM order_items WHERE order_id = ?`, [order.order_id]);
  for (const item of items) {
    const product = await lockProduct(conn, item.product_id);
    if (order.reservation_id) {
      await conn.query(`UPDATE products SET reserved_quantity = GREATEST(reserved_quantity - ?, 0) WHERE product_id = ?`, [item.quantity, item.product_id]);
      await moveStock(conn, { productId: item.product_id, type: "Sale", change: 0, refType: "Order", refId: order.order_id, remarks: "Reserved stock sold", userId: user.user_id });
    } else {
      if (product.stock_quantity < item.quantity) {
        throw new HttpError(409, `Not enough stock for ${product.product_name} (${product.stock_quantity} available).`);
      }
      await conn.query(`UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?`, [item.quantity, item.product_id]);
      await moveStock(conn, { productId: item.product_id, type: "Sale", change: -item.quantity, refType: "Order", refId: order.order_id, userId: user.user_id });
      await notifyIfLow(conn, item.product_id);
    }
  }
}

const orderActions = {
  async approve(conn, user, id) {
    const order = await lockOrder(conn, id);
    expectStatus(order.order_status, ["Pending Approval"], "This order");
    await conn.query(`UPDATE orders SET order_status = 'Pending Payment', approved_by = ?, approved_at = ? WHERE order_id = ?`, [user.user_id, new Date(), id]);
    return "approve_order";
  },
  async "record-payment"(conn, user, id, value) {
    const order = await lockOrder(conn, id);
    expectStatus(order.order_status, ["Pending Payment"], "This order");
    const reference = cleanText(value, "GCash reference number", 30);
    const [pending] = await conn.query(`SELECT 1 FROM payments WHERE order_id = ? AND payment_status = 'Pending Verification'`, [id]);
    if (pending.length) throw new HttpError(409, "A payment is already waiting for verification.");
    const [[totals]] = await conn.query(`SELECT COALESCE(SUM(quantity * unit_price), 0) AS total FROM order_items WHERE order_id = ?`, [id]);
    try {
      await conn.query(
        `INSERT INTO payments (order_id, gcash_reference_number, amount_paid, payment_status, paid_at, recorded_by)
         VALUES (?, ?, ?, 'Pending Verification', ?, ?)`,
        [id, reference, totals.total, new Date(), user.user_id]
      );
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") throw new HttpError(409, "That GCash reference number was already used.");
      throw error;
    }
    await notify(conn, { role: ADMIN, category: "Payment", message: `Payment for ${order.order_number} needs verification.`, refType: "Order", refId: id });
    return "record_payment";
  },
  async "verify-payment"(conn, user, id) {
    const order = await lockOrder(conn, id);
    expectStatus(order.order_status, ["Pending Payment"], "This order");
    const [[payment]] = await conn.query(
      `SELECT payment_id FROM payments WHERE order_id = ? AND payment_status = 'Pending Verification' ORDER BY payment_id DESC LIMIT 1 FOR UPDATE`, [id]
    );
    if (!payment) throw new HttpError(409, "There is no payment waiting for verification.");
    await applyPaidStock(conn, order, user);
    const now = new Date();
    await conn.query(`UPDATE payments SET payment_status = 'Verified', verified_by = ?, verified_at = ? WHERE payment_id = ?`, [user.user_id, now, payment.payment_id]);
    await conn.query(`UPDATE orders SET order_status = 'Paid' WHERE order_id = ?`, [id]);
    if (order.reservation_id) await conn.query(`UPDATE reservations SET reservation_status = 'Paid' WHERE reservation_id = ?`, [order.reservation_id]);
    await conn.query(`INSERT INTO invoices (invoice_number, order_id, issued_by) VALUES (?, ?, ?)`, [await nextDocumentNumber(conn, "INV"), id, user.user_id]);
    await notify(conn, { userId: order.created_by, category: "Payment", message: `Payment for ${order.order_number} was verified.`, refType: "Order", refId: id });
    return "verify_payment";
  },
  async "reject-payment"(conn, user, id, value) {
    const order = await lockOrder(conn, id);
    const reason = cleanText(value, "Reason", 150);
    const [result] = await conn.query(
      `UPDATE payments SET payment_status = 'Rejected', rejection_reason = ?, verified_by = ?, verified_at = ?
        WHERE order_id = ? AND payment_status = 'Pending Verification'`,
      [reason, user.user_id, new Date(), id]
    );
    if (!result.affectedRows) throw new HttpError(409, "There is no payment waiting for verification.");
    await notify(conn, { userId: order.created_by, category: "Payment", message: `Payment for ${order.order_number} was rejected: ${reason}`, refType: "Order", refId: id });
    return "reject_payment";
  },
  async pack(conn, user, id) {
    const order = await lockOrder(conn, id);
    expectStatus(order.order_status, ["Paid"], "This order");
    await conn.query(`UPDATE orders SET order_status = 'Packed' WHERE order_id = ?`, [id]);
    return "pack_order";
  },
  async ship(conn, user, id, value) {
    const order = await lockOrder(conn, id);
    expectStatus(order.order_status, ["Packed", "For Shipping"], "This order");
    const tracking = cleanText(value, "Tracking number", 40);
    const [[customer]] = await conn.query(`SELECT info_verified FROM customers WHERE customer_id = ?`, [order.customer_id]);
    if (!customer.info_verified) throw new HttpError(409, "Verify the customer's information before shipping.");
    await conn.query(
      `INSERT INTO shipments (order_id, tracking_number, shipment_status, shipped_at, updated_by)
       VALUES (?, ?, 'Shipped', ?, ?)
       ON DUPLICATE KEY UPDATE tracking_number = VALUES(tracking_number), shipment_status = 'Shipped', shipped_at = VALUES(shipped_at), updated_by = VALUES(updated_by)`,
      [id, tracking, new Date(), user.user_id]
    );
    await conn.query(`UPDATE orders SET order_status = 'Shipped' WHERE order_id = ?`, [id]);
    return "ship_order";
  },
  async "in-transit"(conn, user, id) {
    const order = await lockOrder(conn, id);
    expectStatus(order.order_status, ["Shipped"], "This order");
    const [result] = await conn.query(
      `UPDATE shipments SET shipment_status = 'In Transit', updated_by = ? WHERE order_id = ? AND shipment_status = 'Shipped'`, [user.user_id, id]
    );
    if (!result.affectedRows) throw new HttpError(409, "This shipment is not waiting to be marked in transit.");
    return "update_shipment";
  },
  async complete(conn, user, id) {
    const order = await lockOrder(conn, id);
    expectStatus(order.order_status, ["Delivered"], "This order");
    await conn.query(`UPDATE orders SET order_status = 'Completed' WHERE order_id = ?`, [id]);
    return "complete_order";
  },
  async cancel(conn, user, id) {
    const order = await lockOrder(conn, id);
    expectStatus(order.order_status, ["Pending Approval", "Pending Payment"], "This order");
    await conn.query(`UPDATE orders SET order_status = 'Cancelled' WHERE order_id = ?`, [id]);
    return "cancel_order";
  },
};

async function decideRefund(conn, user, id, approve, note) {
  const [[refund]] = await conn.query(`SELECT * FROM refunds WHERE refund_id = ? FOR UPDATE`, [id]);
  if (!refund) throw new HttpError(404, "Refund not found.");
  expectStatus(refund.refund_status, ["Pending Approval"], "This refund");
  if (approve) {
    const [items] = await conn.query(
      `SELECT ri.quantity, ri.is_defective, oi.product_id FROM refund_items ri
         JOIN order_items oi ON oi.order_item_id = ri.order_item_id WHERE ri.refund_id = ?`, [id]
    );
    for (const item of items) {
      await lockProduct(conn, item.product_id);
      if (item.is_defective) {
        await conn.query(`UPDATE products SET defective_quantity = defective_quantity + ? WHERE product_id = ?`, [item.quantity, item.product_id]);
        await moveStock(conn, { productId: item.product_id, type: "Refund Defective", change: 0, refType: "Refund", refId: id, userId: user.user_id });
      } else {
        await conn.query(`UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?`, [item.quantity, item.product_id]);
        await moveStock(conn, { productId: item.product_id, type: "Refund Return", change: item.quantity, refType: "Refund", refId: id, userId: user.user_id });
      }
    }
  }
  await conn.query(
    `UPDATE refunds SET refund_status = ?, approved_by = ?, approved_at = ?, decision_note = ? WHERE refund_id = ?`,
    [approve ? "Approved" : "Rejected", user.user_id, new Date(), note || null, id]
  );
  await notify(conn, { userId: refund.requested_by, category: "Refund", message: `${refund.refund_number} was ${approve ? "approved" : "rejected"}.`, refType: "Refund", refId: id });
  return approve ? "approve_refund" : "reject_refund";
}

const refundActions = {
  approve: (conn, user, id, value) => decideRefund(conn, user, id, true, text(value)),
  reject: (conn, user, id, value) => decideRefund(conn, user, id, false, cleanText(value, "Reason", 255)),
};

const customerActions = {
  async verify(conn, user, id) {
    const [result] = await conn.query(
      `UPDATE customers SET info_verified = 1, verified_by = ?, verified_at = ? WHERE customer_id = ?`,
      [user.user_id, new Date(), id]
    );
    if (!result.affectedRows) throw new HttpError(404, "Customer not found.");
    return "verify_customer";
  },
};

const productActions = {
  async "stock-in"(conn, user, id, value) {
    const quantity = cleanInt(value, "Quantity", { min: 1 });
    const product = await lockProduct(conn, id);
    if (!product) throw new HttpError(404, "Product not found.");
    await conn.query(`UPDATE products SET stock_quantity = stock_quantity + ?, updated_by = ? WHERE product_id = ?`, [quantity, user.user_id, id]);
    await moveStock(conn, { productId: id, type: "Stock In", change: quantity, refType: "Product", refId: id, userId: user.user_id });
    return "stock_in";
  },
};

const rowActionTable = {
  products: { handlers: productActions, roles: [ADMIN, INVENTORY], entity: "product" },
  customers: { handlers: customerActions, roles: [ADMIN, SALES, INVENTORY], entity: "customer" },
  reservations: { handlers: reservationActions, roles: [ADMIN, SALES, INVENTORY], adminOnly: ["approve", "reject"], entity: "reservation" },
  orders: { handlers: orderActions, roles: [ADMIN, SALES, INVENTORY], adminOnly: ["approve", "verify-payment", "reject-payment"], entity: "order" },
  refunds: { handlers: refundActions, roles: [ADMIN], entity: "refund" },
};

export async function runRowAction(req, res, { kind, id: rawId, action }) {
  const config = rowActionTable[Object.hasOwn(rowActionTable, kind) ? kind : ""];
  if (!config || !Object.hasOwn(config.handlers, action)) throw new HttpError(404, "Unknown action.");
  const user = await requireRole(req, ...(config.adminOnly?.includes(action) ? [ADMIN] : config.roles));
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid id.");
  const value = typeof req.body.value === "string" ? req.body.value : "";
  const auditAction = await withTransaction((conn) => config.handlers[action](conn, user, id, value));
  await audit(user.user_id, auditAction, config.entity, id);
  sendJson(res, 200, { ok: true });
}

// ---- Form actions (new customer, reservation, order, refund, ...) -----------------------

async function findCustomer(conn, term) {
  const value = text(term);
  if (!value) throw new HttpError(400, "Enter the customer's name or contact number.");
  const digits = value.replace(/[\s-]/g, "");
  const national = digits.startsWith("+63") ? `0${digits.slice(3)}` : digits;
  const international = national.startsWith("09") ? `+63${national.slice(1)}` : digits;
  let [rows] = await conn.query(
    `SELECT customer_id, full_name FROM customers WHERE contact_number IN (?, ?, ?) OR LOWER(full_name) = LOWER(?) LIMIT 2`,
    [digits, national, international, value]
  );
  if (!rows.length) {
    const like = `%${value.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;
    [rows] = await conn.query(`SELECT customer_id, full_name FROM customers WHERE LOWER(full_name) LIKE ? LIMIT 2`, [like]);
  }
  if (!rows.length) throw new HttpError(404, `Customer "${value}" was not found. Add the customer first in Customers > Add customer.`);
  if (rows.length > 1) throw new HttpError(409, `More than one customer is named "${value}". Use the contact number instead.`);
  return rows[0];
}

async function findProduct(conn, term) {
  const value = text(term);
  const [rows] = await conn.query(
    `SELECT * FROM products WHERE is_active = 1 AND (product_code = ? OR LOWER(product_name) = LOWER(?)) LIMIT 2`,
    [value, value]
  );
  if (!rows.length) throw new HttpError(404, `Product "${value}" was not found.`);
  if (rows.length > 1) throw new HttpError(409, `More than one product is named "${value}". Use the product code instead.`);
  return rows[0];
}

const formActions = {
  async "3.12-new-customer-validation"(conn, user, v) {
    const fields = customerFields({
      full_name: v["Full name"], contact_number: v["Contact number"], street_address: v["Address"],
      barangay: v["Barangay"], city_municipality: v["City"], province: v["Province"],
    });
    const alternate = fields.contact_number.startsWith("+63") ? `0${fields.contact_number.slice(3)}` : `+63${fields.contact_number.slice(1)}`;
    const [dup] = await conn.query(`SELECT 1 FROM customers WHERE contact_number IN (?, ?)`,     [fields.contact_number, alternate]);
    if (dup.length) throw new HttpError(409, "A customer with that contact number already exists.");
        const [result] = await conn.query(
          `INSERT INTO customers (full_name, contact_number, social_media_name, street_address, barangay,
                              city_municipality, province, postal_code, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [fields.full_name, fields.contact_number, cleanText(v["Social media handle"], "Social media handle", 100, { optional: true }),
        fields.street_address, fields.barangay, fields.city_municipality, fields.province,
        cleanText(v["Postal code"], "Postal code", 10, { optional: true }), user.user_id]
    );
    return { action: "create_customer", entity: "customer", id: result.insertId };
  },

  async "5.1-new-reservation"(conn, user, v) {
    const customer = await findCustomer(conn, v.Customer);
    const product = await findProduct(conn, v.Product);
    const quantity = cleanInt(v.Quantity, "Quantity", { min: 1 });
    const days = cleanInt(v["Agreed days"], "Agreed days", { min: 1 });
    if (days > 255) throw new HttpError(400, "Agreed days must be 255 or fewer.");
    if (product.stock_quantity < quantity) {
      throw new HttpError(409, `Only ${product.stock_quantity} of ${product.product_name} available.`);
    }
    const number = await nextDocumentNumber(conn, "RES");
    const [result] = await conn.query(
      `INSERT INTO reservations (reservation_number, customer_id, reservation_days, notes, created_by) VALUES (?, ?, ?, ?, ?)`,
      [number, customer.customer_id, days, cleanText(v["Pickup note"], "Pickup note", 255, { optional: true }), user.user_id]
    );
    await conn.query(
      `INSERT INTO reservation_items (reservation_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)`,
      [result.insertId, product.product_id, quantity, product.selling_price]
    );
    await notify(conn, { role: ADMIN, category: "Approval", message: `${number} needs approval.`, refType: "Reservation", refId: result.insertId });
    return { action: "create_reservation", entity: "reservation", id: result.insertId };
  },

  async "3.13-create-purchase-order"(conn, user, v) {
    const customer = await findCustomer(conn, v.Customer);
    const lines = new Map();
    const addLine = async (term, qty) => {
      const product = await findProduct(conn, term);
      const entry = lines.get(product.product_id) || { product, quantity: 0 };
      entry.quantity += qty;
      lines.set(product.product_id, entry);
    };
    await addLine(v.Product, cleanInt(v.Quantity, "Quantity", { min: 1 }));
    // Extra line items: "CODE x 2, CODE2 x 1" (comma or semicolon separated)
    for (const part of text(v["Additional items"]).split(/[;,\n]/).map((s) => s.trim()).filter(Boolean)) {
      const match = part.match(/^(.+?)\s*(?:x|\*|:)\s*(\d+)$/i);
      if (!match) throw new HttpError(400, `Additional item "${part}" must look like "PRODUCT-CODE x 2".`);
      await addLine(match[1].trim(), cleanInt(match[2], "Quantity", { min: 1 }));
    }
    for (const { product, quantity } of lines.values()) {
      if (product.stock_quantity < quantity) {
        throw new HttpError(409, `Only ${product.stock_quantity} of ${product.product_name} available.`);
      }
    }
    const admin = user.role_name === ADMIN;
    const [result] = await conn.query(
      `INSERT INTO orders (order_number, customer_id, order_status, notes, created_by, approved_by, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [await nextDocumentNumber(conn, "ORD"), customer.customer_id, admin ? "Pending Payment" : "Pending Approval",
        cleanText(v["Note for the Admin"], "Note", 255, { optional: true }), user.user_id,
        admin ? user.user_id : null, admin ? new Date() : null]
    );
    for (const { product, quantity } of lines.values()) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost) VALUES (?, ?, ?, ?, ?)`,
        [result.insertId, product.product_id, quantity, product.selling_price, product.cost_price]
      );
    }
    await conn.query(
      `INSERT INTO purchase_orders (po_number, order_id, issued_by) VALUES (?, ?, ?)`,
      [await nextDocumentNumber(conn, "PO"), result.insertId, user.user_id]
    );
    if (!admin) await notify(conn, { role: ADMIN, category: "Approval", message: "A new order needs approval.", refType: "Order", refId: result.insertId });
    return { action: "create_order", entity: "order", id: result.insertId };
  },

  async "3.14-confirm-delivery"(conn, user, v) {
    const [orders] = await conn.query(`SELECT * FROM orders WHERE order_number = ? FOR UPDATE`, [text(v["Order number"])]);
    const order = orders[0];
    if (!order) throw new HttpError(404, "Order not found.");
    expectStatus(order.order_status, ["Shipped"], "This order");
    const [[shipment]] = await conn.query(`SELECT * FROM shipments WHERE order_id = ?`, [order.order_id]);
    if (!shipment) throw new HttpError(409, "This order has no shipment.");
    const status = text(v["Delivery status"]);
    if (status === "Delivered") {
      const deliveredAt = new Date(v["Date and time delivered"]);
      if (Number.isNaN(deliveredAt.getTime())) throw new HttpError(400, "Enter a valid delivery date and time.");
      await conn.query(
        `UPDATE shipments SET shipment_status = 'Delivered', delivered_at = ?, received_by = ?, updated_by = ? WHERE shipment_id = ?`,
        [deliveredAt, cleanText(v["Received by"], "Received by", 100), user.user_id, shipment.shipment_id]
      );
      await conn.query(`UPDATE orders SET order_status = 'Delivered' WHERE order_id = ?`, [order.order_id]);
      await conn.query(
        `INSERT INTO delivery_receipts (dr_number, order_id, shipment_id, delivered_at, issued_by) VALUES (?, ?, ?, ?, ?)`,
        [await nextDocumentNumber(conn, "DR"), order.order_id, shipment.shipment_id, deliveredAt, user.user_id]
      );
    } else if (["Failed delivery", "Returned to sender"].includes(status)) {
      await conn.query(
        `UPDATE shipments SET shipment_status = 'Returned', return_reason = ?, updated_by = ? WHERE shipment_id = ?`,
        [status, user.user_id, shipment.shipment_id]
      );
      await conn.query(`UPDATE customers SET returned_parcels = returned_parcels + 1, info_verified = 0 WHERE customer_id = ?`, [order.customer_id]);
    } else {
      throw new HttpError(400, "Choose a valid delivery status.");
    }
    return { action: "confirm_delivery", entity: "order", id: order.order_id };
  },

  async "4.3-edit-product-admin-only"(conn, user, v) {
    if (user.role_name !== ADMIN) throw new HttpError(403, "Only an Admin can edit products.");
    const [rows] = await conn.query(`SELECT product_id FROM products WHERE product_code = ? FOR UPDATE`, [text(v["Product code"])]);
    if (!rows[0]) throw new HttpError(404, "Product code not found.");
    const status = text(v.Status);
    if (!["Active", "Inactive"].includes(status)) throw new HttpError(400, "Status must be Active or Inactive.");
    const fields = productFields({
      product_name: v["Product name"], category: v.Category, size: v.Size, cost_price: v["Cost price"],
      selling_price: v["Selling price"], low_stock_threshold: v["Low-stock threshold"],
    }, { creating: false });
    await conn.query(
      `UPDATE products SET product_name = ?, category = ?, size = ?, cost_price = ?, selling_price = ?,
              low_stock_threshold = ?, is_active = ?, updated_by = ? WHERE product_id = ?`,
      [fields.product_name, fields.category, fields.size, fields.cost_price, fields.selling_price,
        fields.low_stock_threshold, status === "Active" ? 1 : 0, user.user_id, rows[0].product_id]
    );
    await notifyIfLow(conn, rows[0].product_id);
    return { action: "edit_product", entity: "product", id: rows[0].product_id };
  },

  async "3.4-new-refund-request"(conn, user, v) {
    const [orders] = await conn.query(`SELECT * FROM orders WHERE order_number = ?`, [text(v["Order number"])]);
    const order = orders[0];
    if (!order) throw new HttpError(404, "Order not found.");
    expectStatus(order.order_status, ["Delivered", "Completed"], "This order");
    const term = text(v["Returned item"]);
    const [items] = await conn.query(
      `SELECT oi.* FROM order_items oi JOIN products p ON p.product_id = oi.product_id
        WHERE oi.order_id = ? AND (p.product_code = ? OR LOWER(p.product_name) = LOWER(?))`,
      [order.order_id, term, term]
    );
    if (items.length !== 1) throw new HttpError(404, "That item is not part of this order.");
    const item = items[0];
    const quantity = cleanInt(v["Return quantity"], "Return quantity", { min: 1 });
    if (quantity > item.quantity) throw new HttpError(400, `Only ${item.quantity} of this item was ordered.`);
    const days = cleanInt(v["Days of ownership"], "Days of ownership");
    const defective = ["Damaged"].includes(text(v["Item condition"]));
    const [refund] = await conn.query(
      `INSERT INTO refunds (refund_number, order_id, customer_id, days_of_ownership, issue_description,
                            inspection_note, refund_amount, requested_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [await nextDocumentNumber(conn, "RFD"), order.order_id, order.customer_id, days,
        cleanText(v["Issue / reason"], "Issue / reason", 255),
        cleanText(v["Inspection note"], "Inspection note", 255, { optional: true }),
        item.unit_price * quantity, user.user_id]
    );
    await conn.query(
      `INSERT INTO refund_items (refund_id, order_item_id, quantity, is_defective) VALUES (?, ?, ?, ?)`,
      [refund.insertId, item.order_item_id, quantity, defective ? 1 : 0]
    );
    await notify(conn, { role: ADMIN, category: "Refund", message: "A refund request needs review.", refType: "Refund", refId: refund.insertId });
    return { action: "request_refund", entity: "refund", id: refund.insertId };
  },

  async "3.5-refund-condition-review"(conn, user, v) {
    const [[refund]] = await conn.query(`SELECT refund_id, refund_status FROM refunds WHERE refund_number = ? FOR UPDATE`, [text(v["Refund ticket"])]);
    if (!refund) throw new HttpError(404, "Refund ticket not found.");
    expectStatus(refund.refund_status, ["Pending Approval"], "This refund");
    const disposition = text(v["Inventory disposition"]);
    if (!["Restock", "Defective", "Discard"].includes(disposition)) throw new HttpError(400, "Choose an inventory disposition.");
    const note = `${text(v["Inspection result"])}: ${cleanText(v["Review note"], "Review note", 200, { optional: true }) || "no note"}`;
    await conn.query(`UPDATE refunds SET inspection_note = ? WHERE refund_id = ?`, [note.slice(0, 255), refund.refund_id]);
    await conn.query(`UPDATE refund_items SET is_defective = ? WHERE refund_id = ?`, [disposition === "Restock" ? 0 : 1, refund.refund_id]);
    return { action: "review_refund", entity: "refund", id: refund.refund_id };
  },

  async "3.6-approval-request-detail"(conn, user, v) {
    if (user.role_name !== ADMIN) throw new HttpError(403, "Only an Admin can decide refunds.");
    const [[refund]] = await conn.query(`SELECT refund_id FROM refunds WHERE refund_number = ?`, [text(v["Refund ticket"])]);
    if (!refund) throw new HttpError(404, "Refund ticket not found.");
    const approve = text(v.Decision) === "Approve";
    const note = cleanText(v["Admin note"], "Admin note", 255, { optional: true }) || "";
    const action = await decideRefund(conn, user, refund.refund_id, approve, note);
    return { action, entity: "refund", id: refund.refund_id };
  },
};
formActions["8.6-mobile-new-reservation"] = formActions["5.1-new-reservation"];

export async function runFormAction(req, res) {
  const user = await requireUser(req);
  requireFields(req.body, ["screenId"]);
  const handler = Object.hasOwn(formActions, req.body.screenId) ? formActions[req.body.screenId] : null;
  if (!handler) throw new HttpError(404, "This form is not available.");
  const values = req.body.values && typeof req.body.values === "object" ? req.body.values : {};
  const result = await withTransaction((conn) => handler(conn, user, values));
  await audit(user.user_id, result.action, result.entity, result.id);
  sendJson(res, 200, { ok: true });
}
