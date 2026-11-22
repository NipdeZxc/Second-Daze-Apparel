import { HttpError, sendJson } from "../http.js";
import { requireRole } from "../auth.js";
import { withTransaction } from "./data.js";

const ADMIN = "Admin";
const MAX_FILES = 15;
const MAX_ROWS = 10000;
const MAX_REQUEST_BYTES = 3 * 1024 * 1024;
const INSERT_CHUNK_SIZE = 250;

const specs = [
  {
    file: "user.csv", table: "users", primaryKey: "user_id", maxId: 4294967295n,
    columns: ["user_id", "role_id", "full_name", "username", "email", "password_hash", "must_change_password", "account_status", "failed_login_count", "locked_until", "created_by", "approved_by", "approved_at", "created_at"],
    foreignKeys: { created_by: "users", approved_by: "users" },
  },
  {
    file: "customer.csv", table: "customers", primaryKey: "customer_id", maxId: 4294967295n,
    columns: ["customer_id", "full_name", "contact_number", "social_media_name", "street_address", "barangay", "city_municipality", "province", "postal_code", "entry_source", "info_verified", "verified_by", "verified_at", "returned_parcels", "created_by", "created_at"],
    foreignKeys: { verified_by: "users", created_by: "users" },
  },
  {
    file: "product.csv", table: "products", primaryKey: "product_id", maxId: 4294967295n,
    columns: ["product_id", "product_code", "product_name", "category", "size", "cost_price", "selling_price", "stock_quantity", "reserved_quantity", "defective_quantity", "low_stock_threshold", "is_active", "created_by", "updated_by"],
    foreignKeys: { created_by: "users", updated_by: "users" },
  },
  {
    file: "reservation.csv", table: "reservations", primaryKey: "reservation_id", maxId: 4294967295n,
    columns: ["reservation_id", "reservation_number", "customer_id", "reservation_days", "reservation_status", "notes", "created_by", "approved_by", "approved_at", "expiry_date", "voided_at", "void_reason", "created_at"],
    foreignKeys: { customer_id: "customers", created_by: "users", approved_by: "users" },
  },
  {
    file: "orders.csv", table: "orders", primaryKey: "order_id", maxId: 4294967295n,
    columns: ["order_id", "order_number", "customer_id", "reservation_id", "order_date", "order_status", "notes", "created_by", "approved_by", "approved_at"],
    foreignKeys: { customer_id: "customers", reservation_id: "reservations", created_by: "users", approved_by: "users" },
  },
  {
    file: "reservation_item.csv", table: "reservation_items", primaryKey: "reservation_item_id", maxId: 4294967295n,
    columns: ["reservation_item_id", "reservation_id", "product_id", "quantity", "unit_price"],
    foreignKeys: { reservation_id: "reservations", product_id: "products" },
  },
  {
    file: "order_item.csv", table: "order_items", primaryKey: "order_item_id", maxId: 4294967295n,
    columns: ["order_item_id", "order_id", "product_id", "quantity", "unit_price", "unit_cost"],
    foreignKeys: { order_id: "orders", product_id: "products" },
  },
  {
    file: "payment.csv", table: "payments", primaryKey: "payment_id", maxId: 4294967295n,
    columns: ["payment_id", "order_id", "payment_method", "gcash_reference_number", "amount_paid", "payment_status", "rejection_reason", "paid_at", "recorded_at", "recorded_by", "verified_by", "verified_at"],
    foreignKeys: { order_id: "orders", recorded_by: "users", verified_by: "users" },
  },
  {
    file: "shipment.csv", table: "shipments", primaryKey: "shipment_id", maxId: 4294967295n,
    columns: ["shipment_id", "order_id", "courier", "tracking_number", "shipment_status", "shipped_at", "delivered_at", "received_by", "return_reason", "updated_by"],
    foreignKeys: { order_id: "orders", updated_by: "users" },
  },
  {
    file: "purchase_order.csv", table: "purchase_orders", primaryKey: "po_id", maxId: 4294967295n,
    columns: ["po_id", "po_number", "order_id", "issued_at", "issued_by"],
    foreignKeys: { order_id: "orders", issued_by: "users" },
  },
  {
    file: "invoice.csv", table: "invoices", primaryKey: "invoice_id", maxId: 4294967295n,
    columns: ["invoice_id", "invoice_number", "order_id", "issued_at", "issued_by"],
    foreignKeys: { order_id: "orders", issued_by: "users" },
  },
  {
    file: "delivery_receipt.csv", table: "delivery_receipts", primaryKey: "dr_id", maxId: 4294967295n,
    columns: ["dr_id", "dr_number", "order_id", "shipment_id", "delivered_at", "issued_at", "issued_by"],
    foreignKeys: { order_id: "orders", shipment_id: "shipments", issued_by: "users" },
  },
  {
    file: "refund.csv", table: "refunds", primaryKey: "refund_id", maxId: 4294967295n,
    columns: ["refund_id", "refund_number", "order_id", "customer_id", "refund_date", "days_of_ownership", "issue_description", "inspection_note", "refund_amount", "refund_status", "requested_by", "approved_by", "approved_at", "decision_note"],
    foreignKeys: { order_id: "orders", customer_id: "customers", requested_by: "users", approved_by: "users" },
  },
  {
    file: "refund_item.csv", table: "refund_items", primaryKey: "refund_item_id", maxId: 4294967295n,
    columns: ["refund_item_id", "refund_id", "order_item_id", "quantity", "is_defective"],
    foreignKeys: { refund_id: "refunds", order_item_id: "order_items" },
  },
  {
    file: "stock_movement.csv", table: "stock_movements", primaryKey: "movement_id", maxId: 18446744073709551615n,
    columns: ["movement_id", "product_id", "movement_type", "quantity_change", "reference_type", "reference_id", "remarks", "performed_by", "created_at"],
    foreignKeys: { product_id: "products", performed_by: "users" },
  },
];

