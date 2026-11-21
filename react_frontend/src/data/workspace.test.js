import assert from "node:assert/strict";
import test from "node:test";
import Papa from "papaparse";
import { strFromU8, unzipSync } from "fflate";
import { buildOverview, csvTemplate, datasets, emptyRecords, importColumns, importKinds, MAX_CSV_BYTES, parseImport } from "./workspace.js";
import { createWorkspaceExcel, serializeWorkspaceCsv } from "./export.js";

const productCsv = `${csvTemplate("products")}TEST-1,"Shirt, ""Blue""",Tops,M,100.10,200.20,2,3`;
const customerCsv = `${csvTemplate("customers")}Test Customer,09123456789,"Line one
Line two",Brgy 1,Test City,Test Province`;

test("only products and customers can be imported, and templates exclude read-only columns", () => {
  assert.deepEqual(importKinds, ["products", "customers"]);
  assert.equal(csvTemplate("products"), "product_code,product_name,category,size,cost_price,selling_price,stock_quantity,low_stock_threshold\r\n");
  assert.ok(!importColumns("customers").some((column) => column.key === "status" || column.key === "customer_id"));
  assert.throws(() => parseImport("orders", "x", emptyRecords()), /supported import type/);
});

test("CSV handles UTF-8 BOM, escaped quotes, CRLF, and quoted multiline fields", () => {
  const [product] = parseImport("products", `\uFEFF${productCsv}\r\n\r\n`);
  assert.equal(product.product_name, 'Shirt, "Blue"');
  assert.equal(product.cost_price, 100.1);
  const [customer] = parseImport("customers", customerCsv);
  assert.equal(customer.street_address, "Line one\nLine two");
  assert.equal(customer.contact_number, "09123456789");
});

test("malformed CSV and incorrect headers never produce importable rows", () => {
  for (const [csv, error] of [
    ["", /Missing columns/],
    [csvTemplate("products"), /between 1 and 5000/],
    ["product_code,product_code\nA,A", /must not be duplicated/],
    [productCsv.replace("product_name", "unknown"), /Missing columns/],
    [productCsv.replace("product_code,", "extra,product_code,"), /Unknown columns/],
    [`${csvTemplate("products")}A,"unclosed`, /Invalid CSV/],
    [`${productCsv},extra`, /expected 8 columns/],
  ]) {
    assert.throws(() => parseImport("products", csv), error);
  }
});

test("numeric and contact validation reject invalid business data with row errors", () => {
  for (const replacement of ["-1", "NaN", "1.234", "1e2", "Infinity", "100000000"]) {
    assert.throws(() => parseImport("products", productCsv.replace("100.10", replacement)), /Data row 1: cost_price/);
  }
  assert.throws(() => parseImport("products", productCsv.replace(",2,3", ",2.5,3")), /stock_quantity/);
  assert.throws(() => parseImport("customers", customerCsv.replace("09123456789", "12345")), /contact_number/);
});

test("existing product codes can be restocked, but duplicates within a file and existing customers are rejected", () => {
  const existing = { ...emptyRecords(), products: [{ product_code: "TEST-1" }] };
  assert.equal(parseImport("products", productCsv, existing)[0].stock_quantity, 2);
  const existingCustomer = { ...emptyRecords(), customers: [{ contact_number: "09123456789" }] };
  assert.throws(() => parseImport("customers", customerCsv, existingCustomer), /Duplicate contact_number/);
  assert.throws(() => parseImport("products", `${productCsv}\n${productCsv.split("\n").at(-1)}`), /Data row 2: Duplicate product_code/);
});

test("file size and row count limits are enforced at their actual boundaries", () => {
  assert.equal(parseImport("products", productCsv.padEnd(MAX_CSV_BYTES, " ")).length, 1);
  assert.throws(() => parseImport("products", " ".repeat(MAX_CSV_BYTES + 1)), /2 MB/);
  const rows = Array.from({ length: 5000 }, (_, index) => `TEST-${index},Item,,,1,2,3,4`);
  assert.equal(parseImport("products", csvTemplate("products") + rows.join("\n")).length, 5000);
  assert.throws(() => parseImport("products", csvTemplate("products") + [...rows, "EXTRA,Item,,,1,2,3,4"].join("\n")), /between 1 and 5000/);
});

test("overview of empty records has no synthetic data", () => {
  const overview = buildOverview(emptyRecords());
  assert.equal(overview.metrics.grossSales, 0);
  assert.equal(overview.metrics.averageOrderValue, null);
  assert.equal(overview.metrics.fulfillmentRate, null);
  assert.deepEqual(overview.dailySales, []);
  assert.deepEqual(overview.queues, { accessApprovals: 0, ordersToFulfill: 0, lowStockItems: 0 });
});

