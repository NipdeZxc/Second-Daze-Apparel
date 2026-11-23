import assert from "node:assert/strict";
import test from "node:test";
import {
  assertUniqueCustomerContacts,
  byTable,
  datasetFingerprint,
  planTable,
  restoreDatasetBatch,
  supportedDatasetFiles,
  validateDatasetBatchFiles,
} from "./dataset-import.js";
import { createBackupCsv } from "./export.js";
import { mergeDatasetInputs, parseDatasetInput } from "../../../react_frontend/src/data/datasetImport.js";

const productRecord = {
  product_id: "1",
  product_code: "SKU-000001",
  product_name: "Sample",
  category: null,
  size: null,
  cost_price: "10.00",
  selling_price: "20.00",
  stock_quantity: "5",
  reserved_quantity: "0",
  defective_quantity: "0",
  low_stock_threshold: "1",
  is_active: "1",
  created_by: "1",
  updated_by: null,
};

const userRecord = {
  user_id: "1",
  role_id: "1",
  full_name: "Dataset User",
  username: "dataset-user",
  email: null,
  password_hash: "$2a$10$example",
  must_change_password: "1",
  account_status: "Active",
  failed_login_count: "0",
  locked_until: null,
  created_by: null,
  approved_by: null,
  approved_at: null,
  created_at: "2025-01-01 00:00:00",
};

test("customer imports reject duplicate contact numbers in either local or international format", () => {
  assert.throws(() => assertUniqueCustomerContacts([
    { contact_number: "09990001001" },
    { contact_number: "+639990001001" },
  ]), /duplicate contact numbers/);
  assert.throws(() => assertUniqueCustomerContacts(
    [{ contact_number: "09990001001" }],
    ["+639990001001"],
  ), /already exist/);
  assert.doesNotThrow(() => assertUniqueCustomerContacts(
    [{ contact_number: "09990001002" }],
    ["+639990001001"],
  ));
});

test("dataset fingerprint is stable across file and column order changes", () => {
  const reverseKeys = (record) => Object.fromEntries(Object.entries(record).reverse());
  const first = [
    { fileName: "product.csv", table: "products", records: [productRecord] },
    { fileName: "user.csv", table: "users", records: [userRecord] },
  ];
  const reordered = [
    { fileName: "user.csv", table: "users", records: [reverseKeys(userRecord)] },
    { fileName: "product.csv", table: "products", records: [reverseKeys(productRecord)] },
  ];
  assert.equal(datasetFingerprint(first), datasetFingerprint(reordered));
  assert.notEqual(datasetFingerprint(first), datasetFingerprint([
    { ...first[0], records: [{ ...productRecord, product_code: "SKU-000002" }] },
    first[1],
  ]));
});

test("batch importer exposes all TiDB dataset files", () => {
  assert.equal(supportedDatasetFiles.length, 15);
  assert.ok(supportedDatasetFiles.some(({ file, table }) => file === "stock_movement.csv" && table === "stock_movements"));
});

test("batch validation accepts schema-shaped rows and rejects unknown or duplicate files", () => {
  const valid = validateDatasetBatchFiles([
    { fileName: "user.csv", table: "users", records: [userRecord] },
    { fileName: "product.csv", table: "products", records: [productRecord] },
  ]);
  assert.equal(valid.totalRows, 2);
  assert.deepEqual([...valid.seenTables], ["users", "products"]);

  assert.throws(() => validateDatasetBatchFiles([
    { fileName: "unknown.csv", table: "products", records: [productRecord] },
  ]), /does not match a supported TiDB dataset/);
  assert.throws(() => validateDatasetBatchFiles([
    { fileName: "product.csv", table: "products", records: [productRecord, productRecord] },
  ]), /duplicate product_id/);
});

test("batch validation rejects extra columns before building SQL", () => {
  assert.throws(() => validateDatasetBatchFiles([
    { fileName: "product.csv", table: "products", records: [{ ...productRecord, injected_column: "x" }] },
  ]), /columns that do not match the TiDB schema/);
});

test("batch validation requires parent files when remapped references are present", () => {
  assert.throws(() => validateDatasetBatchFiles([
    { fileName: "product.csv", table: "products", records: [productRecord] },
  ]), /include user\.csv in the same batch/);
  assert.throws(() => validateDatasetBatchFiles([
    { fileName: "user.csv", table: "users", records: [{ ...userRecord, user_id: "2" }] },
    { fileName: "product.csv", table: "products", records: [productRecord] },
  ]), /users ID that is not included in the batch/);
});

