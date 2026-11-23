import Papa from "papaparse";

export const MAX_CSV_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5000;
const text = (key, label, extra = {}) => ({ key, label, type: "text", ...extra });
const money = (key, label, extra = {}) => ({ key, label, type: "money", ...extra });
const quantity = (key, label, extra = {}) => ({ key, label, type: "quantity", ...extra });
const date = (key, label, extra = {}) => ({ key, label, type: "date", ...extra });
const status = (values) => ({ key: "status", label: "Status", type: "text", values, readonly: true, optional: true });

// Column shapes mirror what the API returns. Columns flagged readonly are never sent to the API
// when importing or editing; `importable` marks the datasets an Admin can load from CSV.
export const datasets = {
  products: {
    label: "Products and inventory", key: "product_code", importable: true, editable: true, importKey: "product_code",
    columns: [
      text("product_code", "Product code"), text("product_name", "Product"),
      text("category", "Category", { optional: true }), text("size", "Size", { optional: true }),
      money("cost_price", "Cost price"), money("selling_price", "Selling price"),
      quantity("stock_quantity", "Available"),
      quantity("reserved_quantity", "Reserved", { readonly: true, optional: true }),
      quantity("defective_quantity", "Defective", { readonly: true, optional: true }),
      quantity("low_stock_threshold", "Low-stock threshold"),
    ],
  },
  customers: {
    label: "Customers", key: "customer_id", importable: true, editable: true, importKey: "contact_number",
    columns: [
      text("customer_id", "Customer ID", { readonly: true, optional: true }), text("full_name", "Customer"),
      text("contact_number", "Contact number"), text("street_address", "Address"),
      text("barangay", "Barangay"), text("city_municipality", "City"), text("province", "Province"),
      status(["Verified", "Unverified"]),
    ],
  },
  orders: {
    label: "Orders", key: "order_number",
    columns: [
      text("order_number", "Order"), text("customer_name", "Customer"), money("total_amount", "Amount"),
      text("payment_status", "Payment"), text("items", "Items"), text("tracking_number", "Tracking no."),
      status(["Pending Approval", "Pending Payment", "Paid", "Packed", "For Shipping", "Shipped", "Delivered", "Completed", "Cancelled", "Voided"]),
      date("ordered_at", "Ordered at"),
    ],
  },
  sales: {
    label: "Sales", key: "sale_no",
    columns: [
      text("sale_no", "Sale"), money("amount", "Amount"), money("cost", "Cost"), date("sold_at", "Sold at"),
    ],
  },
  reservations: {
    label: "Reservations", key: "reservation_number",
    columns: [
      text("reservation_number", "Reservation"), text("customer_name", "Customer"),
      quantity("reservation_days", "Agreed days"), text("items", "Items", { optional: true }),
      money("amount", "Amount"),
      status(["Pending Approval", "Active", "Paid", "Voided", "Cancelled", "Rejected"]),
      date("expires_at", "Expires at", { optional: true }),
    ],
  },
  refunds: {
    label: "Refunds", key: "refund_number",
    columns: [
      text("refund_number", "Refund ticket"), text("order_number", "Order"), text("customer_name", "Customer"),
      text("reason", "Reason"), money("amount", "Amount"), status(["Pending Approval", "Approved", "Rejected"]),
    ],
  },
  documents: {
    label: "Sales documents", key: "doc_number",
    columns: [
      text("doc_number", "Document ID"), text("doc_type", "Type"), text("order_number", "Related order"),
      text("issued_by", "Issued by"), date("issued_at", "Date"),
    ],
  },
  accounts: {
    label: "Staff accounts", key: "username",
    columns: [
      text("username", "Login"), text("full_name", "Staff member"), text("role", "Role"),
      status(["Pending Approval", "Active", "Disabled"]), date("last_login_at", "Last login", { optional: true }),
    ],
  },
};

export const importKinds = Object.keys(datasets).filter((kind) => datasets[kind].importable);

function definitionFor(kind) {
  if (!Object.hasOwn(datasets, kind) || !datasets[kind].importable) throw new Error("Choose a supported import type.");
  return datasets[kind];
}

