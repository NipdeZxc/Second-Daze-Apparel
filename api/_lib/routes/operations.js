import { getPool } from "../../_db.js";
import { HttpError, requireFields, sendJson } from "../http.js";
import { requireRole, requireUser } from "../auth.js";
import { sendRefundStatusEmail } from "../mailer.js";

const ADMIN = "Admin";
const SALES = "Sales Management";
const INVENTORY = "Inventory Management";
const text = (value) => typeof value === "string" ? value.trim() : "";
const money = (value) => Number(value || 0);

async function transaction(work) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function nextNumber(conn, key, prefix) {
  await conn.query(
    `INSERT INTO document_sequences (seq_key, seq_year, last_number) VALUES (?, 0, LAST_INSERT_ID(1))
     ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)`,
    [key]
  );
  const [[row]] = await conn.query(`SELECT LAST_INSERT_ID() AS value`);
  return `${prefix}-${row.value}`;
}

async function log(conn, { userId = null, action, type, id, number = null, from = null, to = null, note = null }) {
  await conn.query(
    `INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, entity_no, from_status, to_status, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, action, type, id, number, from, to, note]
  );
}

async function notifyUser(conn, userId, type, title, message, entityType, entityId) {
  if (!userId) return;
  await conn.query(
    `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, type, title.slice(0, 120), message.slice(0, 255), entityType, entityId]
  );
}

async function notifyRoles(conn, roles, type, title, message, entityType, entityId, excludeUserId = null) {
  const [users] = await conn.query(
    `SELECT user_id FROM users WHERE role IN (?) AND account_status = 'Active'`, [roles]
  );
  for (const user of users) if (user.user_id !== excludeUserId) await notifyUser(conn, user.user_id, type, title, message, entityType, entityId);
}

