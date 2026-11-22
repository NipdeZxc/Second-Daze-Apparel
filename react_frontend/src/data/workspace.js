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

function reportDatePeriod(value, granularity) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.toLocaleDateString("en-CA");
  return granularity === "day" ? day : day.slice(0, 7);
}

function productStockStatus(product) {
  if (product.status === "Inactive" || product.is_active === 0 || product.is_active === false) return "Inactive";
  return Number(product.stock_quantity) <= Number(product.low_stock_threshold) ? "Low stock" : "In stock";
}

export function getReportChartDrilldown(overview, report, view, item) {
  const records = overview?.records;
  if (!records || !item) return null;

  const weekly = view === "weekly";
  if (report === "sales") {
    const sales = weekly ? overview.fridayReview?.sales || [] : records.sales || [];
    const period = weekly ? "day" : "month";
    const rows = sales.filter((sale) => reportDatePeriod(sale.sold_at, period) === item.period);
    return { kind: "sales", title: `Sales · ${item.period}`, rows };
  }

  if (report === "orders") {
    const orders = weekly ? overview.fridayReview?.orders || [] : records.orders || [];
    const rows = orders.filter((order) => (order.status || "Unknown") === item.label);
    return { kind: "orders", title: `Orders · ${item.label}`, rows };
  }

  if (report === "stock") {
    const rows = (records.products || [])
      .filter((product) => productStockStatus(product) === item.label)
      .map((product) => ({ ...product, report_stock_status: item.label }));
    return { kind: "products", title: `Products · ${item.label}`, rows };
  }

  if (report === "financial") {
    const sales = weekly ? overview.fridayReview?.sales || [] : records.sales || [];
    const range = weekly && overview.fridayReview
      ? { start: new Date(overview.fridayReview.start), end: new Date(overview.fridayReview.end) }
      : null;
    const refunds = (records.refunds || []).filter((refund) =>
      refund.status === "Approved" && (!weekly || (range && dateInRange(refund.refund_date, range))),
    );
    const details = [
      ...sales.map((sale, index) => {
        const amount = Number(sale.amount || 0);
        const cost = Number(sale.cost || 0);
        return {
          report_id: `sale-${sale.id ?? sale.sale_no ?? index}`,
          record_type: "Sale",
          reference: sale.sale_no || `Sale ${index + 1}`,
          date: sale.sold_at,
          net_sales: amount,
          recorded_cost: cost,
          profit_impact: amount - cost,
        };
      }),
      ...refunds.map((refund, index) => {
        const amount = Number(refund.amount || 0);
        return {
          report_id: `refund-${refund.id ?? refund.refund_number ?? index}`,
          record_type: "Approved refund",
          reference: refund.refund_number || `Refund ${index + 1}`,
          date: refund.refund_date,
          net_sales: -amount,
          recorded_cost: 0,
          profit_impact: -amount,
        };
      }),
    ];
    const rows = details.filter((detail) => {
      if (item.label === "Recorded cost") return detail.recorded_cost !== 0;
      if (item.label === "Profit") return detail.profit_impact !== 0;
      return detail.net_sales !== 0;
    });
    return { kind: "financial", title: `${item.label} source records`, rows };
  }

  return null;
}

export function buildReportChartData(overview, report, view) {
  const records = overview?.records;
  if (!records) return { type: report === "sales" ? "trend" : "bars", format: report === "financial" ? "money" : "count", period: null, items: [] };

  const weekly = view === "weekly";
  if (report === "sales") {
    const totals = new Map();
    const sales = weekly ? overview.fridayReview?.sales || [] : records.sales || [];
    for (const sale of sales) {
      const period = reportDatePeriod(sale.sold_at, weekly ? "day" : "month");
      if (!period) continue;
      totals.set(period, (totals.get(period) || 0) + cents(sale.amount));
    }
    return {
      type: "trend",
      period: weekly ? "day" : "month",
      items: [...totals].sort(([left], [right]) => left.localeCompare(right))
        .map(([period, amount]) => ({ period, value: amount / 100 })),
    };
  }

  if (report === "financial") {
    const metrics = overview.metrics || {};
    return {
      type: "bars",
      format: "money",
      items: [
        { label: "Net sales", value: weekly ? metrics.weeklySales ?? 0 : metrics.grossSales ?? 0 },
        { label: "Recorded cost", value: weekly ? metrics.weeklyCost ?? 0 : metrics.totalCost ?? 0 },
        { label: "Profit", value: weekly ? metrics.weeklyProfit ?? 0 : metrics.profit ?? 0 },
      ],
    };
  }

  if (report === "orders") {
    const orders = weekly ? overview.fridayReview?.orders || [] : records.orders || [];
    const counts = new Map();
    for (const order of orders) {
      const status = order.status || "Unknown";
      counts.set(status, (counts.get(status) || 0) + 1);
    }
    return {
      type: "bars",
      format: "count",
      items: [...counts].sort(([left], [right]) => left.localeCompare(right))
        .map(([label, value]) => ({ label, value })),
    };
  }

  if (report === "stock") {
    const products = records.products || [];
    const counts = new Map([["In stock", 0], ["Low stock", 0], ["Inactive", 0]]);
    for (const product of products) {
      const status = productStockStatus(product);
      counts.set(status, counts.get(status) + 1);
    }
    return {
      type: "bars",
      format: "count",
      items: [...counts].filter(([, value]) => value > 0).map(([label, value]) => ({ label, value })),
    };
  }

  return { type: "bars", format: "count", period: null, items: [] };
}

function dateInRange(value, range) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= range.start && date <= range.end;
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
  const dateKey = (value) => new Date(value).toLocaleDateString("en-CA");
  const dailySales = new Map();
  for (const sale of records.sales) {
    const day = dateKey(sale.sold_at);
    dailySales.set(day, (dailySales.get(day) || 0) + cents(sale.amount));
  }
  const countedOrders = records.orders.filter((order) => !["Cancelled", "Voided"].includes(order.status));
  const orderedTotal = records.orders.reduce((sum, order) => sum + cents(order.total_amount), 0);
  return {
    records, lowStock, reservations, pendingOrders,
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
      todaysSales: records.sales.filter((sale) => dateKey(sale.sold_at) === dateKey(now)).reduce((sum, sale) => sum + cents(sale.amount), 0) / 100,
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
