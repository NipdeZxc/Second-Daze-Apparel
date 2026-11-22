import crypto from "node:crypto";
import { getPool } from "../../_db.js";
import { HttpError, sendJson } from "../http.js";
import { notify, voidExpiredReservations, withTransaction } from "./data.js";

const REMINDER_HOURS = 24;

// Sends one "expiring soon" notice per active reservation whose hold ends within 24 hours.
export async function sendExpiryReminders() {
  const [due] = await getPool().query(
    `SELECT r.reservation_id FROM reservations r
      WHERE r.reservation_status = 'Active'
        AND r.expiry_date > ? AND r.expiry_date <= DATE_ADD(?, INTERVAL ? HOUR)
        AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.reservation_id = r.reservation_id)
        AND NOT EXISTS (SELECT 1 FROM notifications n
                         WHERE n.reference_type = 'Reservation' AND n.reference_id = r.reservation_id
                           AND n.category = 'Reservation' AND n.message LIKE '%expires within%')`,
    [new Date(), new Date(), REMINDER_HOURS]
  );
  let sent = 0;
  for (const { reservation_id: id } of due) {
    sent += await withTransaction(async (conn) => {
      const [rows] = await conn.query(
        `SELECT reservation_number, reservation_status, created_by FROM reservations WHERE reservation_id = ? FOR UPDATE`,
        [id]
      );
      if (rows[0]?.reservation_status !== "Active") return 0;
      const message = `${rows[0].reservation_number} expires within ${REMINDER_HOURS} hours and its stock will be released if unpaid.`;
      await notify(conn, { userId: rows[0].created_by, category: "Reservation", message, refType: "Reservation", refId: id });
      await notify(conn, { role: "Sales Management", category: "Reservation", message, refType: "Reservation", refId: id });
      return 1;
    });
  }
  return sent;
}

// Scheduled job (Vercel Cron): voids unpaid reservations past their agreed days, releases stock and notifies.
export async function runOperationsMaintenance(req, res) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(String(req.headers.authorization || ""));
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    throw new HttpError(401, "Unauthorized.");
  }
  await voidExpiredReservations();
  const reminders = await sendExpiryReminders();
  sendJson(res, 200, { ok: true, reminders });
}
