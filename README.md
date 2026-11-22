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
It provides separate Admin, Sales Management, and Inventory Management
workspaces in one responsive app. The original high-fidelity screenshots are retained in [`High Fidelity`](<./High%20Fidelity/>), and
[`second_daze_physical_schema.sql`](./second_daze_physical_schema.sql) is kept
as a backend reference.

## Run locally

Install Node.js 20.19 or newer, then from the repository root install the
dependencies and start the integrated frontend/API app:

```powershell
npm ci
npm --prefix react_frontend ci
npx vercel dev
```

Configure the required database and session environment variables before
signing in. The app uses the server-backed login and session endpoints; it has
no demo login or browser-local business data. A Vite-only `npm run dev` does not
serve the `/api/*` functions.

The workspace navigation and dashboards are specific to Admin, Sales
Management, and Inventory Management. The same app reflows for desktop and
mobile; the legacy `/mobile` URL redirects to the signed-in user's workspace.
Use the sidebar (or its compact mobile navigation) to move between modules.
Related-workflow links connect tasks such as creating a refund request,
reviewing it, and recording the Admin decision.

Workspace records are loaded from `GET /api/data/records` and refreshed on
demand and every 30 seconds. Authentication is restored from the server-validated
HttpOnly session cookie; the browser does not persist user or business records.

## Database-backed features

Every list, dashboard, report, form and approval reads or writes the TiDB/MySQL
database (schema: `Team10/second_daze_schema_tidb.sql`) through the `/api`
serverless function (`api/[...route].js`). The business rules (stock holds,
payment verification, document numbering, expiry, role checks) are enforced
server-side in `api/_lib/routes/data.js`.

Required environment variables on Vercel: `DB_HOST`, `DB_PORT`, `DB_USER`,
`DB_PASSWORD`, `DB_NAME`, `SESSION_SECRET` (32+ characters). The database
connector also accepts TiDB Marketplace's `TIDB_HOST`, `TIDB_PORT`, `TIDB_USER`,
`TIDB_PASSWORD`, and `TIDB_DATABASE` variables directly. Optionally set
`DB_SSL_CA` to a PEM CA certificate if your cluster requires it. For the class
test logins set `ENABLE_TEST_ACCOUNTS=true`: signing in as `admin` / `admin` or
`staff` / `staff` then creates those accounts in the database on first use.
These credentials are deliberately weak; **remove the flag before handling real
data**.

Workflow notes:

- Orders, reservations, refunds and sales are created through their forms and
  row actions (approve, record GCash payment, verify payment, pack, ship,
  deliver, complete, cancel, refund). Admins can also load the provided
  historical dataset CSVs for review through the separate batch-import option.
- Products and customers can be bulk-added by an Admin through **Import CSV**.
- Admins can permanently delete individual products, customers, orders,
  reservations, and refunds from their record tables. A confirmation identifies
  the selected record, and records with linked history cannot be deleted.
- Expired reservations are voided and their stock released whenever data is
  read; there is no scheduled job. Stock is only released against recorded
  reservation holds. Historical imports without hold movements are voided
  without changing inventory, with an audit entry and notification explaining
  why. Recorded holds with inconsistent balances require inventory reconciliation.

## Import CSV data

Sign in as an Admin, then select **Import CSV**. Choose a data type and
download its header-only template:

- **Products:** `product_code`, `product_name`, `cost_price`, `selling_price`,
  `stock_quantity`, `low_stock_threshold`. Optional: `category`, `size`.
- **Customers:** `full_name`, `contact_number`, `street_address`, `barangay`,
  `city_municipality`, `province`.

Prices must be non-negative plain numbers with at most two decimal places and
quantities non-negative whole numbers. Each file may contain up to 5,000 data
rows and must be 2 MB or smaller. Select **Preview CSV**, review the first ten rows, then **Import records**.
Invalid rows and duplicate identifiers within the file reject the entire import.
For products, a new product code creates a product with the CSV stock quantity;
an existing product code adds that quantity to current stock and records a stock
movement without changing the product details. A file whose product codes and quantities were already imported is rejected, even if renamed, so stock is never added twice; change the quantities to import a new shipment.
Existing customer contact numbers are rejected rather than overwritten.

For the files in [`dataset/`](./dataset/), use **Import multiple TiDB dataset
files** and select one or more files at once. The files are named after the
schema tables (for example `product.csv`, `orders.csv`, and
`stock_movement.csv`). The importer validates their TiDB column headers, remaps
IDs to avoid collisions, inserts tables in foreign-key order, and saves the
whole selection in one transaction. If a file fails, none of the batch is
saved. Include any files referenced by the selected rows (usually the full
dataset) so remapped IDs preserve foreign-key relationships. Select no more
than 15 files, 2 MB per file, 3 MB total, and 10,000 rows per batch.

The legacy dataset is normalized to the TiDB enum and relationship rules.
Legacy user roles map to the app's three roles; imported user passwords must be
reset before those accounts can sign in. Duplicate purchase-order rows that
violated the TiDB one-PO-per-order rule are omitted, and extra order-to-
reservation links are cleared while retained in the order notes.

Data tables include search, sortable columns, status filters, pagination, View,
and the row actions allowed for the signed-in role. Admins can edit products and
customers.

Run the frontend, API-client, role-access, CSV validation, and dashboard
aggregation tests with
`npm --prefix react_frontend test` from the repository root.

## Export records

Sign in as an Admin, then choose **Export records** from the sidebar or
dashboard. **Download CSV** creates one UTF-8 CSV containing the shared
workspace records; its `record_type` column identifies each row.
**Download Excel** creates an `.xlsx` workbook with a separate sheet for each
record type. Exports include products, customers, orders, sales, reservations,
refunds, sales documents, and staff accounts. Exported columns match the
workspace record lists. Staff accounts cannot access this screen.

## Deploy to Vercel

Create a Vercel project connected to this repository and set:

- **Root Directory:** repository root (`.`)
- **Framework preset:** Vite
- **Build command:** `npm --prefix react_frontend run build`
- **Output directory:** `react_frontend/dist`
- **Install command:** `npm ci && npm --prefix react_frontend ci`

Use the repository root so Vercel deploys the top-level `api` serverless
functions as well as the React frontend. The root `vercel.json` contains these
build settings.

The app uses hash-based routes, so direct navigation to a screen does not need
extra Vercel rewrite rules. The legacy `/mobile` rewrite opens the same
responsive app and routes to the signed-in user's role dashboard.

## Backend API

The frontend API helpers are in [`react_frontend/src/api/`](./react_frontend/src/api/).
Leave `VITE_API_BASE_URL` empty to use the same origin.

- `POST /api/login`, `POST /api/logout`, `GET /api/me`
- `GET /api/data/records` – all business data for the signed-in role, with the
  actions each row currently allows
- `POST /api/data/actions` – form submissions `{ screenId, values }`
- `POST /api/data/import`, `PUT /api/data/:kind/:id`
- `DELETE /api/data/:kind/:id` – Admin-only deletion of an unlinked individual record
- `POST /api/data/import-batch` – Admin-only atomic TiDB dataset import
- `POST /api/data/:kind/:id/:action` – row actions
- `POST /api/data/notifications-read`

Every protected endpoint checks the session and role on the server;
client-side navigation is UX only.
