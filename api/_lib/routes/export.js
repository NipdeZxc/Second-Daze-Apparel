import { getPool } from "../../_db.js";
import { HttpError } from "../http.js";
import { audit, requireRole } from "../auth.js";

const EXPORTABLE = new Set([
  "products",
  "customers",
  "orders",
  "order_items",
  "payments",
  "shipments",
  "reservations",
  "reservation_items",
  "refunds",
  "refund_items",
  "stock_movements",
  "invoices",
  "purchase_orders",
  "delivery_receipts",
  "audit_log",
  "v_order_totals",
  "v_weekly_sales",
]);

function cell(value) {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  // Stop spreadsheet apps from running text that starts like a formula.
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function exportTable(req, res, params) {
  const admin = await requireRole(req, "Admin");
  if (!EXPORTABLE.has(params.name)) throw new HttpError(404, "Unknown export.");
  const [rows] = await getPool().query(`SELECT * FROM \`${params.name}\``);

  const columns = rows.length ? Object.keys(rows[0]) : [];
  const lines = [columns.join(","), ...rows.map((row) => columns.map((c) => cell(row[c])).join(","))];
  await audit(admin.user_id, "export", "table", null, params.name);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${params.name}.csv"`);
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(`\uFEFF${lines.join("\r\n")}`);
}
