import assert from "node:assert/strict";
import test from "node:test";
import Papa from "papaparse";
import { strFromU8, unzipSync } from "fflate";
import { buildOverview, buildReportChartData, buildWeeklyReport, csvTemplate, datasets, emptyRecords, getFridayReviewWeek, getReportChartDrilldown, importColumns, importKinds, MAX_CSV_BYTES, parseImport } from "./workspace.js";
import { datasetImportFiles, parseDatasetFile } from "./datasetImport.js";
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
  assert.deepEqual(overview.queues, { accessApprovals: 0, ordersToFulfill: 0, lowStockItems: 0, unpaidReservations: 0 });
});

test("TiDB dataset CSV parser recognizes supported files and keeps schema columns", () => {
  const definition = datasetImportFiles.find((item) => item.file === "product.csv");
  const values = {
    product_id: "1",
    product_code: "SKU-000001",
    product_name: "Sample Shirt",
    category: "Tops",
    size: "M",
    cost_price: "10.00",
    selling_price: "20.00",
    stock_quantity: "5",
    reserved_quantity: "0",
    defective_quantity: "0",
    low_stock_threshold: "1",
    is_active: "1",
    created_by: "1",
    updated_by: "",
  };
  const csv = `${definition.columns.join(",")}\r\n${definition.columns.map((column) => values[column]).join(",")}`;
  const parsed = parseDatasetFile("product.csv", csv);
  assert.equal(parsed.table, "products");
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].product_code, "SKU-000001");
  assert.equal(parsed.records[0].updated_by, null);
});

test("TiDB dataset CSV parser rejects unknown files, missing columns, and duplicate IDs", () => {
  assert.throws(() => parseDatasetFile("unknown.csv", "id\n1"), /not a supported TiDB dataset/);
  assert.throws(() => parseDatasetFile("product.csv", "product_id,product_name\n1,Shirt"), /columns do not match/);
  const definition = datasetImportFiles.find((item) => item.file === "product.csv");
  const values = {
    product_id: "1", product_code: "SKU-1", product_name: "Shirt", category: "", size: "",
    cost_price: "1.00", selling_price: "2.00", stock_quantity: "1", reserved_quantity: "0",
    defective_quantity: "0", low_stock_threshold: "1", is_active: "1", created_by: "1", updated_by: "",
  };
  const row = definition.columns.map((column) => values[column]).join(",");
  assert.throws(() => parseDatasetFile("product.csv", `${definition.columns.join(",")}\n${row}\n${row}`), /duplicate product_id/);
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
      { reservation_number: "V2", status: "Paid", expires_at: "2026-11-25T00:00:00Z" },
      { reservation_number: "V3", status: "Active", expires_at: "2026-11-01T00:00:00Z" },
    ],
    dashboard: { pendingOrders: 1, unpaidReservations: 1, itemsForShipping: 4, completedOrders: 1 },
  };
  const overview = buildOverview(records, new Date("2026-11-20T12:00:00Z"));
  assert.equal(overview.metrics.grossSales, 150.1);
  assert.equal(overview.metrics.profit, 50);
  assert.equal(overview.metrics.ordersPlaced, 3);
  assert.equal(overview.metrics.activeReservations, 1);
  assert.equal(overview.metrics.pendingOrders, 1);
  assert.equal(overview.metrics.unpaidReservations, 1);
  assert.equal(overview.metrics.itemsForShipping, 4);
  assert.equal(overview.metrics.completedOrders, 1);
  assert.deepEqual(overview.queues, { accessApprovals: 2, ordersToFulfill: 1, lowStockItems: 1, unpaidReservations: 1 });
});

test("overview retains historical daily sales for the all-time chart", () => {
  const sales = Array.from({ length: 35 }, (_, index) => ({
    amount: index + 1,
    sold_at: new Date(Date.UTC(2020, 0, index + 1, 12)).toISOString(),
  }));
  const overview = buildOverview({ ...emptyRecords(), sales }, new Date("2026-11-20T12:00:00Z"));

  assert.equal(overview.dailySales.length, 35);
  assert.equal(overview.dailySales[0][1], 1);
  assert.equal(overview.dailySales.at(-1)[1], 35);
});

