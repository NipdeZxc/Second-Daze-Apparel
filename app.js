const prototypeScreens = [
  ["2-admin-dashboard", "2-admin-dashboard.html", "dashboard"],
  ["2.1-subaccounts", "2.1-subaccounts.html", "table"],
  ["2.2-access-approvals", "2.2-access-approvals.html", "table"],
  ["2.3-sales-documents", "2.3-sales-documents.html", "table"],
  ["2.4-refunds", "2.4-refunds.html", "table"],
  ["2.5-reservations", "2.5-reservations.html", "table"],
  ["2.6-reports", "2.6-reports.html", "reports"],
  ["3-sales-catalog", "3-sales-catalog.html", "catalog"],
  ["3.1-checkout-pending-payment", "3.1-checkout-pending-payment.html", "detail"],
  ["3.2-sale-completed", "3.2-sale-completed.html", "success"],
  ["3.3-sales-documents", "3.3-sales-documents.html", "table"],
  ["3.4-new-refund-request", "3.4-new-refund-request.html", "form"],
  ["3.5-refund-condition-review", "3.5-refund-condition-review.html", "form"],
  ["3.6-approval-request-detail", "3.6-approval-request-detail.html", "detail"],
  ["3.7-refund-completed", "3.7-refund-completed.html", "success"],
  ["3.8-checkout-gcash-payment", "3.8-checkout-gcash-payment.html", "detail"],
  ["3.9-orders-status-tracking", "3.9-orders-status-tracking.html", "table"],
  ["3.10-order-detail-shipment", "3.10-order-detail-shipment.html", "detail"],
  ["3.11-customers", "3.11-customers.html", "table"],
  ["3.12-new-customer-validation", "3.12-new-customer-validation.html", "form"],
  ["3.13-create-purchase-order", "3.13-create-purchase-order.html", "form"],
  ["3.14-confirm-delivery", "3.14-confirm-delivery.html", "form"],
  ["3.15-payment-not-received", "3.15-payment-not-received.html", "detail"],
  ["4-inventory-workspace", "4-inventory-workspace.html", "table"],
  ["4.1-stock-movement-saved", "4.1-stock-movement-saved.html", "success"],
  ["4.2-low-stock-alerts", "4.2-low-stock-alerts.html", "table"],
  ["4.3-edit-product-admin-only", "4.3-edit-product-admin-only.html", "form"],
  ["5-reservations", "5-reservations.html", "table"],
  ["5.1-new-reservation", "5.1-new-reservation.html", "form"],
  ["5.2-expired-reservation-void-notice", "5.2-expired-reservation-void-notice.html", "success"],
  ["5.3-reservation-approved", "5.3-reservation-approved.html", "success"],
  ["6-sales-inventory-reports", "6-sales-inventory-reports.html", "reports"],
  ["6.1-sales-inventory-reports-v2", "6.1-sales-inventory-reports-v2.html", "reports"],
  ["7-staff-accounts", "7-staff-accounts.html", "table"],
  ["8-mobile-sign-in", "8-mobile-sign-in.html", "mobile-login"],
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
  "2-admin-dashboard": ["Dashboard", "Workspace overview for sales, inventory, and approvals."],
  "2.1-subaccounts": ["Subaccounts", "Create staff accounts and assign workspace access."],
  "2.2-access-approvals": ["Access approvals", "Review staff requests before granting workspace access."],
  "2.3-sales-documents": ["Sales Documents", "Central hub for Purchase Orders, Invoices, Delivery Receipts, and Quotations."],
  "2.4-refunds": ["Refunds Management", "Review, inspect evidence, and settle customer disputes and return requests."],
  "2.5-reservations": ["Reservations", "Manage pickup requests, guest details, and fulfillment readiness."],
  "2.6-reports": ["Reports & Analytics", "Performance oversight for Second Daze Apparel."],
  "3-sales-catalog": ["Find their next favorite.", "Browse the rail, build an order, then continue to checkout."],
  "3.1-checkout-pending-payment": ["Checkout", "Finalize payment and issue the receipt."],
  "3.2-sale-completed": ["Sale completed", "Payment verification and order recording are complete."],
  "3.3-sales-documents": ["Sales documents", "Create and track invoices, delivery receipts, and purchase orders linked to each sale."],
  "3.4-new-refund-request": ["New refund request", "Find the original order, record the returned item, and submit the request for Admin review."],
  "3.5-refund-condition-review": ["Refund condition review", "Inspect the returned item and record its inventory disposition."],
  "3.6-approval-request-detail": ["Refund approval", "Review the requested amount and refund details before deciding."],
  "3.7-refund-completed": ["Refund completed", "The refund decision and customer result have been recorded."],
  "3.8-checkout-gcash-payment": ["Checkout", "Record the customer's GCash payment. The Admin verifies it before the sale is completed."],
  "3.9-orders-status-tracking": ["Orders", "Track every order from reservation to completion."],
  "3.10-order-detail-shipment": ["Order details", "Review fulfillment progress, shipment details, and linked documents."],
  "3.11-customers": ["Customers", "Buyer details used for orders and delivery. Check them before shipping."],
  "3.12-new-customer-validation": ["New customer", "Complete details help prevent returned parcels."],
  "3.13-create-purchase-order": ["New purchase order", "Record what the customer ordered. The Admin approves it before it is issued."],
  "3.14-confirm-delivery": ["Confirm delivery", "Issue the Delivery Receipt once the customer has received the parcel."],
  "3.15-payment-not-received": ["Payment not verified", "The Admin could not match this GCash payment."],
  "4-inventory-workspace": ["Inventory Management", "Track products, monitor stock levels, and act on low-stock items before they impact sales."],
  "4.1-stock-movement-saved": ["Stock movement saved", "The inventory movement has been recorded."],
  "4.2-low-stock-alerts": ["Low stock", "Items at or below their threshold. Restock them before they sell out."],
  "4.3-edit-product-admin-only": ["Edit product", "Product information can be edited by Admin only."],
  "5-reservations": ["Reservation Management", "Monitor holds, approvals, payments, and expiry windows."],
  "5.1-new-reservation": ["New reservation", "Prepare a customer hold request. Admin approval is required before confirmation."],
  "5.2-expired-reservation-void-notice": ["Reservation automatically voided", "The unpaid reservation deadline passed and its held stock was released."],
  "5.3-reservation-approved": ["Reservation approved", "The requested items are on hold until the reservation deadline."],
  "6-sales-inventory-reports": ["Sales and inventory reports", "Profit is calculated automatically from recorded sales and costs."],
  "6.1-sales-inventory-reports-v2": ["Sales & Inventory Summary", "Review sales performance and inventory distribution for a selected period."],
  "7-staff-accounts": ["Staff accounts", "Create subaccounts, assign responsibilities, and control access."],
  "8-mobile-sign-in": ["Sign in", "Apparel access portal"],
  "8.1-mobile-admin-dashboard": ["Dashboard", "Admin workspace"],
  "8.2-mobile-approvals": ["Approvals", "Review access, payment, refund, and reservation requests."],
  "8.3-mobile-checkout-gcash": ["Checkout", "Record GCash payment for Admin verification."],
  "8.4-mobile-orders": ["Orders", "Track customer orders and fulfillment status."],
  "8.5-mobile-low-stock": ["Low stock", "Items at or below their restock threshold."],
  "8.6-mobile-new-reservation": ["New reservation", "Prepare a hold request for Admin approval."],
  "9-overlay-notifications-admin": ["Admin notifications", "Admin · Notification center"],
  "9.1-overlay-notifications-sales": ["Sales notifications", "Sales Management · Notification center"],
  "9.2-overlay-notifications-inventory": ["Inventory notifications", "Inventory Management · Notification center"],
  "9.3-overlay-confirm-approve": ["Confirm this approval?", "This decision is saved with your name and the time."],
};

