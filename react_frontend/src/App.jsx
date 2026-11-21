import { useEffect, useRef, useState } from "react";
import { formFields, screens, tableColumns } from "./screens.js";
import { demoLoginEnabled, signIn, signOut } from "./api/auth.js";
import { getWorkspaceOverview, submitWorkspaceAction } from "./api/workspace.js";
import { buildOverview, readWorkspace, STORAGE_KEY } from "./data/workspace.js";
import { CsvImportPanel, DataExportPanel, DataReports, formatMoney, RecordsTable, screenDatasets } from "./DataPanels.jsx";

const mainScreens = screens.filter((screen) => screen.group === "Main system");
const mobileScreens = screens.filter((screen) => screen.group === "Mobile companion");
const mobileTabs = [
  { id: "8.1-mobile-admin-dashboard", label: "Home", icon: "home" },
  { id: "8.2-mobile-approvals", label: "Approvals", icon: "check" },
  { id: "8.4-mobile-orders", label: "Orders", icon: "bag" },
  { id: "8.5-mobile-low-stock", label: "Inventory", icon: "box" },
].map((tab) => ({ ...mobileScreens.find((screen) => screen.id === tab.id), label: tab.label, icon: tab.icon }));

const iconPaths = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  bag: <><path d="M5 8h14l1 13H4L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  box: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 8 9 5 9-5M3 8v9l9 5 9-5V8M12 13v9" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  chart: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 6-7" /></>,
  smartphone: <><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  close: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></>,
  key: <><circle cx="8" cy="15" r="5" /><path d="m11.5 11.5 8-8 2 2-2 2 2 2-3 3-2-2-3.5 3.5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3" /></>,
};

function Icon({ name, size = 16, className = "" }) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name] || iconPaths.grid}
    </svg>
  );
}

const adminOnlyIds = new Set(["2-admin-dashboard", "2.1-subaccounts", "2.2-access-approvals", "2.6-reports", "2.7-csv-import", "2.8-sales", "2.9-data-export", "4.3-edit-product-admin-only", "7-staff-accounts"]);

function isAdmin(user) {
  return user?.role === "Admin";
}

function homeId(user) {
  return isAdmin(user) ? "2-admin-dashboard" : "2s-staff-dashboard";
}

