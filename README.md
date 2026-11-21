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
It includes the admin workspace and an independently accessible mobile
companion with its own sign-in and navigation. The original high-fidelity
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
The app opens on staff sign-in. In development, use `admin` / `admin` for the
admin dashboard or `staff` / `staff` for the staff dashboard.
Use `pending@demo.local` with any non-empty password to
view the pending-approval screen. These demo credentials are not real
authentication and must not be used to protect production data.

Admin and staff menus share the same header, sidebar, typography, and responsive
layout across dashboards, orders, customers, and other workspace modules.
Click the name (or avatar on small screens) in the top-right corner and choose
**Log out** to return to sign-in.
Use the sidebar to move between workspace modules. Dashboard queues,
quick actions, and each page's related-workflow links connect common tasks—for
example, a refund request leads to item review and approval, while order details
lead to delivery confirmation. The mobile companion is a separate entry at
`http://127.0.0.1:5173/mobile` (or `https://your-vercel-domain/mobile`); it has
its own sign-in, Home/Approvals/Orders/Inventory navigation, notifications, and
sign-out. There is no link between the two app shells. Sign in with the same
backend account on either surface to use the same workspace.

Both surfaces read the same database-backed endpoint, `GET /api/data/records`.
They refresh it when opened, on demand, and every 30 seconds, so changes made on
one surface appear on the other. Nothing is stored in the browser except a
username/role hint; the session is an HttpOnly cookie validated by `/api/me`.

## Database-backed features

Every list, dashboard, report, form and approval reads or writes the TiDB/MySQL
database (schema: `Team10/second_daze_schema_tidb.sql`) through the `/api`
serverless function (`api/[...route].js`). The business rules (stock holds,
payment verification, document numbering, expiry, role checks) are enforced
server-side in `api/_lib/routes/data.js`.

Required environment variables on Vercel: `DB_HOST`, `DB_PORT`, `DB_USER`,
`DB_PASSWORD`, `DB_NAME`, `SESSION_SECRET` (32+ characters). For the class
test logins set `ENABLE_TEST_ACCOUNTS=true`: signing in as `admin` / `admin` or
`staff` / `staff` then creates those accounts in the database on first use.
These credentials are deliberately weak; **remove the flag before handling real
data**.

Workflow notes:

- Orders, reservations, refunds and sales are created through their forms and
  row actions (approve, record GCash payment, verify payment, pack, ship,
  deliver, complete, cancel, refund), not by CSV import.
- Products and customers can be bulk-added by an Admin through **Import CSV**.
- Expired reservations are voided and their stock released whenever data is
  read; there is no scheduled job.

## Import CSV data

Sign in as an Admin, then select **Import CSV**. Choose a data type and
download its header-only template:

- **Products:** `product_code`, `product_name`, `cost_price`, `selling_price`,
  `stock_quantity`, `low_stock_threshold`. Optional: `category`, `size`.
- **Customers:** `full_name`, `contact_number`, `street_address`, `barangay`,
  `city_municipality`, `province`.

Prices must be non-negative plain numbers with at most two decimal places and
quantities non-negative whole numbers. Each file may contain up to 5,000 data
rows and must be 2 MB or smaller. Select **Preview CSV**, review the first ten
rows, then **Import records**. Invalid rows and duplicate identifiers reject the
entire import; imports only add records and never overwrite existing ones.

Data tables include search, sortable columns, status filters, pagination, View,
and the row actions allowed for the signed-in role. Admins can edit products and
customers.

Run the CSV validation and dashboard aggregation tests with
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

## Backend API

The frontend API helpers are in [`react_frontend/src/api/`](./react_frontend/src/api/).
Leave `VITE_API_BASE_URL` empty to use the same origin.

- `POST /api/login`, `POST /api/logout`, `GET /api/me`
- `GET /api/data/records` – all business data for the signed-in role, with the
  actions each row currently allows
- `POST /api/data/actions` – form submissions `{ screenId, values }`
- `POST /api/data/import`, `PUT /api/data/:kind/:id`
- `POST /api/data/:kind/:id/:action` – row actions
- `POST /api/data/notifications-read`

Every protected endpoint checks the session and role on the server;
client-side navigation is UX only.
