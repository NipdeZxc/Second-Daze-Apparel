const highFidelityScreens = [
  ["1-staff-sign-in", "index.html", "auth"],
  ["1.1-sign-in-error", "1.1-sign-in-error.html", "auth-error"],
  ["1.2-access-awaiting-approval", "1.2-access-awaiting-approval.html", "auth-pending"],
  ["1.3-forgot-password", "1.3-forgot-password.html", "auth-forgot"],
  ["2-admin-dashboard", "2-admin-dashboard.html", "dashboard"],
  ["2.1-subaccounts", "2.1-subaccounts.html", "staff"],
  ["2.2-access-approvals", "2.2-access-approvals.html", "approvals"],
  ["2.3-sales-documents", "2.3-sales-documents.html", "documents"],
  ["2.4-refunds", "2.4-refunds.html", "refunds"],
  ["2.5-reservations", "2.5-reservations.html", "reservations"],
  ["2.6-reports", "2.6-reports.html", "reports"],
  ["3-sales-catalog", "3-sales-catalog.html", "catalog"],
  ["3.1-checkout-pending-payment", "3.1-checkout-pending-payment.html", "checkout"],
  ["3.2-sale-completed", "3.2-sale-completed.html", "success"],
  ["3.3-sales-documents", "3.3-sales-documents.html", "documents"],
  ["3.4-new-refund-request", "3.4-new-refund-request.html", "refund-form"],
  ["3.5-refund-condition-review", "3.5-refund-condition-review.html", "refund-review"],
  ["3.6-approval-request-detail", "3.6-approval-request-detail.html", "approval-detail"],
  ["3.7-refund-completed", "3.7-refund-completed.html", "refund-success"],
  ["3.8-checkout-gcash-payment", "3.8-checkout-gcash-payment.html", "checkout"],
  ["3.9-orders-status-tracking", "3.9-orders-status-tracking.html", "orders"],
  ["3.10-order-detail-shipment", "3.10-order-detail-shipment.html", "order-detail"],
  ["3.11-customers", "3.11-customers.html", "customers"],
  ["3.12-new-customer-validation", "3.12-new-customer-validation.html", "customer-form"],
  ["3.13-create-purchase-order", "3.13-create-purchase-order.html", "purchase-order"],
  ["3.14-confirm-delivery", "3.14-confirm-delivery.html", "delivery"],
  ["3.15-payment-not-received", "3.15-payment-not-received.html", "payment-error"],
  ["4-inventory-workspace", "4-inventory-workspace.html", "inventory"],
  ["4.1-stock-movement-saved", "4.1-stock-movement-saved.html", "stock-success"],
  ["4.2-low-stock-alerts", "4.2-low-stock-alerts.html", "low-stock"],
  ["4.3-edit-product-admin-only", "4.3-edit-product-admin-only.html", "product-edit"],
  ["5-reservations", "5-reservations.html", "reservations"],
  ["5.1-new-reservation", "5.1-new-reservation.html", "reservation-form"],
  ["5.2-expired-reservation-void-notice", "5.2-expired-reservation-void-notice.html", "reservation-expired"],
  ["5.3-reservation-approved", "5.3-reservation-approved.html", "reservation-approved"],
  ["6-sales-inventory-reports", "6-sales-inventory-reports.html", "reports"],
  ["6.1-sales-inventory-reports-v2", "6.1-sales-inventory-reports-v2.html", "reports"],
  ["7-staff-accounts", "7-staff-accounts.html", "staff"],
  ["8-mobile-sign-in", "8-mobile-sign-in.html", "mobile-auth"],
  ["8.1-mobile-admin-dashboard", "8.1-mobile-admin-dashboard.html", "mobile-dashboard"],
  ["8.2-mobile-approvals", "8.2-mobile-approvals.html", "mobile-approvals"],
  ["8.3-mobile-checkout-gcash", "8.3-mobile-checkout-gcash.html", "mobile-checkout"],
  ["8.4-mobile-orders", "8.4-mobile-orders.html", "mobile-orders"],
  ["8.5-mobile-low-stock", "8.5-mobile-low-stock.html", "mobile-stock"],
  ["8.6-mobile-new-reservation", "8.6-mobile-new-reservation.html", "mobile-reservation"],
  ["9-overlay-notifications-admin", "9-overlay-notifications-admin.html", "notifications"],
  ["9.1-overlay-notifications-sales", "9.1-overlay-notifications-sales.html", "notifications"],
  ["9.2-overlay-notifications-inventory", "9.2-overlay-notifications-inventory.html", "notifications"],
  ["9.3-overlay-confirm-approve", "9.3-overlay-confirm-approve.html", "confirm"],
].map(([id, file, type]) => ({ id, file, type }));

