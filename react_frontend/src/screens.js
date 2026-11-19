const main = [
  ["1-staff-sign-in", "Staff sign-in", "Sign in with the account provided by your Admin.", "auth"],
  ["1.1-sign-in-error", "Sign-in error", "Email or password was not recognized. Check your details and try again.", "auth-error"],
  ["1.2-access-awaiting-approval", "Access awaiting approval", "An Admin must approve your subaccount before you can enter the workspace.", "pending"],
  ["1.3-forgot-password", "Forgot password", "Request password-reset instructions for your staff account.", "auth-forgot"],
  ["2-admin-dashboard", "Dashboard", "Workspace overview for sales, inventory, and approvals.", "dashboard"],
  ["2.1-subaccounts", "Subaccounts", "Create staff accounts and assign workspace access.", "table"],
  ["2.2-access-approvals", "Access approvals", "Review staff requests before granting workspace access.", "table"],
  ["2.3-sales-documents", "Sales documents", "Create and track invoices, delivery receipts, purchase orders, and quotations.", "table"],
  ["2.4-refunds", "Refunds management", "Review return requests, inspect item condition, and record refund decisions.", "table"],
  ["2.5-reservations", "Reservations", "Review pickup requests, agreed terms, and reservation expiry.", "table"],
  ["2.6-reports", "Reports & Analytics", "Review performance using recorded sales and inventory data.", "reports"],
  ["3-sales-catalog", "Find their next favorite.", "Browse the catalog, build an order, then continue to checkout.", "catalog"],
  ["3.1-checkout-pending-payment", "Checkout", "Finalize payment and issue the receipt.", "detail"],
  ["3.2-sale-completed", "Sale completed", "Payment verification and order recording are complete.", "success"],
  ["3.3-sales-documents", "Sales documents", "Create and track invoices, delivery receipts, and purchase orders linked to each sale.", "table"],
  ["3.4-new-refund-request", "New refund request", "Find the original order, record the returned item, and submit the request for Admin review.", "form"],
  ["3.5-refund-condition-review", "Refund condition review", "Inspect the returned item and record its inventory disposition.", "form"],
  ["3.6-approval-request-detail", "Refund approval", "Review the requested amount and refund details before deciding.", "detail"],
  ["3.7-refund-completed", "Refund completed", "The refund decision and customer result have been recorded.", "success"],
  ["3.8-checkout-gcash-payment", "GCash checkout", "Record the customer's GCash payment for Admin verification.", "detail"],
  ["3.9-orders-status-tracking", "Orders", "Track every order from reservation to completion.", "table"],
  ["3.10-order-detail-shipment", "Order details", "Review fulfillment progress, shipment details, and linked documents.", "detail"],
  ["3.11-customers", "Customers", "Buyer details used for orders and delivery. Check them before shipping.", "table"],
  ["3.12-new-customer-validation", "New customer", "Complete customer details to help prevent returned parcels.", "form"],
  ["3.13-create-purchase-order", "New purchase order", "Record what the customer ordered. Admin approval is required before issue.", "form"],
  ["3.14-confirm-delivery", "Confirm delivery", "Issue the Delivery Receipt once the customer has received the parcel.", "form"],
  ["3.15-payment-not-received", "Payment not verified", "The recorded GCash payment could not be matched.", "detail"],
  ["4-inventory-workspace", "Inventory Management", "Track products, monitor stock levels, and act on low-stock items before they impact sales.", "table"],
  ["4.1-stock-movement-saved", "Stock movement saved", "The inventory movement has been recorded.", "success"],
  ["4.2-low-stock-alerts", "Low stock", "Items at or below their threshold. Restock them before they sell out.", "table"],
  ["4.3-edit-product-admin-only", "Edit product", "Product details and pricing can be changed by Admin only.", "form"],
  ["5-reservations", "Reservation Management", "Monitor holds, approvals, payments, and expiry windows.", "table"],
  ["5.1-new-reservation", "New reservation", "Prepare a customer hold request. Admin approval is required before confirmation.", "form"],
  ["5.2-expired-reservation-void-notice", "Reservation automatically voided", "The unpaid reservation deadline passed and its held stock was released.", "success"],
  ["5.3-reservation-approved", "Reservation approved", "The requested items are on hold until the reservation deadline.", "success"],
  ["6-sales-inventory-reports", "Sales and inventory reports", "Review recorded sales, costs, stock levels, and fulfillment activity.", "reports"],
  ["6.1-sales-inventory-reports-v2", "Sales & Inventory Summary", "Review sales performance and inventory distribution for a selected period.", "reports"],
  ["7-staff-accounts", "Staff accounts", "Create subaccounts, assign responsibilities, and control access.", "table"],
].map(([id, title, description, kind]) => ({ id, title, description, kind, group: "Main system" }));

