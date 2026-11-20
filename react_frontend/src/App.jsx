import { useEffect, useState } from "react";
import { formFields, groups, screens, tableColumns } from "./screens.js";
import { demoLoginEnabled, signIn, signOut } from "./api/auth.js";

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
  key: <><circle cx="8" cy="15" r="5" /><path d="m11.5 11.5 8-8 2 2-2 2 2 2-3 3-2-2-3.5 3.5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
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

function screenIcon(screen) {
  if (screen.id === "2-admin-dashboard") return "home";
  if (screen.group === "Mobile companion") return "smartphone";
  if (screen.group === "Mobile overlays") return "bell";
  if (screen.id === "2.4-refunds" || screen.id.startsWith("2.3-")) return "bag";
  if (screen.id === "2.5-reservations") return "calendar";
  if (screen.id === "2.6-reports") return "chart";
  const section = screen.id.split(/[.-]/)[0];
  return { 1: "key", 2: "users", 3: "bag", 4: "box", 5: "calendar", 6: "chart", 7: "users" }[section] || "grid";
}

function readAuthUser() {
  const username = sessionStorage.getItem("second-daze-username");
  if (!username) return null;
  return {
    username,
    role: sessionStorage.getItem("second-daze-role") || "Staff",
    demo: sessionStorage.getItem("second-daze-demo") === "true",
  };
}

function saveAuthUser(user) {
  sessionStorage.setItem("second-daze-username", user.username);
  sessionStorage.setItem("second-daze-role", user.role || "Staff");
  sessionStorage.setItem("second-daze-demo", String(user.demo));
}

function clearAuthUser() {
  sessionStorage.removeItem("second-daze-username");
  sessionStorage.removeItem("second-daze-role");
  sessionStorage.removeItem("second-daze-demo");
}

