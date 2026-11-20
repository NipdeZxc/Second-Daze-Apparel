import Papa from "papaparse";

export const STORAGE_KEY = "second-daze-workspace-v1";
export const MAX_CSV_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5000;
const text = (key, label, optional = false) => ({ key, label, type: "text", optional });
const money = (key, label) => ({ key, label, type: "money" });
const quantity = (key, label) => ({ key, label, type: "quantity" });
const date = (key, label) => ({ key, label, type: "date" });
const status = (values) => ({ key: "status", label: "Status", type: "text", values });

export const datasets = {
  products: {
    label: "Products and inventory", key: "sku",
    columns: [
      text("sku", "SKU"), text("product_name", "Product"), text("category", "Category", true),
      text("size", "Size", true), text("color", "Color", true),
      money("cost_price", "Cost price"), money("selling_price", "Selling price"),
      quantity("qty_available", "Available"), quantity("low_stock_threshold", "Low-stock threshold"),
    ],
  },
  customers: {
    label: "Customers", key: "customer_code",
    columns: [
      text("customer_code", "Customer code"), text("full_name", "Customer"),
      text("contact_number", "Contact number"), text("email", "Email", true),
      text("address", "Address", true), text("city", "City", true),
    ],
  },
  orders: {
    label: "Orders", key: "order_no", reference: ["customer_code", "customers"],
    columns: [
      text("order_no", "Order"), text("customer_code", "Customer code"),
      money("total_amount", "Amount"),
      status(["Pending", "Processing", "Shipped", "Completed", "Cancelled"]),
      date("ordered_at", "Ordered at"),
    ],
  },
  sales: {
    label: "Sales", key: "sale_no", reference: ["order_no", "orders"],
    columns: [
      text("sale_no", "Sale"), text("order_no", "Order"),
      money("amount", "Amount"), money("cost", "Cost"), date("sold_at", "Sold at"),
    ],
  },
  reservations: {
    label: "Reservations", key: "reservation_no", reference: ["customer_code", "customers"],
    columns: [
      text("reservation_no", "Reservation"), text("customer_code", "Customer code"),
      status(["Awaiting Approval", "Approved", "Paid", "Expired", "Rejected", "Cancelled"]),
      date("expires_at", "Expires at"),
    ],
  },
};

function definitionFor(kind) {
  if (!Object.hasOwn(datasets, kind)) throw new Error("Choose a supported import type.");
  return datasets[kind];
}

export function emptyWorkspace() {
  return { version: 1, products: [], customers: [], orders: [], sales: [], reservations: [], recentActivity: [], updatedAt: null };
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
  if (column.type === "date") {
    const match = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(raw);
    if (!match || !Number.isFinite(Date.parse(raw)) || new Date(`${match[1]}T00:00:00Z`).toISOString().slice(0, 10) !== match[1]) {
      throw new Error(`${column.key} must be a valid YYYY-MM-DD date or ISO timestamp with timezone.`);
    }
  }
  if (column.values && !column.values.includes(raw)) {
    throw new Error(`${column.key} must be one of: ${column.values.join(", ")}.`);
  }
  if (column.key === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    throw new Error("email must be a valid email address.");
  }
  return raw;
}

export function validateRecords(kind, records, workspace) {
  const definition = definitionFor(kind);
  if (!records.length || records.length > MAX_ROWS) throw new Error(`Import between 1 and ${MAX_ROWS} rows at a time.`);
  const seen = new Set(workspace[kind].map((record) => record[definition.key].toLowerCase()));
  return records.map((record, index) => {
    try {
      const normalized = Object.fromEntries(definition.columns.map((column) => [column.key, normalizeValue(record[column.key], column)]));
      const id = normalized[definition.key].toLowerCase();
      if (seen.has(id)) throw new Error(`Duplicate ${definition.key}: ${normalized[definition.key]}. Existing records are not overwritten.`);
      seen.add(id);
      if (definition.reference) {
        const [field, target] = definition.reference;
        if (!workspace[target].some((item) => item[datasets[target].key] === normalized[field])) {
          throw new Error(`${field} "${normalized[field]}" does not exist. Import ${target} first.`);
        }
      }
      return normalized;
    } catch (error) {
      throw new Error(`Data row ${index + 1}: ${error.message}`);
    }
  });
}

export function parseImport(kind, csv, workspace) {
  const definition = definitionFor(kind);
  if (new TextEncoder().encode(csv).length > MAX_CSV_BYTES) throw new Error("CSV files must be 2 MB or smaller.");
  const parsed = Papa.parse(csv.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n"), {
    skipEmptyLines: "greedy", delimiter: ",", newline: "\n",
  });
  if (parsed.errors.length) throw new Error(`Invalid CSV: ${parsed.errors[0].message}`);
  const [header = [], ...rows] = parsed.data;
  const columns = header.map((name) => name.trim());
  if (new Set(columns).size !== columns.length) throw new Error("CSV headers must not be duplicated.");
  const required = definition.columns.filter((column) => !column.optional).map((column) => column.key);
  const missing = required.filter((key) => !columns.includes(key));
  const unknown = columns.filter((key) => !definition.columns.some((column) => column.key === key));
  if (missing.length) throw new Error(`Missing columns: ${missing.join(", ")}.`);
  if (unknown.length) throw new Error(`Unknown columns: ${unknown.join(", ")}. Download the template for the supported format.`);
  const records = rows.map((values, index) => {
    if (values.length !== columns.length) throw new Error(`Data row ${index + 1}: expected ${columns.length} columns, received ${values.length}.`);
    return Object.fromEntries(columns.map((key, position) => [key, values[position]]));
  });
  return validateRecords(kind, records, workspace);
}

