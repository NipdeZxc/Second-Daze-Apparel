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
The app opens on staff sign-in. In development, use `admin` / `admin` to enter
the dashboard preview, or `pending@demo.local` with any non-empty password to
view the pending-approval screen. These demo credentials are not real
authentication and must not be used to protect production data.

Use the sidebar to move between workspace modules. Dashboard queues,
quick actions, and each page's related-workflow links connect common tasks—for
example, a refund request leads to item review and approval, while order details
lead to delivery confirmation. The mobile companion is a separate entry at
`http://127.0.0.1:5173/mobile` (or `https://your-vercel-domain/mobile`); it has
its own sign-in, Home/Approvals/Orders/Inventory navigation, notifications, and
sign-out. There is no link between the two app shells. Sign in with the same
backend account on either surface to use the same workspace.

Both surfaces read the shared `GET /api/workspace/overview/` endpoint. They
refresh it when opened, on demand, and every 30 seconds; changes persisted by a
connected backend can therefore appear in both dashboards without either app
linking directly to the other. When using the local demo login, this API is not
called and no data is synchronized.

## Deploy to Vercel

Create a Vercel project connected to this repository and set:

- **Root Directory:** `react_frontend`
- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Install command:** `npm ci`

The app uses hash-based routes, so direct navigation to a screen does not need
extra Vercel rewrite rules. The Vercel rewrite serves the SPA at `/mobile`.
Do not enable `VITE_ENABLE_DEMO_LOGIN` on a
production deployment. It is false by default in production builds; local Vite
development enables the preview flow.

## Backend integration

The frontend API helper is in [`react_frontend/src/api/client.js`](./react_frontend/src/api/client.js).
Set `VITE_API_BASE_URL` to the backend origin (leave it empty to use the same
origin). Vite environment variables are embedded at build time; set the value
in the Vercel project's environment settings and redeploy after changing it.

When demo login is disabled, the frontend expects:

- `POST /api/auth/login/` with JSON `{ "username": "...", "password": "..." }`
- `200` with JSON containing `user: { "username": "...", "role": "..." }` on success
- `401` for invalid credentials
- `403` with `{ "code": "access_pending" }` for pending approval
- `POST /api/auth/logout/` to end the backend session
- `GET /api/workspace/overview/` to provide data shared by both interfaces:

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
- `POST /api/workspace/actions/` with JSON containing the originating surface,
  screen ID, and submitted form values:

```json
{
  "source": "mobile",
  "screenId": "8.6-mobile-new-reservation",
  "values": {
    "Customer": "Customer name",
    "Product": "Product name",
    "Quantity": "1"
  }
}
```

The backend must validate the current user's role and each screen's fields,
persist the action, and update the overview/activity feed. Both interfaces
submit to this same endpoint and refresh the shared overview after success.

The API should use secure, HttpOnly session cookies. For a separate backend
origin, configure the backend's CORS and cookie policies for the Vercel domain.
The backend must enforce authentication and authorization on every protected
data endpoint; client-side navigation and local UI state are UX only. The
frontend is wired to the shared overview and action endpoints, but cross-surface
data synchronization requires the backend to implement those contracts and
persist the submitted actions.
