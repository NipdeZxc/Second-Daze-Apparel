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
It includes the Sections 1–7 admin workspace, the Section 8 mobile companion,
and Section 9 notification and approval overlays. The original high-fidelity
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

Use the sidebar to move between the main-system modules. **Screen index** lists
every screen; **Mobile companion** opens the mobile workflows. Mobile bottom
navigation switches between Home, Approvals, Orders, and Inventory. The
notification icon opens the relevant Section 9 overlay, and its close button
returns to the underlying mobile screen. Sign out from the sidebar or the
mobile header.

## Deploy to Vercel

Create a Vercel project connected to this repository and set:

- **Root Directory:** `react_frontend`
- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Install command:** `npm ci`

The app uses hash-based routes, so direct navigation to a screen does not need
extra Vercel rewrite rules. Do not enable `VITE_ENABLE_DEMO_LOGIN` on a
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

The API should use secure, HttpOnly session cookies. For a separate backend
origin, configure the backend's CORS and cookie policies for the Vercel domain.
The backend must enforce authentication and authorization on every protected
data endpoint; client-side navigation and session state are UX only. Forms,
reports, metrics, and records are still preview-only until connected to real
API endpoints.
