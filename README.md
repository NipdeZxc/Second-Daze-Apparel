# Technological University of the Philippines
## System Analysis and Design

**Section:** BSIS - 3A · **Team:** 8

**Team Leader:** Jae Marvin L. Salazar

**Members:** Emmanuel M. Carurucan, Armhel G. Mayao, Marc Iñigo P. Orozco,
Rheinwell Q. Palomares

## Instructional materials

- [BSIS Agile SAD Curriculum](https://tupcossad.netlify.app/)
- [Google Drive materials](https://drive.google.com/drive/folders/1e6S8s2XvSlx_qyoAlUGewRo02ndxR-e3?usp=drive_link)

## Second Daze Apparel frontend

The deployable frontend is the React + Vite app in [`react_frontend`](./react_frontend/).
It includes role-based Admin, Sales Management, and Inventory Management
workspaces in one responsive app. The original high-fidelity
screenshots are retained in [`High Fidelity`](<./High%20Fidelity/>), and
[`second_daze_physical_schema.sql`](./second_daze_physical_schema.sql) is kept
as a backend reference.

## Run locally

Install Node.js 20.19 or newer, then from the repository root run:

```powershell
cd react_frontend
npm ci
npm run dev
```

Open the Vite URL printed in the terminal (usually `http://127.0.0.1:5173/`).
The app opens on sign-in. In development, use `admin` / `admin`,
`sales` / `sales`, or `inventory` / `inventory` to preview the Admin,
Sales Management, and Inventory Management workspaces, respectively. These
are browser-only demo accounts, not production authentication.
Use `pending@demo.local` with any non-empty password to
view the pending-approval screen. These demo credentials are not real
authentication and must not be used to protect production data.

The same responsive app shell adapts its navigation and content from desktop to
mobile. Each role has a separate dashboard and navigation; these are frontend
views only, not a security boundary. Click the profile in the top-right corner
and choose **Log out** to return to sign-in. Dashboard queues and related
workflow links connect common tasks. The legacy `/mobile` URL now opens the
same app and redirects to the signed-in role's dashboard (or sign-in).

When connected to a backend, the app reads `GET /api/workspace/overview/` and
refreshes on demand and every 30 seconds. When using demo login, it displays
records imported into the current browser's storage. No sample products,
customers, orders, sales, reservations, names, notifications, or dashboard
figures are seeded.

## Import CSV data (temporary local mode)

Sign in as `admin` / `admin`, then select **Import CSV** in the sidebar or
admin dashboard. Choose a data type and download its header-only template:

- **Products and inventory:** `sku`, `product_name`, `cost_price`,
  `selling_price`, `qty_available`, `low_stock_threshold`. Optional:
  `category`, `size`, `color`.
- **Customers:** `customer_code`, `full_name`, `contact_number`. Optional:
  `email`, `address`, `city`.
- **Orders:** `order_no`, `customer_code`, `total_amount`, `status`, `ordered_at`.
- **Sales:** `sale_no`, `order_no`, `amount`, `cost`, `sold_at`.
- **Reservations:** `reservation_no`, `customer_code`, `status`, `expires_at`.

Import customers before orders/reservations, and orders before sales.
Dates accept `YYYY-MM-DD` or ISO timestamps with a timezone. Prices must be
non-negative plain numbers with at most two decimal places. Quantities must
be non-negative whole numbers. Supported statuses are shown beside the import
form. Each file may contain up to 5,000 data rows and must be 2 MB or smaller.

Select **Preview CSV**, review the first ten rows, then **Import records** to
save. Invalid rows, missing references, duplicate identifiers (case-insensitive,
within the file or existing data), and storage errors reject the entire import.
Imports only add records; they do not overwrite existing records. Inventory
quantities are snapshots: importing sales or orders does not change stock.
Sales metrics use imported sales and their recorded costs; order metrics use
imported orders. Empty datasets display zero counts or unavailable/empty states,
not made-up values. Lists, dashboards, reports, and the product catalog read
the saved records; other unimplemented workflows remain explicitly unavailable.

Data tables include search, sortable columns, status filters where supported,
pagination, and View actions. Admin demo users can edit imported records; edits
are validated and saved only in the current browser. Dashboard KPI cards and
work queues navigate to their related screens, and the sales chart can show the
last 7 or 30 days. Workflow forms show field errors and a review confirmation;
demo actions explicitly state that they are not saved.

Data persists across reloads and sign-out on the **same browser and origin**
and is available to the role previews there. Other tabs refresh after an import.
It is **not a database**, is not shared across browsers/devices, and can be lost
when site data is cleared. Keep original CSV files as backups. Demo roles only
hide/disable UI; they are not a security boundary. Do not import sensitive or
production data. A shared, authenticated backend can replace this temporary mode
later; none is required or started for CSV imports.

Run the CSV validation, persistence, and dashboard aggregation tests with
`npm --prefix react_frontend test` from the repository root.

## Deploy to Vercel

Create a Vercel project connected to this repository and set:

- **Root Directory:** `react_frontend`
- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Install command:** `npm ci`

The app uses hash-based routes, so direct navigation to a screen does not need
extra Vercel rewrite rules. The Vercel rewrite serves the SPA at `/mobile`.
The current Vercel configurations enable `VITE_ENABLE_DEMO_LOGIN=true` for a
temporary, browser-only preview. Before handling production data, remove that
setting, disable demo login, and configure a real authenticated backend.
Local Vite development also enables the preview flow.

## Backend integration

The frontend API helper is in [`react_frontend/src/api/client.js`](./react_frontend/src/api/client.js).
Set `VITE_API_BASE_URL` to the backend origin (leave it empty to use the same
origin). Vite environment variables are embedded at build time; set the value
in the Vercel project's environment settings and redeploy after changing it.

When demo login is disabled, the frontend expects the backend to return one of
the roles `Admin`, `Sales Management`, or `Inventory Management`. The frontend
uses the role to choose its dashboard and navigation; the backend must still
enforce access on every protected endpoint. The app expects:

- `POST /api/auth/login/` with JSON `{ "username": "...", "password": "..." }`
- `200` with JSON containing `user: { "username": "...", "role": "..." }` on success
- `401` for invalid credentials
- `403` with `{ "code": "access_pending" }` for pending approval
- `POST /api/auth/logout/` to end the backend session
- `GET /api/workspace/overview/` to provide data for the responsive app:

```json
{
  "queues": {
    "accessApprovals": 0,
    "ordersToFulfill": 0,
    "lowStockItems": 0
  },
  "recentActivity": [
    { "id": "event-id", "message": "Reservation updated", "createdAt": "2026-11-20T08:00:00Z" }
  ],
  "updatedAt": "2026-11-20T08:00:00Z"
}
```
- `POST /api/workspace/actions/` with JSON containing the app surface,
  screen ID, and submitted form values:

```json
{
  "source": "web",
  "screenId": "5.1-new-reservation",
  "values": {
    "Customer": "Customer name",
    "Product": "Product name",
    "Quantity": "1"
  }
}
```

The backend must validate the current user's role and each screen's fields,
persist the action, and update the overview/activity feed. The UI form
integration is a prototype contract; workflow-specific APIs and persistence
remain backend work.

The API should use secure, HttpOnly session cookies. For a separate backend
origin, configure the backend's CORS and cookie policies for the Vercel domain.
The backend must enforce authentication and authorization on every protected
data endpoint; client-side navigation and local UI state are UX only. The
frontend is wired to the shared overview and action endpoints, but cross-surface
data synchronization requires the backend to implement those contracts and
persist the submitted actions.