function DashboardTopbar({ authUser, search, onSearch, onSignOut }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const profileButtonRef = useRef(null);
  useEffect(() => {
    if (!profileOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
        profileButtonRef.current?.focus();
      }
    };
    const closeOnNavigation = () => setProfileOpen(false);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("hashchange", closeOnNavigation);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("hashchange", closeOnNavigation);
    };
  }, [profileOpen]);
  const admin = isAdmin(authUser);
  const displayName = authUser?.username || "Staff";
  const initials = displayName.split(/[ .@_-]/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
  return (
    <header className="dashboard-topbar">
      <Brand compact to={`#/${homeId(authUser)}`} />
      {onSearch && (
        <label className="dashboard-search">
          <Icon name="search" size={15} />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={admin ? "Search orders, requests, reports" : "Search tasks, orders, reservations"}
            aria-label="Search dashboard"
          />
        </label>
      )}
      <ScreenLink className="dashboard-notifications" screen={screens.find((item) => item.id === (admin ? "9-overlay-notifications-admin" : "9.1-overlay-notifications-sales"))} aria-label="Open notifications">
        <Icon name="bell" size={17} />
      </ScreenLink>
      <div className="dashboard-profile-menu" ref={profileRef} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setProfileOpen(false);
      }}>
        <button
          className="dashboard-profile"
          type="button"
          ref={profileButtonRef}
          aria-label={`Account options for ${displayName}`}
          aria-expanded={profileOpen}
          aria-controls="profile-actions"
          onClick={() => setProfileOpen((open) => !open)}
        >
          <span className="dashboard-profile__avatar">{initials || "S"}</span>
          <span><strong>{displayName}</strong><small>{authUser?.role || "Staff"}</small></span>
        </button>
        {profileOpen && (
          <div className="dashboard-profile-menu__actions" id="profile-actions">
            <button type="button" onClick={() => {
              setProfileOpen(false);
              onSignOut();
            }}>
              <Icon name="logout" size={15} /> Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function screenIcon(screen) {
  if (screen.id === "2-admin-dashboard" || screen.id === "2s-staff-dashboard") return "home";
  if (screen.group === "Mobile companion") return "smartphone";
  if (screen.group === "Mobile overlays") return "bell";
  if (screen.id === "2.4-refunds" || screen.id.startsWith("2.3-")) return "bag";
  if (screen.id === "2.5-reservations") return "calendar";
  if (screen.id === "2.6-reports") return "chart";
  const section = screen.id.split(/[.-]/)[0];
  return { 1: "key", 2: "users", 3: "bag", 4: "box", 5: "calendar", 6: "chart", 7: "users" }[section] || "grid";
}

function readAuthUser() {
  const username = localStorage.getItem("second-daze-username");
  if (!username) return null;
  return {
    username,
    role: localStorage.getItem("second-daze-role") || "Staff",
    demo: localStorage.getItem("second-daze-demo") === "true",
  };
}

function saveAuthUser(user) {
  localStorage.setItem("second-daze-username", user.username);
  localStorage.setItem("second-daze-role", user.role || "Staff");
  localStorage.setItem("second-daze-demo", String(user.demo));
}

function clearAuthUser() {
  localStorage.removeItem("second-daze-username");
  localStorage.removeItem("second-daze-role");
  localStorage.removeItem("second-daze-demo");
}

function routeId() {
  const hashRoute = decodeURIComponent(window.location.hash.replace(/^#\/?/, "").split("?")[0]);
  if (hashRoute) return hashRoute;
  return window.location.pathname.replace(/\/+$/, "") === "/mobile" ? "mobile" : "";
}

function ScreenLink({ screen, children, className = "", ...linkProps }) {
  return (
    <a {...linkProps} className={className} href={`#/${screen.id}`}>
      {children || screen.title}
    </a>
  );
}

function Brand({ compact = false, to = "#/1-staff-sign-in" }) {
  return (
    <a className={`brand ${compact ? "brand--compact" : ""}`} href={to} aria-label="Second Daze workspace">
      <img src="/brand-logo.jpg" alt="" />
      <span>Second Daze</span>
    </a>
  );
}

function Sidebar({ active, authUser, onSignOut }) {
  const admin = isAdmin(authUser);
  const dashboardNavIds = admin
    ? ["2-admin-dashboard", "2.7-csv-import", "2.9-data-export", "2.8-sales", "2.1-subaccounts", "2.2-access-approvals", "2.3-sales-documents", "2.4-refunds", "2.5-reservations", "2.6-reports", "3-sales-catalog", "3.9-orders-status-tracking", "3.11-customers", "4-inventory-workspace", "4.2-low-stock-alerts", "7-staff-accounts"]
    : ["2s-staff-dashboard", "3-sales-catalog", "3.9-orders-status-tracking", "3.11-customers", "3.3-sales-documents", "4-inventory-workspace", "4.2-low-stock-alerts", "5-reservations"];

  return (
    <aside className="sidebar sidebar--dashboard">
      <div className="dashboard-sidebar__workspace">
        <span>{admin ? "Workspace" : "Staff workspace"}</span>
        <strong>Second Daze Apparel</strong>
      </div>
      <nav className="dashboard-sidebar__nav" aria-label="Workspace navigation">
        {dashboardNavIds.map((id) => {
          const screen = mainScreens.find((item) => item.id === id);
          return (
            <ScreenLink key={id} screen={screen} className={`nav-link ${active === id ? "is-active" : ""}`} aria-current={active === id ? "page" : undefined}>
              <Icon className="nav-link__icon" name={screenIcon(screen)} size={15} />
              {screen.id === "3-sales-catalog" ? "Sales catalog" : screen.title}
            </ScreenLink>
          );
        })}
      </nav>
      <div className="dashboard-sidebar__focus">
        <strong>Today's focus</strong>
        <span>{admin ? "Review pending approvals and the sales and inventory summary." : "Complete pending orders, restock low items, and confirm today's reservations."}</span>
      </div>
      <div className="sidebar__bottom">
        <button className="nav-link sidebar__sign-out" type="button" onClick={() => onSignOut()} aria-label={`Sign out ${authUser?.username || ""}`}>
          <Icon className="nav-link__icon" name="logout" size={15} />Sign out
        </button>
        <span className="sidebar__note">{authUser?.demo ? "Local preview · data is saved in this browser only" : `Signed in as ${authUser?.role || "Staff"}`}</span>
      </div>
    </aside>
  );
}

const workflowLinks = {
  "2.1-subaccounts": [["Review access requests", "2.2-access-approvals"]],
  "2.2-access-approvals": [["Manage staff accounts", "7-staff-accounts"]],
  "2.3-sales-documents": [["Create purchase order", "3.13-create-purchase-order"], ["Confirm delivery", "3.14-confirm-delivery"]],
  "2.4-refunds": [["Start a refund request", "3.4-new-refund-request"]],
  "2.5-reservations": [["Create reservation", "5.1-new-reservation"]],
  "2.6-reports": [["Open sales and inventory reports", "6-sales-inventory-reports"]],
  "3-sales-catalog": [["Continue to checkout", "3.1-checkout-pending-payment"]],
  "3.1-checkout-pending-payment": [["Record payment", "3.8-checkout-gcash-payment"], ["View orders", "3.9-orders-status-tracking"]],
  "3.2-sale-completed": [["View orders", "3.9-orders-status-tracking"], ["Return to catalog", "3-sales-catalog"]],
  "3.3-sales-documents": [["Create purchase order", "3.13-create-purchase-order"], ["Confirm delivery", "3.14-confirm-delivery"]],
  "3.4-new-refund-request": [["Continue to item review", "3.5-refund-condition-review"], ["Return to refunds", "2.4-refunds"]],
  "3.5-refund-condition-review": [["Send for approval", "3.6-approval-request-detail"]],
  "3.6-approval-request-detail": [["View refund result", "3.7-refund-completed"], ["Return to refunds", "2.4-refunds"]],
  "3.7-refund-completed": [["Return to refunds", "2.4-refunds"]],
  "3.8-checkout-gcash-payment": [["View orders", "3.9-orders-status-tracking"], ["Record payment outcome", "3.2-sale-completed"]],
  "3.9-orders-status-tracking": [["Open order details", "3.10-order-detail-shipment"], ["Create purchase order", "3.13-create-purchase-order"]],
  "3.10-order-detail-shipment": [["Confirm delivery", "3.14-confirm-delivery"], ["View sales documents", "3.3-sales-documents"]],
  "3.11-customers": [["Add customer", "3.12-new-customer-validation"]],
  "3.12-new-customer-validation": [["Continue to purchase order", "3.13-create-purchase-order"], ["Return to customers", "3.11-customers"]],
  "3.13-create-purchase-order": [["Review orders", "3.9-orders-status-tracking"], ["Return to sales documents", "3.3-sales-documents"]],
  "3.14-confirm-delivery": [["View sales documents", "3.3-sales-documents"], ["View orders", "3.9-orders-status-tracking"]],
  "3.15-payment-not-received": [["Retry payment", "3.8-checkout-gcash-payment"], ["Review orders", "3.9-orders-status-tracking"]],
  "4-inventory-workspace": [["Review low stock", "4.2-low-stock-alerts"], ["Edit product", "4.3-edit-product-admin-only"]],
  "4.2-low-stock-alerts": [["Update product stock", "4.3-edit-product-admin-only"], ["Open inventory", "4-inventory-workspace"]],
  "4.3-edit-product-admin-only": [["Review inventory", "4-inventory-workspace"], ["Check low-stock items", "4.2-low-stock-alerts"]],
  "5-reservations": [["Create reservation", "5.1-new-reservation"]],
  "5.1-new-reservation": [["Review reservation outcome", "5.3-reservation-approved"], ["Return to reservations", "5-reservations"]],
  "5.2-expired-reservation-void-notice": [["Review reservations", "5-reservations"]],
  "5.3-reservation-approved": [["Review reservations", "5-reservations"], ["Continue to checkout", "3.1-checkout-pending-payment"]],
  "6-sales-inventory-reports": [["Open report summary", "6.1-sales-inventory-reports-v2"]],
  "6.1-sales-inventory-reports-v2": [["Open sales and inventory reports", "6-sales-inventory-reports"]],
  "7-staff-accounts": [["Manage subaccounts", "2.1-subaccounts"], ["Review access requests", "2.2-access-approvals"]],
  "8.1-mobile-admin-dashboard": [["Review approvals", "8.2-mobile-approvals"], ["Record payment", "8.3-mobile-checkout-gcash"], ["Request reservation", "8.6-mobile-new-reservation"]],
  "8.2-mobile-approvals": [["Review approval confirmation", "9.3-overlay-confirm-approve"]],
  "8.3-mobile-checkout-gcash": [["Review orders", "8.4-mobile-orders"]],
  "8.4-mobile-orders": [["Record payment", "8.3-mobile-checkout-gcash"]],
  "8.5-mobile-low-stock": [["Return to dashboard", "8.1-mobile-admin-dashboard"]],
  "8.6-mobile-new-reservation": [["Review approvals", "8.2-mobile-approvals"]],
};

function WorkflowLinks({ screenId, mobile = false }) {
  const links = workflowLinks[screenId] || [];
  if (!links.length) return null;

  return (
    <nav className={`workflow-links ${mobile ? "workflow-links--mobile" : ""}`} aria-label="Related workflows">
      <h2>{mobile ? "Next steps" : "Related workflows"}</h2>
      <div className="workflow-links__items">
        {links.map(([label, targetId]) => {
          const target = screens.find((item) => item.id === targetId);
          if (!target) return null;
          return (
            <ScreenLink key={targetId} screen={target} className="workflow-link">
              <span>{label}</span><Icon name="arrow" size={15} />
            </ScreenLink>
          );
        })}
      </div>
    </nav>
  );
}

function PageHeader({ screen, authUser }) {
  const staffHome = screen.kind === "staff-dashboard";
  const adminHome = screen.kind === "dashboard";
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{adminHome ? "WORKSPACE OVERVIEW" : staffHome ? "MY WORKSPACE" : "SECOND DAZE / WORKSPACE"}</p>
        <div className="page-header__title-row">
          <span className="page-header__icon"><Icon name={screenIcon(screen)} size={19} /></span>
          <h1>{adminHome ? "Admin dashboard" : staffHome ? "Staff dashboard" : screen.title}</h1>
        </div>
        <p>{adminHome ? "Approvals, reporting, and operational oversight for Second Daze Apparel." : screen.description}</p>
      </div>
      {staffHome && (
        <div className="dashboard-header__actions">
          <ScreenLink className="button button--outline" screen={screens.find((item) => item.id === "5.1-new-reservation")}>
            <Icon name="calendar" size={14} /> New reservation
          </ScreenLink>
          <ScreenLink className="button button--pink" screen={screens.find((item) => item.id === "3-sales-catalog")}>
            <Icon name="plus" size={14} /> New sale
          </ScreenLink>
        </div>
      )}
      {adminHome && (
        <div className="dashboard-header__actions">
          <ScreenLink className="button button--outline" screen={screens.find((item) => item.id === "2.7-csv-import")}>
            <Icon name="file" size={14} /> Import CSV
          </ScreenLink>
          <ScreenLink className="button button--outline" screen={screens.find((item) => item.id === "2.9-data-export")}>
            <Icon name="file" size={14} /> Export records
          </ScreenLink>
          {authUser?.role === "Admin" && (
            <ScreenLink className="button button--pink" screen={screens.find((item) => item.id === "7-staff-accounts")}>
              <Icon name="plus" size={14} /> Create subaccount
            </ScreenLink>
          )}
        </div>
      )}
    </header>
  );
}

function EmptyTable({ screen, overview }) {
  const kind = screenDatasets[screen.id];
  if (kind) {
    const rows = screen.id === "4.2-low-stock-alerts" ? overview?.lowStock : overview?.records?.[kind];
    return <RecordsTable kind={kind} rows={rows} title={screen.title} />;
  }
  const columns = tableColumns[screen.id] || ["Name", "Details", "Status", "Action"];
  return (
    <div className="panel table-panel">
      <div className="panel__top">
        <div>
          <h2>{screen.title}</h2>
          <p>Records will appear here when connected to the backend.</p>
        </div>
        <span className="quiet-tag">No records</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
          <tbody>
            <tr><td className="empty-cell" colSpan={columns.length}>No records to display yet.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WorkspaceSyncStatus({ overviewState, onRefresh }) {
  if (overviewState.error) {
    return (
      <p className="sync-status sync-status--error" role="alert">
        Could not load workspace data. {overviewState.error}
        <button className="sync-status__retry" type="button" onClick={onRefresh}>Retry</button>
      </p>
    );
  }
  return (
    <div className="sync-status">
      <span>{overviewState.status === "loading" ? "Loading workspace data…" : overviewState.status === "local" ? `Browser-only data · last import ${formatUpdatedAt(overviewState.data?.updatedAt)}` : `Last synced ${formatUpdatedAt(overviewState.data?.updatedAt)}`}</span>
      <button className="sync-status__refresh" type="button" onClick={onRefresh} disabled={overviewState.status === "loading"} aria-label="Refresh shared workspace data">
        <Icon name="refresh" size={14} />Refresh
      </button>
    </div>
  );
}

function formatUpdatedAt(value) {
  if (!value) return "not yet";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "not yet";
  return timestamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatQueueCount(count, label = "item") {
  return `${count} ${count === 1 ? label : `${label}s`}`;
}

function Dashboard({ overviewState, onRefresh, search }) {
  const queues = overviewState.data?.queues;
  const summary = overviewState.data?.metrics;
  const metrics = [
    { label: "Gross sales", value: formatMoney(summary?.grossSales), detail: "All imported sales", icon: "bag" },
    { label: "Total cost", value: formatMoney(summary?.totalCost), detail: "Recorded cost of imported sales", icon: "box" },
    { label: "Profit", value: formatMoney(summary?.profit), detail: "Gross sales minus recorded cost", icon: "chart" },
    {
      label: "Access approvals",
      value: typeof queues?.accessApprovals === "number" ? queues.accessApprovals : "—",
      detail: "Staff access requests awaiting review",
      icon: "calendar",
    },
  ];
  const weeklySales = overviewState.data?.dailySales || [];
  const chartMaximum = Math.max(1, ...weeklySales.map(([, value]) => value));
  const requests = (overviewState.data?.recentActivity || []).map((activity) => ({
    title: activity.message,
    detail: formatUpdatedAt(activity.createdAt),
  }));
  const filteredRequests = requests.filter((request) =>
    `${request.title} ${request.detail}`.toLowerCase().includes(search.toLowerCase()),
  );
  const orderStats = [
    { label: "Orders placed", value: summary?.ordersPlaced ?? "—", detail: "All imported orders" },
    { label: "Avg order value", value: formatMoney(summary?.averageOrderValue), detail: "Average imported order amount" },
    { label: "Fulfillment rate", value: typeof summary?.fulfillmentRate === "number" ? `${summary.fulfillmentRate.toFixed(1)}%` : "—", detail: "Completed / non-cancelled orders" },
  ];

  return (
    <div className="dashboard-workspace">
      <div className="dashboard-metrics">
        {metrics.map((metric) => (
          <article className="panel dashboard-metric" key={metric.label}>
            <div className="dashboard-metric__top">
              <span>{metric.label}</span>
              <span className="dashboard-metric__icon"><Icon name={metric.icon} size={15} /></span>
            </div>
            <strong>{metric.value}</strong>
            <p>{metric.detail}</p>
          </article>
        ))}
      </div>
      <div className="dashboard-overview-grid">
        <div className="dashboard-overview-main">
          <section className="panel dashboard-orders">
            <div className="panel__top">
              <div><h2>Orders</h2><p>Transaction hub for revenue, cost, and profit</p></div>
              <span className="quiet-tag">{overviewState.status === "local" ? "Imported data" : "Live overview"}</span>
            </div>
            <div className="dashboard-order-stats">
              {orderStats.map((stat) => (
                <div className="dashboard-order-stat" key={stat.label}>
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                  <small>{stat.detail}</small>
                </div>
              ))}
            </div>
            {weeklySales.length ? (
              <div className="dashboard-chart" role="img" aria-label={`Sales by date: ${weeklySales.map(([day, value]) => `${day}: ${formatMoney(value)}`).join(", ")}`}>
                {weeklySales.map(([day, value]) => (
                  <div className="dashboard-chart__day" key={day}>
                    <span className="dashboard-chart__amount" title={formatMoney(value)}>{formatMoney(value)}</span>
                    <span className="dashboard-chart__bar" style={{ height: `${(value / chartMaximum) * 100}%` }} />
                    <span className="dashboard-chart__label" title={day}>{day.slice(5)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dashboard-chart-empty">
                No sales recorded. Import sales data to display trends.
              </div>
            )}
          </section>
          <section className="panel dashboard-requests">
            <div className="panel__top">
              <div><h2>Recent activity</h2><p>Latest recorded workspace activity</p></div>
              <ScreenLink className="text-link" screen={screens.find((item) => item.id === "2.6-reports")}>View reports</ScreenLink>
            </div>
            {filteredRequests.length ? (
              <div className="dashboard-request-list">
                {filteredRequests.map((request, index) => {
                  const content = (
                    <>
                      <span className="dashboard-request__icon"><Icon name={index === 0 ? "file" : index === 1 ? "refresh" : "calendar"} size={14} /></span>
                      <span className="dashboard-request__copy"><strong>{request.title}</strong><small>{request.detail}</small></span>
                    </>
                  );
                  return request.screenId ? (
                    <ScreenLink className="dashboard-request" screen={screens.find((item) => item.id === request.screenId)} key={`${request.title}-${index}`}>{content}</ScreenLink>
                  ) : (
                    <div className="dashboard-request" key={`${request.title}-${index}`}>{content}</div>
                  );
                })}
              </div>
            ) : (
              <div className="dashboard-empty">{search ? "No activity matches your search." : "No recent activity is available."}</div>
            )}
          </section>
        </div>
        <aside className="dashboard-overview-side">
          <section className="panel dashboard-approvals">
            <div className="panel__top">
              <div><h2>Approvals</h2><p>Requests that need admin review</p></div>
              <span className="quiet-tag">{`${queues?.accessApprovals ?? "—"} pending`}</span>
            </div>
            <div className="dashboard-approval-summary">
              <strong>{typeof queues?.accessApprovals === "number" ? formatQueueCount(queues.accessApprovals, "access request") : "Access requests"}</strong>
              <span>{overviewState.status === "error" ? "Workspace data could not be loaded." : overviewState.status === "local" ? "Account access approvals require a backend and are not available in browser-only mode." : "Open the approval queue to review staff access requests."}</span>
              <ScreenLink className="button button--pink" screen={screens.find((item) => item.id === "2.2-access-approvals")}>Review approvals</ScreenLink>
            </div>
          </section>
          <section className="panel dashboard-status">
            <div className="panel__top"><div><h2>Status clarity</h2><p>Unambiguous states for every request</p></div></div>
            <div className="dashboard-status-list">
              <div><span className="dashboard-status__icon"><Icon name="clock" size={14} /></span><span><strong>Pending</strong><small>Needs admin review before release</small></span></div>
              <div><span className="dashboard-status__icon"><Icon name="check" size={14} /></span><span><strong>Approved</strong><small>Released to the next operational step</small></span></div>
              <div><span className="dashboard-status__icon"><Icon name="close" size={14} /></span><span><strong>Rejected</strong><small>Blocked with reason and follow-up note</small></span></div>
            </div>
          </section>
          <div className="dashboard-sync">
            <WorkspaceSyncStatus overviewState={overviewState} onRefresh={onRefresh} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function StaffDashboard({ overviewState, onRefresh, search }) {
  const queues = overviewState.data?.queues;
  const summary = overviewState.data?.metrics;
  const count = (value) => (typeof value === "number" ? value : "—");
  const metrics = [
    { label: "Orders to fulfill", value: count(queues?.ordersToFulfill), detail: "Awaiting packing or dispatch", icon: "bag" },
    { label: "Today's sales", value: formatMoney(summary?.todaysSales), detail: "Sales recorded today", icon: "chart" },
    { label: "Low stock items", value: count(queues?.lowStockItems), detail: "At or below threshold", icon: "box" },
    { label: "Active reservations", value: count(summary?.activeReservations), detail: "Unexpired holds awaiting action", icon: "calendar" },
  ];
  const matches = (item) => `${item.title} ${item.detail}`.toLowerCase().includes(search.toLowerCase());
  const tasks = (overviewState.data?.pendingOrders || []).map((order) => ({
    title: order.order_no, detail: `${order.customer_code} · ${formatMoney(order.total_amount)}`,
    status: order.status, screenId: "3.9-orders-status-tracking",
  })).filter(matches);
  const lowStock = (overviewState.data?.lowStock || []).map((product) => ({
    title: product.product_name, detail: `${product.sku} · ${product.qty_available} left · threshold ${product.low_stock_threshold}`,
  })).filter(matches);
  const reservations = (overviewState.data?.reservations || []).map((reservation) => ({
    title: reservation.reservation_no, detail: `${reservation.customer_code} · ${reservation.status} · expires ${reservation.expires_at}`,
  })).filter(matches);
  const activity = (overviewState.data?.recentActivity || []).map((item) => ({ title: item.message, detail: formatUpdatedAt(item.createdAt) })).filter(matches);
  const quickActions = [
    ["3-sales-catalog", "Start a sale", "bag"],
    ["3.4-new-refund-request", "New refund request", "refresh"],
    ["3.12-new-customer-validation", "Add customer", "users"],
    ["4-inventory-workspace", "View inventory", "box"],
  ];

  return (
    <div className="dashboard-workspace">
      <div className="dashboard-metrics">
        {metrics.map((metric) => (
          <article className="panel dashboard-metric" key={metric.label}>
            <div className="dashboard-metric__top">
              <span>{metric.label}</span>
              <span className="dashboard-metric__icon"><Icon name={metric.icon} size={15} /></span>
            </div>
            <strong>{metric.value}</strong>
            <p>{metric.detail}</p>
          </article>
        ))}
      </div>
      <div className="dashboard-overview-grid">
        <div className="dashboard-overview-main">
          <section className="panel dashboard-requests">
            <div className="panel__top">
              <div><h2>Orders to follow up</h2><p>Recorded orders that need fulfillment</p></div>
              <ScreenLink className="text-link" screen={screens.find((item) => item.id === "3.9-orders-status-tracking")}>View orders</ScreenLink>
            </div>
            {(overviewState.status === "local" ? tasks : activity).length ? (
              <div className="dashboard-request-list">
                {(overviewState.status === "local" ? tasks : activity).map((task) => {
                  const content = (
                    <>
                      <span className="dashboard-request__icon"><Icon name="file" size={14} /></span>
                      <span className="dashboard-request__copy"><strong>{task.title}</strong><small>{task.detail}</small></span>
                      {task.status && <span className="dashboard-request__status">{task.status}</span>}
                    </>
                  );
                  return task.screenId ? (
                    <ScreenLink className="dashboard-request" screen={screens.find((item) => item.id === task.screenId)} key={task.title}>{content}</ScreenLink>
                  ) : (
                    <div className="dashboard-request" key={`${task.title}-${task.detail}`}>{content}</div>
                  );
                })}
              </div>
            ) : (
              <div className="dashboard-empty">{search ? "No tasks match your search." : overviewState.data ? "No recorded orders need follow-up." : "Order data is not available."}</div>
            )}
          </section>
          <section className="panel dashboard-requests">
            <div className="panel__top">
              <div><h2>Low stock</h2><p>Restock these items before they sell out</p></div>
              <ScreenLink className="text-link" screen={screens.find((item) => item.id === "4.2-low-stock-alerts")}>View all</ScreenLink>
            </div>
            {lowStock.length ? (
              <div className="dashboard-request-list">
                {lowStock.map((item) => (
                  <div className="dashboard-request" key={item.title}>
                    <span className="dashboard-request__icon"><Icon name="box" size={14} /></span>
                    <span className="dashboard-request__copy"><strong>{item.title}</strong><small>{item.detail}</small></span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty">{search ? "No low-stock items match your search." : overviewState.status === "local" ? "No imported items are below their threshold." : "Open Low stock to view available inventory data."}</div>
            )}
          </section>
        </div>
        <aside className="dashboard-overview-side">
          <section className="panel dashboard-approvals">
            <div className="panel__top"><div><h2>Quick actions</h2><p>Common sales and inventory tasks</p></div></div>
            <div className="dashboard-approval-list">
              {quickActions.map(([id, label, icon]) => (
                <ScreenLink className="dashboard-approval" screen={screens.find((item) => item.id === id)} key={id}>
                  <span className="dashboard-approval__icon"><Icon name={icon} size={14} /></span>
                  <span><strong>{label}</strong></span>
                </ScreenLink>
              ))}
            </div>
          </section>
          <section className="panel dashboard-status">
            <div className="panel__top">
              <div><h2>Reservations</h2><p>Holds that need follow-up</p></div>
              <ScreenLink className="text-link" screen={screens.find((item) => item.id === "5-reservations")}>View</ScreenLink>
            </div>
            <div className="dashboard-status-list">
              {reservations.length ? reservations.map((item) => (
                <div key={item.title}>
                  <span className="dashboard-status__icon"><Icon name="clock" size={14} /></span>
                  <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                </div>
              )) : <div className="dashboard-empty">{search ? "No reservations match your search." : overviewState.data ? "No recorded active reservations." : "Reservation data is not available."}</div>}
            </div>
          </section>
          <div className="dashboard-sync">
            <WorkspaceSyncStatus overviewState={overviewState} onRefresh={onRefresh} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function FormPanel({ screen, mobile = false, authUser, onActionSaved }) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fields = formFields[screen.id] || ["Customer", "Order reference", "Details"];
  return (
    <form className={`panel form-panel ${mobile ? "form-panel--mobile" : ""}`} onSubmit={async (event) => {
      event.preventDefault();
      if (authUser?.demo) {
        setMessage("Demo preview only. This action was not saved.");
        return;
      }

      const values = Object.fromEntries(new FormData(event.currentTarget).entries());
      setSubmitting(true);
      setMessage("");
      try {
        await submitWorkspaceAction({
          source: mobile ? "mobile" : "admin",
          screenId: screen.id,
          values,
        });
        setMessage("Saved to the shared workspace.");
        onActionSaved();
      } catch (error) {
        setMessage(error.message || "Unable to save this workspace action.");
      } finally {
        setSubmitting(false);
      }
    }}>
      <div className="panel__top">
        <div><h2>{screen.title}</h2><p>Complete the fields below to preview this workflow.</p></div>
        {!mobile && <span className="quiet-tag">Preview only</span>}
      </div>
      <div className="form-grid">
        {fields.map((field, index) => (
          <label className={field.toLowerCase().includes("note") || field.toLowerCase().includes("address") ? "field field--wide" : "field"} key={field}>
            <span>{field}</span>
            {field.toLowerCase().includes("note") || field.toLowerCase().includes("address") || field.toLowerCase().includes("reason") ? (
              <textarea name={field} rows="3" placeholder={`Enter ${field.toLowerCase()}`} />
            ) : (
              <input name={field} type={field.toLowerCase().includes("date") ? "date" : "text"} placeholder={`Enter ${field.toLowerCase()}`} />
            )}
          </label>
        ))}
      </div>
      <div className="form-actions">
        {message && <span className="form-note" role="status">{message}</span>}
        <button className="button button--primary" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : mobile ? "Continue" : authUser?.demo ? "Save preview" : "Save"}
        </button>
      </div>
    </form>
  );
}

function DetailPanel({ screen, success = false }) {
  return (
    <section className={`panel detail-panel ${success ? "detail-panel--success" : ""}`}>
      <span className="detail-panel__icon" aria-hidden="true">{success ? "✓" : "i"}</span>
      <p className="eyebrow">{success ? "WORKFLOW COMPLETE" : "DETAIL PREVIEW"}</p>
      <h2>{screen.title}</h2>
      <p>{screen.description}</p>
      <div className="detail-placeholder">
        <span>Reference</span><strong>Will be assigned when connected to the backend</strong>
      </div>
      <span className="quiet-tag">No transaction data</span>
    </section>
  );
}

function AuthScreen({ screen, onAuthenticated }) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pending = screen.kind === "pending";
  const forgot = screen.kind === "auth-forgot";
  const showError = screen.kind === "auth-error";
  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (forgot) {
      setMessage("Password reset is not connected in this prototype.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const result = await signIn({
        username: String(formData.get("username") || "").trim(),
        password: String(formData.get("password") || ""),
      });
      if (result.status === "authenticated") {
        onAuthenticated(result.user, result.demo);
        window.location.hash = `/${homeId(result.user)}`;
      } else if (result.status === "pending") {
        window.location.hash = "/1.2-access-awaiting-approval";
      } else {
        window.location.hash = "/1.1-sign-in-error";
      }
    } catch (error) {
      setMessage(error.message || "Unable to contact the sign-in service.");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="auth-page">
      <div className="auth-art">
        <Brand />
        <div className="auth-art__copy">
          <p className="eyebrow">APPAREL ACCESS PORTAL</p>
          <h1>Good to<br /><em>see you.</em></h1>
          <p>Sign in to your Second Daze workspace.</p>
        </div>
        <span className="auth-art__foot">SECOND DAZE APPAREL</span>
      </div>
      <section className="auth-content">
        {(forgot || showError) && (
          <ScreenLink className="text-link auth-content__back" screen={screens.find((item) => item.id === "1-staff-sign-in")}>
            {forgot ? "← Sign in" : "← Try again"}
          </ScreenLink>
        )}
        {pending ? (
          <div className="auth-card">
            <span className="detail-panel__icon"><Icon name="users" size={22} /></span>
            <p className="eyebrow">ACCESS REQUEST</p>
            <h2>Awaiting approval</h2>
            <p>An Admin must approve your subaccount before you can enter the workspace.</p>
            <a className="button button--primary" href="#/1-staff-sign-in">Return to sign in</a>
          </div>
        ) : (
          <form className="auth-card" onSubmit={handleSubmit}>
            <p className="eyebrow">{forgot ? "ACCOUNT RECOVERY" : "WELCOME BACK"}</p>
            <h2>{forgot ? "Reset your password" : "Staff sign-in"}</h2>
            <p>{forgot ? "Request password-reset instructions for your staff account." : "Use your staff account to access the workspace."}</p>
            {showError && <p className="inline-error" role="alert">Email or password was not recognized. Check your details and try again.</p>}
            <label className="field"><span>Username</span><input name="username" type="text" autoComplete="username" required placeholder="Enter your username" /></label>
            {!forgot && <label className="field"><span>Password</span><input name="password" type="password" required placeholder="Enter your password" /></label>}
            {message && <p className="form-note" role="status">{message}</p>}
            <button type="submit" className="button button--primary" disabled={submitting}>
              <Icon name={forgot ? "arrow" : "key"} size={15} />
              {submitting ? "Signing in…" : forgot ? "Request reset" : "Sign in"}
            </button>
            {!forgot && <ScreenLink className="text-link auth-card__link" screen={screens.find((item) => item.id === "1.3-forgot-password")}>Forgot password?</ScreenLink>}
            <p className="auth-card__hint">
              {demoLoginEnabled
                ? <>Demo login: <code>admin</code> / <code>admin</code> or <code>staff</code> / <code>staff</code>. Business data starts empty and stays in this browser. Use <code>pending@demo.local</code> with any password to preview approval.</>
                : "Sign-in is handled by the configured backend."}
            </p>
          </form>
        )}
      </section>
    </main>
  );
}

function MobileLogin({ onAuthenticated }) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <form className="mobile-login" onSubmit={async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      setSubmitting(true);
      setMessage("");
      try {
        const result = await signIn({
          username: String(formData.get("username") || "").trim(),
          password: String(formData.get("password") || ""),
        });
        if (result.status === "authenticated") {
          onAuthenticated(result.user, result.demo);
          window.location.hash = "/8.1-mobile-admin-dashboard";
        } else if (result.status === "pending") {
          setMessage("Your access request is awaiting approval from an Admin.");
        } else {
          setMessage("Username or password was not recognized.");
        }
      } catch (error) {
        setMessage(error.message || "Unable to contact the sign-in service.");
      } finally {
        setSubmitting(false);
      }
    }}>
      <h2>Sign in</h2>
      <p>Use your staff account to access the workspace.</p>
      {demoLoginEnabled && <p className="form-note">Demo login: <strong>admin</strong> / <strong>admin</strong>.</p>}
      <label className="field"><span>Username</span><input name="username" type="text" autoComplete="username" placeholder="Enter your username" required /></label>
      <label className="field"><span>Password</span><input name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required /></label>
      {message && <span className="form-note" role="status">{message}</span>}
      <button type="submit" className="button button--primary" disabled={submitting}>
        <Icon name="key" size={15} />{submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function MobileContent({ screen, onAuthenticated, overviewState, onRefresh, authUser }) {
  if (screen.kind === "mobile-form") {
    return <FormPanel key={screen.id} screen={screen} mobile authUser={authUser} onActionSaved={onRefresh} />;
  }
  if (screen.kind === "mobile-auth") {
    return <MobileLogin onAuthenticated={onAuthenticated} />;
  }
  if (screen.kind === "mobile-list" || screen.kind === "mobile-stock") {
    if (overviewState.status === "local" && screen.id !== "8.2-mobile-approvals") {
      const kind = screen.kind === "mobile-stock" ? "products" : "orders";
      const rows = kind === "products" ? overviewState.data.lowStock : overviewState.data.records.orders;
      return <RecordsTable kind={kind} rows={rows} />;
    }
    const count = screen.id === "8.2-mobile-approvals"
      ? overviewState.data?.queues.accessApprovals
      : screen.id === "8.4-mobile-orders"
        ? overviewState.data?.queues.ordersToFulfill
        : overviewState.data?.queues.lowStockItems;
    return (
      <section className="mobile-worklist">
        <div className="mobile-worklist__heading">
          <h2>{screen.kind === "mobile-stock" ? "Stock alerts" : screen.id === "8.2-mobile-approvals" ? "Approval queue" : "Order queue"}</h2>
          <span className="quiet-tag">All items</span>
        </div>
        <div className="mobile-empty">
          <strong>{typeof count === "number" ? formatQueueCount(count) : "No records to display"}</strong>
          <span>{overviewState.status === "local" ? "Account access approvals require a backend." : typeof count === "number" ? "This queue is shared with the operations workspace." : "Connect the workspace data source to load this queue."}</span>
        </div>
      </section>
    );
  }
  return (
    <div className="mobile-dashboard">
      <WorkspaceSyncStatus overviewState={overviewState} onRefresh={onRefresh} />
      <section className="mobile-worklist">
        <div className="mobile-worklist__heading">
          <h2>Needs attention</h2>
          <ScreenLink className="text-link" screen={mobileScreens.find((item) => item.id === "8.2-mobile-approvals")}>View approvals</ScreenLink>
        </div>
        <div className="mobile-empty">
          <strong>{typeof overviewState.data?.queues.accessApprovals === "number"
            ? formatQueueCount(overviewState.data.queues.accessApprovals, "access request")
            : "— access requests"}</strong>
          <span>{overviewState.status === "local" ? "Account access approvals are not available in browser-only mode." : overviewState.data ? "Shared workspace data, refreshed automatically." : "Connect the workspace data source to load assigned items."}</span>
        </div>
      </section>
      <section className="mobile-quick-actions">
        <h2>Quick actions</h2>
        <ScreenLink screen={mobileScreens.find((item) => item.id === "8.3-mobile-checkout-gcash")}>Record GCash payment <span aria-hidden="true">→</span></ScreenLink>
        <ScreenLink screen={mobileScreens.find((item) => item.id === "8.6-mobile-new-reservation")}>Request reservation <span aria-hidden="true">→</span></ScreenLink>
      </section>
      <section className="mobile-worklist">
        <div className="mobile-worklist__heading"><h2>Orders</h2><ScreenLink className="text-link" screen={mobileScreens.find((item) => item.id === "8.4-mobile-orders")}>View orders</ScreenLink></div>
        <p className="mobile-inline-empty">{overviewState.data
          ? `${formatQueueCount(overviewState.data.queues.ordersToFulfill, "order")} ${overviewState.data.queues.ordersToFulfill === 1 ? "needs" : "need"} follow-up in the ${overviewState.status === "local" ? "browser-only" : "shared"} workspace.`
          : "Order data will appear here when available."}</p>
      </section>
    </div>
  );
}

function MobilePreview({ screen, onAuthenticated, authUser, onSignOut, overviewState, onRefresh }) {
  const isOverlay = screen.group === "Mobile overlays";
  const confirm = screen.kind === "confirm";
  const returnScreenIds = {
    "9-overlay-notifications-admin": "8.1-mobile-admin-dashboard",
    "9.1-overlay-notifications-sales": "8.4-mobile-orders",
    "9.2-overlay-notifications-inventory": "8.5-mobile-low-stock",
    "9.3-overlay-confirm-approve": "8.2-mobile-approvals",
  };
  const underlayScreen = isOverlay
    ? mobileScreens.find((item) => item.id === returnScreenIds[screen.id])
    : screen;
  const notificationScreenIds = {
    "8.3-mobile-checkout-gcash": "9.1-overlay-notifications-sales",
    "8.4-mobile-orders": "9.1-overlay-notifications-sales",
    "8.5-mobile-low-stock": "9.2-overlay-notifications-inventory",
  };
  const notificationScreen = screens.find((item) =>
    item.id === (isOverlay ? screen.id : notificationScreenIds[underlayScreen.id] || "9-overlay-notifications-admin"),
  );
  const [confirmationMessage, setConfirmationMessage] = useState("");
  return (
    <main className="mobile-app-view">
      <div className="mobile-app-shell" aria-hidden={isOverlay} inert={isOverlay}>
        <header className="mobile-app-header">
          <Brand compact to={authUser ? "#/8.1-mobile-admin-dashboard" : "#/8-mobile-sign-in"} />
          {screen.kind !== "mobile-auth" && (
            <ScreenLink className={`mobile-notifications ${isOverlay ? "is-current" : ""}`} screen={notificationScreen} aria-label="Notifications">
              <Icon name="bell" size={16} /><span className="mobile-notifications__label">Notifications</span>
            </ScreenLink>
          )}
          {screen.kind !== "mobile-auth" && (
            <button className="mobile-avatar" type="button" onClick={() => onSignOut()} aria-label={`Sign out ${authUser?.username || ""}`}>
              <Icon name="logout" size={14} />
            </button>
          )}
        </header>
        <section className="mobile-app-content">
          {screen.kind !== "mobile-auth" && (
            <header className="mobile-page-heading">
              <h1>{underlayScreen.title}</h1>
              <p>{underlayScreen.description}</p>
            </header>
          )}
          <MobileContent
            screen={underlayScreen}
            onAuthenticated={onAuthenticated}
            overviewState={overviewState}
            onRefresh={onRefresh}
            authUser={authUser}
          />
          <WorkflowLinks screenId={underlayScreen.id} mobile />
        </section>
        {screen.kind !== "mobile-auth" && (
          <nav className="mobile-tabs" aria-label="Mobile navigation">
            {mobileTabs.map((tab) => (
              <ScreenLink key={tab.id} screen={tab} className={underlayScreen.id === tab.id ? "is-active" : ""}>
                <Icon name={tab.icon} size={17} />{tab.label}
              </ScreenLink>
            ))}
          </nav>
        )}
      </div>
      {isOverlay && (
        <div className="mobile-overlay-scrim">
          <section className="mobile-overlay-panel" role="dialog" aria-modal="true" aria-labelledby="mobile-overlay-title">
            <header className="mobile-overlay-header">
              <div><p className="eyebrow">{confirm ? "APPROVAL" : "NOTIFICATIONS"}</p><h2 id="mobile-overlay-title">{screen.title}</h2></div>
              <ScreenLink className="modal-close" screen={underlayScreen} aria-label="Close overlay"><span aria-hidden="true">×</span></ScreenLink>
            </header>
            <p className="mobile-overlay-copy">{screen.description}</p>
            {confirm ? (
              <>
                <div className="approval-summary">
                  <span>Selected request</span>
                  <strong>Request details will appear when connected to live data.</strong>
                </div>
                {confirmationMessage && <p className="form-note" role="status">{confirmationMessage}</p>}
                <div className="mobile-overlay-actions">
                  <ScreenLink className="button button--subtle" screen={underlayScreen}>Cancel</ScreenLink>
                  <button className="button button--primary" type="button" onClick={() => setConfirmationMessage("No approval was saved; this action requires a connected backend.")}>Confirm approval</button>
                </div>
              </>
            ) : (
              <div className="mobile-empty mobile-empty--overlay">
                <strong>No notifications</strong>
                <span>Updates will appear here when notification data is available.</span>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function MainPreview({ screen, authUser, onAuthenticated, onSignOut, overviewState, onRefresh }) {
  const [dashboardSearch, setDashboardSearch] = useState("");
  if (screen.kind.startsWith("auth") || screen.kind === "pending") {
    return <AuthScreen key={screen.id} screen={screen} onAuthenticated={onAuthenticated} />;
  }
  const isDashboard = screen.kind === "dashboard" || screen.kind === "staff-dashboard";
  return (
    <div className="app-shell app-shell--dashboard">
      <DashboardTopbar authUser={authUser} search={dashboardSearch} onSearch={isDashboard ? setDashboardSearch : undefined} onSignOut={onSignOut} />
      <Sidebar active={screen.id} authUser={authUser} onSignOut={onSignOut} />
      <main className="workspace">
        <PageHeader screen={screen} authUser={authUser} />
        <div className="workspace__body">
          {authUser?.demo && <p className="data-notice">Local preview: records are saved only in this browser, not shared with other devices. No sample business data is loaded.</p>}
          {overviewState.error && !isDashboard && <WorkspaceSyncStatus overviewState={overviewState} onRefresh={onRefresh} />}
          {screen.kind === "dashboard" && <Dashboard overviewState={overviewState} onRefresh={onRefresh} search={dashboardSearch} />}
          {screen.kind === "staff-dashboard" && <StaffDashboard overviewState={overviewState} onRefresh={onRefresh} search={dashboardSearch} />}
          {screen.kind === "csv-import" && (authUser?.demo
            ? <CsvImportPanel authUser={authUser} onImported={onRefresh} />
            : <p role="alert">Browser CSV import is available only in local preview mode. Shared backend import is not configured.</p>)}
          {screen.kind === "data-export" && <DataExportPanel authUser={authUser} />}
          {screen.kind === "table" && <EmptyTable screen={screen} overview={overviewState.data} />}
          {screen.kind === "catalog" && <RecordsTable kind="products" rows={overviewState.data?.records?.products} title="Product catalog" />}
          {screen.kind === "form" && <FormPanel key={screen.id} screen={screen} authUser={authUser} onActionSaved={onRefresh} />}
          {screen.kind === "detail" && <DetailPanel screen={screen} />}
          {screen.kind === "success" && <DetailPanel screen={screen} success />}
          {screen.kind === "reports" && <DataReports overview={overviewState.data} />}
          <WorkflowLinks screenId={screen.id} />
        </div>
        <footer className="workspace__footer"><span>Second Daze Apparel</span><span>Operations workspace</span></footer>
      </main>
    </div>
  );
}

export default function App() {
  const [authUser, setAuthUser] = useState(readAuthUser);
  const [currentId, setCurrentId] = useState(() => routeId());
  const [authError, setAuthError] = useState("");
  const [overviewState, setOverviewState] = useState({ status: "loading", data: null, error: "" });
  const [overviewRefresh, setOverviewRefresh] = useState(0);
  useEffect(() => {
    const updateRoute = () => setCurrentId(routeId());
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
  }, []);
  useEffect(() => {
    const syncAuth = (event) => {
      if (event.key === STORAGE_KEY || event.key === null) setOverviewRefresh((previous) => previous + 1);
      if (event.key !== STORAGE_KEY) setAuthUser(readAuthUser());
    };
    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, []);
  useEffect(() => {
    if (!authUser) {
      setOverviewState({ status: "idle", data: null, error: "" });
      return undefined;
    }
    if (authUser.demo) {
      const refreshLocal = () => {
        try {
          setOverviewState({ status: "local", data: buildOverview(readWorkspace()), error: "" });
        } catch (error) {
          setOverviewState({ status: "error", data: null, error: error.message || "Unable to load saved browser data." });
        }
      };
      refreshLocal();
      const intervalId = window.setInterval(refreshLocal, 30000);
      return () => window.clearInterval(intervalId);
    }

    const controller = new AbortController();
    setOverviewState({ status: "loading", data: null, error: "" });
    const refresh = async () => {
      setOverviewState((previous) => ({
        ...previous,
        status: previous.data ? "refreshing" : "loading",
        error: "",
      }));
      try {
        const data = await getWorkspaceOverview({ signal: controller.signal });
        setOverviewState({ status: "ready", data, error: "" });
      } catch (error) {
        if (error.name !== "AbortError") {
          setOverviewState((previous) => ({
            ...previous,
            status: previous.data ? "ready" : "error",
            error: error.message || "Unable to load shared workspace data.",
          }));
        }
      }
    };

    refresh();
    const intervalId = window.setInterval(refresh, 30000);
    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [authUser?.demo, authUser?.username, overviewRefresh]);

  const authenticateUser = (user, demo) => {
    const normalizedUser = { ...user, role: user.role || "Staff", demo };
    saveAuthUser(normalizedUser);
    setAuthUser(normalizedUser);
    setAuthError("");
  };
  const handleSignOut = async (returnTo = "1-staff-sign-in") => {
    try {
      await signOut(authUser || { demo: true });
      clearAuthUser();
      setAuthUser(null);
      setAuthError("");
      window.location.hash = `/${returnTo}`;
    } catch (error) {
      setAuthError(error.message || "Unable to sign out.");
    }
  };

  const requestedId = !currentId || currentId === "screens"
    ? authUser ? homeId(authUser) : "1-staff-sign-in"
    : currentId === "mobile" ? "8-mobile-sign-in" : currentId;
  const requestedScreen = screens.find((item) => item.id === requestedId)
    || screens.find((item) => item.id === "1-staff-sign-in");
  const wrongRole = authUser && requestedScreen.group === "Main system" && (
    (!isAdmin(authUser) && adminOnlyIds.has(requestedScreen.id))
    || (isAdmin(authUser) && requestedScreen.id === "2s-staff-dashboard")
  );
  const publicScreen = requestedScreen.kind.startsWith("auth") || requestedScreen.kind === "pending";
  const mobileScreen = requestedScreen.group !== "Main system";
  const signInRoute = mobileScreen ? "8-mobile-sign-in" : "1-staff-sign-in";
  const requiresAuthentication = !publicScreen && requestedScreen.id !== "8-mobile-sign-in";
  useEffect(() => {
    if (authUser && requestedScreen.id === "8-mobile-sign-in") {
      window.location.hash = "/8.1-mobile-admin-dashboard";
      return;
    }
    if (authUser && requestedScreen.id === "1-staff-sign-in") {
      window.location.hash = `/${homeId(authUser)}`;
      return;
    }
    if (wrongRole) {
      window.location.hash = `/${homeId(authUser)}`;
      return;
    }
    if (!authUser && requiresAuthentication) {
      window.location.hash = `/${signInRoute}`;
    }
  }, [authUser, requestedId, requestedScreen.id, requiresAuthentication, signInRoute, wrongRole]);

  const screen = !authUser && requiresAuthentication
    ? screens.find((item) => item.id === signInRoute)
    : wrongRole ? screens.find((item) => item.id === homeId(authUser)) : requestedScreen;

  if (screen.group !== "Main system") {
    return (
      <>
        {authError && <p className="global-error" role="alert">{authError}</p>}
        <MobilePreview
          key={screen.id}
          screen={screen}
          onAuthenticated={authenticateUser}
          authUser={authUser}
          onSignOut={() => handleSignOut("8-mobile-sign-in")}
          overviewState={overviewState}
          onRefresh={() => setOverviewRefresh((current) => current + 1)}
        />
      </>
    );
  }
  return (
    <>
      {authError && <p className="global-error" role="alert">{authError}</p>}
      <MainPreview
        screen={screen}
        authUser={authUser}
        onAuthenticated={authenticateUser}
        onSignOut={handleSignOut}
        overviewState={overviewState}
        onRefresh={() => setOverviewRefresh((current) => current + 1)}
      />
    </>
  );
}