const screenCopy = {
  "1-staff-sign-in": ["Sign in", "Sign in with the account provided by your Admin."],
  "1.1-sign-in-error": ["Sign-in unsuccessful", "Email or password was not recognized. Check your details and try again."],
  "1.2-access-awaiting-approval": ["Access awaiting approval", "An Admin must approve your subaccount before you can enter the workspace."],
  "1.3-forgot-password": ["Forgot password?", "Enter your staff email to receive password-reset instructions."],
  "2-admin-dashboard": ["Dashboard", "Workspace overview for sales, inventory, and approvals."],
  "2.1-subaccounts": ["Subaccounts", "Create staff accounts and assign workspace access."],
  "2.2-access-approvals": ["Access approvals", "Review staff requests before granting workspace access."],
  "2.3-sales-documents": ["Sales Documents", "Central hub for purchase orders, invoices, delivery receipts, and quotations."],
  "2.4-refunds": ["Refunds Management", "Review return requests and record inspection outcomes."],
  "2.5-reservations": ["Reservations", "Manage pickup requests, approvals, and fulfillment."],
  "2.6-reports": ["Reports & Analytics", "Review sales and inventory reports from recorded data."],
  "3-sales-catalog": ["Sales catalog", "Browse available products and build an order."],
  "3.1-checkout-pending-payment": ["Checkout", "Finalize payment and issue the receipt."],
  "3.2-sale-completed": ["Sale completed", "Payment verification and order recording are complete."],
  "3.3-sales-documents": ["Sales documents", "Create and track documents linked to each sale."],
  "3.4-new-refund-request": ["New refund request", "Record the returned item and submit the request for review."],
  "3.5-refund-condition-review": ["Refund condition review", "Inspect the returned item and record its inventory disposition."],
  "3.6-approval-request-detail": ["Refund approval", "Review refund details before recording a decision."],
  "3.7-refund-completed": ["Refund completed", "The refund decision has been recorded."],
  "3.8-checkout-gcash-payment": ["Checkout", "Record the customer's GCash payment for Admin verification."],
  "3.9-orders-status-tracking": ["Orders", "Track orders from reservation through completion."],
  "3.10-order-detail-shipment": ["Order details", "Review fulfillment progress, shipment details, and linked documents."],
  "3.11-customers": ["Customers", "Review customer details used for orders and delivery."],
  "3.12-new-customer-validation": ["New customer", "Complete customer details for order fulfillment."],
  "3.13-create-purchase-order": ["New purchase order", "Record the requested items for Admin approval."],
  "3.14-confirm-delivery": ["Confirm delivery", "Record delivery details after the customer receives the parcel."],
  "3.15-payment-not-received": ["Payment not verified", "The Admin could not match this GCash payment."],
  "4-inventory-workspace": ["Inventory Management", "Track products, monitor stock levels, and manage stock movements."],
  "4.1-stock-movement-saved": ["Stock movement saved", "The inventory movement has been recorded."],
  "4.2-low-stock-alerts": ["Low stock", "Items at or below their restock threshold."],
  "4.3-edit-product-admin-only": ["Edit product", "Product information can be edited by Admin only."],
  "5-reservations": ["Reservation Management", "Monitor holds, approvals, payments, and expiry windows."],
  "5.1-new-reservation": ["New reservation", "Prepare a customer hold request for Admin approval."],
  "5.2-expired-reservation-void-notice": ["Reservation automatically voided", "The unpaid reservation expired and its held stock was released."],
  "5.3-reservation-approved": ["Reservation approved", "The requested items are on hold until the reservation deadline."],
  "6-sales-inventory-reports": ["Sales and inventory reports", "Review recorded sales and inventory activity."],
  "6.1-sales-inventory-reports-v2": ["Sales & Inventory Summary", "Review sales performance and inventory distribution."],
  "7-staff-accounts": ["Staff accounts", "Create subaccounts, assign responsibilities, and control access."],
  "8-mobile-sign-in": ["Sign in", "Apparel access portal"],
  "8.1-mobile-admin-dashboard": ["Dashboard", "Admin workspace"],
  "8.2-mobile-approvals": ["Approvals", "Review access, payment, refund, and reservation requests."],
  "8.3-mobile-checkout-gcash": ["Checkout", "Record GCash payment for Admin verification."],
  "8.4-mobile-orders": ["Orders", "Track customer orders and fulfillment status."],
  "8.5-mobile-low-stock": ["Low stock", "Items at or below their restock threshold."],
  "8.6-mobile-new-reservation": ["New reservation", "Prepare a hold request for Admin approval."],
  "9-overlay-notifications-admin": ["Notifications", "Admin notification center."],
  "9.1-overlay-notifications-sales": ["Notifications", "Sales Management notification center."],
  "9.2-overlay-notifications-inventory": ["Notifications", "Inventory Management notification center."],
  "9.3-overlay-confirm-approve": ["Confirm this approval?", "This decision is saved with your name and the time."],
};

