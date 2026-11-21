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
      text("reservation_number", "Reservation"), text("customer_name", "Customer"), text("items", "Items", { optional: true }),
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
  const seen = new Set((existing[kind] || []).map((record) => String(record[definition.importKey]).toLowerCase()));
  return records.map((record, index) => {
    try {
      const normalized = Object.fromEntries(columns.map((column) => [column.key, normalizeValue(record[column.key], column)]));
      const id = String(normalized[definition.importKey]).toLowerCase();
      if (seen.has(id)) throw new Error(`Duplicate ${definition.importKey}: ${normalized[definition.importKey]}. Existing records are not overwritten.`);
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

export function buildOverview(records, now = new Date()) {
  const refunded = records.refunds.filter((refund) => refund.status === "Approved").reduce((sum, refund) => sum + cents(refund.amount), 0);
  const salesTotal = records.sales.reduce((sum, sale) => sum + cents(sale.amount), 0);
  const totalCost = records.sales.reduce((sum, sale) => sum + cents(sale.cost), 0);
  const grossSales = salesTotal - refunded;
  const pendingOrders = records.orders.filter((order) => !CLOSED_ORDERS.includes(order.status));
  const pendingOrderCount = records.dashboard?.pendingOrders
    ?? records.orders.filter((order) => ["Pending Approval", "Pending Payment"].includes(order.status)).length;
  const lowStock = records.products.filter((product) => product.status !== "Inactive" && Number(product.stock_quantity) <= Number(product.low_stock_threshold));
  const reservations = records.reservations.filter((item) => ["Pending Approval", "Active"].includes(item.status)
    && (!item.expires_at || Date.parse(item.expires_at) > now.getTime()));
  const unpaidReservations = records.dashboard?.unpaidReservations
    ?? records.reservations.filter((item) => item.status === "Active" && item.payment_status !== "Paid").length;
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
      activeReservations: reservations.length,
    },
    queues: {
      accessApprovals: records.pendingAccess,
      ordersToFulfill: pendingOrders.length,
      lowStockItems: lowStock.length,
      unpaidReservations,
    },
    dailySales: [...dailySales].sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([day, amount]) => [day, amount / 100]),
    recentActivity: records.recentActivity,
    updatedAt: records.updatedAt,
  };
}

export function csvTemplate(kind) {
  return `${importColumns(kind).map((column) => column.key).join(",")}\r\n`;
}
