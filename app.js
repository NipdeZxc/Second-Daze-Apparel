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
  ["8.2-mobile-approvals", "8.2-mobile-approvals.html", "mobile-list"],
  ["8.3-mobile-checkout-gcash", "8.3-mobile-checkout-gcash.html", "mobile-form"],
  ["8.4-mobile-orders", "8.4-mobile-orders.html", "mobile-list"],
  ["8.5-mobile-low-stock", "8.5-mobile-low-stock.html", "mobile-stock"],
  ["8.6-mobile-new-reservation", "8.6-mobile-new-reservation.html", "mobile-form"],
  ["9-overlay-notifications-admin", "9-overlay-notifications-admin.html", "notifications"],
  ["9.1-overlay-notifications-sales", "9.1-overlay-notifications-sales.html", "notifications"],
  ["9.2-overlay-notifications-inventory", "9.2-overlay-notifications-inventory.html", "notifications"],
  ["9.3-overlay-confirm-approve", "9.3-overlay-confirm-approve.html", "confirm"],
].map(([id, file, type]) => ({ id, file, type }));

const prototypeId = document.body.dataset.screen?.replace(/^prototype-/, "");
const prototypeScreen = prototypeScreens.find(({ id }) => id === prototypeId);

if (document.body.dataset.screen === "screen-hub") {
  initializeScreenHub();
} else if (prototypeScreen) {
  initializePrototype(prototypeScreen);
} else {
  initializeAccessScreens();
}

function initializeScreenHub() {
  document.title = "Placeholder text";
  const sections = [
    {
      label: "Sections 1–7",
      folder: "section-1-7",
      screens: [
        { id: "1-staff-sign-in", file: "1-staff-sign-in.html" },
        { id: "1.1-sign-in-error", file: "1.1-sign-in-error.html" },
        {
          id: "1.2-access-awaiting-approval",
          file: "1.2-access-awaiting-approval.html",
        },
        { id: "1.3-forgot-password", file: "1.3-forgot-password.html" },
        ...prototypeScreens.filter(
          (screen) =>
            !screen.type.startsWith("mobile-") &&
            screen.type !== "notifications" &&
            screen.type !== "confirm",
        ),
      ],
    },
    {
      label: "Section 8 · Mobile",
      folder: "section-8-mobile",
      screens: prototypeScreens.filter((screen) =>
        screen.type.startsWith("mobile-"),
      ),
    },
    {
      label: "Section 9 · Overlays",
      folder: "section-9-overlays",
      screens: prototypeScreens.filter(
        (screen) =>
          screen.type === "notifications" || screen.type === "confirm",
      ),
    },
  ];

  document.querySelector("#screen-hub").innerHTML = `
    <header class="hub-header">
      <a class="brand" href="index.html">
        <span class="brand-mark" aria-hidden="true">Tx</span>
        <span class="brand-copy"><strong>Placeholder</strong><span>Placeholder text</span></span>
      </a>
    </header>
    <main class="hub-main">
      <p class="eyebrow">Placeholder</p>
      <h1>Placeholder text</h1>
      <p class="hub-intro">Placeholder text Placeholder text</p>
      <div class="hub-groups">
        ${sections
          .map(
            (section) => `
              <section class="hub-group">
                <div class="hub-group-heading">
                  <h2>${section.label}</h2>
                  <span>${section.screens.length}</span>
                </div>
                <nav aria-label="${section.label}">
                  ${section.screens
                    .map(
                      (screen) => `
                        <a href="screens/${section.folder}/${screen.file}">
                          <span>${screen.id.split("-")[0]}</span>
                          <span>Placeholder screen</span>
                          <span aria-hidden="true">→</span>
                        </a>`,
                    )
                    .join("")}
                </nav>
              </section>`,
          )
          .join("")}
      </div>
    </main>`;
}