const screenColumns = {
  staff: ["Staff member", "Login", "Role", "Access status", "Action"],
  approvals: ["Staff member", "Requested role", "Submitted", "Status", "Action"],
  documents: ["Document ID", "Type", "Related sale", "Date", "Status", "Action"],
  refunds: ["Refund ticket", "Order reference", "Customer", "Reason", "Amount", "Status", "Action"],
  reservations: ["Reservation", "Customer", "Pickup date", "Items", "Status", "Action"],
  orders: ["Order", "Customer", "Items", "Amount", "Payment", "Status", "Action"],
  customers: ["Customer", "Contact number", "City", "Details", "Orders", "Action"],
  inventory: ["Product", "Category", "Size", "Cost / sell", "Stock", "Status", "Action"],
  "low-stock": ["Item", "Available", "Reserved", "Defective", "Threshold", "Status", "Action"],
};

const screenFields = {
  "3.4-new-refund-request": ["Order number", "Returned item", "Return quantity", "Item condition", "Issue / reason", "Inspection note"],
  "3.5-refund-condition-review": ["Refund ticket", "Item condition", "Inspection result", "Inventory disposition", "Review note"],
  "3.6-approval-request-detail": ["Refund ticket", "Order reference", "Requested amount", "Decision", "Admin note"],
  "3.12-new-customer-validation": ["Full name", "Social media handle", "Contact number", "Address", "City", "Province", "Postal code"],
  "3.13-create-purchase-order": ["Customer", "Product", "Quantity", "Note for the Admin"],
  "3.14-confirm-delivery": ["Delivery status", "Date and time delivered", "Received by"],
  "4.3-edit-product-admin-only": ["Product name", "Category", "Size", "Cost price", "Selling price", "Low-stock threshold", "Status"],
  "5.1-new-reservation": ["Customer", "Product", "Quantity", "Agreed days", "Pickup note"],
};

const highFidelityScreen = highFidelityScreens.find(
  ({ id }) => id === document.body.dataset.screen,
);

if (highFidelityScreen) initializeHighFidelityScreen(highFidelityScreen);

