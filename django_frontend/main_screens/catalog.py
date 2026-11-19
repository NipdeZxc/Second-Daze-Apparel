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

SCREEN_COPY = {
    "2-admin-dashboard": ("Dashboard", "Workspace overview for sales, inventory, and approvals."),
    "2.1-subaccounts": ("Subaccounts", "Create staff accounts and assign workspace access."),
    "2.2-access-approvals": ("Access approvals", "Review staff requests before granting workspace access."),
    "2.3-sales-documents": ("Sales documents", "Create and track invoices, delivery receipts, purchase orders, and quotations."),
    "2.4-refunds": ("Refunds management", "Review return requests, inspect item condition, and record refund decisions."),
    "2.5-reservations": ("Reservations", "Review pickup requests, agreed terms, and reservation expiry."),
    "2.6-reports": ("Reports & Analytics", "Review performance using recorded sales and inventory data."),
    "3-sales-catalog": ("Find their next favorite.", "Browse the catalog, build an order, then continue to checkout."),
    "3.1-checkout-pending-payment": ("Checkout", "Finalize payment and issue the receipt."),
    "3.2-sale-completed": ("Sale completed", "Payment verification and order recording are complete."),
    "3.3-sales-documents": ("Sales documents", "Create and track invoices, delivery receipts, and purchase orders linked to each sale."),
    "3.4-new-refund-request": ("New refund request", "Find the original order, record the returned item, and submit the request for Admin review."),
    "3.5-refund-condition-review": ("Refund condition review", "Inspect the returned item and record its inventory disposition."),
    "3.6-approval-request-detail": ("Refund approval", "Review the requested amount and refund details before deciding."),
    "3.7-refund-completed": ("Refund completed", "The refund decision and customer result have been recorded."),
    "3.8-checkout-gcash-payment": ("Checkout", "Record the customer's GCash payment for Admin verification."),
    "3.9-orders-status-tracking": ("Orders", "Track every order from reservation to completion."),
    "3.10-order-detail-shipment": ("Order details", "Review fulfillment progress, shipment details, and linked documents."),
    "3.11-customers": ("Customers", "Buyer details used for orders and delivery. Check them before shipping."),
    "3.12-new-customer-validation": ("New customer", "Complete customer details to help prevent returned parcels."),
    "3.13-create-purchase-order": ("New purchase order", "Record what the customer ordered. Admin approval is required before issue."),
    "3.14-confirm-delivery": ("Confirm delivery", "Issue the Delivery Receipt once the customer has received the parcel."),
    "3.15-payment-not-received": ("Payment not verified", "The recorded GCash payment could not be matched."),
    "4-inventory-workspace": ("Inventory Management", "Track products, monitor stock levels, and act on low-stock items before they impact sales."),
    "4.1-stock-movement-saved": ("Stock movement saved", "The inventory movement has been recorded."),
    "4.2-low-stock-alerts": ("Low stock", "Items at or below their threshold. Restock them before they sell out."),
    "4.3-edit-product-admin-only": ("Edit product", "Product details and pricing can be changed by Admin only."),
    "5-reservations": ("Reservation Management", "Monitor holds, approvals, payments, and expiry windows."),
    "5.1-new-reservation": ("New reservation", "Prepare a customer hold request. Admin approval is required before confirmation."),
    "5.2-expired-reservation-void-notice": ("Reservation automatically voided", "The unpaid reservation deadline passed and its held stock was released."),
    "5.3-reservation-approved": ("Reservation approved", "The requested items are on hold until the reservation deadline."),
    "6-sales-inventory-reports": ("Sales and inventory reports", "Review recorded sales, costs, stock levels, and fulfillment activity."),
    "6.1-sales-inventory-reports-v2": ("Sales & Inventory Summary", "Review sales performance and inventory distribution for a selected period."),
    "7-staff-accounts": ("Staff accounts", "Create subaccounts, assign responsibilities, and control access."),
}

