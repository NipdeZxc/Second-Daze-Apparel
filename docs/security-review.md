# Security and Privacy Review (Task 7.2, RA 10173)

Code review of `main` plus fixes made during Phase 7. The items under "Team checks before go-live" need the Vercel and TiDB dashboards, so the team must confirm them.

Status: **Pass**, **Fixed** (changed in this review), **Accepted risk** (reason given), **Team check** (not verifiable from code).

## Results

| # | Check | Status | Evidence / change |
|---|---|---|---|
| 1 | Passwords are hashed | Pass / Fixed | bcrypt (cost 10) in `api/_lib/password.js`; no plain-text passwords stored. **Fixed:** accounts from the Admin dataset import (`user.csv`) are now forced to change their password on first login, since imported hashes were never checked against the password policy (`api/_lib/routes/dataset-import.js`). |
| 2 | Strong password enforced by the server | Pass | `assertStrongPassword`: 8–72 characters with upper, lower, number and symbol; used on change and reset. Temporary passwords are random 12 characters. |
| 3 | Authorization is server-side | Fixed | Every route calls `requireUser`/`requireRole`. **Fixed:** `POST /api/data/actions` (all sales forms) now requires Admin or Sales; before, Inventory could call it directly. Customer row actions no longer allow Inventory. Test: `api/data/route.test.js`. |
| 4 | Sessions | Pass / Accepted risk | HMAC-signed cookie, `HttpOnly; Secure; SameSite=Strict`, 8-hour expiry, `SESSION_SECRET` ≥ 32 characters or the server refuses to run. A password change or reset, or disabling the account, ends all sessions immediately. **Accepted risk:** logout clears the cookie but does not revoke a copied token server-side. The cookie cannot be read by JavaScript and expires in 8 hours; full revocation would need a new `users` column. |
| 5 | No secrets in the repo | Pass | No credentials in tracked files; `.gitignore` excludes `.env*`. Production secrets live only in Vercel environment variables. |
| 6 | No sensitive data in logs | Fixed | **Fixed:** the API error handler and the dataset importer logged full database error objects, which can contain SQL with customer data. They now log only the error code (`api/[...route].js`, `dataset-import.js`). The reset-email error logs only the code/message. |
| 7 | Password reset | Fixed / Accepted risk | 32-byte random token, stored as SHA-256, 30-minute expiry, 60-second cooldown; same reply whether or not the account exists. **Fixed:** the token is now claimed with one conditional `UPDATE` inside a transaction, so two simultaneous requests cannot both use it (`api/_lib/routes/reset.js`). **Accepted risk:** the reply is slightly slower when an email is actually sent; sending in the background is unreliable on serverless functions. |
| 8 | Brute force | Pass | Account locks for 15 minutes after 5 failed logins; failures are written to `audit_log`. No per-IP limit (Vercel's edge protection can be added later). |
| 9 | SQL injection | Pass | All values use `?` placeholders. Table and column names come only from fixed allowlists (export, delete, delete-all, dataset import). |
| 10 | Input validation / CSV formula injection | Pass | Server validates required fields, numbers, PH mobile numbers and text lengths. Exports prefix cells starting with `= + - @`, tab or CR. React escapes output; the packing slip uses `escapeHtml`. |
| 11 | Data minimisation | Fixed | Customers: name, mobile, address and optional social handle only, needed for J&T shipping. **Fixed:** `GET /api/data/records` no longer sends customer records or order contact/address to Inventory users, who have no customer or order screens. Test: `api/data/route.test.js`. |
| 12 | Maintenance endpoint | Fixed | Returns 401 without `Authorization: Bearer CRON_SECRET`. **Fixed:** the secret is now compared with `crypto.timingSafeEqual` (`api/_lib/routes/operations.js`). |
| 13 | Database access | Pass / Team check | TLS on by default with certificate and hostname checks (`api/_db.js`). Team: keep `DB_SSL` unset, and use a database user limited to this database. |
| 14 | Dependencies | Accepted risk | `npm audit`: root 0 issues. `react_frontend`: 2 moderate (`uuid` < 11.1.1 via `exceljs`). The issue only affects `uuid` calls that pass a buffer, which this app does not do. The only offered fix downgrades `exceljs` to 3.4.0 (breaking). Re-check when `exceljs` updates. |
| 15 | Retention and backups | Team check | Admin export (CSV/XLSX) is the backup method; store the files in a private drive. Decide how long to keep data. Handle a customer's deletion request with the per-record delete (Admin). "Delete all data" keeps accounts and the audit log. |
| 16 | Test accounts (`ENABLE_TEST_ACCOUNTS`) | Fixed | With the flag on, logging in as `admin`/`admin` created a full Admin account. **Fixed:** the flag is now ignored when `VERCEL_ENV` or `NODE_ENV` is `production` (`api/_lib/routes/auth.js`). Test: `api/_lib/routes/auth.test.js`. |
| 17 | CORS / CSRF | Pass | No CORS headers (same-origin only); `SameSite=Strict` cookie blocks cross-site requests. |
| 18 | Admin "Delete all data" | Pass | Admin only, exact phrase `DELETE ALL DATA`, single transaction, fixed table list, audit entry. |

No high-risk item is unresolved.

## Evidence from acceptance testing (Phase 7.1)

Results from running the checks against the real database, see [test-results.md](./test-results.md). "Fixed code" = the working tree with the fixes above, run locally against the production database; the live site still runs the older code.

| Check | Test | Fixed code | Live site |
|---|---|---|---|
| Lockout after 5 failed logins (#8) | SEC-08 | Pass: 6th try gets HTTP 423, 5 `login_failed` audit entries | Pass |
| Signed-out users get no data (#3) | TC-07 | Pass: HTTP 401 | Pass |
| Sales cannot use Admin APIs (#3) | TC-15, TC-75 | Pass: HTTP 403 | Not testable (DEF-01) |
| Inventory cannot submit sales forms (#3) | TC-16 | Pass: HTTP 403 | Not testable (DEF-01); code review shows the deployed code allows it |
| Inventory gets no customer data (#11) | TC-16b | Pass: no customers, no contact/address on orders | Not testable (DEF-01); deployed code sends it |
| Reset link single use, expiry, same reply (#7) | TC-09 | Pass | Not testable (DEF-01) |
| Copied cookie after logout (#4) | TC-08 | Still accepted (HTTP 200), as documented | — |
| Long input / markup (#10) | SEC-10 | Pass: HTTP 400 over 100 characters; markup shown as text | Not testable (DEF-01) |
| Formula cells in exports (#10) | TC-71 | Pass: `=1+1` exported as `'=1+1` | Pass |
| Cron secret (#12) | TC-58 | Pass: none 401, wrong 401, correct 200 | 404: the endpoint is unreachable (DEF-01), so the daily expiry job has not been running on production |

**Found during testing:** the `users` table on production had active accounts `admin` / `admin` and `staff` / `staff` (weak passwords). **Fixed after testing:** both were disabled and their password hashes made unusable. Both logins now return HTTP 401 on the live site. They were the only Admin logins with known passwords, so the team must create a real Admin with `node scripts/create-admin.js` (using the database settings) before using the Admin screens.

**Deployed:** the fixes and DEF-01 are live (commit `77c42bc`). Run 3 on the live site passed the security checks that DEF-01 had made untestable (TC-15, TC-16, TC-16b, TC-09, TC-58, TC-75, SEC-10).

## Team checks before go-live

- [ ] Vercel production: `SESSION_SECRET` is a random value of 32+ characters (e.g. `openssl rand -hex 32`).
- [ ] Vercel production: `CRON_SECRET` set (random, 32+ characters).
- [ ] Vercel production: `ENABLE_TEST_ACCOUNTS` not set.
- [x] No active `admin`/`staff` test users in the `users` table (disabled after Phase 7 testing).
- [ ] A real Admin account created with `scripts/create-admin.js` (strong password).
- [ ] Vercel production: `DB_SSL` not set to `false`.
- [ ] TiDB: the app's database user only has access to the app database; the password is not shared outside the team.
- [ ] Vercel logs after test runs contain no passwords, reset links or customer phone numbers.
- [ ] Export backups stored in a private, access-limited folder.
- [x] Phase 7 TEST records deleted and QA accounts disabled (`scripts/phase7-cleanup.mjs`).
- [ ] Remaining sample data deleted (Admin → Export records → Delete all data) before real use.

## Reviewed by

| Name | Role | Date | Signature |
|---|---|---|---|
| | | | |