const mainColumns = {
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

const formFields = {
  "3.4-new-refund-request": ["Order number", "Returned item", "Return quantity", "Item condition", "Issue / reason", "Inspection note"],
  "3.5-refund-condition-review": ["Refund ticket", "Item condition", "Inspection result", "Inventory disposition", "Review note"],
  "3.6-approval-request-detail": ["Refund ticket", "Order reference", "Requested amount", "Decision", "Admin note"],
  "3.12-new-customer-validation": ["Full name", "Social media handle", "Contact number", "Address", "City", "Province", "Postal code"],
  "3.13-create-purchase-order": ["Customer", "Order", "Product", "Quantity", "Note for the Admin"],
  "3.14-confirm-delivery": ["Delivery status", "Date and time delivered", "Received by"],
  "4.3-edit-product-admin-only": ["Product name", "Category", "Size", "Cost price", "Selling price", "Low-stock threshold", "Status"],
  "5.1-new-reservation": ["Customer", "Product", "Quantity", "Agreed days", "Pickup note"],
};

const prototypeId = document.body.dataset.screen?.replace(/^prototype-/, "");
const prototypeScreen = prototypeScreens.find(({ id }) => id === prototypeId);

if (document.body.dataset.screen === "screen-hub") initializeScreenHub();
else if (prototypeScreen) initializePrototype(prototypeScreen);
else initializeAccessScreens();

function getScreenCopy(screen) {
  const [title, description] = screenCopy[screen.id] || ["Workspace", "Review and manage workspace information."];
  return { title, description };
}

function initializeScreenHub() {
  document.title = "Second Daze | Screen directory";
  const groups = [
    {
      title: "Account access",
      folder: "section-1-7",
      screens: [
        { id: "1-staff-sign-in", file: "1-staff-sign-in.html", title: "Staff sign-in" },
        { id: "1.1-sign-in-error", file: "1.1-sign-in-error.html", title: "Sign-in error" },
        { id: "1.2-access-awaiting-approval", file: "1.2-access-awaiting-approval.html", title: "Access awaiting approval" },
        { id: "1.3-forgot-password", file: "1.3-forgot-password.html", title: "Forgot password" },
      ],
    },
    { title: "Main system · Sections 1–7", folder: "section-1-7", screens: prototypeScreens.filter((item) => !item.type.startsWith("mobile-") && item.type !== "notifications" && item.type !== "confirm") },
    { title: "Mobile companion · Section 8", folder: "mobile-companion/section-8-mobile", screens: prototypeScreens.filter((item) => item.type.startsWith("mobile-")) },
    { title: "Mobile companion · Section 9 overlays", folder: "mobile-companion/section-9-overlays", screens: prototypeScreens.filter((item) => item.type === "notifications" || item.type === "confirm") },
  ];
  document.querySelector("#screen-hub").innerHTML = `
    <header class="hub-header"><a class="brand" href="index.html"><img class="brand-logo" src="download.jpg" alt="Second Daze Apparel" /><span class="brand-copy"><strong>Second Daze</strong><span>Apparel operations prototype</span></span></a></header>
    <main class="hub-main"><p class="eyebrow">Screen directory</p><h1>Choose a screen</h1><p class="hub-intro">Sections 1–7 are the main system. Sections 8–9 are the mobile companion and its overlays.</p>
      <div class="hub-groups">${groups.map((group) => `<section class="hub-group"><div class="hub-group-heading"><h2>${group.title}</h2><span>${group.screens.length} screens</span></div><nav>${group.screens.map((screen) => `<a href="screens/${group.folder}/${screen.file}"><span>${screen.id.split("-")[0]}</span><span>${screen.title || getScreenCopy(screen).title}</span><span aria-hidden="true">→</span></a>`).join("")}</nav></section>`).join("")}</div>
    </main>`;
}

function initializeAccessScreens() {
  const screen = document.body.dataset.screen;
  const titles = {
    "sign-in": "Staff sign-in",
    "sign-in-error": "Sign-in error",
    "access-awaiting-approval": "Access awaiting approval",
    "forgot-password": "Forgot password",
  };
  document.title = `${titles[screen] || "Staff sign-in"} | Second Daze`;
  document.querySelector("#site-header").innerHTML = `<header class="topbar"><a class="brand" href="1-staff-sign-in.html" aria-label="Second Daze"><img class="brand-logo" src="../../download.jpg" alt="" /><span class="brand-copy"><strong>Second Daze</strong><span>Apparel access portal</span></span></a><a class="topbar-label" href="../../index.html">Screen directory</a></header>`;
  document.querySelector("#site-footer").innerHTML = `<footer class="page-footer"><span>Second Daze</span><span>Apparel access portal</span><a class="text-button" href="../../index.html">Screen directory</a></footer>`;
  const passwordInput = document.querySelector("#password");
  const togglePassword = document.querySelector("#toggle-password");
  if (passwordInput && togglePassword) {
    togglePassword.addEventListener("click", () => {
      const showPassword = passwordInput.type === "password";
      passwordInput.type = showPassword ? "text" : "password";
      togglePassword.textContent = showPassword ? "Hide" : "Show";
      togglePassword.setAttribute("aria-label", showPassword ? "Hide password" : "Show password");
      togglePassword.setAttribute("aria-pressed", String(showPassword));
    });
  }
  const loginForm = document.querySelector("#login-form");
  if (loginForm) {
    const usernameInput = document.querySelector("#username");
    const errorScreen = screen === "sign-in-error";
    const previousUsername = sessionStorage.getItem("staff-username");
    if (previousUsername) usernameInput.value = previousUsername;
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      sessionStorage.setItem("staff-username", username);
      if (username.toLowerCase() === "admin" && password === "admin") {
        window.location.href = "2-admin-dashboard.html";
        return;
      }
      if (username.toLowerCase() === "pending@demo.local" && password) {
        window.location.href = "1.2-access-awaiting-approval.html";
        return;
      }
      if (!errorScreen) {
        window.location.href = "1.1-sign-in-error.html";
        return;
      }
      const errorNotice = document.querySelector("#login-error");
      errorNotice.querySelector("strong").textContent = "Sign-in unsuccessful";
      errorNotice.querySelector("p").textContent = "Username or password was not recognized. Check your details and try again.";
      errorNotice.hidden = false;
      passwordInput.focus();
    });
  }
  const resetForm = document.querySelector("#reset-form");
  if (resetForm) {
    resetForm.addEventListener("submit", (event) => {
      event.preventDefault();
      document.querySelector("#submitted-email").textContent = document.querySelector("#reset-email").value;
      document.querySelector("#reset-form-content").hidden = true;
      document.querySelector("#reset-success").hidden = false;
    });
  }
}