const byTable = new Map(specs.map((spec) => [spec.table, spec]));
const byFile = new Map(specs.map((spec) => [spec.file, spec]));
const importOrder = specs.map((spec) => spec.table);
export const supportedDatasetFiles = specs.map(({ file, table }) => ({ file, table }));
const STOCK_REFERENCE_TABLES = {
  Order: "orders",
  Reservation: "reservations",
  Refund: "refunds",
  Product: "products",
  // The legacy dataset's Purchase Order references contain order IDs.
  "Purchase Order": "orders",
};

function sourceId(value, label) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw) || BigInt(raw) <= 0n) throw new HttpError(400, `${label} must be a positive whole number.`);
  return BigInt(raw).toString();
}

export function validateDatasetBatchFiles(files) {
  if (!Array.isArray(files) || files.length === 0 || files.length > MAX_FILES) {
    throw new HttpError(400, `Select between 1 and ${MAX_FILES} supported CSV files.`);
  }
  if (Buffer.byteLength(JSON.stringify(files), "utf8") > MAX_REQUEST_BYTES) {
    throw new HttpError(413, "The combined dataset import must be 3 MB or smaller.");
  }

  const seenTables = new Set();
  const sourceIdsByTable = new Map();
  let totalRows = 0;
  for (const file of files) {
    if (!file || typeof file !== "object" || Array.isArray(file)) throw new HttpError(400, "Invalid dataset file.");
    const spec = byTable.get(file.table);
    if (!spec || file.fileName !== spec.file || byFile.get(file.fileName) !== spec) {
      throw new HttpError(400, "A selected file does not match a supported TiDB dataset table.");
    }
    if (seenTables.has(spec.table)) throw new HttpError(400, `Only one ${spec.file} file can be imported at a time.`);
    seenTables.add(spec.table);
    if (!Array.isArray(file.records) || file.records.length === 0 || file.records.length > 5000) {
      throw new HttpError(400, `${spec.file} must contain between 1 and 5,000 rows.`);
    }
    totalRows += file.records.length;
    if (totalRows > MAX_ROWS) throw new HttpError(400, `A dataset batch may contain at most ${MAX_ROWS} rows.`);

    const seenIds = new Set();
    for (const [index, record] of file.records.entries()) {
      if (!record || typeof record !== "object" || Array.isArray(record)) {
        throw new HttpError(400, `${spec.file} row ${index + 1} is invalid.`);
      }
      const keys = Object.keys(record).sort();
      const expected = [...spec.columns].sort();
      if (keys.length !== expected.length || keys.some((key, position) => key !== expected[position])) {
        throw new HttpError(400, `${spec.file} row ${index + 1} has columns that do not match the TiDB schema.`);
      }
      const id = sourceId(record[spec.primaryKey], `${spec.file} row ${index + 1} ${spec.primaryKey}`);
      if (seenIds.has(id)) throw new HttpError(409, `${spec.file} contains duplicate ${spec.primaryKey} ${id}.`);
      seenIds.add(id);
    }
    sourceIdsByTable.set(spec.table, seenIds);
  }
  for (const file of files) {
    const spec = byTable.get(file.table);
    for (const [column, parentTable] of Object.entries(spec.foreignKeys)) {
      for (const [index, record] of file.records.entries()) {
        if (record[column] == null || record[column] === "") continue;
        if (!seenTables.has(parentTable)) {
          throw new HttpError(400, `${spec.file} references ${parentTable}; include ${byTable.get(parentTable).file} in the same batch so IDs can be mapped safely.`);
        }
        const id = sourceId(record[column], `${spec.file} row ${index + 1} ${column}`);
        if (!sourceIdsByTable.get(parentTable).has(id)) {
          throw new HttpError(400, `${spec.file} row ${index + 1} references a ${parentTable} ID that is not included in the batch.`);
        }
      }
    }
    if (spec.table === "stock_movements") {
      for (const [index, record] of file.records.entries()) {
        const parentTable = STOCK_REFERENCE_TABLES[record.reference_type];
        if (!parentTable || record.reference_id == null || record.reference_id === "") continue;
        if (!seenTables.has(parentTable)) {
          throw new HttpError(400, `stock_movement.csv references ${parentTable}; include ${byTable.get(parentTable).file} in the same batch so IDs can be mapped safely.`);
        }
        const id = sourceId(record.reference_id, `stock_movement.csv row ${index + 1} reference_id`);
        if (!sourceIdsByTable.get(parentTable).has(id)) {
          throw new HttpError(400, `stock_movement.csv row ${index + 1} references a ${parentTable} ID that is not included in the batch.`);
        }
      }
    }
  }
  return { totalRows, seenTables };
}

