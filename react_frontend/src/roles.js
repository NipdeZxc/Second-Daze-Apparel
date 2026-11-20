export const roleHomeScreens = {
  Admin: "2-admin-dashboard",
  "Sales Management": "3-sales-dashboard",
  "Inventory Management": "4-inventory-dashboard",
};

const roleNavigation = {
  Admin: [
    "2-admin-dashboard",
    "2.7-csv-import",
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
    "4-inventory-workspace",
    "4.2-low-stock-alerts",
    "7-staff-accounts",
    "9-notifications",
  ],
  "Sales Management": [
    "3-sales-dashboard",
    "3-sales-catalog",
    "3.9-orders-status-tracking",
    "3.11-customers",
    "3.3-sales-documents",
    "2.4-refunds",
    "5-reservations",
    "6-sales-inventory-reports",
    "9-notifications",
  ],
  "Inventory Management": [
    "4-inventory-dashboard",
    "4-inventory-workspace",
    "4.2-low-stock-alerts",
    "6-sales-inventory-reports",
    "9-notifications",
  ],
};

const roleScreens = {
  Admin: [],
  "Sales Management": [
    "3.1-checkout-pending-payment",
    "3.2-sale-completed",
    "3.4-new-refund-request",
    "3.5-refund-condition-review",
    "3.6-approval-request-detail",
    "3.7-refund-completed",
    "3.8-checkout-gcash-payment",
    "3.10-order-detail-shipment",
    "3.12-new-customer-validation",
    "3.13-create-purchase-order",
    "3.14-confirm-delivery",
    "3.15-payment-not-received",
    "5.1-new-reservation",
    "5.2-expired-reservation-void-notice",
    "5.3-reservation-approved",
    "6.1-sales-inventory-reports-v2",
  ],
  "Inventory Management": ["4.1-stock-movement-saved"],
};

export function normalizeRole(role) {
  return role === "Staff" ? "Sales Management" : role;
}

export function homeScreenForRole(role) {
  return roleHomeScreens[normalizeRole(role)] || roleHomeScreens["Sales Management"];
}

export function navigationForRole(role) {
  return roleNavigation[normalizeRole(role)] || roleNavigation["Sales Management"];
}

export function canAccessScreen(role, screenId) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === "Admin"
    || navigationForRole(normalizedRole).includes(screenId)
    || (roleScreens[normalizedRole] || []).includes(screenId);
}