function initializePrototype(screen) {
  document.body.classList.add("prototype-page", `prototype-${screen.type}`);
  const copy = getScreenCopy(screen);
  document.title = `${copy.title} | Second Daze`;
  const root = document.querySelector("#prototype-screen");
  root.innerHTML = screen.type.startsWith("mobile-")
    ? renderMobileScreen(screen, copy)
    : screen.type === "notifications" || screen.type === "confirm"
      ? renderOverlayScreen(screen, copy)
      : renderDesktopScreen(screen, copy);
  root.addEventListener("submit", (event) => {
    if (!event.target.matches("form")) return;
    event.preventDefault();
    const message = root.querySelector("#prototype-message");
    if (screen.type === "mobile-login") {
      const formData = new FormData(event.target);
      const username = String(formData.get("username") || "").trim().toLowerCase();
      const password = formData.get("password");
      if (username === "admin" && password === "admin") {
        window.location.href = "8.1-mobile-admin-dashboard.html";
        return;
      }
      if (message) {
        message.textContent = "Username or password was not recognized.";
        message.hidden = false;
      }
      return;
    }
    if (message) message.hidden = false;
  });
  root.addEventListener("click", (event) => {
    const dismiss = event.target.closest("[data-dismiss]");
    if (dismiss && (screen.type === "notifications" || screen.type === "confirm")) {
      const returnScreens = {
        "9-overlay-notifications-admin": "8.1-mobile-admin-dashboard",
        "9.1-overlay-notifications-sales": "8.4-mobile-orders",
        "9.2-overlay-notifications-inventory": "8.5-mobile-low-stock",
        "9.3-overlay-confirm-approve": "8.2-mobile-approvals",
      };
      window.location.href = `../section-8-mobile/${returnScreens[screen.id]}.html`;
    }
    const switcher = event.target.closest("[data-screen-link]");
    if (switcher) window.location.href = switcher.dataset.screenLink;
  });
}

