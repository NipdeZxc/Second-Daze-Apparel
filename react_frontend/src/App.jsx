import { useEffect, useRef, useState } from "react";
import { formFields, screens, tableColumns } from "./screens.js";
import { changePassword, getCurrentUser, requestPasswordReset, resetPassword, signIn, signOut } from "./api/auth.js";
import { canAccessScreen, homeScreenForRole, navigationForRole, normalizeRole } from "./roles.js";
import { DataReports, formatMoney, RecordsTable, screenDatasets } from "./DataPanels.jsx";
import { approveUser, createUser, disableUser, enableUser, listUsers, resetUserPassword } from "./api/users.js";
import { downloadTableExport, exportableTables } from "./api/export.js";

const mainScreens = screens.filter((screen) => screen.group === "Main system");
const iconPaths = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  bag: <><path d="M5 8h14l1 13H4L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  box: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 8 9 5 9-5M3 8v9l9 5 9-5V8M12 13v9" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  chart: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 6-7" /></>,
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

function isAdmin(user) {
  return user?.role === "Admin";
}

function homeId(user) {
  return homeScreenForRole(user?.role);
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
      <ScreenLink className="dashboard-notifications" screen={screens.find((item) => item.id === "9-notifications")} aria-label="Open notifications">
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
  if (["2-admin-dashboard", "3-sales-dashboard", "4-inventory-dashboard"].includes(screen.id)) return "home";
  if (screen.kind === "notifications") return "bell";
  if (screen.id === "2.4-refunds" || screen.id.startsWith("2.3-")) return "bag";
  if (screen.id === "2.5-reservations") return "calendar";
  if (screen.id === "2.6-reports") return "chart";
  const section = screen.id.split(/[.-]/)[0];
  return { 1: "key", 2: "users", 3: "bag", 4: "box", 5: "calendar", 6: "chart", 7: "users" }[section] || "grid";
}