export const importColumns = (kind) => definitionFor(kind).columns.filter((column) => !column.readonly);

export function emptyRecords() {
  return {
    ...Object.fromEntries(Object.keys(datasets).map((kind) => [kind, []])),
    notifications: [], recentActivity: [], pendingAccess: 0, dashboard: null, updatedAt: null,
  };
}

function normalizeValue(value, column) {
  const raw = String(value ?? "").trim();
  if (!raw && column.optional) return "";
  if (!raw) throw new Error(`${column.key} is required.`);
  if (raw.length > 500) throw new Error(`${column.key} must be 500 characters or fewer.`);
  if (column.type === "money" || column.type === "quantity") {
    const pattern = column.type === "money" ? /^\d+(\.\d{1,2})?$/ : /^\d+$/;
    if (!pattern.test(raw) || Number(raw) > 99999999) {
      throw new Error(`${column.key} must be a non-negative ${column.type === "money" ? "amount with at most two decimal places" : "whole number"} below 100000000.`);
    }
    return Number(raw);
  }
  if (column.key === "contact_number" && !/^(09|\+639)[0-9]{9}$/.test(raw.replace(/[\s-]/g, ""))) {
    throw new Error("contact_number must look like 09XXXXXXXXX or +639XXXXXXXXX.");
  }
  return raw;
}

export function validateRecords(kind, records, existing = emptyRecords()) {
  const definition = definitionFor(kind);
  const columns = importColumns(kind);
  if (!records.length || records.length > MAX_ROWS) throw new Error(`Import between 1 and ${MAX_ROWS} rows at a time.`);
  const existingIds = new Set((existing[kind] || []).map((record) => String(record[definition.importKey]).toLowerCase()));
  const seen = new Set();
  return records.map((record, index) => {
    try {
      const normalized = Object.fromEntries(columns.map((column) => [column.key, normalizeValue(record[column.key], column)]));
      const id = String(normalized[definition.importKey]).toLowerCase();
      if (seen.has(id)) throw new Error(`Duplicate ${definition.importKey}: ${normalized[definition.importKey]} within this file.`);
      if (kind !== "products" && existingIds.has(id)) {
        throw new Error(`Duplicate ${definition.importKey}: ${normalized[definition.importKey]}. Existing records are not overwritten.`);
      }
      seen.add(id);
      return normalized;
    } catch (error) {
      throw new Error(`Data row ${index + 1}: ${error.message}`);
    }
  });
}

export function parseImport(kind, csv, existing = emptyRecords()) {
  const columnDefinitions = importColumns(kind);
  if (new TextEncoder().encode(csv).length > MAX_CSV_BYTES) throw new Error("CSV files must be 2 MB or smaller.");
  const parsed = Papa.parse(csv.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n"), {
    skipEmptyLines: "greedy", delimiter: ",", newline: "\n",
  });
  if (parsed.errors.length) throw new Error(`Invalid CSV: ${parsed.errors[0].message}`);
  const [header = [], ...rows] = parsed.data;
  const columns = header.map((name) => name.trim());
  if (new Set(columns).size !== columns.length) throw new Error("CSV headers must not be duplicated.");
  const required = columnDefinitions.filter((column) => !column.optional).map((column) => column.key);
  const missing = required.filter((key) => !columns.includes(key));
  const unknown = columns.filter((key) => !columnDefinitions.some((column) => column.key === key));
  if (missing.length) throw new Error(`Missing columns: ${missing.join(", ")}.`);
  if (unknown.length) throw new Error(`Unknown columns: ${unknown.join(", ")}. Download the template for the supported format.`);
  const records = rows.map((values, index) => {
    if (values.length !== columns.length) throw new Error(`Data row ${index + 1}: expected ${columns.length} columns, received ${values.length}.`);
    return Object.fromEntries(columns.map((key, position) => [key, values[position]]));
  });
  return validateRecords(kind, records, existing);
}

const cents = (value) => Math.round(Number(value || 0) * 100);
const CLOSED_ORDERS = ["Delivered", "Completed", "Cancelled", "Voided"];