function initializeHighFidelityScreen(screen) {
  document.body.classList.add("hf-page", `hf-${screen.type}`);
  document.title = `${screenCopy[screen.id][0]} | Second Daze Apparel`;
  const root = document.querySelector("#high-fidelity-screen");

  if (screen.type.startsWith("auth")) {
    root.innerHTML = renderAuth(screen);
  } else if (screen.type.startsWith("mobile-")) {
    root.innerHTML = renderMobile(screen);
  } else if (screen.type === "notifications" || screen.type === "confirm") {
    root.innerHTML = renderOverlay(screen);
  } else {
    root.innerHTML = renderDesktop(screen);
  }

  root.addEventListener("submit", (event) => {
    if (!event.target.matches("form")) return;
    event.preventDefault();
    const feedback = event.target.querySelector(".hf-feedback");
    if (screen.type === "auth" || screen.type === "auth-error") {
      window.location.href = "1.2-access-awaiting-approval.html";
    } else if (feedback) {
      feedback.hidden = false;
    }
  });

  root.addEventListener("click", (event) => {
    const dismiss = event.target.closest("[data-dismiss]");
    if (dismiss) window.location.href = screen.type === "confirm" ? "8.2-mobile-approvals.html" : "8.1-mobile-admin-dashboard.html";
  });
}

function pageHeading(screen, actions = "") {
  const [title, description] = screenCopy[screen.id];
  return `<div class="hf-page-heading"><div><p class="hf-overline">Second Daze Apparel</p><h1>${title}</h1><p>${description}</p></div>${actions ? `<div class="hf-heading-actions">${actions}</div>` : ""}</div>`;
}

function emptyState(message = "Records will appear here when data is connected.") {
  return `<div class="hf-empty-state" role="status"><strong>No records to display</strong><p>${message}</p></div>`;
}

function renderDesktop(screen) {
  const type = screen.type;
  const content = type === "dashboard" ? renderDashboard(screen)
    : type === "catalog" ? renderCatalog(screen)
      : type === "reports" ? renderReports(screen)
        : ["staff", "approvals", "documents", "refunds", "reservations", "orders", "customers", "inventory", "low-stock"].includes(type)
          ? renderList(screen)
          : type.includes("form") || ["purchase-order", "delivery", "product-edit", "reservation-form"].includes(type)
            ? renderForm(screen)
            : type === "checkout" ? renderCheckout(screen)
              : renderDetail(screen);

  return `<div class="hf-desktop">
    <header class="hf-topbar"><a class="hf-brand" href="index.html"><img class="hf-logo-image" src="../download.jpg" alt="Second Daze Apparel" /><span><strong>Second Daze</strong><small>Apparel workspace</small></span></a>
      <div class="hf-topbar-actions"><a class="hf-notice-link" href="9-overlay-notifications-admin.html" aria-label="Notifications">♧</a><span class="hf-avatar">SD</span><span class="hf-user-copy"><strong>Staff workspace</strong><small>Signed-in account</small></span></div>
    </header>
    <div class="hf-desktop-body"><aside class="hf-sidebar"><p class="hf-sidebar-label">Workspace</p><nav aria-label="Main navigation">${renderNavigation(screen)}</nav>
      <div class="hf-sidebar-bottom"><div class="hf-workspace-card"><strong>Second Daze</strong><small>Apparel workspace</small></div><a href="index.html">↪ <span>Sign out</span></a></div>
    </aside><main class="hf-content">${content}</main></div>
  </div>`;
}

function renderNavigation(current) {
  const nav = [
    ["Workspace", ["2-admin-dashboard", "2.1-subaccounts", "2.2-access-approvals", "2.6-reports"]],
    ["Sales", ["3-sales-catalog", "3.9-orders-status-tracking", "3.11-customers", "5-reservations", "2.4-refunds", "2.3-sales-documents"]],
    ["Inventory", ["4-inventory-workspace", "4.2-low-stock-alerts"]],
  ];
  return nav.map(([group, ids]) => `<div class="hf-nav-group"><span>${group}</span>${ids.map((id) => {
    const item = highFidelityScreens.find((entry) => entry.id === id);
    const active = item.type === current.type || item.id === current.id;
    return `<a class="${active ? "is-current" : ""}" href="${item.file}"><span class="hf-nav-icon">◇</span><span>${screenCopy[id][0]}</span></a>`;
  }).join("")}</div>`).join("");
}

