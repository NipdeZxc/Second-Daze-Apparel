import { useEffect, useId, useRef, useState } from "react";
import { formFields, screens, tableColumns } from "./screens.js";
import { getCurrentUser, requestPasswordReset, signIn, signOut } from "./api/auth.js";
import { getWorkspaceRecords, markNotificationsRead, submitWorkspaceAction } from "./api/workspace.js";
import { buildOverview } from "./data/workspace.js";
import { ApprovalQueue, CsvImportPanel, DataExportPanel, DataReports, formatMoney, RecordsTable, screenDatasets } from "./DataPanels.jsx";

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
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="m3 3 18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a14.6 14.6 0 0 1-3.1 3.8M6.6 6.6C3.7 8.5 2 12 2 12s3.6 7 10 7a10.5 10.5 0 0 0 4.1-.8" /></>,
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

function PasswordField({ autoComplete = "current-password" }) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();
  return (
    <div className="field">
      <label htmlFor={inputId}>Password</label>
      <div className="password-field">
        <input id={inputId} name="password" type={visible ? "text" : "password"} autoComplete={autoComplete} required placeholder="Enter your password" />
        <button
          type="button"
          className="password-visibility"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <Icon name={visible ? "eyeOff" : "eye"} size={16} />
        </button>
      </div>
    </div>
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

// The signed session lives in an HttpOnly cookie; this only remembers who to show until /api/me confirms it.
function readAuthUser() {
  const username = localStorage.getItem("second-daze-username");
  if (!username) return null;
  return { username, role: localStorage.getItem("second-daze-role") || "Staff" };
}

function saveAuthUser(user) {
  localStorage.setItem("second-daze-username", user.username);
  localStorage.setItem("second-daze-role", user.role || "Staff");
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
        <span className="sidebar__note">{`Signed in as ${authUser?.role || "Staff"}`}</span>
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

function EmptyTable({ screen, overview, authUser, onRecordsChanged }) {
  const kind = screenDatasets[screen.id];
  if (kind) {
    const records = overview?.records?.[kind];
    const rows = screen.id === "4.2-low-stock-alerts" ? overview?.lowStock
      : screen.id === "2.2-access-approvals" ? records?.filter((account) => account.status === "Pending Approval")
        : records;
    return <RecordsTable
      kind={kind}
      rows={rows}
      title={screen.title}
      authUser={authUser}
      canEdit={isAdmin(authUser)}
      onRecordUpdated={onRecordsChanged}
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
      <span>{overviewState.status === "loading" ? "Loading workspace data…" : `Last synced ${formatUpdatedAt(overviewState.data?.updatedAt)}`}</span>
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
    return <div className="dashboard-chart-empty">No sales recorded in this period. Import sales data to display trends.</div>;
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

function Dashboard({ overviewState, onRefresh, search }) {
  const [salesRange, setSalesRange] = useState(7);
  const queues = overviewState.data?.queues;
  const summary = overviewState.data?.metrics;
  const metrics = [
    { label: "Gross sales", value: formatMoney(summary?.grossSales), detail: "All imported sales", icon: "bag", screenId: "2.8-sales" },
    { label: "Total cost", value: formatMoney(summary?.totalCost), detail: "Recorded cost of imported sales", icon: "box", screenId: "6.1-sales-inventory-reports-v2" },
    { label: "Profit", value: formatMoney(summary?.profit), detail: "Gross sales minus recorded cost", icon: "chart", screenId: "6.1-sales-inventory-reports-v2" },
    { label: "Pending orders", value: typeof summary?.pendingOrders === "number" ? summary.pendingOrders : "—", detail: "Awaiting approval or payment", icon: "clock", screenId: "3.9-orders-status-tracking" },
    { label: "Unpaid reservations", value: typeof summary?.unpaidReservations === "number" ? summary.unpaidReservations : "—", detail: "Reservations awaiting approval or payment", icon: "calendar", screenId: "2.5-reservations" },
    { label: "Items for shipping", value: typeof summary?.itemsForShipping === "number" ? summary.itemsForShipping : "—", detail: "Orders in the shipping queue", icon: "box", screenId: "3.9-orders-status-tracking" },
    { label: "Completed orders", value: typeof summary?.completedOrders === "number" ? summary.completedOrders : "—", detail: "Orders marked complete", icon: "check", screenId: "3.9-orders-status-tracking" },
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
    { label: "Orders placed", value: summary?.ordersPlaced ?? "—", detail: "All imported orders" },
    { label: "Avg order value", value: formatMoney(summary?.averageOrderValue), detail: "Average imported order amount" },
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
                <span className="quiet-tag">Live overview</span>
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
              <span>{overviewState.status === "error" ? "Workspace data could not be loaded." : "Open the approval queue to review staff access requests."}</span>
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
  const [salesRange, setSalesRange] = useState(7);
  const queues = overviewState.data?.queues;
  const summary = overviewState.data?.metrics;
  const count = (value) => (typeof value === "number" ? value : "—");
  const metrics = [
    { label: "Orders to fulfill", value: count(queues?.ordersToFulfill), detail: "Awaiting packing or dispatch", icon: "bag", screenId: "3.9-orders-status-tracking" },
    { label: "Today's sales", value: formatMoney(summary?.todaysSales), detail: "Sales recorded today", icon: "chart", screenId: "3.9-orders-status-tracking" },
    { label: "Low stock items", value: count(queues?.lowStockItems), detail: "At or below threshold", icon: "box", screenId: "4.2-low-stock-alerts" },
    { label: "Active reservations", value: count(summary?.activeReservations), detail: "Unexpired holds awaiting action", icon: "calendar", screenId: "5-reservations" },
  ];
  const matches = (item) => `${item.title} ${item.detail}`.toLowerCase().includes(search.toLowerCase());
  const tasks = (overviewState.data?.pendingOrders || []).map((order) => ({
    title: order.order_number, detail: `${order.customer_name} · ${formatMoney(order.total_amount)}`,
    status: order.status, screenId: "3.9-orders-status-tracking",
  })).filter(matches);
  const lowStock = (overviewState.data?.lowStock || []).map((product) => ({
    title: product.product_name, detail: `${product.product_code} · ${product.stock_quantity} left · threshold ${product.low_stock_threshold}`,
  })).filter(matches);
  const reservations = (overviewState.data?.reservations || []).map((reservation) => ({
    title: reservation.reservation_number, detail: `${reservation.customer_name} · ${reservation.status}${reservation.expires_at ? ` · expires ${new Date(reservation.expires_at).toLocaleDateString()}` : ""}`,
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
          <div><h2>Sales trend</h2><p>Recorded sales during the selected period</p></div>
          <SalesRangeControl value={salesRange} onChange={setSalesRange} />
        </div>
        <SalesChart overview={overviewState.data} days={salesRange} />
      </section>
      <div className="dashboard-overview-grid">
        <div className="dashboard-overview-main">
          <section className="panel dashboard-requests">
            <div className="panel__top">
              <div><h2>Orders to follow up</h2><p>Recorded orders that need fulfillment</p></div>
              <ScreenLink className="text-link" screen={screens.find((item) => item.id === "3.9-orders-status-tracking")}>View orders</ScreenLink>
            </div>
            {tasks.length ? (
              <div className="dashboard-request-list">
                {tasks.map((task) => {
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
                  <ScreenLink className="dashboard-request" screen={screens.find((screen) => screen.id === "4.2-low-stock-alerts")} key={item.title}>
                    <span className="dashboard-request__icon"><Icon name="box" size={14} /></span>
                    <span className="dashboard-request__copy"><strong>{item.title}</strong><small>{item.detail}</small></span>
                  </ScreenLink>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty">{search ? "No low-stock items match your search." : overviewState.data ? "No items are below their threshold." : "Inventory data is not available."}</div>
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
            <WorkspaceSyncStatus overviewState={overviewState} onRefresh={onRefresh} />
          </div>
        </aside>
      </div>
    </div>
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
  status: ["Active", "Inactive"],
};

function FormPanel({ screen, mobile = false, authUser, onActionSaved }) {
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("status");
  const [errors, setErrors] = useState({});
  const [pendingValues, setPendingValues] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef(null);
  const fields = formFields[screen.id] || ["Customer", "Order reference", "Details"];
  const cancelScreenId = formCancelTargets[screen.id] || (mobile ? "8.1-mobile-admin-dashboard" : "2-admin-dashboard");
  const submitForm = (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const nextErrors = {};
    for (const field of fields) {
      const normalized = field.toLowerCase();
      const value = String(values[field] || "").trim();
      const optional = normalized.includes("note") || ["social media handle", "email", "postal code", "additional items"].includes(normalized);
      if (!optional && !value) {
        nextErrors[field] = `${field} is required.`;
      } else if (normalized.includes("quantity") || normalized.includes("agreed days")) {
        if (value && (!/^\d+$/.test(value) || Number(value) < 1)) nextErrors[field] = `${field} must be a whole number greater than zero.`;
      } else if (normalized.includes("amount") || normalized.includes("price")) {
        if (value && (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) < 0)) nextErrors[field] = `${field} must be a non-negative amount with up to two decimal places.`;
      } else if (normalized === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        nextErrors[field] = "Enter a valid email address.";
      } else if (normalized.includes("contact number") && value && !/^(09|\+639)\d{9}$/.test(value.replace(/[\s-]/g, ""))) {
        nextErrors[field] = "Contact number must look like 09XXXXXXXXX or +639XXXXXXXXX.";
      }
    }
    setErrors(nextErrors);
    setMessage("");
    if (Object.keys(nextErrors).length) return;
    setPendingValues(values);
    setConfirming(true);
  };
  const saveAction = async () => {
    setSubmitting(true);
    setMessage("");
    try {
      await submitWorkspaceAction({
        screenId: screen.id,
        values: pendingValues,
      });
      setMessage("Saved to the database.");
      setMessageType("status");
      setConfirming(false);
      formRef.current?.reset();
      onActionSaved();
    } catch (error) {
      setMessage(error.message || "Unable to save this workspace action.");
      setMessageType("error");
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };
  const fieldInputType = (field) => {
    const normalized = field.toLowerCase();
    if (normalized.includes("date and time")) return "datetime-local";
    if (normalized.includes("date")) return "date";
    if (normalized.includes("quantity") || normalized.includes("agreed days")) return "number";
    if (normalized.includes("amount") || normalized.includes("price")) return "number";
    if (normalized.includes("email")) return "email";
    if (normalized.includes("contact number")) return "tel";
    return "text";
  };
  const fieldId = (field) => `form-${screen.id}-${field}`.replace(/[^a-z0-9_-]/gi, "-");

  return (
    <>
      <form ref={formRef} className={`panel form-panel ${mobile ? "form-panel--mobile" : ""}`} onSubmit={submitForm} noValidate>
        <div className="panel__top">
          <div><h2>{screen.title}</h2><p>Complete the required fields, then review before saving.</p></div>
          {!mobile && <span className="quiet-tag">Review before save</span>}
        </div>
        <div className="form-grid">
          {fields.map((field) => {
            const normalized = field.toLowerCase();
            const choices = formChoices[normalized];
            const optional = normalized.includes("note") || ["social media handle", "email", "postal code", "additional items"].includes(normalized);
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
          <button className="button button--primary" type="submit" disabled={submitting}>
            {mobile ? "Review and continue" : "Review and save"}
          </button>
        </div>
      </form>
      {confirming && (
        <div className="form-confirm-backdrop">
          <section className="form-confirm" role="alertdialog" aria-modal="true" aria-labelledby="form-confirm-title">
            <p className="eyebrow">CONFIRM ACTION</p>
            <h2 id="form-confirm-title">Review before saving</h2>
            <p>Confirm these details before saving them to the database.</p>
            <dl>{Object.entries(pendingValues || {}).slice(0, 4).map(([field, value]) => <div key={field}><dt>{field}</dt><dd>{value || "—"}</dd></div>)}</dl>
            <div className="form-confirm__actions">
              <button className="button button--outline" type="button" onClick={() => setConfirming(false)} disabled={submitting}>Continue editing</button>
              <button className="button button--primary" type="button" onClick={saveAction} disabled={submitting}>{submitting ? "Saving…" : "Confirm and save"}</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function DetailPanel({ screen, success = false, overview, authUser, onRecordsChanged }) {
  const view = detailViews[screen.id];
  const records = overview?.records;
  if (!view || !records) {
    return (
      <section className={`panel detail-panel ${success ? "detail-panel--success" : ""}`}>
        <p className="eyebrow">{success ? "WORKFLOW" : "DETAILS"}</p>
        <h2>{screen.title}</h2>
        <p>{screen.description}</p>
        <span className="quiet-tag">{records ? "Nothing to show" : "Loading…"}</span>
      </section>
    );
  }
  return (
    <>
      <p className="form-note">{screen.description}</p>
      <RecordsTable
        kind={view.kind}
        rows={records[view.kind].filter(view.filter || (() => true))}
        title={screen.title}
        authUser={authUser}
        onRecordUpdated={onRecordsChanged}
      />
    </>
  );
}

// Workflow pages show the live records that belong to that step of the process.
const detailViews = {
  "3.1-checkout-pending-payment": { kind: "orders", filter: (order) => order.status === "Pending Payment" },
  "3.8-checkout-gcash-payment": { kind: "orders", filter: (order) => order.status === "Pending Payment" },
  "3.15-payment-not-received": { kind: "orders", filter: (order) => order.payment_status === "Rejected" },
  "3.10-order-detail-shipment": { kind: "orders" },
  "3.2-sale-completed": { kind: "sales" },
  "3.6-approval-request-detail": { kind: "refunds", filter: (refund) => refund.status === "Pending Approval" },
  "3.7-refund-completed": { kind: "refunds", filter: (refund) => refund.status !== "Pending Approval" },
  "4.1-stock-movement-saved": { kind: "products" },
  "5.2-expired-reservation-void-notice": { kind: "reservations", filter: (item) => item.status === "Voided" },
  "5.3-reservation-approved": { kind: "reservations", filter: (item) => ["Active", "Paid"].includes(item.status) },
};

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
      setSubmitting(true);
      try {
        const response = await requestPasswordReset(String(formData.get("username") || "").trim());
        setMessage(response?.message || "If that account exists, reset instructions have been sent.");
      } catch (error) {
        setMessage(error.message || "Unable to request a password reset.");
      } finally {
        setSubmitting(false);
      }
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
        onAuthenticated(result.user);
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
            {!forgot && <PasswordField autoComplete="current-password" />}
            {message && <p className="form-note" role="status">{message}</p>}
            <button type="submit" className="button button--primary" disabled={submitting}>
              <Icon name={forgot ? "arrow" : "key"} size={15} />
              {submitting ? "Signing in…" : forgot ? "Request reset" : "Sign in"}
            </button>
            {!forgot && <ScreenLink className="text-link auth-card__link" screen={screens.find((item) => item.id === "1.3-forgot-password")}>Forgot password?</ScreenLink>}
            <p className="auth-card__hint">Sign in with your Second Daze account. Records are stored in the shared database.</p>
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
          onAuthenticated(result.user);
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
      <label className="field"><span>Username</span><input name="username" type="text" autoComplete="username" placeholder="Enter your username" required /></label>
      <PasswordField autoComplete="current-password" />
      {message && <span className="form-note" role="status">{message}</span>}
      <button type="submit" className="button button--primary" disabled={submitting}>
        <Icon name="key" size={15} />{submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function MobileContent({ screen, onAuthenticated, overviewState, onRefresh, authUser }) {
  if (screen.kind === "mobile-form") {
    if (screen.id === "8.3-mobile-checkout-gcash") {
      const pending = (overviewState.data?.records?.orders || []).filter((order) => order.actions?.some((action) => action.id === "record-payment"));
      return (
        <section className="mobile-worklist">
          <div className="mobile-worklist__heading"><h2>Orders awaiting payment</h2></div>
          <RecordsTable kind="orders" rows={pending} authUser={authUser} onRecordUpdated={onRefresh} />
        </section>
      );
    }
    return <FormPanel key={screen.id} screen={screen} mobile authUser={authUser} onActionSaved={onRefresh} />;
  }
  if (screen.kind === "mobile-auth") {
    return <MobileLogin onAuthenticated={onAuthenticated} />;
  }
  if (screen.kind === "mobile-list" || screen.kind === "mobile-stock") {
    const records = overviewState.data?.records;
    if (screen.id === "8.2-mobile-approvals") {
      return (
        <section className="mobile-worklist">
          <div className="mobile-worklist__heading"><h2>Approval queue</h2></div>
          <ApprovalQueue records={records} onChanged={onRefresh} />
        </section>
      );
    }
    const kind = screen.kind === "mobile-stock" ? "products" : "orders";
    const rows = kind === "products" ? overviewState.data?.lowStock : records?.orders;
    return <RecordsTable kind={kind} rows={rows} authUser={authUser} onRecordUpdated={onRefresh} />;
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
          <span>{overviewState.data ? "Live data from the database." : "Loading assigned items…"}</span>
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
          ? `${formatQueueCount(overviewState.data.queues.ordersToFulfill, "order")} ${overviewState.data.queues.ordersToFulfill === 1 ? "needs" : "need"} follow-up.`
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
  const notifications = (overviewState.data?.records?.notifications || []).filter((item) => !item.is_read);
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
                <ApprovalQueue records={overviewState.data?.records} onChanged={onRefresh} />
                <div className="mobile-overlay-actions">
                  <ScreenLink className="button button--subtle" screen={underlayScreen}>Close</ScreenLink>
                </div>
              </>
            ) : notifications.length ? (
              <>
                <ul className="approval-queue">
                  {notifications.map((item) => (
                    <li key={item.id}><strong>{item.category}</strong><small>{item.message}</small></li>
                  ))}
                </ul>
                <button className="button button--subtle" type="button" onClick={() => markNotificationsRead().then(onRefresh).catch(() => {})}>Mark all as read</button>
              </>
            ) : (
              <div className="mobile-empty mobile-empty--overlay">
                <strong>No notifications</strong>
                <span>You are all caught up.</span>
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
          {overviewState.error && !isDashboard && <WorkspaceSyncStatus overviewState={overviewState} onRefresh={onRefresh} />}
          {screen.kind === "dashboard" && <Dashboard overviewState={overviewState} onRefresh={onRefresh} search={dashboardSearch} />}
          {screen.kind === "staff-dashboard" && <StaffDashboard overviewState={overviewState} onRefresh={onRefresh} search={dashboardSearch} />}
          {screen.kind === "csv-import" && <CsvImportPanel authUser={authUser} existingRecords={overviewState.data?.records} onImported={onRefresh} />}
          {screen.kind === "data-export" && <DataExportPanel authUser={authUser} records={overviewState.data?.records} />}
          {screen.kind === "table" && <EmptyTable screen={screen} overview={overviewState.data} />}
          {screen.kind === "catalog" && <RecordsTable kind="products" rows={overviewState.data?.records?.products} title="Product catalog" />}
          {screen.kind === "form" && <FormPanel key={screen.id} screen={screen} authUser={authUser} onActionSaved={onRefresh} />}
          {screen.kind === "detail" && <DetailPanel screen={screen} overview={overviewState.data} authUser={authUser} onRecordsChanged={onRefresh} />}
          {screen.kind === "success" && <DetailPanel screen={screen} success overview={overviewState.data} authUser={authUser} onRecordsChanged={onRefresh} />}
          {screen.kind === "reports" && <DataReports overview={overviewState.data} authUser={authUser} />}
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
      if (event.key === null || event.key.startsWith("second-daze-")) setAuthUser(readAuthUser());
    };
    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, []);
  useEffect(() => {
    if (!authUser) return undefined;
    let cancelled = false;
    getCurrentUser().then((user) => {
      if (cancelled) return;
      if (!user) { clearAuthUser(); setAuthUser(null); return; }
      const verified = { username: user.username, role: user.role };
      saveAuthUser(verified);
      setAuthUser((previous) => (previous?.username === verified.username && previous?.role === verified.role ? previous : verified));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [authUser?.username]);
  useEffect(() => {
    if (!authUser) {
      setOverviewState({ status: "idle", data: null, error: "" });
      return undefined;
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
        const records = await getWorkspaceRecords({ signal: controller.signal });
        setOverviewState({ status: "ready", data: buildOverview(records), error: "" });
      } catch (error) {
        if (error.name === "AbortError") return;
        if (error.status === 401) {
          clearAuthUser();
          setAuthUser(null);
          return;
        }
        setOverviewState((previous) => ({
          ...previous,
          status: previous.data ? "ready" : "error",
          error: error.message || "Unable to load workspace data.",
        }));
      }
    };

    refresh();
    const intervalId = window.setInterval(refresh, 30000);
    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [authUser?.username, overviewRefresh]);

  const authenticateUser = (user) => {
    const normalizedUser = { username: user.username, role: user.role || "Staff" };
    saveAuthUser(normalizedUser);
    setAuthUser(normalizedUser);
    setAuthError("");
  };
  const handleSignOut = async (returnTo = "1-staff-sign-in") => {
    try {
      await signOut();
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