function routeId() {
  const hashRoute = decodeURIComponent(window.location.hash.replace(/^#\/?/, "").split("?")[0]);
  if (hashRoute) return hashRoute;
  if (new URLSearchParams(window.location.search).has("reset")) return "1.4-reset-password";
  return window.location.pathname.replace(/\/+$/, "") === "/mobile" ? "mobile" : "";
}

const legacyRouteAliases = {
  "2s-staff-dashboard": "3-sales-dashboard",
  "8-mobile-sign-in": "1-staff-sign-in",
  "8.1-mobile-admin-dashboard": "role-home",
  "8.2-mobile-approvals": "2.2-access-approvals",
  "8.3-mobile-checkout-gcash": "3.8-checkout-gcash-payment",
  "8.4-mobile-orders": "3.9-orders-status-tracking",
  "8.5-mobile-low-stock": "4.2-low-stock-alerts",
  "8.6-mobile-new-reservation": "5.1-new-reservation",
  "9-overlay-notifications-admin": "9-notifications",
  "9.1-overlay-notifications-sales": "9-notifications",
  "9.2-overlay-notifications-inventory": "9-notifications",
  "9.3-overlay-confirm-approve": "2.2-access-approvals",
};

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
  const dashboardNavIds = navigationForRole(authUser?.role);

  return (
    <aside className="sidebar sidebar--dashboard">
      <div className="dashboard-sidebar__workspace">
        <span>{admin ? "Workspace" : authUser?.role || "Workspace"}</span>
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
        <span className="sidebar__note">Signed in as {authUser?.role || "Workspace user"}</span>
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
};

function WorkflowLinks({ screenId }) {
  const links = workflowLinks[screenId] || [];
  if (!links.length) return null;

  return (
    <nav className="workflow-links" aria-label="Related workflows">
      <h2>Related workflows</h2>
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
  const staffHome = screen.kind === "sales-dashboard";
  const inventoryHome = screen.kind === "inventory-dashboard";
  const adminHome = screen.kind === "dashboard";
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{adminHome ? "WORKSPACE OVERVIEW" : staffHome || inventoryHome ? "MY WORKSPACE" : "SECOND DAZE / WORKSPACE"}</p>
        <div className="page-header__title-row">
          <span className="page-header__icon"><Icon name={screenIcon(screen)} size={19} /></span>
          <h1>{adminHome ? "Admin dashboard" : staffHome ? "Sales dashboard" : inventoryHome ? "Inventory dashboard" : screen.title}</h1>
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
            <Icon name="file" size={14} /> Export CSV
          </ScreenLink>
          <ScreenLink className="button button--outline" screen={screens.find((item) => item.id === "6-sales-inventory-reports")}>
            <Icon name="chart" size={14} /> Export report
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
    return <RecordsTable
      kind={kind}
      rows={rows}
      title={screen.title}
      canEdit={false}
    />;
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

function WorkspaceSyncStatus({ overviewState }) {
  return (
    <p className="sync-status" role="status">
      {overviewState.error || "Workspace data endpoints are not included in the Phase 1 backend."}
    </p>
  );
}

function formatUpdatedAt(value) {
  if (!value) return "not yet";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "not yet";
  return timestamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getSalesSeries(overview, days) {
  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days + 1);
  const startKey = dateKey(startDate);
  const endKey = dateKey(endDate);
  return (overview?.dailySales || []).filter(([day]) => day >= startKey && day <= endKey);
}

function SalesRangeControl({ value, onChange }) {
  return (
    <label className="dashboard-range">
      <span>Date range</span>
      <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
      </select>
    </label>
  );
}

function SalesChart({ overview, days }) {
  const salesSeries = getSalesSeries(overview, days);
  const chartMaximum = Math.max(1, ...salesSeries.map(([, value]) => value));
  if (!salesSeries.length) {
    return <div className="dashboard-chart-empty">Sales trends will appear when the reporting API is available.</div>;
  }
  return (
    <div className="dashboard-chart" style={{ gridTemplateColumns: `repeat(${salesSeries.length}, minmax(0, 1fr))` }} role="img" aria-label={`Sales by date for the last ${days} days: ${salesSeries.map(([day, value]) => `${day}: ${formatMoney(value)}`).join(", ")}`}>
      {salesSeries.map(([day, value]) => (
        <div className="dashboard-chart__day" key={day}>
          <span className="dashboard-chart__amount" title={formatMoney(value)}>{formatMoney(value)}</span>
          <span className="dashboard-chart__bar" style={{ height: `${(value / chartMaximum) * 100}%` }} />
          <span className="dashboard-chart__label" title={day}>{day.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function formatQueueCount(count, label = "item") {
  return `${count} ${count === 1 ? label : `${label}s`}`;
}

function Dashboard({ overviewState, search }) {
  const [salesRange, setSalesRange] = useState(7);
  const queues = overviewState.data?.queues;
  const summary = overviewState.data?.metrics;
  const metrics = [
    { label: "Gross sales", value: formatMoney(summary?.grossSales), detail: "Recorded sales", icon: "bag", screenId: "2.8-sales" },
    { label: "Total cost", value: formatMoney(summary?.totalCost), detail: "Recorded cost of sales", icon: "box", screenId: "6.1-sales-inventory-reports-v2" },
    { label: "Profit", value: formatMoney(summary?.profit), detail: "Gross sales minus recorded cost", icon: "chart", screenId: "6.1-sales-inventory-reports-v2" },
    {
      label: "Access approvals",
      value: typeof queues?.accessApprovals === "number" ? queues.accessApprovals : "—",
      detail: "Staff access requests awaiting review",
      icon: "calendar",
      screenId: "2.2-access-approvals",
    },
  ];
  const requests = (overviewState.data?.recentActivity || []).map((activity) => ({
    title: activity.message,
    detail: formatUpdatedAt(activity.createdAt),
  }));
  const filteredRequests = requests.filter((request) =>
    `${request.title} ${request.detail}`.toLowerCase().includes(search.toLowerCase()),
  );
  const orderStats = [
    { label: "Orders placed", value: summary?.ordersPlaced ?? "—", detail: "Recorded orders" },
    { label: "Avg order value", value: formatMoney(summary?.averageOrderValue), detail: "Average recorded order amount" },
    { label: "Fulfillment rate", value: typeof summary?.fulfillmentRate === "number" ? `${summary.fulfillmentRate.toFixed(1)}%` : "—", detail: "Completed / non-cancelled orders" },
  ];

  return (
    <div className="dashboard-workspace">
      <div className="dashboard-metrics">
        {metrics.map((metric) => (
          <ScreenLink className="panel dashboard-metric dashboard-metric--link" screen={screens.find((item) => item.id === metric.screenId)} key={metric.label}>
            <div className="dashboard-metric__top">
              <span>{metric.label}</span>
              <span className="dashboard-metric__icon"><Icon name={metric.icon} size={15} /></span>
            </div>
            <strong>{metric.value}</strong>
            <p>{metric.detail}</p>
          </ScreenLink>
        ))}
      </div>
      <div className="dashboard-overview-grid">
        <div className="dashboard-overview-main">
          <section className="panel dashboard-orders">
            <div className="panel__top">
              <div><h2>Orders</h2><p>Transaction hub for revenue, cost, and profit</p></div>
              <div className="dashboard-chart-tools">
                <SalesRangeControl value={salesRange} onChange={setSalesRange} />
                <span className="quiet-tag">Workspace API pending</span>
              </div>
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
            <SalesChart overview={overviewState.data} days={salesRange} />
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
              <span>Approval counts will appear when workspace data endpoints are implemented.</span>
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
            <WorkspaceSyncStatus overviewState={overviewState} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function SalesDashboard({ overviewState, search }) {
  const [salesRange, setSalesRange] = useState(7);
  const queues = overviewState.data?.queues;
  const summary = overviewState.data?.metrics;
  const count = (value) => (typeof value === "number" ? value : "—");
  const metrics = [
    { label: "Orders to fulfill", value: count(queues?.ordersToFulfill), detail: "Awaiting packing or dispatch", icon: "bag", screenId: "3.9-orders-status-tracking" },
    { label: "Today's sales", value: formatMoney(summary?.todaysSales), detail: "Sales recorded today", icon: "chart", screenId: "3.9-orders-status-tracking" },
    { label: "Active reservations", value: count(summary?.activeReservations), detail: "Unexpired holds awaiting action", icon: "calendar", screenId: "5-reservations" },
  ];
  const matches = (item) => `${item.title} ${item.detail}`.toLowerCase().includes(search.toLowerCase());
  const reservations = (overviewState.data?.reservations || []).map((reservation) => ({
    title: reservation.reservation_no, detail: `${reservation.customer_code} · ${reservation.status} · expires ${reservation.expires_at}`,
  })).filter(matches);
  const activity = (overviewState.data?.recentActivity || []).map((item) => ({ title: item.message, detail: formatUpdatedAt(item.createdAt) })).filter(matches);
  const quickActions = [
    ["3-sales-catalog", "Start a sale", "bag"],
    ["3.4-new-refund-request", "New refund request", "refresh"],
    ["3.12-new-customer-validation", "Add customer", "users"],
    ["5.1-new-reservation", "New reservation", "calendar"],
  ];

  return (
    <div className="dashboard-workspace">
      <div className="dashboard-metrics">
        {metrics.map((metric) => (
          <ScreenLink className="panel dashboard-metric dashboard-metric--link" screen={screens.find((item) => item.id === metric.screenId)} key={metric.label}>
            <div className="dashboard-metric__top">
              <span>{metric.label}</span>
              <span className="dashboard-metric__icon"><Icon name={metric.icon} size={15} /></span>
            </div>
            <strong>{metric.value}</strong>
            <p>{metric.detail}</p>
          </ScreenLink>
        ))}
      </div>
      <section className="panel dashboard-orders">
        <div className="panel__top">
          <div>          <h2>Sales trend</h2><p>Recorded sales during the selected period</p></div>
          <SalesRangeControl value={salesRange} onChange={setSalesRange} />
        </div>
        <SalesChart overview={overviewState.data} days={salesRange} />
      </section>
      <div className="dashboard-overview-grid">
        <div className="dashboard-overview-main">
          <section className="panel dashboard-requests">
            <div className="panel__top">
              <div><h2>Orders to follow up</h2><p>Recorded sales orders that need fulfillment</p></div>
              <ScreenLink className="text-link" screen={screens.find((item) => item.id === "3.9-orders-status-tracking")}>View orders</ScreenLink>
            </div>
            {activity.length ? (
              <div className="dashboard-request-list">
                {activity.map((task) => {
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
              <div><h2>Recent sales activity</h2><p>Latest recorded changes for sales workflows</p></div>
            </div>
            {activity.length ? (
              <div className="dashboard-request-list">
                {activity.map((item) => (
                  <div className="dashboard-request" key={`${item.title}-${item.detail}`}>
                    <span className="dashboard-request__icon"><Icon name="file" size={14} /></span>
                    <span className="dashboard-request__copy"><strong>{item.title}</strong><small>{item.detail}</small></span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty">{search ? "No sales activity matches your search." : "No recent sales activity is available."}</div>
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
                <ScreenLink className="dashboard-status-link" screen={screens.find((screen) => screen.id === "5-reservations")} key={item.title}>
                  <span className="dashboard-status__icon"><Icon name="clock" size={14} /></span>
                  <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                </ScreenLink>
              )) : <div className="dashboard-empty">{search ? "No reservations match your search." : overviewState.data ? "No recorded active reservations." : "Reservation data is not available."}</div>}
            </div>
          </section>
          <div className="dashboard-sync">
            <WorkspaceSyncStatus overviewState={overviewState} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function InventoryDashboard({ overviewState }) {
  const products = overviewState.data?.records?.products;
  const lowStock = overviewState.data?.lowStock || [];
  const productCount = Array.isArray(products) ? products.length : "—";
  const lowStockCount = typeof overviewState.data?.queues?.lowStockItems === "number"
    ? overviewState.data.queues.lowStockItems
    : lowStock.length || (Array.isArray(products) ? 0 : "—");
  const metrics = [
    { label: "Products", value: productCount, detail: "Products available in the workspace", icon: "box", screenId: "4-inventory-workspace" },
    { label: "Low stock", value: lowStockCount, detail: "At or below product threshold", icon: "bell", screenId: "4.2-low-stock-alerts" },
  ];

  return (
    <div className="dashboard-workspace">
      <div className="dashboard-metrics dashboard-metrics--inventory">
        {metrics.map((metric) => (
          <ScreenLink className="panel dashboard-metric dashboard-metric--link" screen={screens.find((item) => item.id === metric.screenId)} key={metric.label}>
            <div className="dashboard-metric__top">
              <span>{metric.label}</span>
              <span className="dashboard-metric__icon"><Icon name={metric.icon} size={15} /></span>
            </div>
            <strong>{metric.value}</strong>
            <p>{metric.detail}</p>
          </ScreenLink>
        ))}
      </div>
      <section className="panel dashboard-requests">
        <div className="panel__top">
          <div><h2>Restocking priorities</h2><p>Products at or below their configured threshold</p></div>
          <ScreenLink className="text-link" screen={screens.find((item) => item.id === "4.2-low-stock-alerts")}>View low stock</ScreenLink>
        </div>
        {lowStock.length ? (
          <div className="dashboard-request-list">
            {lowStock.slice(0, 8).map((product) => (
              <ScreenLink className="dashboard-request" screen={screens.find((item) => item.id === "4.2-low-stock-alerts")} key={product.sku}>
                <span className="dashboard-request__icon"><Icon name="box" size={14} /></span>
                <span className="dashboard-request__copy"><strong>{product.product_name}</strong><small>{product.sku} · {product.qty_available} available · threshold {product.low_stock_threshold}</small></span>
              </ScreenLink>
            ))}
          </div>
        ) : (
          <div className="dashboard-empty">{Array.isArray(products) ? "No products are currently below their stock threshold." : "Inventory data will appear when the workspace API is connected."}</div>
        )}
      </section>
      <div className="dashboard-sync">
        <WorkspaceSyncStatus overviewState={overviewState} />
      </div>
    </div>
  );
}

function UserManagementPanel({ screen }) {
  const approvalsOnly = screen.id === "2.2-access-approvals";
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [temporaryCredentials, setTemporaryCredentials] = useState(null);
  const [formBusy, setFormBusy] = useState(false);

  const refreshUsers = async (signal) => {
    setLoading(true);
    setError("");
    try {
      setUsers(await listUsers({ signal }));
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(requestError.message || "Unable to load accounts.");
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    refreshUsers(controller.signal);
    return () => controller.abort();
  }, []);

  const performAction = async (user, action) => {
    const labels = {
      approve: "Approve this account?",
      disable: "Disable this account? The user will lose access.",
      enable: "Re-enable this account?",
      reset: "Reset this user's password? They will need to change it at next sign-in.",
    };
    if (!window.confirm(labels[action])) return;
    setBusyId(String(user.id));
    setError("");
    setMessage("");
    setTemporaryCredentials(null);
    try {
      if (action === "approve") await approveUser(user.id);
      if (action === "disable") await disableUser(user.id);
      if (action === "enable") await enableUser(user.id);
      if (action === "reset") {
        const result = await resetUserPassword(user.id);
        setTemporaryCredentials({ username: result.username, password: result.temporaryPassword });
      }
      setMessage(action === "reset" ? "Password reset. Deliver the temporary credential securely." : "Account updated.");
      await refreshUsers();
    } catch (requestError) {
      setError(requestError.message || "Unable to update this account.");
    } finally {
      setBusyId("");
    }
  };

  const createAccount = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = {
      fullName: String(data.get("fullName") || "").trim(),
      username: String(data.get("username") || "").trim(),
      email: String(data.get("email") || "").trim(),
      role: String(data.get("role") || ""),
    };
    const form = event.currentTarget;
    setFormBusy(true);
    setError("");
    setMessage("");
    setTemporaryCredentials(null);
    try {
      const result = await createUser(values);
      setTemporaryCredentials({ username: result.username, password: result.temporaryPassword });
      setMessage("Account created in Pending Approval status. Share the temporary password securely.");
      form.reset();
      await refreshUsers();
    } catch (requestError) {
      setError(requestError.message || "Unable to create the account.");
    } finally {
      setFormBusy(false);
    }
  };

  const visibleUsers = approvalsOnly
    ? users.filter((user) => user.status === "Pending Approval")
    : users;

  return (
    <div className="account-management">
      {!approvalsOnly && (
        <form className="panel account-create" onSubmit={createAccount}>
          <div className="panel__top"><div><h2>Create subaccount</h2><p>New accounts require Admin approval before sign-in.</p></div></div>
          <div className="form-grid">
            <label className="field"><span>Full name *</span><input name="fullName" required maxLength={100} /></label>
            <label className="field"><span>Username *</span><input name="username" required minLength={3} maxLength={50} pattern={"[A-Za-z0-9._\\-]+"} /></label>
            <label className="field"><span>Email (optional)</span><input name="email" type="email" /></label>
            <label className="field"><span>Role *</span><select name="role" required defaultValue=""><option value="" disabled>Select role</option><option>Sales Management</option><option>Inventory Management</option></select></label>
          </div>
          <div className="form-actions">
            <button type="submit" className="button button--primary" disabled={formBusy}>{formBusy ? "Creating…" : "Create account"}</button>
          </div>
        </form>
      )}
      {temporaryCredentials && (
        <section className="panel temporary-credential" role="status">
          <strong>Temporary password (shown once)</strong>
          <p>Username: <code>{temporaryCredentials.username}</code></p>
          <p>Password: <code>{temporaryCredentials.password}</code></p>
          <span>Copy and deliver this securely. Do not send it through an unapproved channel.</span>
        </section>
      )}
      {error && <p className="inline-error" role="alert">{error}</p>}
      {message && <p className="form-note" role="status">{message}</p>}
      <section className="panel table-panel">
        <div className="panel__top">
          <div><h2>{approvalsOnly ? "Pending access approvals" : "Workspace accounts"}</h2><p>Account status and available Admin actions come from the backend.</p></div>
          <button type="button" className="button button--outline" onClick={() => refreshUsers()} disabled={loading}>Refresh</button>
        </div>
        {loading ? <p className="empty-cell">Loading accounts…</p> : visibleUsers.length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Full name</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {visibleUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.fullName}</td><td>{user.username}</td><td>{user.email || "—"}</td><td>{user.role}</td><td><span className="record-status">{user.status}</span></td>
                    <td className="record-actions">
                      {user.role !== "Admin" && user.status === "Pending Approval" && <button className="table-action" type="button" disabled={busyId === String(user.id)} onClick={() => performAction(user, "approve")}>Approve</button>}
                      {user.role !== "Admin" && user.status === "Active" && <button className="table-action" type="button" disabled={busyId === String(user.id)} onClick={() => performAction(user, "disable")}>Disable</button>}
                      {user.role !== "Admin" && user.status === "Disabled" && <button className="table-action" type="button" disabled={busyId === String(user.id)} onClick={() => performAction(user, "enable")}>Enable</button>}
                      {user.role !== "Admin" && <button className="table-action" type="button" disabled={busyId === String(user.id)} onClick={() => performAction(user, "reset")}>Reset password</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="empty-cell">{approvalsOnly ? "There are no accounts awaiting approval." : "No accounts are available."}</p>}
      </section>
    </div>
  );
}

function NotificationsPanel({ authUser }) {
  return (
    <section className="panel notification-center">
      <div className="panel__top">
        <div><h2>{authUser?.role} notifications</h2><p>Role-relevant workspace updates</p></div>
        <span className="quiet-tag">Live notifications pending API</span>
      </div>
      <div className="empty-message">
        <span className="empty-message__icon"><Icon name="bell" size={18} /></span>
        <p>There are no notifications to display.</p>
        <p>Low-stock, reservation-expiry, and approval alerts will appear here when the backend notification service is available.</p>
      </div>
    </section>
  );
}

const formCancelTargets = {
  "3.4-new-refund-request": "2.4-refunds",
  "3.5-refund-condition-review": "2.4-refunds",
  "3.6-approval-request-detail": "2.4-refunds",
  "3.12-new-customer-validation": "3.11-customers",
  "3.13-create-purchase-order": "3.9-orders-status-tracking",
  "3.14-confirm-delivery": "3.9-orders-status-tracking",
  "4.3-edit-product-admin-only": "4-inventory-workspace",
  "5.1-new-reservation": "5-reservations",
};

const formChoices = {
  "item condition": ["New", "Good", "Damaged"],
  "inspection result": ["Accepted", "Rejected", "Needs further review"],
  "inventory disposition": ["Restock", "Defective", "Discard"],
  decision: ["Approve", "Reject"],
  "delivery status": ["Delivered", "Failed delivery", "Returned to sender"],
};

function FormPanel({ screen, authUser }) {
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("status");
  const [errors, setErrors] = useState({});
  const [pendingValues, setPendingValues] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const fields = formFields[screen.id] || ["Customer", "Order reference", "Details"];
  const cancelScreenId = formCancelTargets[screen.id] || homeId(authUser);
  const submitForm = (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const nextErrors = {};
    for (const field of fields) {
      const normalized = field.toLowerCase();
      const value = String(values[field] || "").trim();
      const optional = normalized.includes("note") || normalized === "social media handle" || normalized === "email";
      if (!optional && !value) {
        nextErrors[field] = `${field} is required.`;
      } else if (normalized.includes("quantity") || normalized.includes("days")) {
        if (value && (!/^\d+$/.test(value) || Number(value) < 1)) nextErrors[field] = `${field} must be a whole number greater than zero.`;
      } else if (normalized.includes("amount") || normalized.includes("price")) {
        if (value && (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) < 0)) nextErrors[field] = `${field} must be a non-negative amount with up to two decimal places.`;
      } else if (normalized === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        nextErrors[field] = "Enter a valid email address.";
      } else if (normalized.includes("contact number") && value && screen.id === "3.12-new-customer-validation") {
        const mobileNumber = value.replace(/[\s()-]/g, "");
        if (!/^(?:09\d{9}|\+639\d{9}|639\d{9})$/.test(mobileNumber)) {
          nextErrors[field] = "Enter a Philippine mobile number, such as 09XXXXXXXXX or +639XXXXXXXXX.";
        }
      }
    }
    setErrors(nextErrors);
    setMessage("");
    if (Object.keys(nextErrors).length) return;
    setPendingValues(values);
    setConfirming(true);
  };
  const saveAction = () => {
    setMessage("The details passed frontend validation, but this workflow cannot be saved until its backend API is implemented.");
    setMessageType("status");
    setConfirming(false);
  };
  const fieldInputType = (field) => {
    const normalized = field.toLowerCase();
    if (normalized.includes("date and time")) return "datetime-local";
    if (normalized.includes("date")) return "date";
    if (normalized.includes("quantity") || normalized.includes("days")) return "number";
    if (normalized.includes("amount") || normalized.includes("price")) return "number";
    if (normalized.includes("email")) return "email";
    if (normalized.includes("contact number")) return "tel";
    return "text";
  };
  const fieldId = (field) => `form-${screen.id}-${field}`.replace(/[^a-z0-9_-]/gi, "-");

  return (
    <>
      <form className="panel form-panel" onSubmit={submitForm} noValidate>
        <div className="panel__top">
          <div><h2>{screen.title}</h2><p>Complete the required fields, then review before saving.</p></div>
          <span className="quiet-tag">Review before save</span>
        </div>
        <div className="form-grid">
          {fields.map((field) => {
            const normalized = field.toLowerCase();
            const choices = formChoices[normalized];
            const optional = normalized.includes("note") || normalized === "social media handle" || normalized === "email";
            const isLongText = normalized.includes("note") || normalized.includes("address") || normalized.includes("reason");
            const id = fieldId(field);
            return (
              <label className={isLongText ? "field field--wide" : "field"} key={field} htmlFor={id}>
                <span>{field}{optional ? " (optional)" : " *"}</span>
                {choices ? (
                  <select id={id} name={field} required={!optional} aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `${id}-error` : undefined} onChange={() => setErrors((previous) => ({ ...previous, [field]: "" }))}>
                    <option value="">Choose {field.toLowerCase()}</option>
                    {choices.map((choice) => <option value={choice} key={choice}>{choice}</option>)}
                  </select>
                ) : isLongText ? (
                  <textarea id={id} name={field} rows="3" required={!optional} aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `${id}-error` : undefined} placeholder={`Enter ${field.toLowerCase()}`} onChange={() => setErrors((previous) => ({ ...previous, [field]: "" }))} />
                ) : (
                  <input
                    id={id}
                    name={field}
                    type={fieldInputType(field)}
                    required={!optional}
                    min={fieldInputType(field) === "number" ? (normalized.includes("quantity") || normalized.includes("days") ? 1 : 0) : undefined}
                    step={normalized.includes("amount") || normalized.includes("price") ? "0.01" : normalized.includes("quantity") || normalized.includes("days") ? "1" : undefined}
                    aria-invalid={Boolean(errors[field])}
                    aria-describedby={errors[field] ? `${id}-error` : undefined}
                    placeholder={`Enter ${field.toLowerCase()}`}
                    onChange={() => setErrors((previous) => ({ ...previous, [field]: "" }))}
                  />
                )}
                {errors[field] && <small className="field-error" id={`${id}-error`}>{errors[field]}</small>}
              </label>
            );
          })}
        </div>
        <div className="form-actions">
          <ScreenLink className="button button--outline" screen={screens.find((item) => item.id === cancelScreenId)}>Cancel</ScreenLink>
          {message && <span className={messageType === "error" ? "inline-error form-feedback" : "form-note form-feedback"} role={messageType === "error" ? "alert" : "status"}>{message}</span>}
          <button className="button button--primary" type="submit">
            Review and save
          </button>
        </div>
      </form>
      {confirming && (
        <div className="form-confirm-backdrop">
          <section className="form-confirm" role="alertdialog" aria-modal="true" aria-labelledby="form-confirm-title">
            <p className="eyebrow">CONFIRM ACTION</p>
            <h2 id="form-confirm-title">Review before saving</h2>
            <p>This review checks the entered details only. The current backend does not yet save this workflow.</p>
            <dl>{Object.entries(pendingValues || {}).slice(0, 4).map(([field, value]) => <div key={field}><dt>{field}</dt><dd>{value || "—"}</dd></div>)}</dl>
            <div className="form-confirm__actions">
              <button className="button button--outline" type="button" onClick={() => setConfirming(false)}>Continue editing</button>
              <button className="button button--primary" type="button" onClick={saveAction}>Finish review</button>
            </div>
          </section>
        </div>
      )}
    </>
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

function passwordValidationMessage(password) {
  if (password.length < 8 || password.length > 72) return "Password must be 8–72 characters.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return "Include an uppercase letter, a lowercase letter, a number, and a symbol.";
  }
  return "";
}

function AuthScreen({ screen, onAuthenticated }) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const pending = screen.kind === "pending";
  const forgot = screen.kind === "auth-forgot";
  const reset = screen.kind === "auth-reset";
  const showError = screen.kind === "auth-error";
  const resetToken = new URLSearchParams(window.location.search).get("reset") || "";
  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSubmitting(true);
    setMessage("");
    try {
      if (forgot) {
        await requestPasswordReset(String(formData.get("identifier") || "").trim());
        setMessage("If the account has an email on file, a reset link has been sent.");
        return;
      }
      if (reset) {
        const newPassword = String(formData.get("newPassword") || "");
        const confirmation = String(formData.get("confirmPassword") || "");
        const passwordError = passwordValidationMessage(newPassword);
        if (passwordError) {
          setMessage(passwordError);
          return;
        }
        if (newPassword !== confirmation) {
          setMessage("The passwords do not match.");
          return;
        }
        await resetPassword({ token: resetToken, newPassword });
        window.history.replaceState({}, "", window.location.pathname);
        setResetComplete(true);
        return;
      }
      const result = await signIn({
        username: String(formData.get("username") || "").trim(),
        password: String(formData.get("password") || ""),
      });
      if (result.status === "authenticated") {
        onAuthenticated(result.user);
        window.location.hash = `/${homeId(result.user)}`;
      } else if (result.status === "inactive") {
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
        {(forgot || reset || showError) && (
          <ScreenLink className="text-link auth-content__back" screen={screens.find((item) => item.id === "1-staff-sign-in")}>
            {forgot || reset ? "← Sign in" : "← Try again"}
          </ScreenLink>
        )}
        {resetComplete ? (
          <div className="auth-card">
            <span className="detail-panel__icon"><Icon name="check" size={22} /></span>
            <p className="eyebrow">ACCOUNT RECOVERY</p>
            <h2>Password updated</h2>
            <p>Your password has been reset. You can now sign in with the new password.</p>
            <ScreenLink className="button button--primary" screen={screens.find((item) => item.id === "1-staff-sign-in")}>Return to sign in</ScreenLink>
          </div>
        ) : pending ? (
          <div className="auth-card">
            <span className="detail-panel__icon"><Icon name="users" size={22} /></span>
            <p className="eyebrow">ACCESS REQUEST</p>
            <h2>Account not active</h2>
            <p>Your account may be awaiting approval or disabled. Contact an Admin for access.</p>
            <a className="button button--primary" href="#/1-staff-sign-in">Return to sign in</a>
          </div>
        ) : (
          <form className="auth-card" onSubmit={handleSubmit}>
            <p className="eyebrow">{forgot || reset ? "ACCOUNT RECOVERY" : "WELCOME BACK"}</p>
            <h2>{reset ? "Choose a new password" : forgot ? "Reset your password" : "Workspace sign-in"}</h2>
            <p>{reset ? "Use a strong password you have not used before." : forgot ? "Enter your username or email to request a reset link." : "Use your workspace account to sign in."}</p>
            {showError && <p className="inline-error" role="alert">Username or password was not recognized. Check your details and try again.</p>}
            {!reset && <label className="field"><span>{forgot ? "Username or email" : "Username"}</span><input name={forgot ? "identifier" : "username"} type="text" autoComplete="username" required placeholder={forgot ? "Enter your username or email" : "Enter your username"} /></label>}
            {!forgot && !reset && <label className="field"><span>Password</span><input name="password" type="password" autoComplete="current-password" required placeholder="Enter your password" /></label>}
            {reset && (
              <>
                {!resetToken && <p className="inline-error" role="alert">This reset link is missing its token. Request a new reset link.</p>}
                <label className="field"><span>New password</span><input name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={72} /></label>
                <label className="field"><span>Confirm new password</span><input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={72} /></label>
              </>
            )}
            {message && <p className="form-note" role="status">{message}</p>}
            <button type="submit" className="button button--primary" disabled={submitting || (reset && !resetToken)}>
              <Icon name={forgot || reset ? "arrow" : "key"} size={15} />
              {submitting ? "Please wait…" : reset ? "Set new password" : forgot ? "Request reset" : "Sign in"}
            </button>
            {!forgot && !reset && <ScreenLink className="text-link auth-card__link" screen={screens.find((item) => item.id === "1.3-forgot-password")}>Forgot password?</ScreenLink>}
          </form>
        )}
      </section>
    </main>
  );
}

function ChangePasswordScreen({ authUser, onPasswordChanged }) {
  const forced = authUser.mustChangePassword;
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get("newPassword") || "");
    const confirmation = String(data.get("confirmPassword") || "");
    if (newPassword !== confirmation) {
      setMessage("The passwords do not match.");
      return;
    }
    const passwordError = passwordValidationMessage(newPassword);
    if (passwordError) {
      setMessage(passwordError);
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      await changePassword({
        currentPassword: String(data.get("currentPassword") || ""),
        newPassword,
      });
      await onPasswordChanged();
    } catch (error) {
      setMessage(error.message || "Unable to change the password.");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="auth-page">
      <div className="auth-art">
        <Brand to={`#/${homeId(authUser)}`} />
        <div className="auth-art__copy"><p className="eyebrow">ACCOUNT SECURITY</p><h1>Secure your<br /><em>account.</em></h1><p>Choose a strong password before continuing.</p></div>
        <span className="auth-art__foot">SECOND DAZE APPAREL</span>
      </div>
      <section className="auth-content">
        <form className="auth-card" onSubmit={handleSubmit}>
          <p className="eyebrow">{forced ? "PASSWORD UPDATE REQUIRED" : "ACCOUNT SECURITY"}</p>
          <h2>Change your password</h2>
          <p>{forced ? "Your Admin provided a temporary password. Replace it to continue." : "Use at least 8 characters with uppercase, lowercase, a number, and a symbol."}</p>
          <label className="field"><span>{forced ? "Temporary password" : "Current password"}</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label>
          <label className="field"><span>New password</span><input name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={72} required /></label>
          <label className="field"><span>Confirm new password</span><input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={72} required /></label>
          {message && <p className="inline-error" role="alert">{message}</p>}
          <button type="submit" className="button button--primary" disabled={submitting}>{submitting ? "Saving…" : "Update password"}</button>
        </form>
      </section>
    </main>
  );
}

function DataExportPanel() {
  const [table, setTable] = useState(exportableTables[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const handleExport = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await downloadTableExport(table);
      setMessage(`${table}.csv download started.`);
    } catch (requestError) {
      setError(requestError.message || "Unable to export this table.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel data-export">
      <div className="panel__top"><div><h2>Export workspace data</h2><p>Download an authorized database table as CSV.</p></div></div>
      <form className="data-export__content" onSubmit={handleExport}>
        <label className="field" htmlFor="export-table">
          <span>Data to export</span>
          <select id="export-table" value={table} onChange={(event) => setTable(event.target.value)}>
            {exportableTables.map((name) => <option value={name} key={name}>{name.replace(/_/g, " ")}</option>)}
          </select>
        </label>
        <p className="form-note">The backend checks Admin access and records the export in its audit log.</p>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {message && <p className="form-note" role="status">{message}</p>}
        <button className="button button--primary" type="submit" disabled={busy}>{busy ? "Preparing export…" : "Download CSV"}</button>
      </form>
    </section>
  );
}

function MainPreview({ screen, authUser, onAuthenticated, onSignOut, onPasswordChanged, overviewState }) {
  const [dashboardSearch, setDashboardSearch] = useState("");
  if (screen.kind.startsWith("auth") || screen.kind === "pending") {
    return <AuthScreen key={screen.id} screen={screen} onAuthenticated={onAuthenticated} />;
  }
  if (screen.kind === "change-password") {
    return <ChangePasswordScreen authUser={authUser} onPasswordChanged={onPasswordChanged} />;
  }
  const isDashboard = ["dashboard", "sales-dashboard", "inventory-dashboard"].includes(screen.kind);
  return (
    <div className="app-shell app-shell--dashboard">
      <DashboardTopbar authUser={authUser} search={dashboardSearch} onSearch={isDashboard ? setDashboardSearch : undefined} onSignOut={onSignOut} />
      <Sidebar active={screen.id} authUser={authUser} onSignOut={onSignOut} />
      <main className="workspace">
        <PageHeader screen={screen} authUser={authUser} />
        <div className="workspace__body">
          {overviewState.error && !isDashboard && <WorkspaceSyncStatus overviewState={overviewState} />}
          {screen.kind === "dashboard" && <Dashboard overviewState={overviewState} search={dashboardSearch} />}
          {screen.kind === "sales-dashboard" && <SalesDashboard overviewState={overviewState} search={dashboardSearch} />}
          {screen.kind === "inventory-dashboard" && <InventoryDashboard overviewState={overviewState} />}
          {screen.kind === "data-export" && <DataExportPanel />}
          {(screen.kind === "user-management" || screen.kind === "user-approvals") && <UserManagementPanel key={screen.id} screen={screen} />}
          {screen.kind === "table" && <EmptyTable screen={screen} overview={overviewState.data} />}
          {screen.kind === "catalog" && <RecordsTable
            kind="products"
            rows={overviewState.data?.records?.products}
            title="Product catalog"
          />}
          {screen.kind === "form" && <FormPanel key={screen.id} screen={screen} authUser={authUser} />}
          {screen.kind === "detail" && <DetailPanel screen={screen} />}
          {screen.kind === "success" && <DetailPanel screen={screen} success />}
          {screen.kind === "reports" && <DataReports overview={overviewState.data} />}
          {screen.kind === "notifications" && <NotificationsPanel authUser={authUser} />}
          <WorkflowLinks screenId={screen.id} />
        </div>
        <footer className="workspace__footer"><span>Second Daze Apparel</span><span>Operations workspace</span></footer>
      </main>
    </div>
  );
}

export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [currentId, setCurrentId] = useState(() => routeId());
  const [authError, setAuthError] = useState("");
  const [overviewState, setOverviewState] = useState({ status: "loading", data: null, error: "" });
  useEffect(() => {
    const updateRoute = () => setCurrentId(routeId());
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    getCurrentUser({ signal: controller.signal }).then((user) => {
      setAuthUser({ ...user, role: normalizeRole(user.role) });
    }).catch((error) => {
      if (error.name !== "AbortError" && error.status !== 401) {
        setAuthError(error.status === 404
          ? "Phase 1 API is unavailable. Start the integrated app with `npx vercel dev`."
          : error.message || "Unable to check the current session.");
      }
    }).finally(() => {
      if (!controller.signal.aborted) setSessionLoading(false);
    });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    setOverviewState({
      status: authUser ? "unavailable" : "idle",
      data: null,
      error: authUser ? "The Phase 1 backend does not include workspace data APIs yet." : "",
    });
  }, [authUser]);

  const authenticateUser = (user) => {
    setAuthUser({ ...user, role: normalizeRole(user.role) });
    setSessionLoading(false);
    setAuthError("");
  };
  const handleSignOut = async () => {
    try {
      await signOut();
      setAuthUser(null);
      setAuthError("");
      window.location.hash = "/1-staff-sign-in";
    } catch (error) {
      setAuthError(error.message || "Unable to sign out.");
    }
  };

  const aliasedId = legacyRouteAliases[currentId] || currentId;
  const requestedId = !currentId || currentId === "screens"
    ? authUser ? homeId(authUser) : "1-staff-sign-in"
    : currentId === "mobile" || aliasedId === "role-home"
      ? authUser ? homeId(authUser) : "1-staff-sign-in"
      : aliasedId;
  const requestedScreen = screens.find((item) => item.id === requestedId)
    || screens.find((item) => item.id === "1-staff-sign-in");
  const wrongRole = authUser && requestedScreen.group === "Main system"
    && !canAccessScreen(authUser.role, requestedScreen.id);
  const passwordChangeRequired = authUser?.mustChangePassword && requestedScreen.id !== "1.5-change-password";
  const publicScreen = requestedScreen.kind.startsWith("auth") || requestedScreen.kind === "pending";
  const requiresAuthentication = !publicScreen && requestedScreen.id !== "1.5-change-password";
  useEffect(() => {
    if (sessionLoading) return;
    if (passwordChangeRequired) {
      window.location.hash = "/1.5-change-password";
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
    if (!authUser && requiresAuthentication) window.location.hash = "/1-staff-sign-in";
  }, [authUser, requestedId, requestedScreen.id, requiresAuthentication, wrongRole, sessionLoading, passwordChangeRequired]);

  const screen = passwordChangeRequired
    ? screens.find((item) => item.id === "1.5-change-password")
    : !authUser && requiresAuthentication
    ? screens.find((item) => item.id === "1-staff-sign-in")
    : wrongRole ? screens.find((item) => item.id === homeId(authUser)) : requestedScreen;

  if (sessionLoading) {
    return <main className="session-loading" role="status">Checking your session…</main>;
  }

  return (
    <>
      {authError && <p className="global-error" role="alert">{authError}</p>}
      <MainPreview
        screen={screen}
        authUser={authUser}
        onAuthenticated={authenticateUser}
        onSignOut={handleSignOut}
        onPasswordChanged={async () => {
          const user = await getCurrentUser();
          setAuthUser({ ...user, role: normalizeRole(user.role) });
          window.location.hash = `/${homeId(user)}`;
        }}
        overviewState={overviewState}
      />
    </>
  );
}
