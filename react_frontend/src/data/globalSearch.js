import { canAccessScreen, navigationForRole, normalizeRole } from "../roles.js";
import { screens } from "../screens.js";

const searchCollections = [
  {
    kind: "orders", category: "Order", titleKey: "order_number",
    detailKeys: ["customer_name", "status", "payment_status"],
    screens: { Admin: "3.9-orders-status-tracking", "Sales Management": "3.9-orders-status-tracking" },
  },
  {
    kind: "products", category: "Product", titleKey: "product_name", lookupKey: "product_code",
    detailKeys: ["product_code", "category", "size"],
    screens: { Admin: "4-inventory-workspace", "Sales Management": "3-sales-catalog", "Inventory Management": "4-inventory-workspace" },
  },
  {
    kind: "customers", category: "Customer", titleKey: "full_name", lookupKey: "contact_number",
    detailKeys: ["contact_number", "city_municipality"],
    screens: { Admin: "3.11-customers", "Sales Management": "3.11-customers" },
  },
  {
    kind: "sales", category: "Sale", titleKey: "sale_no",
    detailKeys: ["order_no", "amount"],
    screens: { Admin: "2.8-sales", "Sales Management": "3.9-orders-status-tracking" },
  },
  {
    kind: "reservations", category: "Reservation", titleKey: "reservation_number",
    detailKeys: ["customer_name", "status"],
    screens: { Admin: "2.5-reservations", "Sales Management": "5-reservations" },
  },
  {
    kind: "refunds", category: "Refund", titleKey: "refund_number",
    detailKeys: ["order_number", "customer_name", "status"],
    screens: { Admin: "2.4-refunds", "Sales Management": "2.4-refunds" },
  },
  {
    kind: "documents", category: "Document", titleKey: "doc_number",
    detailKeys: ["doc_type", "order_number", "issued_by"],
    screens: { Admin: "2.3-sales-documents", "Sales Management": "3.3-sales-documents" },
  },
  {
    kind: "accounts", category: "Staff account", titleKey: "full_name", lookupKey: "username",
    detailKeys: ["username", "role", "status"],
    screens: { Admin: "7-staff-accounts" },
  },
  {
    kind: "notifications", category: "Notification", titleKey: "message",
    detailKeys: ["category", "created_at"],
    screens: { Admin: "9-notifications", "Sales Management": "9-notifications", "Inventory Management": "9-notifications" },
  },
];

export function matchesGlobalSearch(record, query, keys = Object.keys(record || {})) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) return true;
  return keys.some((key) => {
    const value = record?.[key];
    return ["string", "number", "boolean"].includes(typeof value)
      && String(value).toLowerCase().includes(normalizedQuery);
  });
}

export function findGlobalSearchResults(query, records, role, limit = 8) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (normalizedQuery.length < 2) return { results: [], total: 0 };
  const normalizedRole = normalizeRole(role);
  const matches = [];
  for (const collection of searchCollections) {
    const screenId = collection.screens[normalizedRole];
    if (!screenId || !canAccessScreen(normalizedRole, screenId)) continue;
    for (const [index, record] of (records?.[collection.kind] || []).entries()) {
      if (!matchesGlobalSearch(record, normalizedQuery)) continue;
      const title = String(record[collection.titleKey] || `${collection.category} ${index + 1}`);
      const lookupKey = collection.kind === "sales" && normalizedRole === "Sales Management"
        ? "order_no" : collection.lookupKey || collection.titleKey;
      matches.push({
        id: `${collection.kind}-${record.id ?? index}`,
        category: collection.category,
        title,
        detail: collection.detailKeys.map((key) => record[key]).filter((value) => value != null && String(value).trim()).join(" / "),
        screenId,
        query: String(record[lookupKey] || title),
        titleMatch: title.toLowerCase().startsWith(normalizedQuery),
      });
    }
  }
  for (const screenId of navigationForRole(normalizedRole)) {
    const screen = screens.find((item) => item.id === screenId);
    if (!screen || !canAccessScreen(normalizedRole, screenId) || !matchesGlobalSearch(screen, normalizedQuery, ["title", "description"])) continue;
    matches.push({
      id: `page-${screenId}`, category: "Page", title: screen.title, detail: screen.description,
      screenId, query: "", titleMatch: screen.title.toLowerCase().startsWith(normalizedQuery),
    });
  }
  matches.sort((left, right) => Number(left.category === "Page") - Number(right.category === "Page")
    || Number(right.titleMatch) - Number(left.titleMatch));
  return { results: matches.slice(0, limit), total: matches.length };
}

export function globalSearchHref(result) {
  return `#/${result.screenId}${result.query ? `?search=${encodeURIComponent(result.query)}` : ""}`;
}

export function searchFromHash(hash) {
  const queryStart = hash.indexOf("?");
  return queryStart < 0 ? "" : new URLSearchParams(hash.slice(queryStart + 1)).get("search") || "";
}