function renderDashboard(screen) {
  const areas = [
    ["Sales activity", "Orders and sales documents"],
    ["Inventory", "Stock levels and movements"],
    ["Access approvals", "Staff requests requiring review"],
  ];
  return `${pageHeading(screen)}<div class="hf-dashboard-grid">${areas.map(([title, detail]) => `<section class="hf-card"><div class="hf-card-heading"><div><h2>${title}</h2><p>${detail}</p></div></div>${emptyState("Live workspace data will appear here once connected.")}</section>`).join("")}</div>`;
}

function renderCatalog(screen) {
  return `${pageHeading(screen)}<div class="hf-filter-row"><input aria-label="Search products" placeholder="Search products" /><select aria-label="Category"><option>All categories</option></select><select aria-label="Size"><option>All sizes</option></select></div><div class="hf-catalog-layout"><section class="hf-card">${emptyState("Available products will appear here when inventory data is connected.")}</section><aside class="hf-card hf-cart"><h2>Current order</h2>${emptyState("Add products to begin an order.")}<a class="hf-button hf-button-primary hf-full" href="3.1-checkout-pending-payment.html">Continue to checkout</a></aside></div>`;
}

function renderList(screen) {
  const columns = screenColumns[screen.type] || ["Status", "Details", "Date", "Action"];
  const message = screen.type === "low-stock" ? "Items at or below their restock threshold will appear here."
    : screen.type === "approvals" ? "Staff access requests will appear here."
      : screen.type === "refunds" ? "Refund requests will appear here."
        : "Records will appear here when data is connected.";
  return `${pageHeading(screen)}<div class="hf-filter-row"><input class="hf-search" aria-label="Search ${screenCopy[screen.id][0]}" placeholder="Search ${screenCopy[screen.id][0].toLowerCase()}" /><select aria-label="Filter by status"><option>All statuses</option></select></div><section class="hf-card hf-table-card"><div class="hf-table-wrap"><table class="hf-table"><thead><tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead><tbody><tr><td colspan="${columns.length}">${emptyState(message)}</td></tr></tbody></table></div></section>`;
}

function renderReports(screen) {
  return `${pageHeading(screen)}<div class="hf-filter-row"><select aria-label="Report type"><option>All reports</option></select><select aria-label="Date range"><option>Select date range</option></select></div><div class="hf-report-grid"><section class="hf-card"><h2>Sales summary</h2>${emptyState("Sales totals and trends will appear when transaction data is connected.")}</section><section class="hf-card"><h2>Inventory summary</h2>${emptyState("Inventory distribution will appear when stock data is connected.")}</section></div>`;
}

function renderForm(screen) {
  const fields = screenFields[screen.id] || ["Reference", "Status", "Notes"];
  return `${pageHeading(screen)}<div class="hf-split-grid"><form class="hf-card hf-form-card"><div class="hf-card-heading"><div><h2>${screenCopy[screen.id][0]}</h2><p>${screenCopy[screen.id][1]}</p></div></div><div class="hf-form-grid">${fields.map((field) => `<label class="hf-field-wide"><span>${field}</span>${/note|reason|address/i.test(field) ? `<textarea rows="3" aria-label="${field}"></textarea>` : `<input type="text" aria-label="${field}" />`}</label>`).join("")}</div><div class="hf-inline-actions"><a class="hf-button" href="2-admin-dashboard.html">Cancel</a><button class="hf-button hf-button-primary" type="submit">Save changes</button></div><p class="hf-feedback" hidden>Prototype only. Connect the backend to save this record.</p></form><aside class="hf-card hf-summary-card"><h2>Record summary</h2>${emptyState("A summary will be available after record details are entered.")}</aside></div>`;
}