async function moveStock(conn, { product, available, reserved = 0, defective = 0, type, refType, refId, refNo, userId = null, reason = null }) {
  const before = Number(product.qty_available);
  const after = before + available;
  const movementNo = await nextNumber(conn, "MOV", "MOV");
  await conn.query(
    `INSERT INTO stock_movements
      (movement_no, product_id, movement_type, available_change, reserved_change, defective_change,
       available_before, available_after, reference_type, reference_id, reference_no, reason, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [movementNo, product.product_id, type, available, reserved, defective, before, after, refType, refId, refNo, reason, userId]
  );
}

function displayStatus(value, voidReason) {
  if (value === "Awaiting Approval") return "Pending Approval";
  if (value === "Approved") return "Active";
  if (value === "Expired") return voidReason === "No-show" ? "No-show" : "Voided";
  return value;
}

function actionsForReservation(row, role) {
  const actions = [];
  if (row.status === "Pending Approval" && role === ADMIN) actions.push(
    { id: "approve", label: "Approve", path: `data/reservations/${row.id}/approve` },
    { id: "reject", label: "Reject", prompt: "Reason for rejection", path: `data/reservations/${row.id}/reject` }
  );
  if (["Active", "Paid"].includes(row.status) && !row.is_prepared) {
    actions.push({ id: "prepare", label: "Mark prepared", path: `data/reservations/${row.id}/prepare` });
  }
  if (["Active", "Paid"].includes(row.status) && row.is_prepared && !row.is_picked_up && row.payment_status === "Paid") {
    actions.push({ id: "handover", label: "Record pickup", path: `data/reservations/${row.id}/handover` });
  }
  if (row.status === "Active" && row.payment_status === "Unpaid") {
    actions.push(
      ...(!row.order_number ? [{ id: "convert", label: "Create checkout order", path: `data/reservations/${row.id}/convert` }] : []),
      { id: "extend", label: "Extend hold", prompt: "Additional calendar days | reason", path: `data/reservations/${row.id}/extend` },
      { id: "no-show", label: "Record no-show", path: `data/reservations/${row.id}/no-show` }
    );
  }
  if (["Pending Approval", "Active"].includes(row.status)) actions.push(
    { id: "cancel", label: "Cancel", path: `data/reservations/${row.id}/cancel` }
  );
  return actions;
}

function actionsForOrder(row, role) {
  const actions = [];
  if (row.status === "Pending Payment" && !["Awaiting Verification", "Verified"].includes(row.payment_status)) {
    actions.push({ id:"record-payment", label:"Record GCash payment", prompt:"13-digit GCash reference", path:`data/orders/${row.id}/record-payment` });
  }
  if (row.status === "Pending Payment" && row.payment_status === "Awaiting Verification" && role === ADMIN) {
    actions.push({ id:"verify-payment", label:"Verify payment", path:`data/orders/${row.id}/verify-payment` });
  }
  return actions;
}

function actionsForRefund(row, role) {
  const actions = [];
  if (row.status === "Pending Approval" && role === ADMIN) actions.push(
    { id: "approve", label: "Approve", path: `data/refunds/${row.id}/approve` },
    { id: "reject", label: "Reject", prompt: "Reason for rejection", path: `data/refunds/${row.id}/reject` }
  );
  if (row.status === "Approved" && [ADMIN, SALES].includes(role)) actions.push(
    { id: "complete", label: "Record payout", prompt: "Payout method (Cash or GCash) | receipt/reference", path: `data/refunds/${row.id}/complete` }
  );
  if (["Completed", "Rejected"].includes(row.status) && !row.customer_notified_at && row.email) actions.push(
    { id: "notify", label: "Retry customer notice", path: `data/refunds/${row.id}/notify` }
  );
  return actions;
}

async function sendExpiryReminders() {
  await transaction(async (conn) => {
    const [due] = await conn.query(
      `SELECT reservation_id, reservation_no, requested_by, expires_at
         FROM reservations r
        WHERE r.status = 'Approved' AND r.payment_status = 'Unpaid'
          AND r.expires_at > NOW() AND r.expires_at <= DATE_ADD(NOW(), INTERVAL 24 HOUR)
          AND NOT EXISTS (SELECT 1 FROM audit_log a WHERE a.entity_type = 'reservation'
            AND a.entity_id = r.reservation_id AND a.action = 'Expiry Reminder Sent')
        ORDER BY r.expires_at FOR UPDATE`
    );
    for (const item of due) {
      const [[reservation]] = await conn.query(`SELECT status FROM reservations WHERE reservation_id = ? FOR UPDATE`, [item.reservation_id]);
      if (reservation?.status !== "Approved") continue;
      const [[sent]] = await conn.query(`SELECT audit_id FROM audit_log WHERE entity_type='reservation' AND entity_id=? AND action='Expiry Reminder Sent' LIMIT 1 FOR UPDATE`, [item.reservation_id]);
      if (sent) continue;
      await notifyUser(conn, item.requested_by, "Void Notice", `Hold expiring soon - ${item.reservation_no}`,
        `This unpaid reservation expires at ${item.expires_at}.`, "reservation", item.reservation_id);
      await notifyRoles(conn, [ADMIN, "Sales"], "Void Notice", `Hold expiring soon - ${item.reservation_no}`,
        `Unpaid reservation expires within 24 hours.`, "reservation", item.reservation_id, item.requested_by);
      await log(conn, { action: "Expiry Reminder Sent", type: "reservation", id: item.reservation_id,
        number: item.reservation_no, from: "Approved", to: "Approved", note: "Automated reminder; sent once." });
    }
  });
}

async function releaseReservation(conn, reservation, userId, reason) {
  const [items] = await conn.query(
    `SELECT ri.product_id, ri.quantity, p.sku, p.qty_available, p.qty_reserved
       FROM reservation_items ri JOIN products p ON p.product_id = ri.product_id
      WHERE ri.reservation_id = ? ORDER BY ri.product_id FOR UPDATE`, [reservation.reservation_id]
  );
  for (const item of items) {
    if (item.qty_reserved < item.quantity) throw new HttpError(409, `Reserved stock for ${item.sku} is inconsistent; no stock was changed.`);
    await conn.query(`UPDATE products SET qty_available = qty_available + ?, qty_reserved = qty_reserved - ? WHERE product_id = ?`,
      [item.quantity, item.quantity, item.product_id]);
    await moveStock(conn, { product: item, available: item.quantity, reserved: -item.quantity,
      type: "Reservation Release", refType: "Reservation", refId: reservation.reservation_id,
      refNo: reservation.reservation_no, userId, reason });
  }
}

async function voidExpiredReservations() {
  const [due] = await getPool().query(
    `SELECT reservation_id FROM reservations WHERE status = 'Approved' AND payment_status = 'Unpaid' AND expires_at < NOW()`
  );
  for (const { reservation_id: id } of due) {
    await transaction(async (conn) => {
      const [[reservation]] = await conn.query(`SELECT * FROM reservations WHERE reservation_id = ? FOR UPDATE`, [id]);
      if (!reservation || reservation.status !== "Approved" || reservation.payment_status !== "Unpaid") return;
      await releaseReservation(conn, reservation, null, "Unpaid at deadline; automatic expiry");
      await conn.query(`UPDATE reservations SET status = 'Expired', voided_at = NOW(), voided_by = NULL,
        void_reason = 'Unpaid at deadline (automatic expiry)' WHERE reservation_id = ?`, [id]);
      await notifyUser(conn, reservation.requested_by, "Void Notice", `Reservation expired - ${reservation.reservation_no}`,
        "The unpaid hold expired and its stock was released.", "reservation", id);
      await log(conn, { action: "Automatically Expired", type: "reservation", id, number: reservation.reservation_no,
        from: "Approved", to: "Expired", note: "Unpaid at deadline; held stock released." });
    });
  }
}

export async function getOperationsRecords(req, res) {
  const user = await requireUser(req);
  const db = getPool();
  await voidExpiredReservations();
  await sendExpiryReminders();
  const [[evidenceTable]] = await db.query(`SELECT COUNT(*) AS present FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='refund_evidence'`);
  const evidenceSelect = Number(evidenceTable.present) ? `(SELECT GROUP_CONCAT(evidence_id, ':', file_name SEPARATOR '\\n') FROM refund_evidence e WHERE e.refund_id=f.refund_id) AS evidence` : `NULL AS evidence`;
  const queries = [
    db.query(`SELECT p.product_id AS id, p.sku AS product_code, p.product_name, c.name AS category, p.size,
      p.cost_price, p.selling_price, p.qty_available AS stock_quantity, p.qty_reserved AS reserved_quantity,
      p.qty_defective AS defective_quantity, p.low_stock_threshold, p.status AS product_status
      FROM products p JOIN categories c ON c.category_id = p.category_id ORDER BY p.sku`),
    db.query(`SELECT customer_id AS id, customer_code AS customer_id, full_name, contact_number, address AS street_address,
      city AS city_municipality, province, email, is_verified FROM customers ORDER BY customer_id DESC`),
    db.query(`SELECT o.order_id AS id, o.order_no AS order_number, c.full_name AS customer_name,
      o.status, o.created_at AS ordered_at, o.total_amount,
      COALESCE((SELECT payment_status FROM payments p WHERE p.order_id=o.order_id ORDER BY p.payment_id DESC LIMIT 1),'Unpaid') AS payment_status,
      (SELECT GROUP_CONCAT(CONCAT(p.product_name, ' (',p.sku,') x',oi.quantity) SEPARATOR '; ')
         FROM order_items oi JOIN products p ON p.product_id=oi.product_id WHERE oi.order_id=o.order_id) AS items,
      s.tracking_number, s.shipment_status
      FROM orders o JOIN customers c ON c.customer_id=o.customer_id LEFT JOIN shipments s ON s.order_id=o.order_id
      ORDER BY o.created_at DESC, o.order_id DESC`),
    db.query(`SELECT r.reservation_id AS id, r.reservation_no AS reservation_number, c.full_name AS customer_name,
      c.contact_number, r.status AS raw_status, r.payment_status, r.expires_at, r.agreed_days AS reservation_days,
      r.requested_at, r.pickup_note AS notes, r.void_reason, r.reserve_amount AS amount,
      (SELECT GROUP_CONCAT(CONCAT(p.product_name,' (',p.sku,', ',p.size,') x',ri.quantity) SEPARATOR ', ')
         FROM reservation_items ri JOIN products p ON p.product_id=ri.product_id WHERE ri.reservation_id=r.reservation_id) AS items,
      (SELECT o.order_no FROM orders o WHERE o.reservation_id=r.reservation_id LIMIT 1) AS order_number,
      (SELECT o.status FROM orders o WHERE o.reservation_id=r.reservation_id LIMIT 1) AS order_status,
      EXISTS(SELECT 1 FROM audit_log a WHERE a.entity_type='reservation' AND a.entity_id=r.reservation_id AND a.action='Pickup Prepared') AS is_prepared,
      EXISTS(SELECT 1 FROM audit_log a WHERE a.entity_type='reservation' AND a.entity_id=r.reservation_id AND a.action='Pickup Handed Over') AS is_picked_up,
      CASE WHEN r.status='Approved' AND r.payment_status='Unpaid' THEN
        CASE WHEN r.expires_at<NOW() THEN 'Overdue' WHEN r.expires_at<=DATE_ADD(NOW(),INTERVAL 24 HOUR) THEN 'Expiring soon' ELSE 'On track' END ELSE '' END AS urgency,
      (SELECT COUNT(*) FROM audit_log a WHERE a.entity_type='reservation' AND a.entity_id=r.reservation_id AND a.action='Expiry Reminder Sent') AS reminders_sent,
      (SELECT GROUP_CONCAT(CONCAT(a.action,' — ',COALESCE(u.full_name,'System'),' — ',DATE_FORMAT(a.created_at,'%Y-%m-%d %H:%i'),IF(a.note IS NULL,'',CONCAT(': ',a.note))) ORDER BY a.created_at SEPARATOR '\n')
         FROM audit_log a LEFT JOIN users u ON u.user_id=a.actor_user_id WHERE a.entity_type='reservation' AND a.entity_id=r.reservation_id) AS timeline
      FROM reservations r JOIN customers c ON c.customer_id=r.customer_id ORDER BY r.requested_at DESC, r.reservation_id DESC`),
    db.query(`SELECT f.refund_id AS id, f.refund_no AS refund_number, o.order_no AS order_number, c.full_name AS customer_name,
      c.contact_number, c.email, f.issue_reason AS reason, f.inspection_note, f.refund_amount AS amount,
      f.approved_amount, f.status AS raw_status, f.refund_method, f.refund_receipt_no, f.requested_at AS refund_date,
      CASE WHEN f.status IN ('Condition Review','Awaiting Approval') AND f.requested_at<=DATE_SUB(NOW(),INTERVAL 3 DAY) THEN 'Urgent' ELSE '' END AS urgency,
      f.approved_at, f.refunded_at, f.customer_notified_at,
      (SELECT u.full_name FROM users u WHERE u.user_id=f.requested_by) AS requested_by_name,
      (SELECT u.full_name FROM users u WHERE u.user_id=f.approved_by) AS approved_by_name,
      (SELECT u.full_name FROM users u WHERE u.user_id=f.condition_reviewed_by) AS condition_reviewed_by_name,
      (SELECT u.full_name FROM users u WHERE u.user_id=f.refunded_by) AS refunded_by_name,
      (SELECT GROUP_CONCAT(CONCAT(p.product_name,' (',p.sku,') x',ri.quantity,' — ',ri.item_condition,' — ',ri.inventory_action) SEPARATOR '; ')
         FROM refund_items ri JOIN products p ON p.product_id=ri.product_id WHERE ri.refund_id=f.refund_id) AS items,
      ${evidenceSelect},
      (SELECT GROUP_CONCAT(CONCAT(a.action,' — ',COALESCE(u.full_name,'System'),' — ',DATE_FORMAT(a.created_at,'%Y-%m-%d %H:%i'),IF(a.note IS NULL,'',CONCAT(': ',a.note))) ORDER BY a.created_at SEPARATOR '\n')
         FROM audit_log a LEFT JOIN users u ON u.user_id=a.actor_user_id WHERE a.entity_type='refund' AND a.entity_id=f.refund_id) AS timeline
      FROM refunds f JOIN orders o ON o.order_id=f.order_id JOIN customers c ON c.customer_id=o.customer_id
      ORDER BY f.requested_at DESC, f.refund_id DESC`),
    db.query(`SELECT d.doc_number, d.doc_type, o.order_no AS order_number, u.full_name AS issued_by, d.issued_at
      FROM sales_documents d JOIN orders o ON o.order_id=d.order_id JOIN users u ON u.user_id=d.prepared_by
      WHERE d.issued_at IS NOT NULL ORDER BY d.issued_at DESC LIMIT 500`),
    db.query(`SELECT notification_id AS id, type AS category, title, message, is_read, created_at
      FROM notifications WHERE user_id=? ORDER BY created_at DESC, notification_id DESC LIMIT 50`, [user.user_id]),
    db.query(`SELECT a.audit_id, a.action, a.entity_type, a.entity_no, a.note, a.created_at, u.full_name
      FROM audit_log a LEFT JOIN users u ON u.user_id=a.actor_user_id ORDER BY a.audit_id DESC LIMIT 30`),
  ];
  const [[products], [customers], [orders], [reservationRows], [refundRows], [documents], [notifications], [activity]] = await Promise.all(queries);
  let accounts = [];
  if (user.role_name === ADMIN) {
    const [rows] = await db.query(`SELECT user_id AS id, email AS username, full_name,
      CASE role WHEN 'Sales' THEN 'Sales Management' WHEN 'Inventory' THEN 'Inventory Management' ELSE role END AS role,
      account_status AS status, last_login_at, created_at FROM users ORDER BY created_at DESC`);
    accounts = rows;
  }
  const reservations = reservationRows.map((r) => {
    const status = displayStatus(r.raw_status, r.void_reason);
    const row = { ...r, status, amount: money(r.amount), expires_at: r.expires_at ? new Date(r.expires_at).toISOString() : "" };
    row.actions = actionsForReservation(row, user.role_name);
    if (status === "Active" && row.is_prepared) row.pickup_status = row.is_picked_up ? "Picked up" : "Prepared";
    else if (status === "Active") row.pickup_status = "Awaiting preparation";
    return row;
  });
  const refunds = refundRows.map((r) => {
    const status = r.raw_status === "Awaiting Approval" ? "Pending Approval" : r.raw_status;
    const row = { ...r, status, amount: money(r.amount), refund_date: r.refund_date ? new Date(r.refund_date).toISOString() : "" };
    row.actions = actionsForRefund(row, user.role_name);
    return row;
  });
  const normalizedProducts = products.map((p) => ({ ...p, stock_quantity: Number(p.stock_quantity), reserved_quantity: Number(p.reserved_quantity),
    defective_quantity: Number(p.defective_quantity), cost_price: money(p.cost_price), selling_price: money(p.selling_price),
    status: p.product_status !== "Active" ? "Inactive" : Number(p.stock_quantity) <= Number(p.low_stock_threshold) ? "Low stock" : "In stock" }));
  const normalizedCustomers = customers.map((c) => ({ ...c, status: c.is_verified ? "Verified" : "Unverified" }));
  const normalizedOrders = orders.map((o) => {
    const row = { ...o, total_amount: money(o.total_amount), ordered_at: o.ordered_at ? new Date(o.ordered_at).toISOString() : "" };
    row.actions = actionsForOrder(row, user.role_name);
    return row;
  });
  const sales = normalizedOrders.filter((o) => ["For Shipping", "Shipped", "Completed"].includes(o.status)).map((o) => ({
    id: o.id, sale_no: o.order_number, order_no: o.order_number, amount: o.total_amount, cost: 0, sold_at: o.ordered_at,
  }));
  sendJson(res, 200, {
    products: normalizedProducts, customers: normalizedCustomers, orders: normalizedOrders, sales, reservations, refunds,
    documents: documents.map((d) => ({ ...d, issued_at: d.issued_at ? new Date(d.issued_at).toISOString() : "" })),
    accounts, notifications: notifications.map((n) => ({ ...n, is_read: Boolean(n.is_read), created_at: new Date(n.created_at).toISOString() })),
    recentActivity: activity.map((a) => ({ id: String(a.audit_id), message: `${a.full_name || "System"}: ${a.action}${a.entity_no ? ` (${a.entity_no})` : ""}${a.note ? ` — ${a.note}` : ""}`, createdAt: new Date(a.created_at).toISOString() })),
    pendingAccess: accounts.filter((a) => a.status === "Awaiting Approval").length,
    summary: { activeReservations: reservations.filter((r) => ["Pending Approval", "Active"].includes(r.status)).length,
      pendingOrders: normalizedOrders.filter((o) => ["Draft", "Pending Payment", "Awaiting Verification"].includes(o.status)).length,
      pendingRefunds: refunds.filter((r) => ["Pending Approval", "Condition Review"].includes(r.status)).length },
  });
}

export async function runOperationsMaintenance(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) throw new HttpError(401, "Unauthorized.");
  await voidExpiredReservations();
  await sendExpiryReminders();
  sendJson(res, 200, { ok: true });
}

export async function markOperationsNotificationsRead(req, res) {
  const user = await requireUser(req);
  await getPool().query(`UPDATE notifications SET is_read=1, read_at=NOW() WHERE user_id=? AND is_read=0`, [user.user_id]);
  sendJson(res, 200, { ok:true });
}

async function approveReservation(conn, user, id) {
  const [[r]] = await conn.query(`SELECT * FROM reservations WHERE reservation_id=? FOR UPDATE`, [id]);
  if (!r) throw new HttpError(404, "Reservation not found.");
  if (r.status !== "Awaiting Approval") throw new HttpError(409, `Reservation is already ${r.status}.`);
  const [items] = await conn.query(`SELECT ri.product_id, ri.quantity, p.sku, p.qty_available, p.qty_reserved
    FROM reservation_items ri JOIN products p ON p.product_id=ri.product_id WHERE ri.reservation_id=? ORDER BY p.product_id FOR UPDATE`, [id]);
  if (!items.length) throw new HttpError(409, "This reservation has no items.");
  for (const item of items) if (item.qty_available < item.quantity) throw new HttpError(409, `Not enough available stock for ${item.sku}.`);
  for (const item of items) {
    await conn.query(`UPDATE products SET qty_available=qty_available-?, qty_reserved=qty_reserved+? WHERE product_id=?`, [item.quantity, item.quantity, item.product_id]);
    await moveStock(conn, { product: item, available: -item.quantity, reserved: item.quantity, type: "Reservation Hold",
      refType: "Reservation", refId: id, refNo: r.reservation_no, userId: user.user_id, reason: "Reservation approved" });
  }
  await conn.query(`UPDATE reservations SET status='Approved', approved_by=?, approved_at=NOW(), hold_activated_at=NOW(),
    expires_at=DATE_ADD(requested_at, INTERVAL agreed_days-1 DAY) WHERE reservation_id=?`, [user.user_id, id]);
  await notifyUser(conn, r.requested_by, "Reservation Approved", `Reservation approved - ${r.reservation_no}`, "Your unpaid reservation is on hold until its deadline.", "reservation", id);
  await log(conn, { userId: user.user_id, action: "Approved and stock held", type: "reservation", id, number: r.reservation_no, from: r.status, to: "Approved" });
}

async function releaseAndSetStatus(conn, user, id, status, reason) {
  const [[r]] = await conn.query(`SELECT * FROM reservations WHERE reservation_id=? FOR UPDATE`, [id]);
  if (!r) throw new HttpError(404, "Reservation not found.");
  if (r.status !== "Approved" || r.payment_status !== "Unpaid") throw new HttpError(409, "Only an unpaid active hold can be released this way.");
  await releaseReservation(conn, r, user.user_id, reason);
  await conn.query(`UPDATE reservations SET status=?, voided_at=NOW(), voided_by=?, void_reason=? WHERE reservation_id=?`, [status, user.user_id, reason, id]);
  await log(conn, { userId: user.user_id, action: status === "Expired" ? "No-show recorded and stock released" : "Cancelled and stock released",
    type: "reservation", id, number: r.reservation_no, from: r.status, to: status, note: reason });
}

export async function runOperationRowAction(req, res, { kind, id: rawId, action }) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, "Invalid record ID.");
  const value = text(req.body?.value);
  let user;
  if (kind === "reservations") {
    const roleSet = ["approve", "reject"].includes(action) ? [ADMIN] : [ADMIN, SALES, INVENTORY];
    user = await requireRole(req, ...roleSet);
    await transaction(async (conn) => {
      const [[r]] = await conn.query(`SELECT * FROM reservations WHERE reservation_id=? FOR UPDATE`, [id]);
      if (!r) throw new HttpError(404, "Reservation not found.");
      if (action === "approve") return approveReservation(conn, user, id);
      if (action === "reject") {
        if (r.status !== "Awaiting Approval") throw new HttpError(409, "Only a pending reservation can be rejected.");
        if (!value) throw new HttpError(400, "A rejection reason is required.");
        await conn.query(`UPDATE reservations SET status='Rejected', rejection_reason=? WHERE reservation_id=?`, [value.slice(0,255), id]);
        await notifyUser(conn, r.requested_by, "Reservation Rejected", `Reservation rejected - ${r.reservation_no}`, value, "reservation", id);
        await log(conn, { userId:user.user_id, action:"Rejected", type:"reservation", id, number:r.reservation_no, from:r.status, to:"Rejected", note:value });
        return;
      }
      if (action === "cancel" && r.status === "Awaiting Approval") {
        await conn.query(`UPDATE reservations SET status='Cancelled', voided_at=NOW(), voided_by=?, void_reason='Cancelled before approval' WHERE reservation_id=?`, [user.user_id,id]);
        await log(conn,{userId:user.user_id,action:"Reservation Cancelled",type:"reservation",id,number:r.reservation_no,from:r.status,to:"Cancelled",note:"Cancelled before stock was held."});
        return;
      }
      if (action === "convert") {
        if (r.status !== "Approved" || r.payment_status !== "Unpaid") throw new HttpError(409,"Only an approved unpaid reservation can be checked out.");
        const [[existing]] = await conn.query(`SELECT order_id FROM orders WHERE reservation_id=? LIMIT 1 FOR UPDATE`,[id]);
        if(existing) throw new HttpError(409,"This reservation already has a checkout order.");
        const [items] = await conn.query(`SELECT ri.product_id,ri.quantity,ri.unit_price,p.sku,p.cost_price
          FROM reservation_items ri JOIN products p ON p.product_id=ri.product_id WHERE ri.reservation_id=? ORDER BY p.product_id`,[id]);
        const subtotal=items.reduce((sum,item)=>sum+Number(item.quantity)*Number(item.unit_price),0);
        const totalCost=items.reduce((sum,item)=>sum+Number(item.quantity)*Number(item.cost_price),0);
        const orderNo=await nextNumber(conn,"ORD","ORD");
        const [created]=await conn.query(`INSERT INTO orders (order_no,customer_id,reservation_id,order_source,status,subtotal,discount_amount,total_amount,total_cost,notes,created_by)
          VALUES (?,?,?,'Reservation','Pending Payment',?,0,?,?,?,?)`,
          [orderNo,r.customer_id,id,subtotal,subtotal,totalCost,r.pickup_note,user.user_id]);
        for(const item of items) await conn.query(`INSERT INTO order_items (order_id,product_id,quantity,unit_price,unit_cost,allocated_discount) VALUES (?,?,?,?,?,0)`,
          [created.insertId,item.product_id,item.quantity,item.unit_price,item.cost_price]);
        await notifyUser(conn,r.requested_by,"Reservation Approved",`Checkout ready - ${r.reservation_no}`,`Order ${orderNo} is ready for payment.`,"reservation",id);
        await log(conn,{userId:user.user_id,action:"Checkout Order Created",type:"reservation",id,number:r.reservation_no,from:r.status,to:r.status,note:orderNo});
        return;
      }
      if (action === "cancel") return releaseAndSetStatus(conn, user, id, "Cancelled", "Cancelled by staff");
      if (action === "no-show") {
        if (![ADMIN, SALES].includes(user.role_name)) throw new HttpError(403, "Admin or Sales staff can record a no-show.");
        return releaseAndSetStatus(conn, user, id, "Expired", "No-show");
      }
      if (action === "extend") {
        if (![ADMIN, SALES].includes(user.role_name)) throw new HttpError(403, "Admin or Sales staff can extend a reservation.");
        if (r.status !== "Approved" || r.payment_status !== "Unpaid") throw new HttpError(409, "Only an unpaid active hold can be extended.");
        const match = value.match(/^\s*(\d{1,3})\s*[|:]\s*(.+)$/);
        if (!match) throw new HttpError(400, "Enter additional days and a reason separated by |.");
        const days = Number(match[1]);
        const reason = match[2].trim().slice(0,500);
        if (days < 1 || Number(r.agreed_days) + days > 255 || !reason) throw new HttpError(400, "Days must be positive, total days at most 255, and reason is required.");
        await conn.query(`UPDATE reservations SET agreed_days=agreed_days+?, expires_at=DATE_ADD(expires_at, INTERVAL ? DAY) WHERE reservation_id=?`, [days, days, id]);
        await log(conn, { userId:user.user_id, action:"Hold Extended", type:"reservation", id, number:r.reservation_no, from:r.status, to:r.status, note:`${days} days added. ${reason}` });
        return;
      }
      if (["prepare", "handover"].includes(action)) {
        if (!["Approved", "Paid"].includes(r.status)) throw new HttpError(409, "Pickup steps require an approved reservation.");
        const event = action === "prepare" ? "Pickup Prepared" : "Pickup Handed Over";
        if (action === "handover") {
          const [[prepared]] = await conn.query(`SELECT audit_id FROM audit_log WHERE entity_type='reservation' AND entity_id=? AND action='Pickup Prepared' LIMIT 1`, [id]);
          if (!prepared) throw new HttpError(409, "Mark the items prepared before recording pickup.");
          if (r.payment_status !== "Paid") throw new HttpError(409, "Record payment before handing over the reserved items.");
        }
        const [[existing]] = await conn.query(`SELECT audit_id FROM audit_log WHERE entity_type='reservation' AND entity_id=? AND action=? LIMIT 1`, [id,event]);
        if (existing) throw new HttpError(409, "This pickup step has already been recorded.");
        await log(conn, { userId:user.user_id, action:event, type:"reservation", id, number:r.reservation_no, from:r.status, to:r.status, note:action === "prepare" ? "Items prepared for pickup." : "Items handed to customer." });
        return;
      }
      throw new HttpError(404, "Unknown reservation action.");
    });
    return sendJson(res, 200, { ok: true });
  }
  if (kind === "orders") {
    const rowActionRole = action === "verify-payment" ? [ADMIN] : [ADMIN, SALES];
    user = await requireRole(req, ...rowActionRole);
    await transaction(async (conn) => {
      const [[order]] = await conn.query(`SELECT * FROM orders WHERE order_id=? FOR UPDATE`,[id]);
      if(!order) throw new HttpError(404,"Order not found.");
      if(action === "record-payment") {
        if(order.status!=="Pending Payment") throw new HttpError(409,"This order is not awaiting payment.");
        const reference=value.replace(/[\s-]/g,"");
        if(!/^\d{13}$/.test(reference)) throw new HttpError(400,"Enter the 13-digit GCash reference number.");
        const [[pending]]=await conn.query(`SELECT payment_id FROM payments WHERE order_id=? AND payment_status='Awaiting Verification' LIMIT 1 FOR UPDATE`,[id]);
        if(pending) throw new HttpError(409,"A payment is already waiting for verification.");
        try {
          await conn.query(`INSERT INTO payments (order_id,payment_method,amount_paid,gcash_reference_no,payment_date,payment_status,recorded_by)
            VALUES (?,'GCash',?,?,NOW(),'Awaiting Verification',?)`,[id,order.total_amount,reference,user.user_id]);
        } catch(error) { if(error.code==="ER_DUP_ENTRY") throw new HttpError(409,"That GCash reference was already used."); throw error; }
        const [admins]=await conn.query(`SELECT user_id FROM users WHERE role='Admin' AND account_status='Active'`);
        for(const admin of admins) await notifyUser(conn,admin.user_id,"Payment To Verify",`Payment verification - ${order.order_no}`,"A GCash payment is waiting for verification.","order",id);
        await log(conn,{userId:user.user_id,action:"Payment Recorded",type:"order",id,number:order.order_no,from:order.status,to:order.status,note:`GCash reference ${reference}`});
        return;
      }
      if(action !== "verify-payment") throw new HttpError(404,"Unknown order action.");
      if(order.status!=="Pending Payment") throw new HttpError(409,"This order is not awaiting payment.");
      const [[payment]]=await conn.query(`SELECT * FROM payments WHERE order_id=? AND payment_status='Awaiting Verification' ORDER BY payment_id DESC LIMIT 1 FOR UPDATE`,[id]);
      if(!payment) throw new HttpError(409,"There is no payment waiting for verification.");
      if(order.stock_deducted_at) throw new HttpError(409,"Stock for this order was already deducted.");
      const [items]=await conn.query(`SELECT oi.product_id,oi.quantity,p.sku,p.qty_available,p.qty_reserved
        FROM order_items oi JOIN products p ON p.product_id=oi.product_id WHERE oi.order_id=? ORDER BY p.product_id FOR UPDATE`,[id]);
      for(const item of items) {
        if(order.reservation_id) {
          if(item.qty_reserved<item.quantity) throw new HttpError(409,`Reserved stock for ${item.sku} is inconsistent.`);
          await conn.query(`UPDATE products SET qty_reserved=qty_reserved-? WHERE product_id=?`,[item.quantity,item.product_id]);
          await moveStock(conn,{product:item,available:0,reserved:-item.quantity,type:"Sale",refType:"Order",refId:id,refNo:order.order_no,userId:user.user_id,reason:"Reserved stock sold after verified payment"});
        } else {
          if(item.qty_available<item.quantity) throw new HttpError(409,`Not enough available stock for ${item.sku}.`);
          await conn.query(`UPDATE products SET qty_available=qty_available-? WHERE product_id=?`,[item.quantity,item.product_id]);
          await moveStock(conn,{product:item,available:-item.quantity,type:"Sale",refType:"Order",refId:id,refNo:order.order_no,userId:user.user_id,reason:"Sale after verified payment"});
        }
      }
      await conn.query(`UPDATE payments SET payment_status='Verified',verified_by=?,verified_at=NOW() WHERE payment_id=?`,[user.user_id,payment.payment_id]);
      await conn.query(`UPDATE orders SET status='For Shipping',paid_at=NOW(),stock_deducted_at=NOW() WHERE order_id=?`,[id]);
      if(order.reservation_id) await conn.query(`UPDATE reservations SET status='Paid',payment_status='Paid' WHERE reservation_id=? AND status='Approved'`,[order.reservation_id]);
      await notifyUser(conn,order.created_by,"Payment Verified",`Payment verified - ${order.order_no}`,"Payment was verified and reserved stock was committed to the order.","order",id);
      await log(conn,{userId:user.user_id,action:"Payment Verified and Stock Committed",type:"order",id,number:order.order_no,from:order.status,to:"For Shipping"});
    });
    return sendJson(res,200,{ok:true});
  }
  if (kind !== "refunds") throw new HttpError(404, "Unknown operation.");
  user = await requireRole(req, ADMIN, SALES, INVENTORY);
  let notifyResult = null;
  await transaction(async (conn) => {
    const [[f]] = await conn.query(`SELECT f.*, o.order_no, o.customer_id, c.email, c.full_name
      FROM refunds f JOIN orders o ON o.order_id=f.order_id JOIN customers c ON c.customer_id=o.customer_id
      WHERE f.refund_id=? FOR UPDATE`, [id]);
    if (!f) throw new HttpError(404, "Refund not found.");
    if (action === "notify") {
      if (!["Completed", "Rejected"].includes(f.status)) throw new HttpError(409, "The customer is notified after a final refund result.");
      if (f.customer_notified_at) throw new HttpError(409, "The customer was already notified.");
      if (!f.email) throw new HttpError(409, "This customer has no email address on file.");
      notifyResult = f.status === "Completed"
        ? { email:f.email, name:f.full_name, number:f.refund_no, status:"completed", amount:f.approved_amount || f.refund_amount, receipt:f.refund_receipt_no, method:f.refund_method }
        : { email:f.email, name:f.full_name, number:f.refund_no, status:"rejected", reason:f.rejection_reason };
      return;
    }
    if (action === "approve" || action === "reject") {
      if (user.role_name !== ADMIN) throw new HttpError(403, "Only Admin can decide refunds.");
      if (f.status !== "Awaiting Approval") throw new HttpError(409, "The refund is not waiting for approval.");
      const note = value.slice(0,255);
      if (action === "reject" && !note) throw new HttpError(400, "A rejection reason is required.");
      const next = action === "approve" ? "Approved" : "Rejected";
      await conn.query(`UPDATE refunds SET status=?, approved_by=?, approved_at=NOW(), approved_amount=?, rejection_reason=? WHERE refund_id=?`,
        [next, user.user_id, action === "approve" ? f.refund_amount : null, action === "reject" ? note : null, id]);
      await notifyUser(conn, f.requested_by, "Refund Approved", `${action === "approve" ? "Refund approved" : "Refund rejected"} - ${f.refund_no}`,
        action === "approve" ? "The approved refund is ready for payout." : note, "refund", id);
      await log(conn, { userId:user.user_id, action:action === "approve" ? "Refund Approved" : "Refund Rejected", type:"refund", id, number:f.refund_no, from:f.status, to:next, note });
      if (action === "reject") notifyResult = { email:f.email, name:f.full_name, number:f.refund_no, status:"rejected", reason:note };
      return;
    }
    if (action !== "complete") throw new HttpError(404, "Unknown refund action.");
    if (![ADMIN, SALES].includes(user.role_name)) throw new HttpError(403, "Admin or Sales staff can record a refund payout.");
    if (f.status !== "Approved") throw new HttpError(409, "Only an approved refund can be paid.");
    const payout = value.match(/^\s*(Cash|GCash)\s*[|:]\s*(.+)$/i);
    if (!payout?.[2]?.trim()) throw new HttpError(400, "Enter Cash or GCash and the receipt/reference separated by |.");
    const payoutMethod = payout[1][0].toUpperCase() + payout[1].slice(1).toLowerCase();
    const receipt = payout[2].trim().slice(0,25);
    const [items] = await conn.query(`SELECT ri.*, p.sku, p.qty_available, p.qty_defective FROM refund_items ri
      JOIN products p ON p.product_id=ri.product_id WHERE ri.refund_id=? ORDER BY p.product_id FOR UPDATE`, [id]);
    if(!items.length) throw new HttpError(409,"This refund has no returned items to finalize.");
    for (const item of items) {
      if (item.inventory_action === "Return To Stock") {
        await conn.query(`UPDATE products SET qty_available=qty_available+? WHERE product_id=?`, [item.quantity,item.product_id]);
        await moveStock(conn, { product:item, available:item.quantity, type:"Refund Restock", refType:"Refund", refId:id, refNo:f.refund_no, userId:user.user_id, reason:"Non-defective refund return" });
      } else {
        await conn.query(`UPDATE products SET qty_defective=qty_defective+? WHERE product_id=?`, [item.quantity,item.product_id]);
        await moveStock(conn, { product:item, available:0, defective:item.quantity, type:"Defective Quarantine", refType:"Refund", refId:id, refNo:f.refund_no, userId:user.user_id, reason:"Defective refund return quarantined" });
      }
    }
    let result;
    try {
      [result] = await conn.query(`UPDATE refunds SET status='Completed', refund_method=?, refunded_by=?, refunded_at=NOW(), refund_receipt_no=? WHERE refund_id=? AND status='Approved'`, [payoutMethod, user.user_id, receipt, id]);
    } catch(error) { if(error.code==="ER_DUP_ENTRY") throw new HttpError(409,"That receipt/reference number has already been used."); throw error; }
    if (!result.affectedRows) throw new HttpError(409, "This refund was already finalized.");
    await log(conn, { userId:user.user_id, action:"Refund Paid and Finalized", type:"refund", id, number:f.refund_no, from:f.status, to:"Completed", note:`${payoutMethod}; receipt ${receipt}` });
    notifyResult = { email:f.email, name:f.full_name, number:f.refund_no, status:"completed", amount:f.approved_amount || f.refund_amount, receipt, method:payoutMethod };
  });
  if (notifyResult?.email) {
    try {
      await sendRefundStatusEmail(notifyResult.email, notifyResult.name, notifyResult);
      await getPool().query(`UPDATE refunds SET customer_notified_at=NOW() WHERE refund_id=? AND status IN ('Completed','Rejected')`, [id]);
      await getPool().query(`INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, entity_no, note) VALUES (?, 'Customer Notified', 'refund', ?, ?, ?)`,
        [user.user_id, id, notifyResult.number, notifyResult.status]);
    } catch (error) {
      console.error("Refund customer email failed:", error.code || error.message);
      await getPool().query(`INSERT INTO audit_log (actor_user_id,action,entity_type,entity_id,entity_no,note)
        VALUES (?,'Customer Notification Failed','refund',?,?,?)`,[user.user_id,id,notifyResult.number,String(error.code||error.message).slice(0,500)]).catch(() => {});
    }
  }
  sendJson(res, 200, { ok: true, customerNotified: Boolean(notifyResult?.email) });
}

async function findCustomer(conn, term) {
  const [rows] = await conn.query(`SELECT * FROM customers WHERE customer_code=? OR contact_number=? OR LOWER(full_name)=LOWER(?) LIMIT 2`, [term,term,term]);
  if (!rows.length) throw new HttpError(404, "Customer not found.");
  if (rows.length > 1) throw new HttpError(409, "More than one matching customer. Use the customer code or contact number.");
  return rows[0];
}

export async function runOperationFormAction(req, res) {
  const user = await requireUser(req);
  requireFields(req.body, ["screenId"]);
  const v = req.body.values && typeof req.body.values === "object" ? req.body.values : {};
  const screenId = req.body.screenId;
  const result = await transaction(async (conn) => {
    if (["5.1-new-reservation", "8.6-mobile-new-reservation"].includes(screenId)) {
      if (![ADMIN, SALES].includes(user.role_name)) throw new HttpError(403,"Admin or Sales staff can request a reservation.");
      const customer = await findCustomer(conn, text(v.Customer));
      const [products] = await conn.query(`SELECT * FROM products WHERE status='Active' AND (sku=? OR LOWER(product_name)=LOWER(?)) LIMIT 2 FOR UPDATE`, [text(v.Product),text(v.Product)]);
      if (!products.length) throw new HttpError(404, "Product not found.");
      if (products.length > 1) throw new HttpError(409, "More than one product matches; use the SKU.");
      const product=products[0], quantity=Number(v.Quantity), days=Number(v["Agreed days"]);
      if (!Number.isInteger(quantity)||quantity<1||!Number.isInteger(days)||days<1||days>255) throw new HttpError(400,"Enter a valid quantity and 1–255 agreed days.");
      if (product.qty_available<quantity) throw new HttpError(409,`Only ${product.qty_available} units are available.`);
      const number=await nextNumber(conn,"RSV","RSV");
      const amount=Number(product.selling_price)*quantity;
      const [created]=await conn.query(`INSERT INTO reservations (reservation_no,customer_id,fulfillment_type,requested_by,requested_at,agreed_days,expires_at,subtotal,discount_amount,reserve_amount,pickup_note)
        VALUES (?,?,'Store Pickup',?,NOW(),?,DATE_ADD(NOW(),INTERVAL ? DAY),?,0,?,?)`,
        [number,customer.customer_id,user.user_id,days,days-1,amount,amount,text(v["Pickup note"]).slice(0,255)||null]);
      await conn.query(`INSERT INTO reservation_items (reservation_id,product_id,quantity,unit_price) VALUES (?,?,?,?)`,[created.insertId,product.product_id,quantity,product.selling_price]);
      await notifyRoles(conn,["Admin"],"Reservation Request",`Reservation request - ${number}`,"A reservation needs approval.","reservation",created.insertId);
      await log(conn,{userId:user.user_id,action:"Reservation Requested",type:"reservation",id:created.insertId,number,from:null,to:"Awaiting Approval",note:text(v["Pickup note"])||null});
      return { entity:"reservation", id:created.insertId, action:"Reservation Requested" };
    }
    if (screenId === "3.4-new-refund-request") {
      if (![SALES,ADMIN].includes(user.role_name)) throw new HttpError(403,"Sales or Admin access is required.");
      const term=text(v["Order number"]);
      const [[order]]=await conn.query(`SELECT o.*, c.customer_id AS owner_id FROM orders o JOIN customers c ON c.customer_id=o.customer_id WHERE o.order_no=? FOR UPDATE`,[term]);
      if(!order) throw new HttpError(404,"Order not found.");
      if(order.status!=="Completed") throw new HttpError(409,"Refunds are available only for completed orders.");
      const [matches]=await conn.query(`SELECT oi.*,p.sku,p.product_name FROM order_items oi JOIN products p ON p.product_id=oi.product_id
        WHERE oi.order_id=? AND (p.sku=? OR LOWER(p.product_name)=LOWER(?)) LIMIT 2 FOR UPDATE`,[order.order_id,text(v["Returned item"]),text(v["Returned item"])]);
      if(matches.length!==1) throw new HttpError(404,"Choose one item from the original order by SKU.");
      const item=matches[0], quantity=Number(v["Return quantity"]);
      if(!Number.isInteger(quantity)||quantity<1) throw new HttpError(400,"Return quantity must be a positive whole number.");
      const [[returned]]=await conn.query(`SELECT COALESCE(SUM(ri.quantity),0) AS quantity FROM refund_items ri JOIN refunds f ON f.refund_id=ri.refund_id
        WHERE ri.order_item_id=? AND f.status<>'Rejected'`,[item.order_item_id]);
      const eligible=Number(item.quantity)-Number(returned.quantity);
      if(quantity>eligible) throw new HttpError(409,eligible>0?`Only ${eligible} unrefunded unit(s) remain.`:"No refundable units remain for this item.");
      const days=Math.max(0,Math.floor((Date.now()-new Date(order.created_at).getTime())/86400000));
      const method=text(v["Requested method"])||"Cash";
      if(!["Cash","GCash"].includes(method)) throw new HttpError(400,"Choose Cash or GCash.");
      const listAmount=Number(item.unit_price)*quantity;
      const discountShare=Number(item.allocated_discount)*quantity/Number(item.quantity);
      const maximum=Math.round((listAmount-discountShare)*100)/100;
      const number=await nextNumber(conn,"RFD","RFD");
      const [created]=await conn.query(`INSERT INTO refunds (refund_no,order_id,requested_by,days_of_ownership,issue_reason,inspection_note,refund_method,refund_amount,status)
        VALUES (?,?,?,?,?,?,?,?,'Condition Review')`,[number,order.order_id,user.user_id,days,text(v["Issue / reason"]).slice(0,255),text(v["Inspection note"]).slice(0,500)||null,method,maximum]);
      const condition=text(v["Item condition"])==="Damaged"||text(v["Item condition"])==="Defective"?"Defective":"Non-defective";
      await conn.query(`INSERT INTO refund_items (refund_id,order_item_id,product_id,quantity,item_condition,inventory_action,list_amount,discount_share,max_refund_amount,refund_amount)
        VALUES (?,?,?,?,?,?,?,?,?,?)`,[created.insertId,item.order_item_id,item.product_id,quantity,condition,condition==="Defective"?"Exclude From Stock":"Return To Stock",listAmount,discountShare,maximum,maximum]);
      for(const file of Array.isArray(v["Evidence files"])?v["Evidence files"]:[]) await insertEvidence(conn,created.insertId,user.user_id,file);
      await notifyRoles(conn,["Inventory"],"Refund Request",`Return inspection - ${number}`,"A returned item is awaiting physical inspection.","refund",created.insertId);
      await log(conn,{userId:user.user_id,action:"Refund Requested",type:"refund",id:created.insertId,number,from:null,to:"Condition Review",note:text(v["Issue / reason"])});
      return { entity:"refund",id:created.insertId,action:"Refund Requested" };
    }
    if(screenId==="3.5-refund-condition-review") {
      if(![INVENTORY,ADMIN].includes(user.role_name)) throw new HttpError(403,"Inventory or Admin access is required to inspect returned items.");
      const number=text(v["Refund ticket"]);
      const [[f]]=await conn.query(`SELECT * FROM refunds WHERE refund_no=? FOR UPDATE`,[number]);
      if(!f) throw new HttpError(404,"Refund not found.");
      if(f.status!=="Condition Review") throw new HttpError(409,"This refund is not waiting for condition review.");
      const disposition=text(v["Inventory disposition"]);
      if(!["Restock","Defective","Discard"].includes(disposition)) throw new HttpError(400,"Choose a valid inventory disposition.");
      const condition=disposition==="Restock"?"Non-defective":"Defective";
      const stockAction=disposition==="Restock"?"Return To Stock":"Exclude From Stock";
      const note=[text(v["Inspection result"]),text(v["Review note"])].filter(Boolean).join(" — ").slice(0,500);
      await conn.query(`UPDATE refund_items SET item_condition=?,inventory_action=? WHERE refund_id=?`,[condition,stockAction,f.refund_id]);
      await conn.query(`UPDATE refunds SET status='Awaiting Approval',inspection_note=?,condition_reviewed_by=?,condition_reviewed_at=NOW() WHERE refund_id=?`,[note,f.refund_id]);
      await notifyRoles(conn,["Admin"],"Refund Request",`Refund approval - ${number}`,"Condition review is complete and the refund awaits approval.","refund",f.refund_id);
      await log(conn,{userId:user.user_id,action:"Return Received and Inspected",type:"refund",id:f.refund_id,number,from:f.status,to:"Awaiting Approval",note});
      return { entity:"refund",id:f.refund_id,action:"Refund Condition Reviewed" };
    }
    throw new HttpError(404,"This form is not available.");
  });
  sendJson(res,200,{ok:true,...result});
}

async function insertEvidence(conn, refundId, userId, file) {
  const [[evidenceTable]] = await conn.query(`SELECT COUNT(*) AS present FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='refund_evidence'`);
  if (!Number(evidenceTable.present)) throw new HttpError(503,"Evidence storage has not been installed. Apply scripts/migrations/001_refund_evidence.sql first.");
  if (!file || typeof file.name!=="string" || typeof file.data!=="string") throw new HttpError(400,"Invalid evidence file.");
  const match=file.data.match(/^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/);
  if(!match) throw new HttpError(400,"Evidence must be a PNG, JPG, WEBP, or PDF file.");
  const bytes=Buffer.from(match[2],"base64");
  if(!bytes.length||bytes.length>2*1024*1024) throw new HttpError(400,"Each evidence file must be at most 2 MB.");
  await conn.query(`INSERT INTO refund_evidence (refund_id,file_name,mime_type,file_size,file_data,uploaded_by) VALUES (?,?,?,?,?,?)`,
    [refundId,file.name.replace(/[\\/\r\n]/g,"_").slice(0,180),match[1],bytes.length,bytes,userId]);
}

export async function getRefundEvidence(req,res,{id:rawId}) {
  await requireRole(req,ADMIN,SALES,INVENTORY);
  const id=Number(rawId);
  if(!Number.isInteger(id)||id<1) throw new HttpError(400,"Invalid evidence ID.");
  let file;
  try { [[file]]=await getPool().query(`SELECT file_name,mime_type,file_data FROM refund_evidence WHERE evidence_id=?`,[id]); }
  catch(error) { if(error.code==="ER_NO_SUCH_TABLE") throw new HttpError(503,"Refund evidence storage is not installed yet."); throw error; }
  if(!file) throw new HttpError(404,"Evidence file not found.");
  res.setHeader("Cache-Control","private, no-store");
  res.setHeader("Content-Type",file.mime_type);
  res.setHeader("Content-Disposition",`inline; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
  res.status(200).send(file.file_data);
}
