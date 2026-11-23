import Papa from "papaparse";

export const MAX_DATASET_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_DATASET_BATCH_BYTES = 3 * 1024 * 1024;
export const MAX_DATASET_BATCH_ROWS = 10000;
export const MAX_DATASET_FILE_ROWS = 5000;

export const datasetImportFiles = [
  {
    file: "user.csv", table: "users", primaryKey: "user_id",
    columns: ["user_id", "role_id", "full_name", "username", "email", "password_hash", "must_change_password", "account_status", "failed_login_count", "locked_until", "created_by", "approved_by", "approved_at", "created_at"],
    required: ["user_id", "role_id", "full_name", "username", "password_hash", "must_change_password", "account_status", "failed_login_count", "created_at"],
  },
  {
    file: "customer.csv", table: "customers", primaryKey: "customer_id",
    columns: ["customer_id", "full_name", "contact_number", "social_media_name", "street_address", "barangay", "city_municipality", "province", "postal_code", "entry_source", "info_verified", "verified_by", "verified_at", "returned_parcels", "created_by", "created_at"],
    required: ["customer_id", "full_name", "contact_number", "street_address", "barangay", "city_municipality", "province", "entry_source", "info_verified", "returned_parcels"],
  },
  {
    file: "product.csv", table: "products", primaryKey: "product_id",
    columns: ["product_id", "product_code", "product_name", "category", "size", "cost_price", "selling_price", "stock_quantity", "reserved_quantity", "defective_quantity", "low_stock_threshold", "is_active", "created_by", "updated_by"],
    required: ["product_id", "product_code", "product_name", "cost_price", "selling_price", "stock_quantity", "reserved_quantity", "defective_quantity", "low_stock_threshold", "is_active", "created_by"],
  },
  {
    file: "stock_movement.csv", table: "stock_movements", primaryKey: "movement_id",
    columns: ["movement_id", "product_id", "movement_type", "quantity_change", "reference_type", "reference_id", "remarks", "performed_by", "created_at"],
    required: ["movement_id", "product_id", "movement_type", "quantity_change"],
  },
  {
    file: "reservation.csv", table: "reservations", primaryKey: "reservation_id",
    columns: ["reservation_id", "reservation_number", "customer_id", "reservation_days", "reservation_status", "notes", "created_by", "approved_by", "approved_at", "expiry_date", "voided_at", "void_reason", "created_at"],
    required: ["reservation_id", "reservation_number", "customer_id", "reservation_days", "reservation_status", "created_by", "created_at"],
  },
  {
    file: "reservation_item.csv", table: "reservation_items", primaryKey: "reservation_item_id",
    columns: ["reservation_item_id", "reservation_id", "product_id", "quantity", "unit_price"],
    required: ["reservation_item_id", "reservation_id", "product_id", "quantity", "unit_price"],
  },
  {
    file: "orders.csv", table: "orders", primaryKey: "order_id",
    columns: ["order_id", "order_number", "customer_id", "reservation_id", "order_date", "order_status", "notes", "created_by", "approved_by", "approved_at"],
    required: ["order_id", "order_number", "customer_id", "order_date", "order_status", "created_by"],
  },
  {
    file: "order_item.csv", table: "order_items", primaryKey: "order_item_id",
    columns: ["order_item_id", "order_id", "product_id", "quantity", "unit_price", "unit_cost"],
    required: ["order_item_id", "order_id", "product_id", "quantity", "unit_price", "unit_cost"],
  },
  {
    file: "payment.csv", table: "payments", primaryKey: "payment_id",
    columns: ["payment_id", "order_id", "payment_method", "gcash_reference_number", "amount_paid", "payment_status", "rejection_reason", "paid_at", "recorded_at", "recorded_by", "verified_by", "verified_at"],
    required: ["payment_id", "order_id", "payment_method", "amount_paid", "payment_status", "recorded_by"],
  },
  {
    file: "shipment.csv", table: "shipments", primaryKey: "shipment_id",
    columns: ["shipment_id", "order_id", "courier", "tracking_number", "shipment_status", "shipped_at", "delivered_at", "received_by", "return_reason", "updated_by"],
    required: ["shipment_id", "order_id", "courier", "shipment_status", "updated_by"],
  },
  {
    file: "purchase_order.csv", table: "purchase_orders", primaryKey: "po_id",
    columns: ["po_id", "po_number", "order_id", "issued_at", "issued_by"],
    required: ["po_id", "po_number", "order_id", "issued_by"],
  },
  {
    file: "invoice.csv", table: "invoices", primaryKey: "invoice_id",
    columns: ["invoice_id", "invoice_number", "order_id", "issued_at", "issued_by"],
    required: ["invoice_id", "invoice_number", "order_id", "issued_by"],
  },
  {
    file: "delivery_receipt.csv", table: "delivery_receipts", primaryKey: "dr_id",
    columns: ["dr_id", "dr_number", "order_id", "shipment_id", "delivered_at", "issued_at", "issued_by"],
    required: ["dr_id", "dr_number", "order_id", "shipment_id", "issued_by"],
  },
  {
    file: "refund.csv", table: "refunds", primaryKey: "refund_id",
    columns: ["refund_id", "refund_number", "order_id", "customer_id", "refund_date", "days_of_ownership", "issue_description", "inspection_note", "refund_amount", "refund_status", "requested_by", "approved_by", "approved_at", "decision_note"],
    required: ["refund_id", "refund_number", "order_id", "customer_id", "refund_date", "days_of_ownership", "issue_description", "refund_amount", "refund_status", "requested_by"],
  },
  {
    file: "refund_item.csv", table: "refund_items", primaryKey: "refund_item_id",
    columns: ["refund_item_id", "refund_id", "order_item_id", "quantity", "is_defective"],
    required: ["refund_item_id", "refund_id", "order_item_id", "quantity", "is_defective"],
  },
];