async function allocateIds(conn, files) {
  const maps = new Map();
  for (const table of importOrder) {
    if (!files.has(table)) continue;
    const spec = byTable.get(table);
    const [[row]] = await conn.query(`SELECT COALESCE(MAX(\`${spec.primaryKey}\`), 0) AS max_id FROM \`${spec.table}\``);
    let nextId = BigInt(row.max_id ?? 0) + 1n;
    if (nextId + BigInt(files.get(table).records.length) - 1n > spec.maxId) {
      throw new HttpError(409, `No ${spec.primaryKey} range is available for ${spec.file}.`);
    }
    const map = new Map();
    for (const record of files.get(table).records) {
      const source = sourceId(record[spec.primaryKey], `${spec.file} ${spec.primaryKey}`);
      map.set(source, (nextId++).toString());
    }
    maps.set(table, map);
  }
  return maps;
}

function remapReferences(spec, record, idMaps) {
  const row = { ...record };
  row[spec.primaryKey] = idMaps.get(spec.table).get(sourceId(row[spec.primaryKey], spec.primaryKey));
  for (const [column, parentTable] of Object.entries(spec.foreignKeys)) {
    if (row[column] == null || row[column] === "") continue;
    const parentMap = idMaps.get(parentTable);
    const mapped = parentMap?.get(sourceId(row[column], `${spec.file} ${column}`));
    if (mapped) row[column] = mapped;
  }
  if (spec.table === "stock_movements" && row.reference_id != null) {
    const parentTable = STOCK_REFERENCE_TABLES[row.reference_type];
    const mapped = parentTable && idMaps.get(parentTable)?.get(sourceId(row.reference_id, "stock movement reference_id"));
    if (mapped) row.reference_id = mapped;
  }
  return row;
}