test("planTable reuses existing parents and matches their items using remapped IDs", async () => {
  const conn = {
    async query(sql) {
      if (sql.includes("product_code")) return [[{ ...productRecord, product_id: 7 }]];
      if (sql.includes("MAX")) return [[{ max_id: 7 }]];
      throw new Error(sql);
    },
  };
  const idMaps = new Map([["users", new Map([["1", "1"]])]]);
  const file = { records: [productRecord, { ...productRecord, product_id: "2", product_code: "SKU-000002" }] };
  const rows = await planTable(conn, byTable.get("products"), file, idMaps);
  assert.deepEqual(rows.map((row) => row.product_code), ["SKU-000002"]);
  assert.equal(idMaps.get("products").get("1"), "7");
  assert.equal(idMaps.get("products").get("2"), "8");

  const orderConn = {
    async query(sql) {
      if (sql.includes("order_number")) return [[{ order_id: 3, order_number: "ORD-1" }]];
      return [[{ max_id: 3 }]];
    },
  };
  const orderFile = { records: [{ order_id: "1", order_number: "ORD-1", customer_id: null, reservation_id: null }] };
  await planTable(orderConn, byTable.get("orders"), orderFile, idMaps);
  const itemConn = { async query(sql) {
    return sql.includes("MAX") ? [[{ max_id: 9 }]] : [[{ order_item_id: 9, order_id: 3, product_id: 8 }]];
  } };
  const items = await planTable(itemConn, byTable.get("order_items"), { records: [{ order_item_id: "1", order_id: "1", product_id: "2" }] }, idMaps);
  assert.equal(items.length, 0);
  assert.equal(idMaps.get("order_items").get("1"), "9");
});

function datasetFixture() {
  const values = {
    users: { user_id: "1", role_id: "1", full_name: "Dataset Admin", username: "dataset-admin", password_hash: "test-hash", must_change_password: 1, account_status: "Active", failed_login_count: 0 },
    customers: { customer_id: "1", full_name: "Test Customer", contact_number: "09123456789", street_address: "Test St", barangay: "Test", city_municipality: "Manila", province: "Metro Manila", entry_source: "Staff", info_verified: 1, returned_parcels: 0 },
    products: { product_id: "1", product_code: "SKU-1", product_name: 'Shirt, "Blue"', category: "Tops", size: "M", cost_price: "100.00", selling_price: "200.00", stock_quantity: 8, reserved_quantity: 2, defective_quantity: 0, low_stock_threshold: 1, is_active: 1 },
    reservations: { reservation_id: "1", reservation_number: "RES-1", customer_id: "1", reservation_days: 3, reservation_status: "Active", expiry_date: "2099-01-03T00:00:00.000Z" },
    orders: { order_id: "1", order_number: "ORD-1", customer_id: "1", reservation_id: "1", order_date: "2026-01-01T00:00:00.000Z", order_status: "Pending Payment" },
    reservation_items: { reservation_item_id: "1", reservation_id: "1", product_id: "1", quantity: 2, unit_price: "200.00" },
    order_items: { order_item_id: "1", order_id: "1", product_id: "1", quantity: 2, unit_price: "200.00", unit_cost: "100.00" },
    payments: { payment_id: "1", order_id: "1", payment_method: "GCash", gcash_reference_number: "REF-1", amount_paid: "400.00", payment_status: "Pending Verification" },
    shipments: { shipment_id: "1", order_id: "1", courier: "J&T Express", tracking_number: "TRACK-1", shipment_status: "Shipped" },
    purchase_orders: { po_id: "1", po_number: "PO-1", order_id: "1" },
    invoices: { invoice_id: "1", invoice_number: "INV-1", order_id: "1" },
    delivery_receipts: { dr_id: "1", dr_number: "DR-1", order_id: "1", shipment_id: "1" },
    refunds: { refund_id: "1", refund_number: "RFD-1", order_id: "1", customer_id: "1", refund_date: "2026-01-01T00:00:00.000Z", days_of_ownership: 1, issue_description: "Loose seam", refund_amount: "200.00", refund_status: "Pending Approval" },
    refund_items: { refund_item_id: "1", refund_id: "1", order_item_id: "1", quantity: 1, is_defective: 0 },
    stock_movements: { movement_id: "9007199254740993", product_id: "1", movement_type: "Reservation Hold", quantity_change: -2, reference_type: "Reservation", reference_id: "1", remarks: "", performed_by: "1" },
  };
  return [...byTable.values()].map((spec) => ({
    fileName: spec.file, table: spec.table,
    records: [Object.fromEntries(spec.columns.map((column) => [
      column, values[spec.table][column] ?? (
        column === "created_at" ? "2026-01-01T00:00:00.000Z"
          : ["created_by", "updated_by", "approved_by", "verified_by", "recorded_by", "issued_by", "requested_by"].includes(column) ? "1" : null
      ),
    ]))],
  }));
}