export function readWorkspace(storage = localStorage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return emptyWorkspace();
  let workspace;
  try {
    workspace = JSON.parse(raw);
  } catch {
    throw new Error("Saved browser data could not be read. Export or recover the browser storage before importing more records.");
  }
  if (workspace?.version !== 1 || !Array.isArray(workspace.recentActivity)
    || !workspace.recentActivity.every((item) => typeof item.id === "string" && typeof item.message === "string" && Number.isFinite(Date.parse(item.createdAt)))
    || !(workspace.updatedAt === null || (typeof workspace.updatedAt === "string" && Number.isFinite(Date.parse(workspace.updatedAt))))) {
    throw new Error("Saved browser data has an unsupported format. No data has been changed.");
  }
  const validated = emptyWorkspace();
  for (const kind of Object.keys(datasets)) {
    if (!Array.isArray(workspace[kind])) throw new Error(`Saved ${kind} data has an unsupported format.`);
    // Validate saved records in batches without applying the per-file row limit.
    for (let offset = 0; offset < workspace[kind].length; offset += MAX_ROWS) {
      validated[kind].push(...validateRecords(kind, workspace[kind].slice(offset, offset + MAX_ROWS), validated));
    }
  }
  return { ...validated, recentActivity: workspace.recentActivity, updatedAt: workspace.updatedAt };
}

export function saveImport(kind, records, user, storage = localStorage) {
  if (user?.role !== "Admin") throw new Error("Only an Admin can import CSV data.");
  const workspace = readWorkspace(storage);
  const validated = validateRecords(kind, records, workspace);
  const updatedAt = new Date().toISOString();
  const next = {
    ...workspace,
    [kind]: [...workspace[kind], ...validated],
    updatedAt,
    recentActivity: [{
      id: crypto.randomUUID(),
      message: `Imported ${validated.length} ${datasets[kind].label.toLowerCase()} record(s) by ${user.username}.`,
      createdAt: updatedAt,
    }, ...workspace.recentActivity].slice(0, 100),
  };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    throw new Error(`Import was not saved. Browser storage may be full or unavailable. ${error.message}`);
  }
  return next;
}

export function updateRecord(kind, identifier, values, user, storage = localStorage) {
  if (user?.role !== "Admin") throw new Error("Only an Admin can edit imported records.");
  const definition = definitionFor(kind);
  const workspace = readWorkspace(storage);
  const existing = workspace[kind].find((record) => record[definition.key] === identifier);
  if (!existing) throw new Error("The selected record no longer exists.");

  const recordsWithoutCurrent = workspace[kind].filter((record) => record[definition.key] !== identifier);
  const [updatedRecord] = validateRecords(kind, [{ ...existing, ...values }], {
    ...workspace,
    [kind]: recordsWithoutCurrent,
  });
  const updatedAt = new Date().toISOString();
  const next = {
    ...workspace,
    [kind]: workspace[kind].map((record) => record[definition.key] === identifier ? updatedRecord : record),
    updatedAt,
    recentActivity: [{
      id: crypto.randomUUID(),
      message: `Updated ${datasets[kind].label.toLowerCase()} record ${identifier} by ${user.username}.`,
      createdAt: updatedAt,
    }, ...workspace.recentActivity].slice(0, 100),
  };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    throw new Error(`Record was not updated. Browser storage may be full or unavailable. ${error.message}`);
  }
  return next;
}

const cents = (value) => Math.round(value * 100);
export function buildOverview(records, now = new Date()) {
  const total = (key) => records.sales.reduce((sum, sale) => sum + cents(sale[key]), 0) / 100;
  const grossSales = total("amount");
  const totalCost = total("cost");
  const pendingOrders = records.orders.filter((order) => !["Completed", "Cancelled"].includes(order.status));
  const lowStock = records.products.filter((product) => product.qty_available <= product.low_stock_threshold);
  const reservations = records.reservations.filter((item) => ["Awaiting Approval", "Approved"].includes(item.status) && Date.parse(item.expires_at) > now.getTime());
  const dateKey = (value) => new Date(value).toLocaleDateString("en-CA");
  const todaysSales = records.sales.filter((sale) => dateKey(sale.sold_at) === dateKey(now));
  const dailySales = new Map();
  for (const sale of records.sales) {
    const day = sale.sold_at.slice(0, 10);
    dailySales.set(day, (dailySales.get(day) || 0) + cents(sale.amount));
  }
  return {
    records, lowStock, reservations, pendingOrders,
    metrics: {
      grossSales, totalCost, profit: (cents(grossSales) - cents(totalCost)) / 100,
      todaysSales: todaysSales.reduce((sum, sale) => sum + cents(sale.amount), 0) / 100,
      ordersPlaced: records.orders.length,
      averageOrderValue: records.orders.length ? records.orders.reduce((sum, order) => sum + cents(order.total_amount), 0) / 100 / records.orders.length : null,
      fulfillmentRate: records.orders.some((order) => order.status !== "Cancelled")
        ? records.orders.filter((order) => order.status === "Completed").length / records.orders.filter((order) => order.status !== "Cancelled").length * 100 : null,
      activeReservations: reservations.length,
    },
    queues: { accessApprovals: null, ordersToFulfill: pendingOrders.length, lowStockItems: lowStock.length },
    dailySales: [...dailySales].sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([day, amount]) => [day, amount / 100]),
    recentActivity: records.recentActivity,
    updatedAt: records.updatedAt,
  };
}

export function csvTemplate(kind) {
  return `${definitionFor(kind).columns.map((column) => column.key).join(",")}\r\n`;
}