async function insertChunk(conn, spec, records, start) {
  const columns = spec.columns.map((column) => `\`${column}\``).join(", ");
  const rowPlaceholders = `(${spec.columns.map(() => "?").join(", ")})`;
  const placeholders = records.map(() => rowPlaceholders).join(", ");
  const values = records.flatMap((record) => spec.columns.map((column) => record[column] ?? null));
  try {
    await conn.query(`INSERT INTO \`${spec.table}\` (${columns}) VALUES ${placeholders}`, values);
  } catch (error) {
    console.error(`Dataset import failed for ${spec.file}, rows ${start}-${start + records.length - 1}:`, error);
    const status = error.code === "ER_DUP_ENTRY" ? 409 : 400;
    throw new HttpError(status, `${spec.file} failed at rows ${start}-${start + records.length - 1}. Check unique values, statuses, and referenced IDs.`);
  }
}

export async function importDatasetBatch(req, res) {
  const admin = await requireRole(req, ADMIN);
  const { totalRows, seenTables } = validateDatasetBatchFiles(req.body.files);
  const filesByTable = new Map(req.body.files.map((file) => [file.table, file]));

  const counts = await withTransaction(async (conn) => {
    const idMaps = await allocateIds(conn, filesByTable);
    if (filesByTable.has("users")) {
      const [roleRows] = await conn.query(`SELECT role_id, role_name FROM roles`);
      const roleIdsByName = new Map(roleRows.map((role) => [role.role_name, role.role_id]));
      const legacyRoles = new Map([
        ["1", "Admin"],
        ["2", "Sales Management"],
        ["3", "Inventory Management"],
      ]);
      for (const user of filesByTable.get("users").records) {
        const roleName = legacyRoles.get(sourceId(user.role_id, "user role_id"));
        if (!roleName || !roleIdsByName.has(roleName)) {
          throw new HttpError(400, "The imported user role IDs do not match the TiDB role seed data.");
        }
        user.role_id = roleIdsByName.get(roleName);
      }
    }
    const imported = {};
    const deferredUserReferences = [];

    for (const table of importOrder) {
      const file = filesByTable.get(table);
      if (!file) continue;
      const spec = byTable.get(table);
      const rows = file.records.map((record) => remapReferences(spec, record, idMaps));
      if (table === "users") {
        for (const row of rows) {
          deferredUserReferences.push({
            userId: row.user_id,
            createdBy: row.created_by,
            approvedBy: row.approved_by,
          });
          row.created_by = null;
          row.approved_by = null;
        }
      }

      for (let offset = 0; offset < rows.length; offset += INSERT_CHUNK_SIZE) {
        await insertChunk(conn, spec, rows.slice(offset, offset + INSERT_CHUNK_SIZE), offset + 1);
      }
      imported[table] = rows.length;
    }

    for (const user of deferredUserReferences) {
      if (user.createdBy != null || user.approvedBy != null) {
        await conn.query(
          `UPDATE users SET created_by = ?, approved_by = ? WHERE user_id = ?`,
          [user.createdBy, user.approvedBy, user.userId]
        );
      }
    }

    const details = Object.entries(imported).map(([table, count]) => `${table}=${count}`).join(", ");
    await conn.query(
      `INSERT INTO audit_log (user_id, action, entity_type, details, created_at)
       VALUES (?, 'import_dataset', 'dataset', ?, ?)`,
      [admin.user_id, `${seenTables.size} files, ${totalRows} rows: ${details}`.slice(0, 500), new Date()]
    );
    return imported;
  });

  sendJson(res, 200, { imported: counts, totalRows });
}