test("report chart data follows the selected report and period", () => {
  const records = {
    ...emptyRecords(),
    sales: [
      { amount: 100, cost: 40, sold_at: "2025-01-15T12:00:00Z" },
      { amount: 50, cost: 20, sold_at: "2025-01-20T12:00:00Z" },
      { amount: 25, cost: 10, sold_at: "2026-11-18T12:00:00Z" },
    ],
    orders: [
      { status: "Completed", ordered_at: "2026-11-18T12:00:00Z" },
      { status: "Pending Payment", ordered_at: "2026-11-19T12:00:00Z" },
      { status: "Cancelled", ordered_at: "2025-01-20T12:00:00Z" },
    ],
    products: [
      { status: "In stock", stock_quantity: 8, low_stock_threshold: 3 },
      { status: "Low stock", stock_quantity: 2, low_stock_threshold: 3 },
      { status: "Inactive", stock_quantity: 0, low_stock_threshold: 3 },
    ],
  };
  const overview = buildOverview(records, new Date("2026-11-20T12:00:00Z"));
  const weeklySales = buildReportChartData(overview, "sales", "weekly");
  const allSales = buildReportChartData(overview, "sales", "all");
  const financial = buildReportChartData(overview, "financial", "all");
  const weeklyOrders = buildReportChartData(overview, "orders", "weekly");
  const stock = buildReportChartData(overview, "stock", "all");

  assert.equal(weeklySales.items.length, 1);
  assert.equal(weeklySales.items[0].value, 25);
  assert.deepEqual(allSales.items.map((item) => item.value), [150, 25]);
  assert.deepEqual(financial.items.map((item) => item.value), [175, 70, 105]);
  assert.deepEqual(weeklyOrders.items, [
    { label: "Completed", value: 1 },
    { label: "Pending Payment", value: 1 },
  ]);
  assert.deepEqual(stock.items, [
    { label: "In stock", value: 1 },
    { label: "Low stock", value: 1 },
    { label: "Inactive", value: 1 },
  ]);
});

test("report chart drilldowns return the records contributing to each selected value", () => {
  const records = {
    ...emptyRecords(),
    sales: [
      { id: 1, sale_no: "SALE-1", amount: 100, cost: 40, sold_at: "2026-11-18T12:00:00Z" },
      { id: 2, sale_no: "SALE-2", amount: 50, cost: 20, sold_at: "2026-11-19T12:00:00Z" },
      { id: 3, sale_no: "SALE-3", amount: 200, cost: 80, sold_at: "2025-01-15T12:00:00Z" },
    ],
    refunds: [
      { id: 4, refund_number: "REF-1", status: "Approved", amount: 10, refund_date: "2026-11-19T12:00:00Z" },
      { id: 5, refund_number: "REF-2", status: "Pending Approval", amount: 5, refund_date: "2026-11-19T12:00:00Z" },
    ],
    orders: [
      { id: 6, order_number: "ORD-1", status: "Completed", ordered_at: "2026-11-18T12:00:00Z" },
      { id: 7, order_number: "ORD-2", status: "Pending Payment", ordered_at: "2025-01-15T12:00:00Z" },
    ],
    products: [
      { id: 8, product_code: "SKU-1", status: "Inactive", stock_quantity: 0, low_stock_threshold: 3 },
      { id: 9, product_code: "SKU-2", stock_quantity: 2, low_stock_threshold: 3 },
      { id: 10, product_code: "SKU-3", stock_quantity: 8, low_stock_threshold: 3 },
    ],
  };
  const overview = buildOverview(records, new Date("2026-11-20T12:00:00Z"));
  const salesChart = buildReportChartData(overview, "sales", "weekly");
  const orderChart = buildReportChartData(overview, "orders", "weekly");
  const stockChart = buildReportChartData(overview, "stock", "all");
  const financialChart = buildReportChartData(overview, "financial", "weekly");

  assert.deepEqual(
    getReportChartDrilldown(overview, "sales", "weekly", salesChart.items[0]).rows.map((sale) => sale.sale_no),
    ["SALE-1"],
  );
  assert.deepEqual(
    getReportChartDrilldown(overview, "sales", "weekly", salesChart.items[1]).rows.map((sale) => sale.sale_no),
    ["SALE-2"],
  );
  assert.deepEqual(
    getReportChartDrilldown(overview, "orders", "weekly", orderChart.items[0]).rows.map((order) => order.order_number),
    ["ORD-1"],
  );
  assert.deepEqual(
    getReportChartDrilldown(overview, "stock", "all", stockChart.items.find((item) => item.label === "Low stock")).rows
      .map((product) => product.product_code),
    ["SKU-2"],
  );
  const financialRows = getReportChartDrilldown(
    overview,
    "financial",
    "weekly",
    financialChart.items.find((item) => item.label === "Profit"),
  ).rows;
  assert.deepEqual(financialRows.map((row) => [row.reference, row.profit_impact]), [
    ["SALE-1", 60],
    ["SALE-2", 30],
    ["REF-1", -10],
  ]);
});

test("Friday review week returns Monday through the most recent Friday", () => {
  const range = getFridayReviewWeek(new Date("2026-11-21T12:00:00Z"));
  assert.equal(range.start.getUTCDay(), 1);
  assert.equal(range.end.getUTCDay(), 5);
  assert.equal(range.start.toISOString().slice(0, 10), "2026-11-16");
  assert.equal(range.end.toISOString().slice(0, 10), "2026-11-20");
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