function memoryConnection(files = []) {
  const tables = new Map([...byTable.keys()].map((table) => [table, []]));
  for (const file of files) tables.set(file.table, structuredClone(file.records));
  return {
    tables,
    async query(sql, params = []) {
      if (sql === "SELECT role_id, role_name FROM roles") return [[{ role_id: 10, role_name: "Admin" }]];
      if (sql === "SELECT user_id, username FROM users") return [tables.get("users")];
      if (sql.includes("MAX(")) {
        const table = sql.match(/FROM `(\w+)`/)[1];
        const spec = byTable.get(table);
        const max = tables.get(table).reduce((value, row) => BigInt(row[spec.primaryKey]) > value ? BigInt(row[spec.primaryKey]) : value, 0n);
        return [[{ max_id: max.toString() }]];
      }
      if (sql.startsWith("SELECT")) return [tables.get(sql.match(/FROM `(\w+)`/)[1])];
      if (sql.includes("INSERT INTO audit_log")) return [{ affectedRows: 1 }];
      if (sql.startsWith("UPDATE users")) return [{ affectedRows: 1 }];
      const [, table, columnSql] = sql.match(/INSERT INTO `(\w+)` \(([^)]+)\)/);
      const columns = [...columnSql.matchAll(/`(\w+)`/g)].map((match) => match[1]);
      const spec = byTable.get(table);
      for (let offset = 0; offset < params.length; offset += columns.length) {
        const row = Object.fromEntries(columns.map((column, index) => [column, params[offset + index]]));
        for (const [column, parent] of Object.entries(spec.foreignKeys)) {
          if (row[column] != null && !tables.get(parent).some((item) => String(item[byTable.get(parent).primaryKey]) === String(row[column]))) {
            throw new Error(`Unmapped foreign key: ${table}.${column}`);
          }
        }
        tables.get(table).push(row);
      }
      return [{ affectedRows: params.length / columns.length }];
    },
  };
}

test("all 15 dataset files import twice without replacing rows or duplicating stock history", async () => {
  const files = datasetFixture();
  const conn = memoryConnection();
  const first = await restoreDatasetBatch(conn, files, { user_id: 1 });
  assert.equal(Object.values(first.imported).reduce((sum, count) => sum + count, 0), 15);
  assert.equal(files[0].records[0].role_id, "1", "Import must not mutate input role IDs");
  const before = structuredClone([...conn.tables]);
  const second = await restoreDatasetBatch(conn, files, { user_id: 1 });
  assert.equal(Object.values(second.imported).reduce((sum, count) => sum + count, 0), 0);
  assert.equal(Object.values(second.skipped).reduce((sum, count) => sum + count, 0), 15);
  assert.deepEqual([...conn.tables], before);
});

test("CSV backup round-trips all business tables, staff references and reserved stock, including repeated multi-file selection", async () => {
  const fixture = datasetFixture();
  const source = memoryConnection(fixture);
  const csv = await createBackupCsv(source);
  assert.ok(!csv.includes("test-hash"));
  assert.ok(csv.includes("9007199254740993"));
  const parsed = parseDatasetInput("renamed-backup.csv", csv);
  const files = mergeDatasetInputs([parsed, parsed]);
  const target = memoryConnection([{ table: "users", records: [{ user_id: "50", username: "dataset-admin" }] }]);
  const first = await restoreDatasetBatch(target, files, { user_id: 50 });
  assert.equal(Object.values(first.imported).reduce((sum, count) => sum + count, 0), 14);
  for (const spec of [...byTable.values()].filter((item) => item.table !== "users")) {
    const original = fixture.find((file) => file.table === spec.table).records[0];
    const restored = target.tables.get(spec.table)[0];
    for (const column of spec.columns) {
      if (column === spec.primaryKey || Object.hasOwn(spec.foreignKeys, column) || column === "reference_id") continue;
      assert.equal(restored[column] instanceof Date ? restored[column].toISOString() : restored[column], original[column], `${spec.table}.${column}`);
    }
  }
  assert.equal(target.tables.get("products")[0].created_by, "50");
  assert.equal(target.tables.get("products")[0].reserved_quantity, 2);
  const before = structuredClone([...target.tables]);
  const second = await restoreDatasetBatch(target, files, { user_id: 50 });
  assert.equal(Object.values(second.imported).reduce((sum, count) => sum + count, 0), 0);
  assert.deepEqual([...target.tables], before);
});

test("backup restoration rejects missing staff accounts before writing business rows", async () => {
  const csv = await createBackupCsv(memoryConnection(datasetFixture()));
  const target = memoryConnection();
  await assert.rejects(
    restoreDatasetBatch(target, parseDatasetInput("backup.csv", csv), { user_id: 1 }),
    (error) => error.status === 409 && /Staff account/.test(error.message)
  );
  assert.equal(target.tables.get("products").length, 0);
});

test("stock-history matching treats SQL timestamps as UTC and remaps references before comparing", async () => {
  const spec = byTable.get("stock_movements");
  const record = { ...datasetFixture().find((file) => file.table === spec.table).records[0], created_at: "2026-01-01 12:00:00" };
  const existing = { ...record, movement_id: "9", product_id: "7", reference_id: "12", performed_by: "50", created_at: new Date("2026-01-01T12:00:00Z") };
  const conn = { async query(sql) { return sql.includes("MAX") ? [[{ max_id: "9" }]] : [[existing]]; } };
  const maps = new Map([
    ["products", new Map([["1", "7"]])],
    ["reservations", new Map([["1", "12"]])],
    ["users", new Map([["1", "50"]])],
  ]);
  assert.equal((await planTable(conn, spec, { records: [record] }, maps)).length, 0);
  assert.equal(maps.get(spec.table).get(record.movement_id), "9");
});