function renderDesktopScreen(screen, copy) {
  const nav = prototypeScreens.filter((item) => !item.type.startsWith("mobile-") && item.type !== "notifications" && item.type !== "confirm");
  return `
    <header class="app-topbar">
      <a class="app-brand" href="2-admin-dashboard.html" aria-label="Second Daze dashboard"><img class="app-brand-logo" src="../../download.jpg" alt="" /><span><strong>Second Daze</strong><small>Apparel Admin</small></span></a>
      <label class="app-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search orders, requests, reports" /></label>
      <a class="icon-button" href="../mobile-companion/section-9-overlays/9-overlay-notifications-admin.html" aria-label="Notifications">♧</a>
      <button class="profile-button" type="button"><span class="app-brand-mark">SD</span><span><strong>Staff account</strong><small>${screen.id.startsWith("4-") ? "Inventory" : screen.id.startsWith("5-") ? "Reservations" : "Workspace"}</small></span></button>
    </header>
    <div class="app-body"><aside class="app-sidebar">
      <div class="workspace-label"><strong>Workspace</strong><span>Second Daze Apparel</span></div>
      <nav class="screen-navigation" aria-label="Main system navigation">${nav.map((item) => `<a class="${item.id === screen.id ? "is-current" : ""}" href="${item.file}" aria-label="${getScreenCopy(item).title}"><span class="nav-glyph" aria-hidden="true">□</span><span>${getScreenCopy(item).title}</span></a>`).join("")}<a href="../../index.html"><span class="nav-glyph" aria-hidden="true">↗</span><span>Screen directory</span></a></nav>
      <div class="sidebar-note"><strong>Prototype data</strong><p>Connect a data source to display live records and metrics.</p></div>
    </aside>
    <main class="app-content"><div class="content-heading"><div><div class="eyebrow">${screen.id.startsWith("2") ? "Admin workspace" : screen.id.startsWith("3") ? "Sales workspace" : screen.id.startsWith("4") ? "Inventory workspace" : screen.id.startsWith("5") ? "Reservations" : "Reporting"}</div><h1>${copy.title}</h1><p>${copy.description}</p></div>${screen.type === "reports" ? '<div class="heading-actions"><button class="outline-button" type="button">Export report</button></div>' : ""}</div>${renderMainContent(screen, copy)}</main></div>`;
}

