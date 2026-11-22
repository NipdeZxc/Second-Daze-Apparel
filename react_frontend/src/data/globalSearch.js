import { canAccessScreen, normalizeRole } from "../roles.js";

const searchCollections = [
  {
    kind: "orders",
    category: "Order",
    titleKey: "order_number",
    searchKeys: ["order_number", "customer_name", "status", "payment_status", "tracking_number", "items", "total_amount"],
    detailKeys: ["customer_name", "status", "payment_status"],
    screens: { Admin: "3.9-orders-status-tracking", "Sales Management": "3.9-orders-status-tracking" },
  },
  {
    kind: "products",
    category: "Product",
    titleKey: "product_name",
    searchKeys: ["product_name", "product_code", "category", "size", "status"],
    detailKeys: ["product_code", "category", "status"],
    screens: { Admin: "4-inventory-workspace", "Sales Management": "3-sales-catalog", "Inventory Management": "4-inventory-workspace" },
  },
  {
    kind: "customers",
    category: "Customer",
    titleKey: "full_name",
    searchKeys: ["full_name", "contact_number", "city_municipality", "barangay", "province"],
    detailKeys: ["contact_number", "city_municipality"],
    screens: { Admin: "3.11-customers", "Sales Management": "3.11-customers" },
  },
  {
    kind: "sales",
    category: "Sale",
    titleKey: "sale_no",
    searchKeys: ["sale_no", "order_no", "amount"],
    detailKeys: ["order_no", "amount"],
    screens: { Admin: "2.8-sales", "Sales Management": "3.9-orders-status-tracking" },
  },
  {
    kind: "reservations",
    category: "Reservation",
    titleKey: "reservation_number",
    searchKeys: ["reservation_number", "customer_name", "status", "items"],
    detailKeys: ["customer_name", "status"],
    screens: { Admin: "2.5-reservations", "Sales Management": "5-reservations" },
  },
  {
    kind: "refunds",
    category: "Refund",
    titleKey: "refund_number",
    searchKeys: ["refund_number", "order_number", "customer_name", "reason", "status"],
    detailKeys: ["order_number", "customer_name", "status"],
    screens: { Admin: "2.4-refunds", "Sales Management": "2.4-refunds" },
  },
  {
    kind: "documents",
    category: "Document",
    titleKey: "doc_number",
    searchKeys: ["doc_number", "doc_type", "order_number", "status"],
    detailKeys: ["doc_type", "order_number", "status"],
    screens: { Admin: "2.3-sales-documents", "Sales Management": "3.3-sales-documents" },
  },
  {
    kind: "accounts",
    category: "Staff account",
    titleKey: "full_name",
    searchKeys: ["full_name", "username", "email", "role", "status"],
    detailKeys: ["username", "role", "status"],
    screens: { Admin: "7-staff-accounts" },
  },
  {
    kind: "notifications",
    category: "Notification",
    titleKey: "message",
    searchKeys: ["category", "message"],
    detailKeys: ["category", "created_at"],
    screens: { Admin: "9-notifications", "Sales Management": "9-notifications", "Inventory Management": "9-notifications" },
  },
];

export function matchesGlobalSearch(record, query, keys = Object.keys(record || {})) {
  const normalizedQuery = String(query || "").trim().toLocaleLowerCase();
  if (!normalizedQuery) return true;
  return keys.some((key) => {
    const value = record?.[key];
    return (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
      && String(value).toLocaleLowerCase().includes(normalizedQuery);
  });
}

export function findGlobalSearchResults(query, records, role, limit = 8) {
  const normalizedQuery = String(query || "").trim();
  if (normalizedQuery.length < 2) return { results: [], total: 0 };

  const normalizedRole = normalizeRole(role);
  const matches = [];
  for (const collection of searchCollections) {
    const screenId = collection.screens[normalizedRole];
    if (!screenId || !canAccessScreen(normalizedRole, screenId)) continue;
    for (const [index, record] of (records?.[collection.kind] || []).entries()) {
      if (!matchesGlobalSearch(record, normalizedQuery, collection.searchKeys)) continue;
      const title = String(record[collection.titleKey] || `${collection.category} ${index + 1}`);
      const detail = collection.detailKeys
        .map((key) => record[key])
        .filter((value) => value !== null && value !== undefined && String(value).trim())
        .map(String)
        .join(" · ");
      matches.push({
        id: `${collection.kind}-${record.id ?? index}`,
        category: collection.category,
        title,
        detail,
        screenId,
        titleMatch: title.toLocaleLowerCase().startsWith(normalizedQuery.toLocaleLowerCase()),
      });
    }
  }

  matches.sort((left, right) => Number(right.titleMatch) - Number(left.titleMatch));
  return { results: matches.slice(0, limit), total: matches.length };
}