function initializeAccessScreens() {
  const screen = document.body.dataset.screen;
  const pageTitles = {
    "sign-in": "Placeholder text",
    "sign-in-error": "Placeholder text",
    "access-awaiting-approval": "Placeholder text",
    "forgot-password": "Placeholder text",
  };

  document.title = pageTitles[screen] || "Placeholder text";
  document.querySelector("#site-header").innerHTML = `
    <header class="topbar">
      <a class="brand" href="1-staff-sign-in.html" aria-label="Second Daze Apparel home">
        <span class="brand-mark" aria-hidden="true">Tx</span>
        <span class="brand-copy">
          <strong>Placeholder</strong>
          <span>Placeholder text</span>
        </span>
      </a>
      <span class="topbar-label">Placeholder text</span>
    </header>`;
  document.querySelector("#site-footer").innerHTML = `
    <footer class="page-footer">
      <span>Placeholder text</span>
      <span>Placeholder text Placeholder</span>
      <span>Placeholder text Placeholder text Placeholder text</span>
    </footer>`;

  const passwordInput = document.querySelector("#password");
  const togglePassword = document.querySelector("#toggle-password");

  if (passwordInput && togglePassword) {
    togglePassword.addEventListener("click", () => {
      const showPassword = passwordInput.type === "password";
      passwordInput.type = showPassword ? "text" : "password";
      togglePassword.textContent = "Placeholder";
      togglePassword.setAttribute(
        "aria-label",
        showPassword ? "Hide password" : "Show password",
      );
      togglePassword.setAttribute("aria-pressed", String(showPassword));
    });
  }

  const loginForm = document.querySelector("#login-form");
  if (loginForm) {
    const emailInput = document.querySelector("#email");
    const errorScreen = screen === "sign-in-error";
    const previousEmail = sessionStorage.getItem("staff-email");

    if (previousEmail) emailInput.value = previousEmail;

    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = emailInput.value.trim();
      sessionStorage.setItem("staff-email", email);

      if (email.toLowerCase() === "pending@demo.local") {
        window.location.href = "1.2-access-awaiting-approval.html";
        return;
      }

      if (!errorScreen) {
        window.location.href = "1.1-sign-in-error.html";
        return;
      }

      const errorNotice = document.querySelector("#login-error");
      errorNotice.querySelector("strong").textContent =
        "Placeholder text Placeholder";
      errorNotice.querySelector("p").textContent =
        "Placeholder text Placeholder text Placeholder text Placeholder text";
      errorNotice.hidden = false;
      passwordInput.focus();
    });
  }

  const resetForm = document.querySelector("#reset-form");
  if (resetForm) {
    resetForm.addEventListener("submit", (event) => {
      event.preventDefault();
      document.querySelector("#submitted-email").textContent =
        "Placeholder text";
      document.querySelector("#reset-form-content").hidden = true;
      document.querySelector("#reset-success").hidden = false;
    });
  }
}

function initializePrototype(screen) {
  document.body.classList.add("prototype-page", `prototype-${screen.type}`);
  document.title = "Placeholder text";
  const screenRoot = document.querySelector("#prototype-screen");

  if (screen.type.startsWith("mobile-")) {
    screenRoot.innerHTML = renderMobileScreen(screen);
  } else if (screen.type === "notifications" || screen.type === "confirm") {
    screenRoot.innerHTML = renderOverlayScreen(screen);
  } else {
    screenRoot.innerHTML = renderDesktopScreen(screen);
  }

  screenRoot.addEventListener("submit", (event) => {
    if (!event.target.matches("form")) return;
    event.preventDefault();
    const message = document.querySelector("#prototype-message");
    if (message) message.hidden = false;
  });

  screenRoot.addEventListener("click", (event) => {
    const dismiss = event.target.closest("[data-dismiss]");
    if (dismiss) {
      const overlay = dismiss.closest(".prototype-overlay");
      if (overlay) {
        overlay.hidden = true;
        const scrim = document.querySelector(".overlay-scrim");
        if (scrim) scrim.hidden = true;
      }
    }

    const switcher = event.target.closest("[data-screen-link]");
    if (switcher) {
      window.location.href = switcher.dataset.screenLink;
    }
  });
}