function renderMainContent(screen, copy) {
  if (screen.type === "dashboard") return renderDashboard();
  if (screen.type === "reports") return renderReports();
  if (screen.type === "table") return renderTable(screen);
  if (screen.type === "form") return renderForm(screen, copy);
  if (screen.type === "detail") return renderDetail(screen, copy);
  if (screen.type === "success") return renderSuccess(screen, copy);
  return renderCatalog();
}

function renderMetricCards(labels) {
  return `<section class="stat-grid" aria-label="Workspace metrics">${labels.map((label) => `<article class="stat-card"><div class="stat-topline"><span>${label}</span><span class="stat-icon" aria-hidden="true">◷</span></div><strong>—</strong><p>Available when connected to live data</p></article>`).join("")}</section>`;
}

function renderDashboard() {
  return `${renderMetricCards(["Gross sales", "Total cost", "Profit", "Orders placed"])}<section class="dashboard-grid"><article class="surface-panel chart-panel"><div class="panel-heading"><div><h2>Sales overview</h2><p>Performance for the selected period</p></div></div><p>Chart data will appear when sales records are available.</p></article><article class="surface-panel side-summary"><div class="panel-heading"><div><h2>Inventory overview</h2><p>Current availability and stock status</p></div></div><p>Inventory metrics are not connected to a data source.</p></article><article class="surface-panel wide-panel"><div class="panel-heading"><div><h2>Recent activity</h2><p>Latest updates across the workspace</p></div></div><p>No recent activity is available.</p></article><article class="surface-panel side-summary"><div class="panel-heading"><div><h2>Needs attention</h2><p>Items requiring review</p></div></div><p>No pending items are available.</p></article></section>`;
}

function renderReports() {
  return `<div class="filter-bar"><select aria-label="Reporting period"><option>Select reporting period</option></select><select aria-label="Product category"><option>All categories</option></select></div>${renderMetricCards(["Revenue", "Cost", "Profit", "Margin"])}<section class="dashboard-grid"><article class="surface-panel chart-panel"><div class="panel-heading"><div><h2>Sales and profit by period</h2><p>Recorded sales compared with costs</p></div></div><p>Chart data will appear when sales records are available.</p></article><article class="surface-panel side-summary"><div class="panel-heading"><div><h2>Sales by category</h2><p>Category share for the selected period</p></div></div><p>Category breakdown is not available yet.</p></article><article class="surface-panel wide-panel"><div class="panel-heading"><div><h2>Top-selling items</h2><p>Items ranked by recorded sales</p></div></div><p>No sales data is available for this period.</p></article></section>`;
}

