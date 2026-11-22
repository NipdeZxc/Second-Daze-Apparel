# Phase 7 Guide: Testing and Release

Covers tasks 7.1–7.4 from `Team10/Team_Task_List.txt`. Do them in order: 7.1 and 7.2 first, then 7.3, then 7.4 once everything is stable.

## 0. Before you start

1. Work from an up-to-date `main`: `git pull origin main`.
2. Install dependencies: `npm ci` then `npm --prefix react_frontend ci`.
3. Make sure the existing automated tests pass:
   - Frontend: `npm --prefix react_frontend test`
   - Backend: `node --test api/_lib/routes/*.test.js api/data/route.test.js`
   - Build: `npm run build`
4. A separate test database is **optional**. You can test on the deployed site and, when finished, clear everything with **Admin → Export → Delete all data** (type `DELETE ALL DATA`). Staff accounts and the audit log are kept; export a backup first. Use clearly named test records (for example "TEST Customer"). If real data already exists, use a separate test database instead (a second TiDB Cloud Starter cluster loaded with `Team10/second_daze_schema_tidb.sql`).
5. Set `ENABLE_TEST_ACCOUNTS` only on the test environment, never in production.

---

## 7.1 Test cases (acceptance criteria US-01 to US-07)

**Goal:** a written test sheet that proves each user story, run by hand on the test environment, plus automated tests where practical.

### Step 1 – Create the test sheet
Make a spreadsheet (or `docs/test-cases.md`) with these columns:

`ID | User story / task | Role | Steps | Expected result | Actual result | Pass/Fail | Tester | Date | Notes`

### Step 2 – Write the cases
Take every acceptance criterion from the project documents (`Team10/Second_Daze_Apparel_All_Documents.txt`) and write at least one positive and one negative case per item. Minimum coverage:

| Area | Positive case | Negative case |
|---|---|---|
| Login/accounts (US-01, 1.3–1.5) | Admin creates a subaccount, approves it, user signs in and must change password | Pending/disabled account cannot sign in; weak password rejected; wrong password rejected |
| Role access (1.4, 6.2) | Sales sees only the Sales module; Inventory only Inventory | Sales user calling an Inventory/Admin endpoint is refused (test the API directly, not only the UI) |
| Products/stock (2.x) | Add product, Stock In, low-stock alert at threshold | Non-admin cannot edit a product; negative stock refused |
| Customers (3.1) | Valid `09…`/`+639…` number saved | Invalid number or missing address rejected; shipment blocked until customer is verified |
| Orders/PO (3.2, 3.8) | Order with several lines keeps price/cost snapshots; completed sale deducts stock | Order exceeding stock is refused |
| Payment (3.3) | GCash reference recorded; Admin verifies | Duplicate reference blocked; Admin rejects |
| Invoice/DR (3.4, 3.6) | Invoice appears only after payment is verified; Delivery Receipt on confirmed delivery | No invoice for unpaid order |
| Shipment (3.5) | Tracking number and status updates through to Delivered | Returned parcel requires a reason |
| Reservations (4.1–4.3) | Reservation with agreed days; Admin approves and stock is held | Unpaid reservation is voided after the agreed days, stock released, notification created |
| Refunds (4.4–4.5) | Refund with days of ownership; defective item is **not** returned to stock, non-defective is | Refund without Admin approval does not change stock |
| Dashboard/reports (US-06/07, 5.x) | Totals match a hand calculation on a small known data set; weekly (Friday) view correct | Empty data shows zeros, not demo values |
| Export/import (5.4–5.5) | Export contains every dataset; restock import adds stock | Malformed CSV, wrong headers, repeated restock file rejected |
| Notifications (6.5) | Low stock, reservation expiry, pending approval appear and can be marked read | Another role does not see them |

### Step 3 – Prepare known data
Create a small, fixed data set (for example 3 products, 2 customers, 2 orders) so expected totals can be calculated by hand and compared with the dashboard.

### Step 4 – Run and record
1. Run every case in the browser on desktop **and** a phone-sized window.
2. Record actual results, with a screenshot for any failure.
3. Log each failure as a GitHub issue (title, steps, expected vs actual, role, screenshot) labeled `bug`.
4. Fix, then re-run the failed cases and a few neighbouring ones (regression).

### Step 5 – Automate what is cheap
Add tests next to existing ones (`api/_lib/routes/*.test.js`, `react_frontend/test/`) for rules that were bugs. Re-run all three commands from section 0.

**Done when:** every case is Pass (or an accepted, documented exception) and no open `bug` issue is blocking.

---

## 7.2 Security and privacy check (Data Privacy Act, RA 10173)

Do this review with a checklist; record the result and evidence for each line.