function routeId() {
  return decodeURIComponent(window.location.hash.replace(/^#\/?/, "").split("?")[0]);
}

function ScreenLink({ screen, children, className = "", ...linkProps }) {
  return (
    <a {...linkProps} className={className} href={`#/${screen.id}`}>
      {children || screen.title}
    </a>
  );
}

function Brand({ compact = false, to = "#/screens" }) {
  return (
    <a className={`brand ${compact ? "brand--compact" : ""}`} href={to} aria-label="Second Daze workspace">
      <img src="/brand-logo.jpg" alt="" />
      <span>Second Daze</span>
    </a>
  );
}

function Directory({ authUser }) {
  return (
    <main className="directory">
      <header className="directory__header">
        <Brand to={authUser ? "#/2-admin-dashboard" : "#/screens"} />
        {authUser ? (
          <ScreenLink screen={mainScreens.find((screen) => screen.id === "2-admin-dashboard")} className="text-link">
            Return to dashboard
          </ScreenLink>
        ) : (
          <ScreenLink screen={mainScreens.find((screen) => screen.id === "1-staff-sign-in")} className="text-link">
            Sign in
          </ScreenLink>
        )}
      </header>
      <section className="directory__intro directory__intro--index">
        <p className="eyebrow">WORKSPACE NAVIGATION</p>
        <h1>Screen index</h1>
        <p className="lede">
          Select a workflow screen. Sign in to open the dashboard; records and actions remain unconnected until a backend is added.
        </p>
      </section>
      <div className="directory__groups">
        {groups.map((group, index) => (
          <section className="directory-group" key={group.title}>
            <div className="directory-group__heading">
              <span className="group-index">0{index + 1}</span>
              <div>
                <h2>{group.title}</h2>
                <p>{group.screens.length} screens</p>
              </div>
            </div>
            <div className="screen-grid">
              {group.screens.map((screen) => (
                <ScreenLink className="screen-card" key={screen.id} screen={screen}>
                  <span className="screen-card__number">{screen.id.split("-")[0]}</span>
                  <span className="screen-card__title">{screen.title}</span>
                  <span className="screen-card__arrow" aria-hidden="true">↗</span>
                </ScreenLink>
              ))}
            </div>
          </section>
        ))}
      </div>
      <footer className="directory__footer">
        <span>Second Daze Apparel</span>
        <span>UI prototype · Temporary demo login only</span>
      </footer>
    </main>
  );
}

function Sidebar({ active, authUser, onSignOut }) {
  const navGroups = [
    { title: "Overview", icon: "home", ids: ["2-admin-dashboard"] },
    { title: "Administration", icon: "users", ids: ["2.1-subaccounts", "2.2-access-approvals"] },
    { title: "Sales", icon: "bag", ids: ["3-sales-catalog", "3.3-sales-documents", "2.4-refunds", "3.9-orders-status-tracking", "3.11-customers"] },
    { title: "Inventory", icon: "box", ids: ["4-inventory-workspace", "4.2-low-stock-alerts"] },
    { title: "Reservations", icon: "calendar", ids: ["5-reservations"] },
    { title: "Reports", icon: "chart", ids: ["2.6-reports"] },
    { title: "Staff", icon: "users", ids: ["7-staff-accounts"] },
  ].map((group) => ({
    title: group.title,
    items: group.ids.map((id) => mainScreens.find((screen) => screen.id === id)),
  }));

  return (
    <aside className="sidebar">
      <Brand compact to="#/2-admin-dashboard" />
      <p className="sidebar__label">MAIN SYSTEM</p>
      <nav aria-label="Main system screens">
        {navGroups.map((group) => (
          <div className="nav-group" key={group.title}>
            <p className="nav-group__title">{group.title}</p>
            {group.items.map((screen) => (
              <ScreenLink
                key={screen.id}
                screen={screen}
                className={`nav-link ${active === screen.id ? "is-active" : ""}`}
              >
                <Icon className="nav-link__icon" name={group.icon} size={15} />
                {screen.title}
              </ScreenLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar__bottom">
        <a href="#/screens" className="nav-link"><Icon className="nav-link__icon" name="grid" size={15} />Screen index</a>
        <ScreenLink screen={mobileScreens[1]} className="nav-link">
          <Icon className="nav-link__icon" name="smartphone" size={15} />Mobile companion
        </ScreenLink>
        <button className="nav-link sidebar__sign-out" type="button" onClick={onSignOut} aria-label={`Sign out ${authUser?.username || ""}`}>
          <Icon className="nav-link__icon" name="logout" size={15} />Sign out
        </button>
        <span className="sidebar__note">{authUser?.demo ? "Demo preview · no data is saved" : `Signed in as ${authUser?.role || "Staff"}`}</span>
      </div>
    </aside>
  );
}

function PageHeader({ screen }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">SECOND DAZE / {screen.group.toUpperCase()}</p>
        <div className="page-header__title-row">
          <span className="page-header__icon"><Icon name={screenIcon(screen)} size={19} /></span>
          <h1>{screen.title}</h1>
        </div>
        <p>{screen.description}</p>
      </div>
      <span className="prototype-tag">{authLabel(screen)}</span>
    </header>
  );
}

function authLabel(screen) {
  return screen.group === "Mobile companion" || screen.group === "Mobile overlays"
    ? "Mobile companion"
    : "Main system";
}

function EmptyTable({ screen }) {
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

function Dashboard() {
  const queues = [
    { title: "Access approvals", description: "Staff access requests waiting for review.", screenId: "2.2-access-approvals" },
    { title: "Orders to fulfill", description: "Orders requiring payment or delivery follow-up.", screenId: "3.9-orders-status-tracking" },
    { title: "Low-stock items", description: "Inventory below its restock threshold.", screenId: "4.2-low-stock-alerts" },
  ];
  const actions = [
    { title: "Create purchase order", screenId: "3.13-create-purchase-order" },
    { title: "New reservation", screenId: "5.1-new-reservation" },
    { title: "Record a refund", screenId: "3.4-new-refund-request" },
  ];
  return (
    <div className="dashboard-workspace">
      <section className="dashboard-quick-actions" aria-labelledby="quick-actions-title">
        <div className="dashboard-section-heading">
          <div><h2 id="quick-actions-title">Quick actions</h2><p>Start a common workflow.</p></div>
        </div>
        <div className="dashboard-action-list">
          {actions.map((action) => (
            <ScreenLink className="dashboard-action-link" screen={screens.find((screen) => screen.id === action.screenId)} key={action.screenId}>
              <span className="dashboard-action-icon"><Icon name="plus" size={15} /></span>
              <span>{action.title}</span>
              <Icon className="dashboard-action-arrow" name="arrow" size={15} />
            </ScreenLink>
          ))}
        </div>
      </section>
      <section className="dashboard-queues" aria-labelledby="queues-title">
        <div className="dashboard-section-heading">
          <div><h2 id="queues-title">Work queues</h2><p>Items requiring action across the workspace.</p></div>
        </div>
        <div className="dashboard-queue-grid">
          {queues.map((queue) => (
            <article className="panel dashboard-queue" key={queue.screenId}>
              <div className="dashboard-queue__heading">
                <h3>{queue.title}</h3>
                <ScreenLink className="text-link" screen={screens.find((screen) => screen.id === queue.screenId)}>Open queue</ScreenLink>
              </div>
              <p>{queue.description}</p>
              <div className="dashboard-queue__empty">Queue data will appear when connected.</div>
            </article>
          ))}
        </div>
      </section>
      <section className="panel activity-panel">
        <div className="panel__top">
          <div><h2>Recent activity</h2><p>Latest changes recorded in the workspace.</p></div>
          <span className="quiet-tag">Activity log</span>
        </div>
        <div className="activity-empty">Activity will appear when records are available.</div>
      </section>
    </div>
  );
}

function FormPanel({ screen, mobile = false }) {
  const [message, setMessage] = useState("");
  const fields = formFields[screen.id] || ["Customer", "Order reference", "Details"];
  return (
    <form className={`panel form-panel ${mobile ? "form-panel--mobile" : ""}`} onSubmit={(event) => {
      event.preventDefault();
      setMessage("This preview does not save or send data.");
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
              <textarea rows="3" placeholder={`Enter ${field.toLowerCase()}`} />
            ) : (
              <input type={field.toLowerCase().includes("date") ? "date" : "text"} placeholder={`Enter ${field.toLowerCase()}`} />
            )}
          </label>
        ))}
      </div>
      <div className="form-actions">
        {message && <span className="form-note" role="status">{message}</span>}
        <button className="button button--primary" type="submit">{mobile ? "Continue" : "Save preview"}</button>
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

function ReportsPanel() {
  return (
    <section className="report-grid">
      {["Sales performance", "Inventory distribution", "Fulfillment activity", "Reporting period"].map((item) => (
        <article className="panel report-card" key={item}>
          <span className="eyebrow">REPORT</span>
          <h2>{item}</h2>
          <p>Connect recorded data to populate this report.</p>
          <div className="report-card__empty">No data available</div>
        </article>
      ))}
    </section>
  );
}

function CatalogPanel() {
  return (
    <section className="panel catalog-panel">
      <div className="panel__top">
        <div><h2>Product catalog</h2><p>Product images and stock levels will be supplied by live inventory data.</p></div>
        <span className="quiet-tag">Catalog empty</span>
      </div>
      <div className="empty-message"><span className="empty-message__icon">⌕</span><p>No products to display yet.</p></div>
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
        window.location.hash = "/2-admin-dashboard";
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
        <a className="text-link auth-content__back" href="#/screens">← All screens</a>
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
                ? <>Demo login: <code>admin</code> / <code>admin</code>. Use <code>pending@demo.local</code> with any password to preview approval.</>
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
          window.location.hash = "/1.2-access-awaiting-approval";
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

function MobileContent({ screen, onAuthenticated }) {
  if (screen.kind === "mobile-form") return <FormPanel key={screen.id} screen={screen} mobile />;
  if (screen.kind === "mobile-auth") {
    return <MobileLogin onAuthenticated={onAuthenticated} />;
  }
  if (screen.kind === "mobile-list" || screen.kind === "mobile-stock") {
    return (
      <section className="mobile-worklist">
        <div className="mobile-worklist__heading">
          <h2>{screen.kind === "mobile-stock" ? "Stock alerts" : screen.id === "8.2-mobile-approvals" ? "Approval queue" : "Order queue"}</h2>
          <span className="quiet-tag">All items</span>
        </div>
        <div className="mobile-empty">
          <strong>No records to display</strong>
          <span>Connect the workspace data source to load this queue.</span>
        </div>
      </section>
    );
  }
  return (
    <div className="mobile-dashboard">
      <section className="mobile-worklist">
        <div className="mobile-worklist__heading">
          <h2>Needs attention</h2>
          <ScreenLink className="text-link" screen={mobileScreens.find((item) => item.id === "8.2-mobile-approvals")}>View approvals</ScreenLink>
        </div>
        <div className="mobile-empty">
          <strong>Work queue is unavailable</strong>
          <span>Connect the workspace data source to load assigned items.</span>
        </div>
      </section>
      <section className="mobile-quick-actions">
        <h2>Quick actions</h2>
        <ScreenLink screen={mobileScreens.find((item) => item.id === "8.3-mobile-checkout-gcash")}>Record GCash payment <span aria-hidden="true">→</span></ScreenLink>
        <ScreenLink screen={mobileScreens.find((item) => item.id === "8.6-mobile-new-reservation")}>Request reservation <span aria-hidden="true">→</span></ScreenLink>
      </section>
      <section className="mobile-worklist">
        <div className="mobile-worklist__heading"><h2>Orders</h2><ScreenLink className="text-link" screen={mobileScreens.find((item) => item.id === "8.4-mobile-orders")}>View orders</ScreenLink></div>
        <p className="mobile-inline-empty">Order data will appear here when available.</p>
      </section>
    </div>
  );
}

function MobilePreview({ screen, onAuthenticated, authUser, onSignOut }) {
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
          <Brand compact to={screen.kind === "mobile-auth" ? "#/screens" : "#/8.1-mobile-admin-dashboard"} />
          <a className="mobile-directory-link" href="#/screens" aria-label="Open screen index"><Icon name="grid" size={15} /><span>Screens</span></a>
          {screen.kind !== "mobile-auth" && (
            <ScreenLink className={`mobile-notifications ${isOverlay ? "is-current" : ""}`} screen={notificationScreen} aria-label="Notifications">
              <Icon name="bell" size={16} /><span className="mobile-notifications__label">Notifications</span>
            </ScreenLink>
          )}
          {screen.kind !== "mobile-auth" && (
            <button className="mobile-avatar" type="button" onClick={onSignOut} aria-label={`Sign out ${authUser?.username || ""}`}>
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
          <MobileContent screen={underlayScreen} onAuthenticated={onAuthenticated} />
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
            <a className="text-link" href="#/screens">Screen index</a>
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

function MainPreview({ screen, authUser, onAuthenticated, onSignOut }) {
  if (screen.kind.startsWith("auth") || screen.kind === "pending") {
    return <AuthScreen key={screen.id} screen={screen} onAuthenticated={onAuthenticated} />;
  }
  return (
    <div className="app-shell">
      <Sidebar active={screen.id} authUser={authUser} onSignOut={onSignOut} />
      <main className="workspace">
        <PageHeader screen={screen} />
        <div className="workspace__body">
          {screen.kind === "dashboard" && <Dashboard />}
          {screen.kind === "table" && <EmptyTable screen={screen} />}
          {screen.kind === "catalog" && <CatalogPanel />}
          {screen.kind === "form" && <FormPanel key={screen.id} screen={screen} />}
          {screen.kind === "detail" && <DetailPanel screen={screen} />}
          {screen.kind === "success" && <DetailPanel screen={screen} success />}
          {screen.kind === "reports" && <ReportsPanel />}
        </div>
        <footer className="workspace__footer"><span>Second Daze Apparel</span><span>Main system</span></footer>
      </main>
    </div>
  );
}

export default function App() {
  const [authUser, setAuthUser] = useState(readAuthUser);
  const [currentId, setCurrentId] = useState(() => routeId());
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    const updateRoute = () => setCurrentId(routeId());
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
  }, []);

  const authenticateUser = (user, demo) => {
    const normalizedUser = { ...user, role: user.role || "Staff", demo };
    saveAuthUser(normalizedUser);
    setAuthUser(normalizedUser);
    setAuthError("");
  };
  const handleSignOut = async () => {
    try {
      await signOut(authUser || { demo: true });
      clearAuthUser();
      setAuthUser(null);
      setAuthError("");
      window.location.hash = "/1-staff-sign-in";
    } catch (error) {
      setAuthError(error.message || "Unable to sign out.");
    }
  };

  const requestedId = currentId || (authUser ? "2-admin-dashboard" : "1-staff-sign-in");
  const isScreenIndex = requestedId === "screens";
  const requestedScreen = screens.find((item) => item.id === requestedId)
    || screens.find((item) => item.id === "1-staff-sign-in");
  const publicScreen = requestedScreen.kind.startsWith("auth") || requestedScreen.kind === "pending";
  const requiresAuthentication = !isScreenIndex && !publicScreen && requestedScreen.id !== "8-mobile-sign-in";
  useEffect(() => {
    if (!authUser && requiresAuthentication) {
      window.location.hash = "/1-staff-sign-in";
    }
  }, [authUser, requestedId, requiresAuthentication]);

  if (isScreenIndex) return <Directory authUser={authUser} />;
  const screen = !authUser && requiresAuthentication
    ? screens.find((item) => item.id === "1-staff-sign-in")
    : requestedScreen;

  if (screen.group !== "Main system") {
    return (
      <>
        {authError && <p className="global-error" role="alert">{authError}</p>}
        <MobilePreview
          key={screen.id}
          screen={screen}
          onAuthenticated={authenticateUser}
          authUser={authUser}
          onSignOut={handleSignOut}
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
      />
    </>
  );
}
