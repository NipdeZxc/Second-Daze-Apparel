import { apiRequest } from "./client.js";

export const exportableTables = [
  "products",
  "customers",
  "orders",
  "order_items",
  "payments",
  "shipments",
  "reservations",
  "reservation_items",
  "refunds",
  "refund_items",
  "stock_movements",
  "invoices",
  "purchase_orders",
  "delivery_receipts",
  "audit_log",
  "v_order_totals",
  "v_weekly_sales",
];

export async function downloadTableExport(table) {
  if (!exportableTables.includes(table)) {
    throw new Error("Choose a supported export table.");
  }
  const csv = await apiRequest(`/api/export/${encodeURIComponent(table)}`);
  if (typeof csv !== "string") {
    throw new Error("The export API did not return CSV content.");
  }
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${table}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
