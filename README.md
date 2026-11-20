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

Install Node.js 20.19 or newer and the Vercel CLI. The full application uses
the React frontend and Phase 1 serverless functions in one origin so its secure,
HttpOnly session cookie works. From the repository root:

```powershell
npm ci
npm --prefix react_frontend ci
npx vercel dev
```

Configure the required database and mail environment variables in the local
Vercel environment before signing in. The frontend no longer has demo accounts
or browser-local business data. A Vite-only `npm run dev` starts the UI but not
the `/api/*` functions.

The same React app adapts across desktop and mobile, with separate Admin,
Sales Management, and Inventory Management navigation. These client-side
navigation rules are for usability only; the server enforces access. The old
`/mobile` URL redirects to the unified app.

Phase 1 provides authentication, password management, subaccounts, and CSV
export. Product, customer, order, reservation, refund, reporting, and notification
data endpoints are not in Phase 1, so those screens show unavailable/empty
states and the forms only validate locally; they do not claim to save.

Run the frontend tests with `npm --prefix react_frontend test` and build it with
`npm run build`.

## Deploy to Vercel

Create a Vercel project connected to this repository and use the repository
root as the project root. The root Vercel configuration builds the React app
and exposes the Phase 1 API through `api/[...route].js`. Keep the uploaded
`Second-Daze-Apparel-phase-1-backend-foundation` folder in the deployed source;
the root API wrapper imports its serverless handlers. Configure:

- **Root Directory:** `.` (repository root)
- **Framework preset:** Vite
- **Build command:** `npm --prefix react_frontend run build`
- **Output directory:** `react_frontend/dist`
- **Install command:** `npm ci && npm --prefix react_frontend ci`

Set the database connection (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`,
`DB_NAME`), a `SESSION_SECRET` of at least 32 characters, and the Gmail
credentials (`GMAIL_USER`, `GMAIL_APP_PASSWORD`) required for password-reset
email. Set `APP_URL` to the deployed HTTPS origin for reset links.

## Backend integration

The frontend API helpers are in [`react_frontend/src/api`](./react_frontend/src/api/).
They call the Phase 1 API on the same origin:

- `POST /api/login`, `POST /api/logout`, `GET /api/me`
- `POST /api/change-password`
- `POST /api/forgot-password` with `{ "identifier": "username or email" }`
- `POST /api/reset-password` with `{ "token": "...", "newPassword": "..." }`
- `GET /api/users`, `POST /api/users` (Admin subaccounts)
- `POST /api/users/:id/approve`, `/disable`, `/enable`, and `/reset-password`
- `GET /api/export/:name` for the backend's allowlisted CSV export tables

Login sessions are secure, HttpOnly cookies. Deployment uses one Vercel origin
for the frontend and API; the uploaded Phase 1 code does not configure
cross-origin CORS. Do not set `VITE_API_BASE_URL` to a separate origin unless
the backend is separately updated to support credentialed CORS and cookie
policies. Business-data and notification APIs remain Phase 2–5 work.