| # | Check | How to verify |
|---|---|---|
| 1 | Passwords are hashed | Inspect the `user` table: only bcrypt hashes (`$2…`), never plain text; confirm `api/_lib/password.js` |
| 2 | Strong-password rule enforced server-side | Try short/common passwords through the API |
| 3 | Authorization is server-side | With a Sales session, call Admin/Inventory endpoints directly (curl/Postman); expect 401/403 |
| 4 | Sessions | Cookie is `HttpOnly`, `Secure`, `SameSite`; logout invalidates the session; `SESSION_SECRET` is long and random |
| 5 | Secrets not in the repo | `git grep -i -E "password|secret|token"` and review `.env*`, `.gitignore`; rotate anything that was ever committed |
| 6 | No sensitive data in logs | Review `console.*` calls under `api/` (login, reset, import) and Vercel logs: no passwords, reset tokens, session ids, full addresses/phone numbers |
| 7 | Reset flow | Reset tokens expire and are single-use; responses do not reveal whether an account exists |
| 8 | Brute force | Repeated failed logins are limited or at least logged |
| 9 | SQL injection | All queries use placeholders; grep for string-concatenated SQL |
| 10 | Input validation | Exercise forms with `<script>`, very long text, negative numbers; confirm CSV formula escaping on export |
| 11 | Data minimisation | Customer data is limited to what the business needs (name, address, contact); access is role-limited; document who can see it |
| 12 | Cron/maintenance endpoint | `/api/operations/maintenance` rejects requests without `CRON_SECRET` |
| 13 | Database access | TLS on (`DB_SSL`), least-privilege DB user, no public admin console |
| 14 | Dependencies | `npm audit` in the root and in `react_frontend`; fix high/critical findings |
| 15 | Retention and backups | Backups are stored privately; decide and document how long customer data is kept and how deletion requests are handled |

Write the findings (pass / fixed / accepted risk with reason) in `docs/security-review.md`.

**Done when:** no unresolved high-risk item remains.

---

## 7.3 Deploy and verify on Vercel

### Step 1 – Production database
1. Create the production TiDB Cloud Starter cluster (check the current free limits).
2. Run `Team10/second_daze_schema_tidb.sql`.
3. Create the real admin account with `scripts/create-admin.js` if none exists. If you tested on this database, run **Delete all data** (Admin → Export) so no test data goes live.

### Step 2 – Vercel project
1. Import the GitHub repository in Vercel. `vercel.json` already sets the Vite build, output directory and the daily cron.
2. Add environment variables (Production):

   | Variable | Purpose |
   |---|---|
   | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | TiDB connection |
   | `DB_SSL` (and `DB_SSL_CA` if required) | TLS to the database |
   | `SESSION_SECRET` | Long random string |
   | `CRON_SECRET` | Protects `/api/operations/maintenance` |
   | `GMAIL_USER` and the mail app credential used by `api/_lib/mailer.js` | Password-reset email |
   | `APP_URL` | Public site URL for email links |
   | `VITE_API_BASE_URL` | Leave empty when the API is on the same Vercel project |

   Leave `ENABLE_TEST_ACCOUNTS` unset.
3. Deploy and open `/api/health`; it should respond OK.

### Step 3 – Smoke test on the live URL
Run this checklist as each role:
1. Admin signs in → creates and approves a Sales and an Inventory account.
2. Inventory: add product, Stock In, see low-stock notification.
3. Sales: new customer → order → GCash payment; Admin verifies → invoice → shipment → delivery → receipt.
4. Reservation → approve → stock held; refund → approve → inventory rule.
5. Dashboard and weekly report show the expected numbers.
6. Export CSV/Excel opens correctly; forgot-password email arrives and works.
7. Open `/mobile` and a phone browser: the same responsive app loads.
8. Trigger the maintenance endpoint with the secret and confirm unpaid, expired reservations are voided; confirm it refuses a call without the secret.
9. Check Vercel function logs for errors and sensitive data.

### Step 4 – Fix and repeat
Log issues, fix on a branch, merge to `main`, let Vercel redeploy, re-run the failed steps. Keep a note of the final deployed commit.

### Step 5 – Backup routine
Free tiers have limits. Agree who exports all data (Reports → export) and how often (for example weekly, after the Friday review), and where the files are stored.

**Done when:** the full smoke test passes on the production URL and the Owner can sign in.

---

## 7.4 Final documentation

### Step 1 – User guide per role (`docs/user-guide.md`)
One short section per role, written for non-technical users with screenshots:

- **Admin:** sign in, create/approve/disable subaccounts, reset passwords, verify payments, approve reservations/refunds, edit products, dashboard, reports, export/import.
- **Sales Management:** customers, orders/PO, GCash payment entry, invoices, shipments and tracking, delivery confirmation, reservations, refunds, printing order details for the Packer.
- **Inventory Management:** products, stock in/adjustments, low-stock alerts, inventory reports.

Include a "Common problems" list (forgot password, account pending approval, duplicate GCash reference, shipment blocked until the customer is verified).

### Step 2 – README
Update `README.md`: what the system does, architecture, local setup, environment variables, test commands, deployment steps, backup/export routine, and who to contact.

### Step 3 – Handover pack
- Link to this guide, the test sheet, and the security review.
- Known limitations and open items (for example the optional digital catalog, no J&T API, the Owner's customer self-entry form idea).
- List of accounts created and who holds the credentials (never write passwords in the repo).

**Done when:** a new team member or the Owner can use and deploy the system using only these documents.

---

## Suggested schedule and owners

| Step | Owner (from the task list) | Notes |
|---|---|---|
| 7.1 test cases | Everyone (ALL) | Split by phase: each member tests the phases they built, then swap |
| 7.2 security review | Backend lead | Others review the findings |
| 7.3 deploy | Backend lead + frontend/QA | Frontend/QA runs the smoke test |
| 7.4 documentation | Everyone, frontend/QA compiles | |

## Release checklist

- [ ] All 7.1 cases pass; no blocking bug issues
- [ ] Security review complete; secrets rotated if ever exposed
- [ ] Production env vars set; `ENABLE_TEST_ACCOUNTS` unset
- [ ] Live smoke test passed for all three roles
- [ ] Maintenance cron works and is protected
- [ ] Backup/export routine agreed
- [ ] User guide and README updated
- [ ] `main` tagged for the release (for example `git tag v1.0.0`)