function renderDesktopScreen(screen) {
  return `
    <header class="app-topbar">
      <a class="app-brand" href="../section-1-7/1-staff-sign-in.html" aria-label="Placeholder">
        <span class="app-brand-mark">Tx</span>
        <span><strong>Placeholder</strong><small>Placeholder text</small></span>
      </a>
      <label class="app-search">
        <span aria-hidden="true">⌕</span>
        <input type="search" placeholder="Placeholder text Placeholder text" />
      </label>
      <button class="icon-button" type="button" aria-label="Placeholder">♧</button>
      <button class="profile-button" type="button">
        <span class="app-brand-mark">Tx</span>
        <span><strong>Placeholder</strong><small>Placeholder</small></span>
      </button>
    </header>
    <div class="app-body">
      <aside class="app-sidebar">
        <div class="workspace-label">
          <strong>Placeholder</strong>
          <span>Placeholder text Placeholder</span>
        </div>
        <nav class="screen-navigation" aria-label="Placeholder">
          ${prototypeScreens
            .filter(
              (item) =>
                !item.type.startsWith("mobile-") &&
                item.type !== "notifications" &&
                item.type !== "confirm",
            )
            .map(
              (item) => `
                <a class="${item.id === screen.id ? "is-current" : ""}"
                   href="${item.file}"
                   aria-label="${item.id}">
                  <span class="nav-glyph" aria-hidden="true">${item.id[0]}</span>
                  <span>Placeholder text</span>
                </a>`,
            )
            .join("")}
        </nav>
        <div class="sidebar-note">
          <strong>Placeholder</strong>
          <p>Placeholder text Placeholder text Placeholder text</p>
        </div>
      </aside>
      <main class="app-content">
        <div class="content-heading">
          <div>
            <div class="eyebrow">Placeholder</div>
            <h1>Placeholder text Placeholder</h1>
            <p>Placeholder text Placeholder text Placeholder text Placeholder</p>
          </div>
          <div class="heading-actions">
            <button class="outline-button" type="button">Placeholder text</button>
            <button class="solid-button" type="button">＋ Placeholder</button>
          </div>
        </div>
        ${renderContent(screen.type)}
      </main>
    </div>`;
}

function renderContent(type) {
  if (type === "table") return renderTable();
  if (type === "form") return renderForm();
  if (type === "detail") return renderDetail();
  if (type === "success") return renderSuccess();
  if (type === "catalog") return renderCatalog();
  if (type === "reports") return renderReports();
  return renderDashboard();
}

function renderStats(count = 4) {
  return `
    <section class="stat-grid" aria-label="Placeholder">
      ${Array.from(
        { length: count },
        (_, index) => `
          <article class="stat-card">
            <div class="stat-topline">
              <span>Placeholder text</span>
              <span class="stat-icon" aria-hidden="true">${["◷", "▤", "↻", "□"][index % 4]}</span>
            </div>
            <strong>${index === 1 ? "₱0,000.00" : "0"}</strong>
            <p>Placeholder text Placeholder</p>
          </article>`,
      ).join("")}
    </section>`;
}

function renderDashboard() {
  return `
    ${renderStats()}
    <section class="dashboard-grid">
      <article class="surface-panel chart-panel">
        <div class="panel-heading">
          <div><h2>Placeholder text</h2><p>Placeholder text Placeholder</p></div>
          <button class="outline-button" type="button">Placeholder</button>
        </div>
        <div class="chart-area" aria-label="Placeholder chart">
          <div class="chart-guides"><span></span><span></span><span></span><span></span></div>
          <div class="chart-bars">${[44, 68, 51, 82, 62, 92, 75].map((height) => `<i style="height:${height}%"></i>`).join("")}</div>
          <div class="chart-labels"><span>Placeholder</span><span>Placeholder</span><span>Placeholder</span><span>Placeholder</span><span>Placeholder</span><span>Placeholder</span><span>Placeholder</span></div>
        </div>
      </article>
      <article class="surface-panel side-summary">
        <div class="panel-heading"><div><h2>Placeholder text</h2><p>Placeholder text Placeholder</p></div></div>
        ${Array.from({ length: 5 }, () => `<div class="summary-row"><span>Placeholder text</span><strong>0</strong></div>`).join("")}
      </article>
      <article class="surface-panel wide-panel">
        <div class="panel-heading"><div><h2>Placeholder text</h2><p>Placeholder text Placeholder</p></div><button class="outline-button" type="button">Placeholder</button></div>
        ${renderRows(4)}
      </article>
      <article class="surface-panel side-summary">
        <div class="panel-heading"><div><h2>Placeholder</h2><p>Placeholder text Placeholder</p></div></div>
        ${renderRows(3, true)}
      </article>
    </section>`;
}