export function fridayReviewRange(now = new Date()) {
  const friday = new Date(now);
  friday.setUTCHours(23, 59, 59, 999);
  const offsetFromFriday = (friday.getUTCDay() - 5 + 7) % 7;
  friday.setUTCDate(friday.getUTCDate() - offsetFromFriday);
  const monday = new Date(friday);
  monday.setUTCDate(friday.getUTCDate() - 4);
  monday.setUTCHours(0, 0, 0, 0);
  return { start: monday, end: friday };
}

export const getFridayReviewWeek = fridayReviewRange;

export function buildWeeklyReport(records, now = new Date()) {
  const range = fridayReviewRange(now);
  const sales = records.sales.filter((sale) => dateInRange(sale.sold_at, range));
  const orders = records.orders.filter((order) => dateInRange(order.ordered_at, range));
  const refunds = records.refunds.filter((refund) =>
    refund.status === "Approved" && dateInRange(refund.refund_date, range),
  );
  const salesCents = sales.reduce((sum, sale) => sum + cents(sale.amount), 0);
  const costCents = sales.reduce((sum, sale) => sum + cents(sale.cost), 0);
  const refundCents = refunds.reduce((sum, refund) => sum + cents(refund.amount), 0);
  const lowStock = records.products.filter((product) =>
    product.status !== "Inactive" && Number(product.stock_quantity) <= Number(product.low_stock_threshold),
  );
  return {
    range,
    sales: { transactions: sales.length, grossSales: salesCents / 100, cost: costCents / 100 },
    financial: { grossSales: (salesCents - refundCents) / 100, cost: costCents / 100, refunds: refundCents / 100 },
    orders: { count: orders.length, pending: orders.filter((order) => ["Pending Approval", "Pending Payment"].includes(order.status)).length },
    stock: { lowStockCount: lowStock.length, lowStock },
  };
}

function dateInRange(value, range) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= range.start && date <= range.end;
}

function localDateKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function buildSalesChartSeries(dailySales, range, now = new Date()) {
  if (!["7", "30", "all"].includes(String(range))) throw new Error("Choose a supported sales date range.");
  let series = dailySales;
  let startKey;
  let endKey;
  if (range !== "all") {
    const start = new Date(now);
    start.setDate(start.getDate() - Number(range) + 1);
    startKey = localDateKey(start);
    endKey = localDateKey(now);
    series = series.filter(([day]) => day >= startKey && day <= endKey);
  }
  return buildDateChartSeries(series, startKey, endKey);
}

function buildDateChartSeries(series, startKey, endKey) {
  if (!series.length) return [];
  startKey ??= series[0][0];
  endKey ??= series.at(-1)[0];
  const startTime = Date.parse(`${startKey}T00:00:00Z`);
  const endTime = Date.parse(`${endKey}T00:00:00Z`);
  const days = (endTime - startTime) / 86400000 + 1;
  const groupDays = Math.ceil(days / 8);
  const totals = Array(Math.ceil(days / groupDays)).fill(0);
  for (const [day, amount] of series) {
    const index = Math.floor((Date.parse(`${day}T00:00:00Z`) - startTime) / 86400000 / groupDays);
    totals[index] += cents(amount);
  }
  return totals.map((total, index) => ({
    start: new Date(startTime + index * groupDays * 86400000).toISOString().slice(0, 10),
    end: new Date(Math.min(endTime, startTime + ((index + 1) * groupDays - 1) * 86400000)).toISOString().slice(0, 10),
    amount: total / 100,
  }));
}