function renderTable(screen) {
  const columns = mainColumns[screen.id] || ["Record", "Reference", "Status", "Updated", "Action"];
  const searchLabel = getScreenCopy(screen).title.toLowerCase();
  return `<section class="surface-panel table-panel"><div class="filter-bar table-filters"><label class="filter-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search ${searchLabel}" /></label><select aria-label="Status filter"><option>All statuses</option></select><select aria-label="Date filter"><option>Any date</option></select></div><div class="table-scroll"><table><thead><tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead><tbody><tr><td colspan="${columns.length}">No ${searchLabel} found. Records will appear here when available.</td></tr></tbody></table></div></section>`;
}

function renderForm(screen, copy) {
  const fields = formFields[screen.id] || ["Name", "Reference", "Status", "Date", "Notes"];
  const action = screen.id === "3.13-create-purchase-order" ? "Submit for approval" : screen.id === "5.1-new-reservation" ? "Request Admin approval" : "Save changes";
  return `<div class="form-layout"><form class="surface-panel prototype-form"><div class="panel-heading"><div><h2>${copy.title}</h2><p>${copy.description}</p></div></div><div class="form-grid">${fields.map((field, index) => `<label class="${index === 0 || index === fields.length - 1 ? "field-wide" : ""}"><span>${field}${index === 0 ? " *" : ""}</span>${["Item condition", "Delivery status", "Category", "Status"].includes(field) ? `<select aria-label="${field}"><option>Select ${field.toLowerCase()}</option></select>` : ["Inspection note", "Pickup note", "Note for the Admin"].includes(field) ? `<textarea rows="3" placeholder="Add a note"></textarea>` : `<input type="text" placeholder="Enter ${field.toLowerCase()}" />`}</label>`).join("")}</div><div class="form-actions"><button class="outline-button" type="reset">Clear</button><button class="solid-button" type="submit">${action}</button></div><p class="inline-message" id="prototype-message" hidden>Your changes are ready for review.</p></form><aside class="surface-panel form-aside"><div class="panel-heading"><div><h2>Before you continue</h2><p>Review the information and required approvals.</p></div></div><p>${copy.description}</p><div class="notice-box"><span>i</span><p>Live records are not connected. Submissions are for interface testing only.</p></div></aside></div>`;
}

function renderDetail(screen, copy) {
  const isPayment = screen.id === "3.1-checkout-pending-payment" || screen.id === "3.8-checkout-gcash-payment";
  const isShipment = screen.id === "3.10-order-detail-shipment" || screen.id === "3.14-confirm-delivery";
  const isApproval = screen.id === "3.6-approval-request-detail";
  return `<div class="form-layout detail-layout"><article class="surface-panel detail-main">${screen.id === "3.15-payment-not-received" ? '<div class="notice-box"><span>!</span><p><strong>Payment not verified</strong><br />The payment could not be matched. Check the customer receipt before resubmitting.</p></div>' : ""}<div class="panel-heading"><div><h2>${isShipment ? "Shipment" : isApproval ? "Refund request" : "Order summary"}</h2><p>${copy.description}</p></div></div>${isShipment ? '<div class="summary-row"><span>Courier</span><strong>Not provided</strong></div><div class="summary-row"><span>Tracking number</span><strong>Not provided</strong></div><div class="summary-row"><span>Shipment status</span><strong>Awaiting update</strong></div>' : isApproval ? '<div class="summary-row"><span>Requested amount</span><strong>—</strong></div><div class="summary-row"><span>Item condition</span><strong>Awaiting review</strong></div><div class="summary-row"><span>Approval status</span><strong>Pending decision</strong></div>' : '<div class="summary-row"><span>Items</span><strong>No order items loaded</strong></div><div class="summary-row"><span>Subtotal</span><strong>—</strong></div><div class="total-row"><span>Total due</span><strong>—</strong></div>'}<div class="notice-box"><span>i</span><p>Connect the application to its data source to load this record.</p></div></article><aside class="surface-panel form-aside"><div class="panel-heading"><div><h2>${isPayment ? "GCash payment" : isApproval ? "Admin decision" : "Next step"}</h2><p>Review the record before continuing.</p></div></div>${isPayment ? '<label>Amount paid<input placeholder="Enter amount paid" /></label><label>GCash reference number<input placeholder="Enter reference number" /></label><button class="solid-button full-button" type="button">Record payment</button>' : isApproval ? '<button class="solid-button full-button" type="button">Approve request</button><button class="outline-button full-button" type="button">Reject request</button>' : '<button class="solid-button full-button" type="button">Update shipment</button><button class="outline-button full-button" type="button">Back to orders</button>'}</aside></div>`;
}