SCREEN_COLUMNS = {
    "2.1-subaccounts": ("Staff member", "Login", "Role", "Access status", "Action"),
    "2.2-access-approvals": ("Staff member", "Requested role", "Submitted", "Status", "Action"),
    "2.3-sales-documents": ("Document ID", "Type", "Creator", "Client / vendor", "Date", "Amount", "Status", "Action"),
    "2.4-refunds": ("Refund ticket", "Order reference", "Customer", "Reason", "Evidence", "Amount", "Status", "Action"),
    "2.5-reservations": ("Reservation ID", "Customer", "Pickup date", "Items", "Status", "Action"),
    "3.3-sales-documents": ("Document ID", "Type", "Related sale", "Date", "Approval status", "Action"),
    "3.9-orders-status-tracking": ("Order", "Customer", "Items", "Amount", "Payment", "Status", "Action"),
    "3.11-customers": ("Customer", "Contact number", "City", "Details", "Orders", "Action"),
    "4-inventory-workspace": ("Product", "Category", "Size", "Cost / sell", "Stock", "Status", "Action"),
    "4.2-low-stock-alerts": ("Item", "Available", "Reserved", "Defective", "Threshold", "Status", "Action"),
    "5-reservations": ("Reservation", "Customer", "Expiry", "Days left", "Status", "Amount", "Payment", "Actions"),
    "7-staff-accounts": ("Staff member", "Login", "Role", "Access status", "Action"),
}

SCREEN_FIELDS = {
    "3.4-new-refund-request": ("Order number", "Returned item", "Return quantity", "Item condition", "Issue / reason", "Inspection note"),
    "3.5-refund-condition-review": ("Refund ticket", "Item condition", "Inspection result", "Inventory disposition", "Review note"),
    "3.6-approval-request-detail": ("Refund ticket", "Order reference", "Requested amount", "Decision", "Admin note"),
    "3.12-new-customer-validation": ("Full name", "Social media handle", "Contact number", "Address", "City", "Province", "Postal code"),
    "3.13-create-purchase-order": ("Customer", "Order", "Product", "Quantity", "Note for the Admin"),
    "3.14-confirm-delivery": ("Delivery status", "Date and time delivered", "Received by"),
    "4.3-edit-product-admin-only": ("Product name", "Category", "Size", "Cost price", "Selling price", "Low-stock threshold", "Status"),
    "5.1-new-reservation": ("Customer", "Product", "Quantity", "Agreed days", "Pickup note"),
}

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
        "label": "Overview",
        "screens": [("2-admin-dashboard", "dashboard", "Admin")],
    },
    {
        "label": "Administration",
        "screens": [
            ("2.1-subaccounts", "table", "Admin"),
            ("2.2-access-approvals", "table", "Admin"),
        ],
    },
    {
        "label": "Sales",
        "screens": [
            ("3-sales-catalog", "catalog", "Sales"),
            ("3.3-sales-documents", "table", "Sales"),
            ("2.4-refunds", "table", "Admin"),
            ("3.9-orders-status-tracking", "table", "Sales"),
            ("3.11-customers", "table", "Sales"),
        ],
    },
    {
        "label": "Inventory",
        "screens": [
            ("4-inventory-workspace", "table", "Inventory"),
            ("4.2-low-stock-alerts", "table", "Inventory"),
        ],
    },
    {
        "label": "Reservations",
        "screens": [("5-reservations", "table", "Reservations")],
    },
    {
        "label": "Reports & staff",
        "screens": [
            ("2.6-reports", "reports", "Admin"),
            ("7-staff-accounts", "table", "Staff"),
        ],
    },
]

MAIN_SCREEN_BY_SLUG = {
    slug: {
        "slug": slug,
        "kind": kind,
        "group": group,
        "title": SCREEN_COPY[slug][0],
        "description": SCREEN_COPY[slug][1],
        "label": SCREEN_COPY[slug][0],
    }
    for slug, kind, group in MAIN_SCREENS
}
