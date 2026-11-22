import assert from "node:assert/strict";
import test from "node:test";
import {
  assertUniqueCustomerContacts,
  datasetFingerprint,
  supportedDatasetFiles,
  validateDatasetBatchFiles,
} from "./dataset-import.js";

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