function renderSuccess(screen, copy) {
  const back = screen.id.includes("reservation") ? ["5-reservations.html", "Back to reservations"] : screen.id === "3.7-refund-completed" ? ["2.4-refunds.html", "Back to refunds"] : ["2-admin-dashboard.html", "Back to dashboard"];
  return `<article class="surface-panel success-panel"><div class="success-mark" aria-hidden="true">✓</div><span class="status-badge">${screen.id === "5.2-expired-reservation-void-notice" ? "Expired / voided" : "Recorded"}</span><h2>${copy.title}</h2><p>${copy.description}</p><div class="notice-box"><span>i</span><p>This prototype does not store payment, inventory, or customer records.</p></div><div class="success-actions"><a class="solid-button button-link" href="${back[0]}">${back[1]}</a></div></article>`;
}

function renderCatalog() {
  return `<div class="filter-bar catalog-filters"><label class="filter-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search by product name or SKU" /></label><select aria-label="Product category"><option>All categories</option></select><select aria-label="Product size"><option>All sizes</option></select><button class="outline-button" type="button">In stock only</button></div><div class="catalog-layout"><section class="catalog-products surface-panel"><h2>Featured apparel &amp; accessories</h2><p>Product listings will appear when catalog data is available.</p><p>No product images or sample inventory are included in this prototype.</p></section><aside class="surface-panel cart-panel"><div class="panel-heading"><div><h2>Current order</h2><p>Start an order by selecting an available item.</p></div><span class="status-badge">Draft</span></div><p>No items in this order.</p><div class="total-row"><span>Total due</span><strong>—</strong></div><a class="solid-button button-link full-button" href="3.1-checkout-pending-payment.html">Proceed to checkout</a></aside></div>`;
}