function renderReports() {
  return `
    <div class="filter-bar">
      <select aria-label="Placeholder"><option>Placeholder text</option></select>
      <select aria-label="Placeholder"><option>Placeholder</option></select>
      <span>Placeholder text Placeholder</span>
    </div>
    ${renderStats()}
    <section class="dashboard-grid">
      <article class="surface-panel chart-panel">
        <div class="panel-heading"><div><h2>Placeholder text</h2><p>Placeholder text Placeholder</p></div></div>
        <div class="chart-area report-chart"><div class="chart-guides"><span></span><span></span><span></span><span></span></div><div class="chart-bars">${[37, 62, 45, 80, 57, 91, 73].map((height) => `<i style="height:${height}%"></i>`).join("")}</div><div class="chart-labels"><span>Placeholder</span><span>Placeholder</span><span>Placeholder</span><span>Placeholder</span><span>Placeholder</span><span>Placeholder</span><span>Placeholder</span></div></div>
      </article>
      <article class="surface-panel side-summary"><div class="panel-heading"><h2>Placeholder text</h2></div>${renderRows(5, true)}</article>
      <article class="surface-panel wide-panel"><div class="panel-heading"><div><h2>Placeholder text</h2><p>Placeholder text Placeholder</p></div></div>${renderTableMarkup()}</article>
    </section>`;
}

function renderTable() {
  return `
    ${renderStats(3)}
    <section class="surface-panel table-panel">
      <div class="filter-bar table-filters">
        <label class="filter-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Placeholder text Placeholder" /></label>
        <select aria-label="Placeholder"><option>Placeholder</option></select>
        <select aria-label="Placeholder"><option>Placeholder</option></select>
        <button class="outline-button" type="button">Placeholder</button>
      </div>
      ${renderTableMarkup()}
    </section>`;
}