function renderCheckout(screen) {
  return `${pageHeading(screen)}<div class="hf-checkout-grid"><section class="hf-card"><h2>Order summary</h2>${emptyState("Products and totals will appear after items are added to the order.")}</section><form class="hf-card hf-payment-card"><h2>Payment details</h2><label class="hf-form-label">Payment method<select aria-label="Payment method"><option>Select a payment method</option><option>Cash</option><option>GCash</option></select></label><label class="hf-form-label">Payment reference<input type="text" /></label><button class="hf-button hf-button-primary hf-full" type="submit">Record payment</button><p class="hf-feedback" hidden>Prototype only. Connect the backend to record payment.</p></form></div>`;
}

function renderDetail(screen) {
  const [title, description] = screenCopy[screen.id];
  const completed = ["success", "refund-success", "stock-success", "reservation-approved", "reservation-expired"].includes(screen.type);
  return `${pageHeading(screen)}<div class="hf-notice ${screen.type === "payment-error" ? "hf-notice-warm" : "hf-notice-info"}"><span>${completed ? "✓" : "i"}</span><p><strong>${title}</strong><br />${description}</p></div><div class="hf-split-grid"><section class="hf-card"><h2>${completed ? "Record details" : "Related records"}</h2>${emptyState("Record details will appear here when connected to the workspace data.")}</section><aside class="hf-card"><h2>${completed ? "Next steps" : "Actions"}</h2><p class="hf-muted">${completed ? "Continue working in the relevant workspace." : description}</p><a class="hf-button hf-button-primary hf-full" href="2-admin-dashboard.html">Return to dashboard</a></aside></div>`;
}

function renderAuth(screen) {
  const pending = screen.type === "auth-pending";
  const forgot = screen.type === "auth-forgot";
  const error = screen.type === "auth-error";
  if (pending) {
    return `<main class="hf-auth-layout"><div class="hf-auth-brand"><img class="hf-auth-logo" src="../download.jpg" alt="Second Daze Apparel" /><h1>Second Daze</h1><p>Apparel workspace</p></div><section class="hf-auth-card"><div class="hf-auth-symbol">◷</div><span class="hf-pill hf-pill-pink">Awaiting approval</span><h2>Access awaiting approval</h2><p>Your subaccount has been created. An Admin must approve access before you can enter the workspace.</p><div class="hf-auth-detail"><span>Account status</span><strong>Awaiting approval</strong></div><div class="hf-auth-detail"><span>Next step</span><strong>Contact your Admin</strong></div><a class="hf-button hf-button-primary hf-full" href="index.html">Back to sign in</a></section></main>`;
  }
  if (forgot) {
    return `<main class="hf-auth-layout"><div class="hf-auth-brand"><img class="hf-auth-logo" src="../download.jpg" alt="Second Daze Apparel" /><h1>Second Daze</h1><p>Apparel workspace</p></div><section class="hf-auth-card"><div class="hf-auth-symbol">✉</div><h2>Forgot password?</h2><p>Enter the email address associated with your staff account.</p><form><label class="hf-form-label">Email address<input id="reset-email" type="email" placeholder="name@seconddaze.ph" required /></label><button class="hf-button hf-button-primary hf-full" type="submit">Send reset instructions</button><p class="hf-feedback" hidden>If an account matches, password-reset instructions will be sent to that email address.</p></form><a class="hf-back-link" href="index.html">← Back to sign in</a></section></main>`;
  }
  return `<main class="hf-auth-layout"><div class="hf-auth-brand"><img class="hf-auth-logo" src="../download.jpg" alt="Second Daze Apparel" /><h1>Second Daze</h1><p>Apparel workspace</p></div><section class="hf-auth-card">${error ? `<div class="hf-notice hf-notice-error"><span>!</span><p><strong>Sign-in unsuccessful</strong><br />Email or password was not recognized. Check your details and try again.</p></div>` : ""}<h2>Sign in to your workspace</h2><p>Use your staff account to access the areas assigned to you.</p><form data-auth-form><label class="hf-form-label">Email address<input type="email" placeholder="name@seconddaze.ph" required /></label><label class="hf-form-label">Password<input type="password" placeholder="Enter your password" required /></label><div class="hf-auth-options"><label><input type="checkbox" /> Remember me</label><a href="1.3-forgot-password.html">Forgot password?</a></div><button class="hf-button hf-button-primary hf-full" type="submit">Sign in</button></form><p class="hf-auth-footnote">Need access? Ask your Admin to create a subaccount and assign your role.</p></section></main>`;
}

