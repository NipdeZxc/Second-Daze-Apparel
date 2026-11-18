MAIN_SCREENS = [
    ("2-admin-dashboard", "dashboard", "Admin"),
    ("2.1-subaccounts", "table", "Admin"),
    ("2.2-access-approvals", "table", "Admin"),
    ("2.3-sales-documents", "table", "Admin"),
    ("2.4-refunds", "table", "Admin"),
    ("2.5-reservations", "table", "Admin"),
    ("2.6-reports", "reports", "Admin"),
    ("3-sales-catalog", "catalog", "Sales"),
    ("3.1-checkout-pending-payment", "detail", "Sales"),
    ("3.2-sale-completed", "success", "Sales"),
    ("3.3-sales-documents", "table", "Sales"),
    ("3.4-new-refund-request", "form", "Sales"),
    ("3.5-refund-condition-review", "form", "Sales"),
    ("3.6-approval-request-detail", "detail", "Sales"),
    ("3.7-refund-completed", "success", "Sales"),
    ("3.8-checkout-gcash-payment", "detail", "Sales"),
    ("3.9-orders-status-tracking", "table", "Sales"),
    ("3.10-order-detail-shipment", "detail", "Sales"),
    ("3.11-customers", "table", "Sales"),
    ("3.12-new-customer-validation", "form", "Sales"),
    ("3.13-create-purchase-order", "form", "Sales"),
    ("3.14-confirm-delivery", "form", "Sales"),
    ("3.15-payment-not-received", "detail", "Sales"),
    ("4-inventory-workspace", "table", "Inventory"),
    ("4.1-stock-movement-saved", "success", "Inventory"),
    ("4.2-low-stock-alerts", "table", "Inventory"),
    ("4.3-edit-product-admin-only", "form", "Inventory"),
    ("5-reservations", "table", "Reservations"),
    ("5.1-new-reservation", "form", "Reservations"),
    ("5.2-expired-reservation-void-notice", "success", "Reservations"),
    ("5.3-reservation-approved", "success", "Reservations"),
    ("6-sales-inventory-reports", "reports", "Reports"),
    ("6.1-sales-inventory-reports-v2", "reports", "Reports"),
    ("7-staff-accounts", "table", "Staff"),
]

ACCESS_SCREENS = {
    "sign-in-error": {
        "slug": "1.1-sign-in-error",
        "kind": "sign-in",
        "error": True,
    },
    "access-awaiting-approval": {
        "slug": "1.2-access-awaiting-approval",
        "kind": "pending",
    },
    "forgot-password": {
        "slug": "1.3-forgot-password",
        "kind": "forgot",
    },
}

MAIN_NAVIGATION = [
    {
        "label": "Placeholder",
        "screens": [screen for screen in MAIN_SCREENS if screen[2] == "Admin"],
    },
    {
        "label": "Placeholder",
        "screens": [screen for screen in MAIN_SCREENS if screen[2] == "Sales"],
    },
    {
        "label": "Placeholder",
        "screens": [
            screen for screen in MAIN_SCREENS if screen[2] in {"Inventory", "Reservations"}
        ],
    },
    {
        "label": "Placeholder",
        "screens": [screen for screen in MAIN_SCREENS if screen[2] in {"Reports", "Staff"}],
    },
]

MAIN_SCREEN_BY_SLUG = {
    slug: {"slug": slug, "kind": kind, "group": group}
    for slug, kind, group in MAIN_SCREENS
}