function renderMobileScreen(screen, copy) {
  const header = `<header class="mobile-header"><a href="8.1-mobile-admin-dashboard.html" aria-label="Second Daze dashboard"><img class="app-brand-logo" src="../../../download.jpg" alt="" /></a><strong>Second Daze</strong><a class="outline-button button-link mobile-directory-link" href="../../../index.html">All screens</a>${screen.type === "mobile-login" ? "" : '<a class="mobile-notifications-link" href="../section-9-overlays/9-overlay-notifications-admin.html" aria-label="Notifications">♧</a>'}<span class="mobile-avatar">SD</span></header>`;
  let content = "";
  if (screen.type === "mobile-login") {
    content = `<section class="mobile-card"><h2>Sign in to your workspace</h2><p>Temporary demo login: username <strong>admin</strong>, password <strong>admin</strong>.</p><form><label><span>Username</span><input name="username" type="text" autocomplete="username" placeholder="Enter your username" required /></label><label><span>Password</span><input name="password" type="password" autocomplete="current-password" placeholder="Enter your password" required /></label><label><input type="checkbox" /> Remember me</label><button class="solid-button full-button" type="submit">Sign in</button><p>Need access? Ask your Admin to create a subaccount.</p></form></section>`;
  } else if (screen.type === "mobile-dashboard") {
    content = `<h2 class="mobile-section-title">Needs attention</h2><article class="mobile-card"><strong>No pending items</strong><p>Approvals and activity will appear here when live data is connected.</p></article>`;
  } else if (screen.type === "mobile-stock") {
    content = `<article class="mobile-card"><strong>No low-stock items</strong><p>Stock alerts will appear here when inventory data is connected.</p></article>`;
  } else if (screen.type === "mobile-approvals") {
    content = `<div class="mobile-tabs"><button class="solid-button" type="button">Access</button><button class="outline-button" type="button">Payments</button><button class="outline-button" type="button">Refunds</button><button class="outline-button" type="button">Reservations</button></div><article class="mobile-card"><strong>No approval requests</strong><p>Requests will appear here when there are records to review.</p></article>`;
  } else if (screen.type === "mobile-orders") {
    content = `<div class="mobile-tabs"><button class="solid-button" type="button">All</button><button class="outline-button" type="button">To ship</button><button class="outline-button" type="button">Shipped</button><button class="outline-button" type="button">Done</button></div><article class="mobile-card"><strong>No orders found</strong><p>Orders will appear here when sales data is connected.</p></article>`;
  } else {
    const reservation = screen.type === "mobile-reservation";
    content = `<section class="mobile-card"><h2>${reservation ? "Customer and items" : "GCash payment"}</h2><form>${reservation ? '<label><span>Customer</span><input placeholder="Search customer name or ID" /></label><label><span>Add a product</span><input placeholder="Search SKU or product name" /></label><label><span>Agreed days</span><select><option>Select agreed days</option></select></label><label><span>Pickup note</span><input placeholder="Add a pickup note" /></label><div class="notice-box"><span>i</span><p>Admin approval is required before a stock hold is activated.</p></div><button class="solid-button full-button" type="submit">Request Admin approval</button>' : '<p>Order summary and amount will appear when order data is available.</p><label><span>Amount paid</span><input inputmode="decimal" placeholder="Enter amount paid" /></label><label><span>GCash reference number</span><input placeholder="Enter the reference number" /></label><label><span>Payment date</span><input type="datetime-local" /></label><button class="solid-button full-button" type="submit">Record payment</button>'}</form></section>`;
  }
  const nav = prototypeScreens.filter((item) => ["mobile-dashboard", "mobile-approvals", "mobile-orders", "mobile-stock"].includes(item.type));
  return `<div class="mobile-app">${header}<main class="mobile-content">${screen.type === "mobile-login" ? `<p class="mobile-subtitle">${copy.description}</p>` : `<h1>${copy.title}</h1><p class="mobile-subtitle">${copy.description}</p>`}${content}<p class="inline-message" id="prototype-message" hidden>Your changes were submitted for this prototype session.</p></main>${screen.type === "mobile-login" ? "" : `<nav class="mobile-bottom-nav">${nav.map((item) => `<a class="${item.id === screen.id ? "is-current" : ""}" href="${item.file}"><span>□</span><small>${getScreenCopy(item).title}</small></a>`).join("")}</nav>`}</div>`;
}

function renderOverlayScreen(screen, copy) {
  const confirm = screen.type === "confirm";
  const returnPath = screen.id === "9.1-overlay-notifications-sales" ? "../section-8-mobile/8.4-mobile-orders.html" : screen.id === "9.2-overlay-notifications-inventory" ? "../section-8-mobile/8.5-mobile-low-stock.html" : screen.id === "9.3-overlay-confirm-approve" ? "../section-8-mobile/8.2-mobile-approvals.html" : "../section-8-mobile/8.1-mobile-admin-dashboard.html";
  return `<main class="prototype-overlay-page"><div class="overlay-scrim"></div><section class="prototype-overlay" role="dialog" aria-modal="true" aria-labelledby="overlay-title"><div class="overlay-mark" aria-hidden="true">${confirm ? "?" : "SD"}</div><div class="overlay-heading"><div><h1 id="overlay-title">${copy.title}</h1><p>${copy.description}</p></div><a class="icon-button" href="${returnPath}" aria-label="Close">×</a></div><p><a class="text-button" href="../../../index.html">Screen directory</a></p>${confirm ? '<div class="notice-box"><span>i</span><p><strong>What happens next</strong><br />The requester is notified and the record moves to its next step. You can view it in the audit trail.</p></div><div class="overlay-actions"><a class="outline-button button-link" href="' + returnPath + '">Cancel</a><a class="solid-button button-link" href="' + returnPath + '">Confirm approval</a></div>' : `<p>No notifications are available.</p><a class="outline-button button-link full-button" href="${returnPath}">Close</a>`}</section></main>`;
}