function renderMobile(screen) {
  const [title, description] = screenCopy[screen.id];
  if (screen.type === "mobile-auth") return `<div class="hf-mobile-app"><main class="hf-mobile-content">${renderAuth(screen)}</main></div>`;
  const content = screen.type === "mobile-dashboard" ? `<section class="hf-card"><h2>Workspace overview</h2>${emptyState("Live sales, inventory, and approval information will appear here.")}</section>`
    : screen.type === "mobile-approvals" ? `<section class="hf-card"><h2>Pending requests</h2>${emptyState("Requests requiring review will appear here.")}</section>`
      : screen.type === "mobile-orders" ? `<section class="hf-card"><h2>Order list</h2>${emptyState("Orders will appear here when connected to the workspace data.")}</section>`
        : screen.type === "mobile-stock" ? `<section class="hf-card"><h2>Stock alerts</h2>${emptyState("Items that need restocking will appear here.")}</section>`
          : screen.type === "mobile-checkout" ? renderCheckout(screen)
            : `<form class="hf-card"><h2>Reservation details</h2>${["Customer", "Product", "Quantity", "Agreed days", "Pickup note"].map((field) => `<label class="hf-form-label">${field}<input type="text" /></label>`).join("")}<button class="hf-button hf-button-primary hf-full" type="submit">Submit for approval</button><p class="hf-feedback" hidden>Prototype only. Connect the backend to submit this request.</p></form>`;
  const mobilePages = highFidelityScreens.filter((item) => item.type.startsWith("mobile-") && item.type !== "mobile-auth");
  return `<div class="hf-mobile-app"><header class="hf-mobile-header"><a href="8.1-mobile-admin-dashboard.html" aria-label="Second Daze dashboard"><img class="hf-logo-image" src="../download.jpg" alt="" /></a><strong>Second Daze</strong><a href="9-overlay-notifications-admin.html" aria-label="Notifications">♧</a></header><main class="hf-mobile-content"><h1>${title}</h1><p class="hf-mobile-subtitle">${description}</p>${content}</main><nav class="hf-mobile-nav" aria-label="Mobile navigation">${mobilePages.slice(0, 4).map((item) => `<a href="${item.file}" aria-label="${screenCopy[item.id][0]}"><span>◇</span><small>${screenCopy[item.id][0]}</small></a>`).join("")}</nav></div>`;
}

function renderOverlay(screen) {
  const confirmation = screen.type === "confirm";
  const [title, description] = screenCopy[screen.id];
  const closeFile = confirmation ? "8.2-mobile-approvals.html" : "8.1-mobile-admin-dashboard.html";
  return `<main class="hf-overlay-page"><div class="hf-scrim"></div><section class="hf-dialog" role="dialog" aria-modal="true" aria-labelledby="hf-dialog-title"><div class="hf-dialog-heading"><div><h1 id="hf-dialog-title">${title}</h1><p>${description}</p></div><a class="hf-close" href="${closeFile}" aria-label="Close">×</a></div>${confirmation ? `<div class="hf-notice hf-notice-info"><span>i</span><p>Review the request details before approving.</p></div><div class="hf-inline-actions"><a class="hf-button" href="${closeFile}">Cancel</a><a class="hf-button hf-button-primary" href="${closeFile}">Approve</a></div>` : `<div class="hf-notification-list">${emptyState("New notifications will appear here.")}</div><a class="hf-button hf-full" href="${closeFile}">Close</a>`}</section></main>`;
}