export function buildReportChartData(overview, report, view) {
  if (!["sales", "financial", "orders", "stock"].includes(report) || !["weekly", "all"].includes(view)) {
    throw new Error("Choose a supported report and date range.");
  }
  const records = overview.records;
  const weekly = view === "weekly";
  const sales = weekly ? overview.fridayReview.sales : records.sales;
  if (report === "sales") {
    let items;
    if (weekly) {
      const totals = new Map();
      for (const sale of sales) {
        const day = localDateKey(sale.sold_at);
        totals.set(day, (totals.get(day) || 0) + cents(sale.amount));
      }
      const dailySales = [...totals].sort(([left], [right]) => left.localeCompare(right))
        .map(([day, amount]) => [day, amount / 100]);
      items = buildDateChartSeries(dailySales, localDateKey(overview.fridayReview.start), localDateKey(overview.fridayReview.end));
    } else {
      items = buildSalesChartSeries(overview.dailySales, "all");
    }
    return { type: "trend", format: "money", items };
  }
  if (report === "financial") {
    const range = { start: new Date(overview.fridayReview.start), end: new Date(overview.fridayReview.end) };
    const refunds = records.refunds.filter((refund) =>
      refund.status === "Approved" && (!weekly || dateInRange(refund.refund_date, range)),
    );
    const metrics = overview.metrics;
    return {
      type: "bars", format: "money",
      items: sales.length || refunds.length ? [
        { label: "Net sales", value: weekly ? metrics.weeklySales : metrics.grossSales },
        { label: "Recorded cost", value: weekly ? metrics.weeklyCost : metrics.totalCost },
        { label: "Profit", value: weekly ? metrics.weeklyProfit : metrics.profit },
        { label: "Approved refunds", value: refunds.reduce((sum, refund) => sum + cents(refund.amount), 0) / 100 },
      ] : [],
    };
  }
  const counts = report === "stock" ? new Map([["In stock", 0], ["Low stock", 0], ["Inactive", 0]]) : new Map();
  const rows = report === "stock" ? records.products : weekly ? overview.fridayReview.orders : records.orders;
  for (const row of rows) {
    const label = report === "stock"
      ? row.status === "Inactive" || [0, false, "0"].includes(row.is_active) ? "Inactive"
        : Number(row.stock_quantity) <= Number(row.low_stock_threshold) ? "Low stock" : "In stock"
      : row.status || "Unknown";
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  const entries = report === "stock" ? [...counts] : [...counts].sort(([left], [right]) => left.localeCompare(right));
  return { type: "bars", format: "count", items: entries.filter(([, value]) => value > 0).map(([label, value]) => ({ label, value })) };
}

function reportDateBars(entries, range, format, description) {
  const totals = new Map();
  for (const { date, value } of entries) {
    const day = localDateKey(date);
    totals.set(day, (totals.get(day) || 0) + cents(value));
  }
  const series = [...totals].sort(([left], [right]) => left.localeCompare(right))
    .map(([day, value]) => [day, value / 100]);
  const items = buildDateChartSeries(series, range && localDateKey(range.start), range && localDateKey(range.end))
    .map(({ start, end, amount }) => ({ label: start === end ? start : `${start} to ${end}`, value: amount }));
  return { type: "bars", format, description, items };
}

function reportGroupedBars(rows, labelFor, valueFor, description) {
  const totals = new Map();
  for (const row of rows) {
    const label = labelFor(row);
    totals.set(label, (totals.get(label) || 0) + cents(valueFor(row)));
  }
  const items = [...totals].sort(([left, a], [right, b]) => b - a || left.localeCompare(right))
    .map(([label, value]) => ({ label, value: value / 100 }));
  if (items.length > 8) {
    const otherIndex = items.findIndex((item) => item.label === "Other groups");
    if (otherIndex >= 0) items.push(...items.splice(otherIndex, 1));
    const remainder = items.splice(7);
    items.push({ label: "Other groups", value: remainder.reduce((sum, item) => sum + cents(item.value), 0) / 100 });
  }
  return { type: "bars", format: "count", description, items };
}

export function buildReportCardChartData(overview, report, view) {
  const summary = buildReportChartData(overview, report, view);
  const { records } = overview;
  const weekly = view === "weekly";
  const range = weekly ? overview.fridayReview : null;
  const period = weekly ? "Friday review week" : "All-time";
  const sales = weekly ? overview.fridayReview.sales : records.sales;
  const refunds = records.refunds.filter((refund) => refund.status === "Approved"
    && (!weekly || dateInRange(refund.refund_date, { start: new Date(range.start), end: new Date(range.end) })));
  if (report === "sales" || report === "financial") {
    const saleEntries = (valueFor) => sales.map((sale) => ({ date: sale.sold_at, value: valueFor(sale) }));
    const refundEntries = refunds.map((refund) => ({ date: refund.refund_date, value: -Number(refund.amount) }));
    const net = reportDateBars([...saleEntries((sale) => Number(sale.amount)), ...refundEntries], range, "money", `Net sales after approved refunds · ${period}.`);
    if (report === "financial") {
      return [
        net,
        reportDateBars(saleEntries((sale) => Number(sale.cost)), range, "money", `Recorded sales cost · ${period}.`),
        reportDateBars([...saleEntries((sale) => (cents(sale.amount) - cents(sale.cost)) / 100), ...refundEntries], range, "money", `Net sales minus recorded cost · ${period}.`),
        reportDateBars(refunds.map((refund) => ({ date: refund.refund_date, value: Number(refund.amount) })), range, "money", `Approved refunds by refund date · ${period}.`),
      ];
    }
    const today = records.sales.filter((sale) => localDateKey(sale.sold_at) === localDateKey(overview.asOf));
    const hours = new Map();
    for (const sale of today) {
      const hour = Math.floor(new Date(sale.sold_at).getHours() / 3) * 3;
      hours.set(hour, (hours.get(hour) || 0) + cents(sale.amount));
    }
    const orderEntries = records.orders.map((order) => ({ date: order.ordered_at, value: Number(order.total_amount || 0) }));
    const averages = reportDateBars(orderEntries, null, "money", "Average order value by order date · All-time. Intervals are weighted by order count.");
    const counts = reportDateBars(orderEntries.map((entry) => ({ ...entry, value: 1 })), null, "count", "");
    averages.items = averages.items.flatMap((item, index) => counts.items[index].value > 0
      ? [{ ...item, value: cents(item.value / counts.items[index].value) / 100 }] : []);
    return [
      net,
      reportDateBars(saleEntries(() => 1), range, "count", `Recorded sale transactions by date · ${period}.`),
      { type: "bars", format: "money", description: "Today's gross sales by local time, in three-hour intervals.",
        items: [...hours].sort(([left], [right]) => left - right)
          .map(([hour, value]) => ({ label: `${String(hour).padStart(2, "0")}:00–${String(hour + 2).padStart(2, "0")}:59`, value: value / 100 })) },
      averages,
    ];
  }
  if (report === "orders") {
    return [
      { ...summary, description: `Current status of orders placed in ${period}.` },
      reportGroupedBars(records.orders.filter((order) => ["Pending Approval", "Pending Payment"].includes(order.status)), (order) => order.status, () => 1, "Pending approvals and payments · Current totals across all dates."),
      overview.metrics.itemsForShipping == null ? null : {
        type: "bars", format: "count", description: "Orders currently marked For Shipping · All dates.",
        items: [{ label: "For Shipping", value: overview.metrics.itemsForShipping }],
      },
      reportDateBars(records.orders.filter((order) => order.status === "Completed")
        .map((order) => ({ date: order.ordered_at, value: 1 })), null, "count", "Currently completed orders by order date · All-time."),
    ];
  }
  const byCategory = (product) => product.category || "Uncategorized";
  const byProduct = (product) => product.product_code || product.product_name || "Unnamed product";
  return [
    reportGroupedBars(overview.lowStock, byCategory, () => 1, "Low-stock product counts by category · Current inventory."),
    reportGroupedBars(records.products, byCategory, () => 1, "All product counts by category, including inactive products · Current inventory."),
    reportGroupedBars(records.products, byProduct, (product) => Number(product.reserved_quantity || 0), "Reserved units by product · Current inventory."),
    reportGroupedBars(records.products, byProduct, (product) => Number(product.defective_quantity || 0), "Defective units by product · Current inventory."),
  ];
}

export function buildOverview(records, now = new Date()) {
  const refunded = records.refunds.filter((refund) => refund.status === "Approved").reduce((sum, refund) => sum + cents(refund.amount), 0);
  const salesTotal = records.sales.reduce((sum, sale) => sum + cents(sale.amount), 0);
  const totalCost = records.sales.reduce((sum, sale) => sum + cents(sale.cost), 0);
  const grossSales = salesTotal - refunded;
  const fridayRange = fridayReviewRange(now);
  const weeklySales = records.sales.filter((sale) => dateInRange(sale.sold_at, fridayRange));
  const weeklySalesCents = weeklySales.reduce((sum, sale) => sum + cents(sale.amount), 0);
  const weeklyCostCents = weeklySales.reduce((sum, sale) => sum + cents(sale.cost), 0);
  const weeklyRefundCents = records.refunds
    .filter((refund) => refund.status === "Approved" && dateInRange(refund.refund_date, fridayRange))
    .reduce((sum, refund) => sum + cents(refund.amount), 0);
  const weeklyOrders = records.orders.filter((order) => dateInRange(order.ordered_at, fridayRange));
  const pendingOrders = records.orders.filter((order) => !CLOSED_ORDERS.includes(order.status));
  const pendingOrderCount = records.dashboard?.pendingOrders
    ?? records.orders.filter((order) => ["Pending Approval", "Pending Payment"].includes(order.status)).length;
  const lowStock = records.products.filter((product) => product.status !== "Inactive" && Number(product.stock_quantity) <= Number(product.low_stock_threshold));
  const reservations = records.reservations.filter((item) => ["Pending Approval", "Active"].includes(item.status)
    && (!item.expires_at || Date.parse(item.expires_at) > now.getTime()));
  const activeReservationCount = records.reservations.filter((item) =>
    item.status === "Active"
    && (!item.expires_at || Date.parse(item.expires_at) > now.getTime()),
  ).length;
  const unpaidReservations = records.dashboard?.unpaidReservations
    ?? records.reservations.filter((item) => ["Pending Approval", "Active"].includes(item.status)).length;
  const dailySales = new Map();
  for (const sale of records.sales) {
    const day = localDateKey(sale.sold_at);
    dailySales.set(day, (dailySales.get(day) || 0) + cents(sale.amount));
  }
  const countedOrders = records.orders.filter((order) => !["Cancelled", "Voided"].includes(order.status));
  const orderedTotal = records.orders.reduce((sum, order) => sum + cents(order.total_amount), 0);
  return {
    records, lowStock, reservations, pendingOrders, asOf: now.toISOString(),
    metrics: {
      grossSales: grossSales / 100, totalCost: totalCost / 100, profit: (grossSales - totalCost) / 100,
      weeklySales: (weeklySalesCents - weeklyRefundCents) / 100,
      weeklyCost: weeklyCostCents / 100,
      weeklyProfit: (weeklySalesCents - weeklyRefundCents - weeklyCostCents) / 100,
      weeklyOrders: weeklyOrders.length,
      pendingOrders: pendingOrderCount,
      unpaidReservations,
      itemsForShipping: records.dashboard?.itemsForShipping ?? null,
      completedOrders: records.dashboard?.completedOrders
        ?? records.orders.filter((order) => order.status === "Completed").length,
      todaysSales: records.sales.filter((sale) => localDateKey(sale.sold_at) === localDateKey(now)).reduce((sum, sale) => sum + cents(sale.amount), 0) / 100,
      ordersPlaced: records.orders.length,
      averageOrderValue: records.orders.length ? orderedTotal / 100 / records.orders.length : null,
      fulfillmentRate: countedOrders.length
        ? countedOrders.filter((order) => ["Delivered", "Completed"].includes(order.status)).length / countedOrders.length * 100 : null,
      activeReservations: activeReservationCount,
    },
    fridayReview: {
      start: fridayRange.start.toISOString(),
      end: fridayRange.end.toISOString(),
      salesCount: weeklySales.length,
      orders: weeklyOrders,
      sales: weeklySales,
      lowStock,
    },
    queues: {
      accessApprovals: records.pendingAccess,
      ordersToFulfill: pendingOrders.length,
      lowStockItems: lowStock.length,
      unpaidReservations,
    },
    dailySales: [...dailySales].sort(([a], [b]) => a.localeCompare(b)).map(([day, amount]) => [day, amount / 100]),
    recentActivity: records.recentActivity,
    updatedAt: records.updatedAt,
  };
}

export function csvTemplate(kind) {
  return `${importColumns(kind).map((column) => column.key).join(",")}\r\n`;
}