const byFileName = new Map(datasetImportFiles.map((definition) => [definition.file, definition]));

export function parseDatasetFile(fileName, csv) {
  const baseName = String(fileName).split(/[\\/]/).pop().toLowerCase();
  const definition = byFileName.get(baseName)
    || datasetImportFiles.find((item) => `${item.table}.csv` === baseName);
  if (!definition) throw new Error(`${fileName} is not a supported TiDB dataset CSV.`);
  if (new TextEncoder().encode(csv).length > MAX_DATASET_FILE_BYTES) {
    throw new Error(`${fileName} is larger than 2 MB.`);
  }

  const parsed = Papa.parse(csv.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n"), {
    skipEmptyLines: "greedy",
    delimiter: ",",
    newline: "\n",
  });
  if (parsed.errors.length) throw new Error(`${fileName}: invalid CSV: ${parsed.errors[0].message}`);

  const [header = [], ...rows] = parsed.data;
  const columns = header.map((value) => String(value).trim());
  if (new Set(columns).size !== columns.length) throw new Error(`${fileName}: CSV headers must not be duplicated.`);
  const missing = definition.columns.filter((column) => !columns.includes(column));
  const unknown = columns.filter((column) => !definition.columns.includes(column));
  if (missing.length || unknown.length) {
    const details = [
      missing.length ? `missing ${missing.join(", ")}` : "",
      unknown.length ? `unknown ${unknown.join(", ")}` : "",
    ].filter(Boolean).join("; ");
    throw new Error(`${fileName}: columns do not match the TiDB schema (${details}).`);
  }
  if (rows.length === 0 || rows.length > MAX_DATASET_FILE_ROWS) {
    throw new Error(`${fileName}: import between 1 and ${MAX_DATASET_FILE_ROWS} rows.`);
  }

  const seenIds = new Set();
  const records = rows.map((values, index) => {
    if (values.length !== columns.length) {
      throw new Error(`${fileName}: row ${index + 2} has ${values.length} values; expected ${columns.length}.`);
    }
    const record = Object.fromEntries(
      definition.columns.map((column) => {
        const value = String(values[columns.indexOf(column)] ?? "").trim();
        return [column, value || null];
      })
    );
    for (const column of definition.required) {
      if (record[column] == null) throw new Error(`${fileName}: row ${index + 2} is missing ${column}.`);
    }
    const id = String(record[definition.primaryKey]);
    if (seenIds.has(id)) throw new Error(`${fileName}: duplicate ${definition.primaryKey} ${id}.`);
    seenIds.add(id);
    return record;
  });

  return { table: definition.table, fileName: definition.file, records };
}