const mobile = [
  ["8-mobile-sign-in", "Sign in", "Apparel access portal.", "mobile-auth"],
  ["8.1-mobile-admin-dashboard", "Dashboard", "Admin workspace.", "mobile-dashboard"],
  ["8.2-mobile-approvals", "Approvals", "Review access, payment, refund, and reservation requests.", "mobile-list"],
  ["8.3-mobile-checkout-gcash", "Checkout", "Record GCash payment for Admin verification.", "mobile-form"],
  ["8.4-mobile-orders", "Orders", "Track customer orders and fulfillment status.", "mobile-list"],
  ["8.5-mobile-low-stock", "Low stock", "Items at or below their restock threshold.", "mobile-stock"],
  ["8.6-mobile-new-reservation", "New reservation", "Prepare a hold request for Admin approval.", "mobile-form"],
].map(([id, title, description, kind]) => ({ id, title, description, kind, group: "Mobile companion" }));

const overlays = [
  ["9-overlay-notifications-admin", "Admin notifications", "Admin notification center.", "overlay"],
  ["9.1-overlay-notifications-sales", "Sales notifications", "Sales Management notification center.", "overlay"],
  ["9.2-overlay-notifications-inventory", "Inventory notifications", "Inventory Management notification center.", "overlay"],
  ["9.3-overlay-confirm-approve", "Confirm this approval?", "Review the selected access request before confirming.", "confirm"],
].map(([id, title, description, kind]) => ({ id, title, description, kind, group: "Mobile overlays" }));

export const screens = [...main, ...mobile, ...overlays];

export const tableColumns = {
  "2.1-subaccounts": ["Staff member", "Login", "Role", "Access status", "Action"],
  "2.2-access-approvals": ["Staff member", "Requested role", "Submitted", "Status", "Action"],
  "2.3-sales-documents": ["Document ID", "Type", "Creator", "Client / vendor", "Date", "Amount", "Status", "Action"],
  "2.4-refunds": ["Refund ticket", "Order reference", "Customer", "Reason", "Evidence", "Amount", "Status", "Action"],
  "2.5-reservations": ["Reservation ID", "Customer", "Pickup date", "Items", "Status", "Action"],
  "3.3-sales-documents": ["Document ID", "Type", "Related sale", "Date", "Approval status", "Action"],
  "3.9-orders-status-tracking": ["Order", "Customer", "Items", "Amount", "Payment", "Status", "Action"],
  "3.11-customers": ["Customer", "Contact number", "City", "Details", "Orders", "Action"],
  "4-inventory-workspace": ["Product", "Category", "Size", "Cost / sell", "Stock", "Status", "Action"],
  "4.2-low-stock-alerts": ["Item", "Available", "Reserved", "Defective", "Threshold", "Status", "Action"],
  "5-reservations": ["Reservation", "Customer", "Expiry", "Days left", "Status", "Amount", "Payment", "Actions"],
  "7-staff-accounts": ["Staff member", "Login", "Role", "Access status", "Action"],
};

export const formFields = {
  "3.4-new-refund-request": ["Order number", "Returned item", "Return quantity", "Item condition", "Issue / reason", "Inspection note"],
  "3.5-refund-condition-review": ["Refund ticket", "Item condition", "Inspection result", "Inventory disposition", "Review note"],
  "3.6-approval-request-detail": ["Refund ticket", "Order reference", "Requested amount", "Decision", "Admin note"],
  "3.12-new-customer-validation": ["Full name", "Social media handle", "Contact number", "Address", "City", "Province", "Postal code"],
  "3.13-create-purchase-order": ["Customer", "Order", "Product", "Quantity", "Note for the Admin"],
  "3.14-confirm-delivery": ["Delivery status", "Date and time delivered", "Received by"],
  "4.3-edit-product-admin-only": ["Product name", "Category", "Size", "Cost price", "Selling price", "Low-stock threshold", "Status"],
  "5.1-new-reservation": ["Customer", "Product", "Quantity", "Agreed days", "Pickup note"],
  "8.6-mobile-new-reservation": ["Customer", "Product", "Quantity", "Agreed days", "Pickup note"],
};

export const groups = [
  { title: "Main system · Sections 1–7", screens: main },
  { title: "Mobile companion · Section 8", screens: mobile },
  { title: "Mobile overlays · Section 9", screens: overlays },
];
