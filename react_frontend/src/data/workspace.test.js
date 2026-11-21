import assert from "node:assert/strict";
import test from "node:test";
import Papa from "papaparse";
import { strFromU8, unzipSync } from "fflate";
import { buildOverview, csvTemplate, emptyWorkspace, MAX_CSV_BYTES, parseImport, readWorkspace, saveImport, STORAGE_KEY } from "./workspace.js";
import { createWorkspaceExcel, serializeWorkspaceCsv } from "./export.js";

const admin = { username: "test-admin", role: "Admin" };
const productCsv = `${csvTemplate("products")}TEST-1,"Shirt, ""Blue""",Tops,M,Blue,100.10,200.20,2,3`;
const customerCsv = `${csvTemplate("customers")}C-1,Test Customer,09123456789,test@example.com,"Line one
Line two",Test City`;
const orderCsv = `${csvTemplate("orders")}O-1,C-1,200.20,Processing,2026-11-20`;
const salesCsv = `${csvTemplate("sales")}S-1,O-1,200.20,100.10,2026-11-20`;
const reservationCsv = `${csvTemplate("reservations")}R-1,C-1,Approved,2026-11-25`;

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

function importCsv(storage, kind, csv) {
  return saveImport(kind, parseImport(kind, csv, readWorkspace(storage)), admin, storage);
}

test("a fresh workspace has no sample records, synthetic approvals, or sales trends", () => {
  const overview = buildOverview(readWorkspace(memoryStorage()));
  for (const kind of ["products", "customers", "orders", "sales", "reservations"]) {
    assert.deepEqual(overview.records[kind], []);
  }
  assert.deepEqual(overview.queues, { accessApprovals: null, ordersToFulfill: 0, lowStockItems: 0 });
  assert.equal(overview.metrics.grossSales, 0);
  assert.equal(overview.metrics.averageOrderValue, null);
  assert.equal(overview.metrics.fulfillmentRate, null);
  assert.deepEqual(overview.dailySales, []);
});

test("CSV handles UTF-8 BOM, escaped quotes, CRLF, and quoted multiline fields", () => {
  const workspace = emptyWorkspace();
  const [product] = parseImport("products", `\uFEFF${productCsv}\r\n\r\n`, workspace);
  assert.equal(product.product_name, 'Shirt, "Blue"');
  assert.equal(product.cost_price, 100.1);
  const [customer] = parseImport("customers", customerCsv, workspace);
  assert.equal(customer.address, "Line one\nLine two");
  assert.equal(customer.contact_number, "09123456789");
});

test("malformed CSV and incorrect headers never produce importable rows", () => {
  for (const [csv, error] of [
    ["", /Missing columns/],
    [csvTemplate("products"), /between 1 and 5000/],
    ["sku,sku\nA,A", /must not be duplicated/],
    [productCsv.replace("product_name", "unknown"), /Missing columns/],
    [productCsv.replace("sku,", "extra,sku,"), /Unknown columns/],
    [`${csvTemplate("products")}A,"unclosed`, /Invalid CSV/],
    [`${productCsv},extra`, /expected 9 columns/],
  ]) {
    assert.throws(() => parseImport("products", csv, emptyWorkspace()), error);
  }
});

test("numeric, date, and status validation reject invalid business data with row errors", () => {
  for (const replacement of ["-1", "NaN", "1.234", "1e2", "Infinity", "100000000"]) {
    assert.throws(() => parseImport("products", productCsv.replace("100.10", replacement), emptyWorkspace()), /Data row 1: cost_price/);
  }
  assert.throws(() => parseImport("products", productCsv.replace(",2,3", ",2.5,3"), emptyWorkspace()), /qty_available/);
  const workspace = emptyWorkspace();
  workspace.customers = parseImport("customers", customerCsv, workspace);
  assert.throws(() => parseImport("orders", orderCsv.replace("2026-11-20", "2026-02-30"), workspace), /valid YYYY-MM-DD/);
  assert.throws(() => parseImport("orders", orderCsv.replace("Processing", "Unknown"), workspace), /status must be one of/);
});

test("duplicates and missing referenced records are rejected, including after preview", () => {
  const storage = memoryStorage();
  const preview = parseImport("products", productCsv, readWorkspace(storage));
  saveImport("products", preview, admin, storage);
  assert.throws(() => saveImport("products", preview, admin, storage), /Duplicate sku/);
  assert.throws(() => parseImport("products", productCsv.replace("TEST-1", "test-1"), readWorkspace(storage)), /Duplicate sku/);
  assert.throws(() => parseImport("products", `${productCsv}\n${productCsv.split("\n").at(-1)}`, emptyWorkspace()), /Data row 2: Duplicate sku/);
  assert.throws(() => parseImport("orders", orderCsv, emptyWorkspace()), /Import customers first/);
  assert.throws(() => parseImport("sales", salesCsv, emptyWorkspace()), /Import orders first/);
  assert.throws(() => parseImport("reservations", reservationCsv, emptyWorkspace()), /Import customers first/);
});

test("all five import types persist and drive overview metrics without changing imported stock", () => {
  const storage = memoryStorage();
  for (const [kind, csv] of Object.entries({ products: productCsv, customers: customerCsv, orders: orderCsv, sales: salesCsv, reservations: reservationCsv })) {
    importCsv(storage, kind, csv);
  }
  const saved = readWorkspace(storage);
  const overview = buildOverview(saved, new Date("2026-11-20T12:00:00Z"));
  assert.equal(overview.metrics.grossSales, 200.2);
  assert.equal(overview.metrics.totalCost, 100.1);
  assert.equal(overview.metrics.profit, 100.1);
  assert.equal(overview.metrics.todaysSales, 200.2);
  assert.equal(overview.metrics.ordersPlaced, 1);
  assert.equal(overview.metrics.activeReservations, 1);
  assert.equal(overview.queues.ordersToFulfill, 1);
  assert.equal(overview.queues.lowStockItems, 1);
  assert.equal(saved.products[0].qty_available, 2);
  assert.equal(saved.recentActivity.length, 5);
  assert.deepEqual(overview.dailySales, [["2026-11-20", 200.2]]);
  assert.equal(buildOverview(saved, new Date("2026-12-01T12:00:00Z")).metrics.activeReservations, 0);
});