function renderTableMarkup() {
  return `
    <div class="table-scroll">
      <table>
        <thead><tr>${Array.from({ length: 6 }, () => "<th>PLACEHOLDER</th>").join("")}</tr></thead>
        <tbody>
          ${Array.from({ length: 6 }, () => `
            <tr>
              <td><strong>Placeholder text</strong><small>Placeholder text Placeholder</small></td>
              <td>Placeholder text</td>
              <td>Placeholder text</td>
              <td><span class="status-badge">Placeholder</span></td>
              <td><strong>₱00,000.00</strong></td>
              <td><button class="outline-button small-button" type="button">Placeholder</button></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function renderRows(count, compact = false) {
  return `<div class="${compact ? "compact-rows" : "activity-rows"}">${Array.from(
    { length: count },
    (_, index) => `
      <div class="activity-row">
        <span class="row-icon" aria-hidden="true">${["Tx", "↻", "□"][index % 3]}</span>
        <span class="row-copy"><strong>Placeholder text Placeholder</strong><small>Placeholder text Placeholder text</small></span>
        <strong>${index === 0 ? "₱00,000" : "Placeholder"}</strong>
      </div>`,
  ).join("")}</div>`;
}

function renderForm() {
  return `
    <div class="form-layout">
      <form class="surface-panel prototype-form">
        <div class="panel-heading"><div><h2>Placeholder text Placeholder</h2><p>Placeholder text Placeholder text Placeholder</p></div></div>
        <div class="form-grid">
          ${Array.from({ length: 6 }, (_, index) => `
            <label class="${index === 0 || index === 5 ? "field-wide" : ""}">
              <span>Placeholder text</span>
              ${index === 3 ? '<select><option>Placeholder text</option></select>' : `<input ${index === 4 ? 'type="number"' : 'type="text"'} placeholder="${index === 4 ? "0" : "Placeholder text"}" />`}
              <small>Placeholder text Placeholder</small>
            </label>`).join("")}
          <label class="field-wide"><span>Placeholder text</span><textarea rows="4" placeholder="Placeholder text Placeholder text Placeholder"></textarea></label>
        </div>
        <div class="form-actions"><button class="outline-button" type="button">Placeholder</button><button class="solid-button" type="submit">Placeholder text</button></div>
        <p class="inline-message" id="prototype-message" hidden>Placeholder text Placeholder</p>
      </form>
      <aside class="surface-panel form-aside">
        <div class="panel-heading"><div><h2>Placeholder</h2><p>Placeholder text Placeholder text</p></div></div>
        ${renderRows(3, true)}
        <div class="notice-box"><span>i</span><p>Placeholder text Placeholder text Placeholder text Placeholder</p></div>
      </aside>
    </div>`;
}

function renderDetail() {
  return `
    <div class="stepper surface-panel">${Array.from({ length: 5 }, (_, index) => `<div class="step ${index === 2 ? "is-active" : index < 2 ? "is-done" : ""}"><span>${index < 2 ? "✓" : index + 1}</span><strong>Placeholder</strong></div>`).join("")}</div>
    ${renderStats(3)}
    <div class="form-layout detail-layout">
      <article class="surface-panel detail-main">
        <div class="panel-heading"><div><h2>Placeholder text Placeholder</h2><p>Placeholder text Placeholder text Placeholder</p></div><button class="outline-button" type="button">Placeholder</button></div>
        ${renderRows(3)}
        <div class="total-row"><span>Placeholder text</span><strong>₱0,000.00</strong></div>
        <div class="notice-box"><span>i</span><p>Placeholder text Placeholder text Placeholder text Placeholder text</p></div>
      </article>
      <aside class="surface-panel form-aside">
        <div class="panel-heading"><div><h2>Placeholder</h2><p>Placeholder text Placeholder</p></div></div>
        ${Array.from({ length: 4 }, () => `<div class="summary-row"><span>Placeholder text</span><strong>Placeholder</strong></div>`).join("")}
        <button class="solid-button full-button" type="button">Placeholder text</button>
        <button class="outline-button full-button" type="button">Placeholder</button>
      </aside>
    </div>`;
}

function renderSuccess() {
  return `
    <article class="surface-panel success-panel">
      <div class="success-mark" aria-hidden="true">✓</div>
      <span class="status-badge">Placeholder text</span>
      <h2>Placeholder text Placeholder</h2>
      <p>Placeholder text Placeholder text Placeholder text Placeholder text</p>
      ${renderStats(3)}
      <div class="notice-box"><span>i</span><p>Placeholder text Placeholder text Placeholder text Placeholder text Placeholder</p></div>
      <div class="success-actions"><button class="solid-button" type="button">Placeholder text</button><button class="outline-button" type="button">Placeholder</button></div>
    </article>
    <section class="surface-panel"><div class="panel-heading"><div><h2>Placeholder text</h2><p>Placeholder text Placeholder</p></div></div>${renderRows(3)}</section>`;
}

function renderCatalog() {
  return `
    <div class="filter-bar catalog-filters">
      <label class="filter-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Placeholder text Placeholder" /></label>
      <select aria-label="Placeholder"><option>Placeholder</option></select>
      <select aria-label="Placeholder"><option>Placeholder text</option></select>
      <button class="outline-button" type="button">Placeholder</button>
    </div>
    <div class="catalog-layout">
      <section class="catalog-products">${Array.from({ length: 6 }, () => `
        <article class="surface-panel product-card">
          <div class="product-image" aria-hidden="true"><span>×</span><span>×</span></div>
          <div class="product-copy"><small>Placeholder text Placeholder</small><h2>Placeholder text Placeholder</h2><strong>₱0,000</strong><button class="outline-button full-button" type="button">＋ Placeholder</button></div>
        </article>`).join("")}</section>
      <aside class="surface-panel cart-panel"><div class="panel-heading"><div><h2>Placeholder</h2><p>Placeholder text Placeholder</p></div><span class="status-badge">0</span></div>${renderRows(3, true)}<div class="total-row"><span>Placeholder text</span><strong>₱0,000</strong></div><button class="solid-button full-button" type="button">Placeholder text Placeholder</button><button class="outline-button full-button" type="button">Placeholder</button></aside>
    </div>`;
}

function renderMobileScreen(screen) {
  const login = screen.type === "mobile-login";
  const content = login
    ? `<section class="mobile-card"><h2>Placeholder text</h2><form><label><span>Placeholder text</span><input placeholder="Placeholder text" /></label><label><span>Placeholder text</span><input type="password" placeholder="Placeholder text" /></label><div class="mobile-inline"><label><input type="checkbox" /> Placeholder text</label><a href="8-mobile-sign-in.html">Placeholder text</a></div><button class="solid-button full-button" type="submit">Placeholder text</button><p class="mobile-note">Placeholder text Placeholder text Placeholder text</p><p class="inline-message" id="prototype-message" hidden>Placeholder text Placeholder</p></form></section>`
    : screen.type === "mobile-dashboard"
      ? `<div class="mobile-stats">${Array.from({ length: 6 }, () => `<article class="surface-panel"><strong>Placeholder text</strong><b>0</b></article>`).join("")}</div><h2 class="mobile-section-title">Placeholder text <span>Placeholder</span></h2>${renderRows(3, true)}`
      : screen.type === "mobile-stock"
        ? `<div class="mobile-stock-list">${Array.from({ length: 4 }, () => `<article class="mobile-card"><div><h2>Placeholder text</h2><p>Placeholder text</p></div><button class="outline-button" type="button">Placeholder</button><div class="stock-values"><div><strong>Placeholder</strong><b>0</b></div><div><strong>Placeholder</strong><b>0</b></div><button class="solid-button" type="button">Placeholder</button></div></article>`).join("")}</div>`
        : screen.type === "mobile-form"
          ? `<section class="mobile-card"><h2>Placeholder text</h2><form>${Array.from({ length: 4 }, () => `<label><span>Placeholder text</span><input placeholder="Placeholder text" /></label>`).join("")}<button class="solid-button full-button" type="submit">Placeholder text</button><p class="inline-message" id="prototype-message" hidden>Placeholder text Placeholder</p></form></section>`
          : `<div class="mobile-tabs">${Array.from({ length: 4 }, () => `<button class="outline-button" type="button">Placeholder</button>`).join("")}</div>${Array.from({ length: 4 }, () => `<article class="mobile-card"><strong>Placeholder text</strong><p>Placeholder text</p><button class="outline-button" type="button">Placeholder</button></article>`).join("")}`;

  return `
    <div class="mobile-app">
      <header class="mobile-header">
        ${login ? '<span class="app-brand-mark">Tx</span>' : '<button type="button" aria-label="Placeholder">‹</button>'}
        <strong>Placeholder text</strong>
        <span class="mobile-avatar">Tx</span>
      </header>
      <main class="mobile-content">
        ${!login ? '<h1>Placeholder text</h1><p class="mobile-subtitle">Placeholder text Placeholder</p>' : '<p class="mobile-subtitle">Placeholder text</p>'}
        ${content}
      </main>
      ${login ? "" : `<nav class="mobile-bottom-nav">${prototypeScreens.filter((item) => item.type.startsWith("mobile-")).slice(0, 4).map((item, index) => `<a href="${item.file}" aria-label="${item.id}"><span>${["□", "○", "▱", "□"][index]}</span><small>Placeholder</small></a>`).join("")}</nav>`}
    </div>`;
}

function renderOverlayScreen(screen) {
  const confirm = screen.type === "confirm";
  return `
    <main class="prototype-overlay-page">
      <div class="overlay-scrim"></div>
      <section class="prototype-overlay" role="dialog" aria-modal="true" aria-labelledby="overlay-title">
        <div class="overlay-mark" aria-hidden="true">${confirm ? "?" : "Tx"}</div>
        <div class="overlay-heading">
          <div><h1 id="overlay-title">Placeholder text</h1><p>Placeholder text Placeholder text Placeholder</p></div>
          <button type="button" class="icon-button" data-dismiss aria-label="Placeholder">×</button>
        </div>
        ${confirm
          ? `<div class="notice-box"><span>i</span><p>Placeholder text Placeholder text Placeholder text Placeholder text</p></div><div class="overlay-actions"><button class="outline-button" type="button" data-dismiss>Placeholder</button><button class="solid-button" type="button" data-dismiss>Placeholder</button></div>`
          : `<div class="notification-list">${Array.from({ length: 4 }, () => `<article class="notification-item"><span class="notification-dot"></span><div><strong>Placeholder text</strong><p>Placeholder text Placeholder</p></div></article>`).join("")}</div><button class="outline-button full-button" type="button">Placeholder</button>`}
      </section>
    </main>`;
}