test("overview nets approved refunds, counts low stock and open orders", () => {
  const records = {
    ...emptyRecords(),
    pendingAccess: 2,
    products: [
      { product_code: "A", stock_quantity: 2, low_stock_threshold: 3, status: "Low stock" },
      { product_code: "B", stock_quantity: 0, low_stock_threshold: 3, status: "Inactive" },
      { product_code: "C", stock_quantity: 9, low_stock_threshold: 3, status: "In stock" },
    ],
    orders: [
      { order_number: "O1", status: "Completed", total_amount: 200.2 },
      { order_number: "O2", status: "Packed", total_amount: 100 },
      { order_number: "O3", status: "Cancelled", total_amount: 50 },
    ],
    sales: [{ sale_no: "O1", amount: 200.2, cost: 100.1, sold_at: "2026-11-20T04:00:00Z" }],
    refunds: [
      { refund_number: "R1", status: "Approved", amount: 50.1 },
      { refund_number: "R2", status: "Rejected", amount: 99 },
    ],
    reservations: [
      { reservation_number: "V1", status: "Active", expires_at: "2026-11-25T00:00:00Z" },
      { reservation_number: "V2", status: "Active", expires_at: "2026-11-01T00:00:00Z" },
    ],
  };
  const overview = buildOverview(records, new Date("2026-11-20T12:00:00Z"));
  assert.equal(overview.metrics.grossSales, 150.1);
  assert.equal(overview.metrics.profit, 50);
  assert.equal(overview.metrics.ordersPlaced, 3);
  assert.equal(overview.metrics.activeReservations, 1);
  assert.deepEqual(overview.queues, { accessApprovals: 2, ordersToFulfill: 1, lowStockItems: 1 });
});

test("CSV export includes every dataset and safely escapes spreadsheet formulas", () => {
  const workspace = emptyRecords();
  workspace.products.push({ product_code: "SKU-1", product_name: '=HYPERLINK("https://example.invalid")' });
  workspace.customers.push({ customer_id: 1, full_name: "Customer, One" });
  workspace.orders.push({ order_number: "ORD-1" });
  workspace.sales.push({ sale_no: "SALE-1" });
  workspace.reservations.push({ reservation_number: "RES-1" });
  workspace.refunds.push({ refund_number: "REF-1" });
  workspace.documents.push({ doc_number: "DOC-1" });
  workspace.accounts.push({ username: "staff-1" });

  const csv = serializeWorkspaceCsv(workspace);
  assert.ok(csv.startsWith('\uFEFF"record_type","product_code"'));
  const [headers, ...rows] = Papa.parse(csv.replace(/^\uFEFF/, ""), { skipEmptyLines: true }).data;
  const product = Object.fromEntries(headers.map((header, index) => [header, rows[0][index]]));
  const customer = Object.fromEntries(headers.map((header, index) => [header, rows[1][index]]));
  assert.equal(product.record_type, "products");
  assert.equal(product.product_code, "SKU-1");
  assert.equal(product.product_name, `'=HYPERLINK("https://example.invalid")`);
  assert.equal(customer.record_type, "customers");
  assert.equal(customer.full_name, "Customer, One");
  assert.deepEqual(rows.map((row) => row[headers.indexOf("record_type")]), [
    ...Object.keys(datasets),
  ]);
});

test("Excel export writes one sheet per dataset with all stored rows", async () => {
  const workspace = emptyRecords();
  workspace.orders.push({ order_number: "ORD-1", total_amount: 250 });
  const output = createWorkspaceExcel(workspace);
  const files = unzipSync(output);
  const workbookXml = strFromU8(files["xl/workbook.xml"]);
  const orderSheetIndex = Object.keys(datasets).indexOf("orders") + 1;
  const orderSheet = strFromU8(files[`xl/worksheets/sheet${orderSheetIndex}.xml`]);

  for (const dataset of Object.values(datasets)) {
    assert.ok(workbookXml.includes(`name="${dataset.label}"`));
  }
  const orderNumberColumn = datasets.orders.columns.findIndex((column) => column.key === "order_number");
  const amountColumn = datasets.orders.columns.findIndex((column) => column.key === "total_amount");
  const columnName = (index) => String.fromCharCode(65 + index);
  assert.match(orderSheet, new RegExp(`<c r="${columnName(orderNumberColumn)}2" t="inlineStr"><is><t xml:space="preserve">ORD-1<\\/t><\\/is><\\/c>`));
  assert.match(orderSheet, new RegExp(`<c r="${columnName(amountColumn)}2"><v>250<\\/v><\\/c>`));
});
