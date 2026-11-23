import { getPool } from "../../_db.js";
import { HttpError } from "../http.js";
import { audit, requireRole } from "../auth.js";
import { withTransaction } from "./data.js";
import { supportedDatasetFiles, validateDatasetBatchFiles } from "./dataset-import.js";

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
  if (params.name === "backup") {
    const csv = await withTransaction(createBackupCsv);
    await audit(admin.user_id, "export", "dataset", null, "Business-data backup");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="second-daze-backup.csv"');
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(csv);
  }
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

export async function createBackupCsv(conn) {
  const [staff] = await conn.query("SELECT user_id, username FROM users");
  const files = [];
  const referencedStaff = new Set();
  for (const spec of supportedDatasetFiles.filter((item) => item.table !== "users")) {
    const [rows] = await conn.query(
      `SELECT ${spec.columns.map((column) => `\`${column}\``).join(", ")} FROM \`${spec.table}\``
    );
    if (!rows.length) continue;
    const records = rows.map((row) => Object.fromEntries(spec.columns.map((column) => {
      const value = row[column];
      if (["created_by", "updated_by", "verified_by", "approved_by", "issued_by", "recorded_by", "performed_by", "requested_by"].includes(column)
          && value != null) referencedStaff.add(String(value));
      return [column, value instanceof Date ? value.toISOString() : value];
    })));
    files.push({ fileName: spec.file, table: spec.table, records, referenceMode: "backup" });
  }
  if (!files.length) throw new HttpError(400, "There is no business data to back up.");
  const userReferences = staff.filter((user) => referencedStaff.has(String(user.user_id)))
    .map((user) => ({ user_id: String(user.user_id), username: user.username }));
  for (const file of files) file.userReferences = userReferences;
  validateDatasetBatchFiles(files);
  const lines = [
    "record_type,record_data",
    `${cell("__backup")},${cell(JSON.stringify({ version: 1, userReferences }))}`,
    ...files.flatMap((file) => file.records.map((record) => `${cell(file.table)},${cell(JSON.stringify(record))}`)),
  ];
  const csv = `\uFEFF${lines.join("\r\n")}`;
  if (Buffer.byteLength(csv, "utf8") > 2 * 1024 * 1024) {
    throw new HttpError(413, "The backup exceeds the 2 MB import limit. Export individual tables instead.");
  }
  return csv;
}
