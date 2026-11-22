// Client-side routing only. The API repeats every role check before reading or
// writing business data; these helpers keep each role's screens consistent.
export const ROLES = ["Admin", "Sales Management", "Inventory Management"];

const PUBLIC_SCREENS = new Set([
  "1-staff-sign-in",
  "1.1-sign-in-error",
  "1.2-access-awaiting-approval",
  "1.3-forgot-password",
  "1.4-reset-password",
]);

const COMMON_SCREENS = new Set(["1.5-change-password", "2.10-notifications"]);

const ADMIN_DESKTOP = [
  "2-admin-dashboard",
  "2.10-notifications",
  "2.7-csv-import",
  "2.9-data-export",
  "2.8-sales",
  "2.1-subaccounts",
  "2.2-access-approvals",
  "2.3-sales-documents",
  "2.4-refunds",
  "2.5-reservations",
  "2.6-reports",
  "3-sales-catalog",
  "3.9-orders-status-tracking",
  "3.11-customers",
  "4.0-inventory-dashboard",
  "4-inventory-workspace",
  "4.2-low-stock-alerts",
  "6-sales-inventory-reports",
  "6.1-sales-inventory-reports-v2",
  "7-staff-accounts",
];

const SALES_DESKTOP = [
  "2s-staff-dashboard",
  "2.10-notifications",
  "3-sales-catalog",
  "3.1-checkout-pending-payment",
  "3.2-sale-completed",
  "3.3-sales-documents",
  "3.4-new-refund-request",
  "3.5-refund-condition-review",
  "3.6-approval-request-detail",
  "3.7-refund-completed",
  "3.8-checkout-gcash-payment",
  "3.9-orders-status-tracking",
  "3.10-order-detail-shipment",
  "3.11-customers",
  "3.12-new-customer-validation",
  "3.13-create-purchase-order",
  "3.14-confirm-delivery",
  "3.15-payment-not-received",
  "5-reservations",
  "5.1-new-reservation",
  "5.2-expired-reservation-void-notice",
  "5.3-reservation-approved",
];

const INVENTORY_DESKTOP = [
  "4.0-inventory-dashboard",
  "4-inventory-workspace",
  "4.1-stock-movement-saved",
  "4.2-low-stock-alerts",
  "2.10-notifications",
];

const MOBILE_SCREENS = {
  Admin: ["8.1-mobile-admin-dashboard", "8.2-mobile-approvals", "8.3-mobile-checkout-gcash", "8.4-mobile-orders", "8.5-mobile-low-stock", "8.6-mobile-new-reservation"],
  "Sales Management": ["8.4-mobile-orders", "8.6-mobile-new-reservation", "8.3-mobile-checkout-gcash"],
  "Inventory Management": ["8.5-mobile-low-stock", "8.1-mobile-admin-dashboard"],
};

const MOBILE_OVERLAYS = {
  Admin: ["9-overlay-notifications-admin", "9.3-overlay-confirm-approve"],
  "Sales Management": ["9.1-overlay-notifications-sales"],
  "Inventory Management": ["9.2-overlay-notifications-inventory"],
};

export function normalizeRole(role) {
  if (role === "Staff" || role === "Sales") return "Sales Management";
  if (role === "Inventory") return "Inventory Management";
  return ROLES.includes(role) ? role : "Sales Management";
}

export function homeScreenForRole(role, mobile = false) {
  const normalized = normalizeRole(role);
  if (mobile) {
    if (normalized === "Inventory Management") return "8.5-mobile-low-stock";
    if (normalized === "Sales Management") return "8.4-mobile-orders";
    return "8.1-mobile-admin-dashboard";
  }
  if (normalized === "Inventory Management") return "4.0-inventory-dashboard";
  if (normalized === "Admin") return "2-admin-dashboard";
  return "2s-staff-dashboard";
}

export function navigationForRole(role, mobile = false) {
  const normalized = normalizeRole(role);
  if (mobile) return [...MOBILE_SCREENS[normalized]];
  if (normalized === "Admin") return [...ADMIN_DESKTOP];
  if (normalized === "Inventory Management") return [...INVENTORY_DESKTOP];
  return [...SALES_DESKTOP];
}

export function canAccessScreen(role, screenId) {
  if (PUBLIC_SCREENS.has(screenId)) return true;
  const normalized = normalizeRole(role);
  if (COMMON_SCREENS.has(screenId)) return true;
  if (normalized === "Admin") return true;
  return navigationForRole(normalized).includes(screenId)
    || navigationForRole(normalized, true).includes(screenId)
    || MOBILE_OVERLAYS[normalized].includes(screenId);
}