export function parseDatasetInput(fileName, csv) {
  if (new TextEncoder().encode(csv).length > MAX_DATASET_FILE_BYTES) {
    throw new Error(`${fileName} is larger than 2 MB.`);
  }
  const parsed = Papa.parse(csv.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n"), {
    skipEmptyLines: "greedy", delimiter: ",", newline: "\n",
  });
  if (parsed.errors.length) throw new Error(`${fileName}: invalid CSV: ${parsed.errors[0].message}`);
  const [header = [], ...rows] = parsed.data;
  if (header.includes("record_type")) {
    if (header.join(",") !== "record_type,record_data") {
      throw new Error("This is an older report CSV, not a complete backup. It omitted order items, payments and record links, so it cannot restore all data. Download a new CSV backup from Export records.");
    }
    if (rows[0]?.[0] !== "__backup" || rows.some((row) => row.length !== 2)) {
      throw new Error("The CSV backup is missing its metadata or has malformed rows.");
    }
    let metadata;
    const recordsByTable = new Map();
    try {
      metadata = JSON.parse(rows[0][1]);
      for (const [table, json] of rows.slice(1)) {
        const definition = datasetImportFiles.find((item) => item.table === table && table !== "users");
        if (!definition) throw new Error(`Unknown backup record type: ${table}.`);
        const record = JSON.parse(json);
        if (!record || typeof record !== "object" || Array.isArray(record)
            || Object.keys(record).length !== definition.columns.length
            || definition.columns.some((column) => !Object.hasOwn(record, column))) {
          throw new Error(`Backup ${table} columns do not match the schema.`);
        }
        const records = recordsByTable.get(table) || [];
        records.push(record);
        recordsByTable.set(table, records);
      }
    } catch (error) {
      throw new Error(`Invalid CSV backup: ${error.message}`);
    }
    if (metadata?.version !== 1 || !Array.isArray(metadata.userReferences)) {
      throw new Error("Unsupported CSV backup version or missing staff references.");
    }
    const totalRows = rows.length - 1;
    if (!totalRows || totalRows > MAX_DATASET_BATCH_ROWS) {
      throw new Error(`A backup must contain between 1 and ${MAX_DATASET_BATCH_ROWS} business rows.`);
    }
    return [...recordsByTable].map(([table, records]) => {
      const definition = datasetImportFiles.find((item) => item.table === table);
      if (records.length > MAX_DATASET_FILE_ROWS) throw new Error(`${table} exceeds ${MAX_DATASET_FILE_ROWS} rows.`);
      return { table, fileName: definition.file, records, referenceMode: "backup", userReferences: metadata.userReferences };
    });
  }
  const definition = datasetImportFiles.find((item) => item.columns.every((column) => header.includes(column)));
  return definition ? [parseDatasetFile(definition.file, csv)] : null;
}

export function mergeDatasetInputs(inputs) {
  const files = new Map();
  for (const file of inputs.flat()) {
    const existing = files.get(file.table);
    if (!existing) {
      files.set(file.table, { ...file, records: [...file.records] });
      continue;
    }
    if (existing.referenceMode !== file.referenceMode
        || JSON.stringify(existing.userReferences) !== JSON.stringify(file.userReferences)) {
      throw new Error("Do not mix backups from different databases or legacy datasets in one import.");
    }
    const definition = datasetImportFiles.find((item) => item.table === file.table);
    const byId = new Map(existing.records.map((row) => [String(row[definition.primaryKey]), row]));
    for (const row of file.records) {
      const id = String(row[definition.primaryKey]);
      if (byId.has(id)) {
        if (definition.columns.some((column) => byId.get(id)[column] !== row[column])) {
          throw new Error(`${file.table} contains conflicting rows for ${definition.primaryKey} ${id}.`);
        }
      } else {
        byId.set(id, row);
        existing.records.push(row);
      }
    }
    if (existing.records.length > MAX_DATASET_FILE_ROWS) throw new Error(`${file.table} exceeds ${MAX_DATASET_FILE_ROWS} rows.`);
  }
  const result = [...files.values()];
  if (result.reduce((sum, file) => sum + file.records.length, 0) > MAX_DATASET_BATCH_ROWS) {
    throw new Error(`A dataset batch may contain at most ${MAX_DATASET_BATCH_ROWS} rows.`);
  }
  if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_DATASET_BATCH_BYTES) {
    throw new Error("The selected records are too large to send in one batch.");
  }
  return result;
}