test("only admins can save; invalid files and storage failures do not partially modify data", () => {
  const storage = memoryStorage();
  const records = parseImport("products", productCsv, emptyWorkspace());
  assert.throws(() => saveImport("products", records, { role: "Staff" }, storage), /Only an Admin/);
  assert.equal(storage.getItem(STORAGE_KEY), null);
  importCsv(storage, "products", productCsv);
  const before = storage.getItem(STORAGE_KEY);
  assert.throws(() => importCsv(storage, "products", `${csvTemplate("products")}TEST-2,Valid,,,,10,20,1,1
TEST-3,Invalid,,,,wrong,20,1,1`), /Data row 2/);
  assert.equal(storage.getItem(STORAGE_KEY), before);
  const unavailable = { getItem: () => null, setItem: () => { throw new Error("Quota exceeded"); } };
  assert.throws(() => saveImport("products", records, admin, unavailable), /Import was not saved.*Quota exceeded/);
});

test("corrupted stored data is surfaced rather than silently replaced", () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, "{bad json");
  assert.throws(() => readWorkspace(storage), /could not be read/);
  assert.equal(storage.getItem(STORAGE_KEY), "{bad json");
  storage.setItem(STORAGE_KEY, JSON.stringify({ ...emptyWorkspace(), products: [{}] }));
  assert.throws(() => readWorkspace(storage), /sku is required/);
});

test("file size and row count limits are enforced at their actual boundaries", () => {
  assert.equal(parseImport("products", productCsv.padEnd(MAX_CSV_BYTES, " "), emptyWorkspace()).length, 1);
  assert.throws(() => parseImport("products", " ".repeat(MAX_CSV_BYTES + 1), emptyWorkspace()), /2 MB/);
  const rows = Array.from({ length: 5000 }, (_, index) => `TEST-${index},Item,,,,1,2,3,4`);
  assert.equal(parseImport("products", csvTemplate("products") + rows.join("\n"), emptyWorkspace()).length, 5000);
  assert.throws(() => parseImport("products", csvTemplate("products") + [...rows, "EXTRA,Item,,,,1,2,3,4"].join("\n"), emptyWorkspace()), /between 1 and 5000/);
});

test("CSV export includes every dataset and safely escapes spreadsheet formulas", () => {
  const workspace = emptyWorkspace();
  workspace.products.push({
    sku: "SKU-1", product_name: '=HYPERLINK("https://example.invalid")', category: "Tops",
    size: "M", color: "", cost_price: 10, selling_price: 20, qty_available: 2, low_stock_threshold: 3,
  });
  workspace.customers.push({
    customer_code: "C-1", full_name: "Customer, One", contact_number: "09123456789",
    email: "", address: "", city: "",
  });
  workspace.orders.push({ order_no: "ORD-1", customer_code: "C-1", total_amount: 20, status: "Processing", ordered_at: "2026-11-20" });
  workspace.sales.push({ sale_no: "SALE-1", order_no: "ORD-1", amount: 20, cost: 10, sold_at: "2026-11-20" });
  workspace.reservations.push({ reservation_no: "RES-1", customer_code: "C-1", status: "Approved", expires_at: "2026-11-25" });

  const csv = serializeWorkspaceCsv(workspace);
  assert.ok(csv.startsWith('\uFEFF"record_type","sku"'));
  const [headers, ...rows] = Papa.parse(csv.replace(/^\uFEFF/, ""), { skipEmptyLines: true }).data;
  const product = Object.fromEntries(headers.map((header, index) => [header, rows[0][index]]));
  const customer = Object.fromEntries(headers.map((header, index) => [header, rows[1][index]]));
  assert.equal(product.record_type, "products");
  assert.equal(product.sku, "SKU-1");
  assert.equal(product.product_name, `'=HYPERLINK("https://example.invalid")`);
  assert.equal(customer.record_type, "customers");
  assert.equal(customer.full_name, "Customer, One");
  assert.deepEqual(rows.map((row) => row[headers.indexOf("record_type")]), [
    "products", "customers", "orders", "sales", "reservations",
  ]);
});

test("Excel export writes one sheet per dataset with all stored rows", async () => {
  const workspace = emptyWorkspace();
  workspace.orders.push({
    order_no: "ORD-1", customer_code: "C-1", total_amount: 250,
    status: "Processing", ordered_at: "2026-11-20",
  });
  const output = createWorkspaceExcel(workspace);
  const files = unzipSync(output);
  const workbookXml = strFromU8(files["xl/workbook.xml"]);
  const orderSheet = strFromU8(files["xl/worksheets/sheet3.xml"]);

  assert.match(workbookXml, /name="Products and inventory"/);
  assert.match(workbookXml, /name="Customers"/);
  assert.match(workbookXml, /name="Orders"/);
  assert.match(workbookXml, /name="Sales"/);
  assert.match(workbookXml, /name="Reservations"/);
  assert.match(orderSheet, /<c r="A2" t="inlineStr"><is><t xml:space="preserve">ORD-1<\/t><\/is><\/c>/);
  assert.match(orderSheet, /<c r="C2"><v>250<\/v><\/c>/);
});
