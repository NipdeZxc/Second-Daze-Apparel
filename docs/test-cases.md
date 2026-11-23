# Phase 7.1 Test Cases

Acceptance test sheet for US-01 to US-07 and the task list (Phases 1–6). Run on the deployed site (see [PHASE_7_GUIDE.md](./PHASE_7_GUIDE.md)), on desktop and in a phone-sized window.

**How to use:** fill in *Actual* and *Status* (Pass / Fail / Blocked) for every row, with the tester's initials and date. Log every Fail as a GitHub issue labeled `bug` and put the issue number in *Notes*. Use records whose names start with `TEST` so they're easy to recognize, then clear them with **Admin → Export records → Delete all data** when testing is finished.

**Automated coverage:** rows marked **Live site run 3: Pass** are also covered by `npm --prefix react_frontend test` or `node --test api/_lib/routes/*.test.js api/data/route.test.js`. Still run them by hand once on the live site.

## Results

Run on 2026-11-22 against the local server (run 2) and the live site (run 3). **Result on both: 80 Pass, 0 Fail, 2 Not run** (TC-69 and TC-74 need *Delete all data* on the shared database). Full report, defects and evidence: [test-results.md](./test-results.md). Live-site screenshots: [screenshots/live/](./screenshots/live/).

## Test data

Prepare this before starting so expected totals can be checked by hand.

| Item | Values |
|---|---|
| Accounts | `qa_admin` (temporary Admin, created directly in the database); `qa_sales` (Sales Management) and `qa_inventory` (Inventory Management), created and approved in TC-01/TC-03. All disabled after testing |
| Products | `TEST-001` Denim jacket: cost 200, price 500, stock 10, threshold 3. `TEST-002` Floral dress: cost 150, price 400, stock 4, threshold 3 |
| Customers | `TEST Ana Cruz`, 09990001001, full address. `TEST Ben Reyes`, entered as `+63 999 000 1002` (stored +639990001002), full address |

## US-01 / 1.3–1.5: Secure login and subaccounts

| ID | Req | Role | Steps | Expected | Actual | Status | Tester / date | Notes |
|---|---|---|---|---|---|---|---|---|
| TC-01 | 1.5 | Admin | Subaccounts → create `test.sales` (Sales Management) and `test.inventory` (Inventory Management) | Each account is created in *Pending Approval* and a temporary password is shown once | 201 Created for both; status Pending Approval; 12-character temporary password returned once (e.g. length 12). | Pass | Automated testing, 2026-11-22 | [11-admin-subaccounts](./screenshots/11-admin-subaccounts.png) ; Live site run 3: Pass |
| TC-02 | 1.5 | Pending user | Sign in as `test.sales` before approval | Sign-in is refused with an "awaiting approval" message | HTTP 403 "This account is not active. Please contact the Admin." | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass |
| TC-03 | 1.5 | Admin | Access approvals → approve both accounts | Status becomes *Active* | Both approved (HTTP 200); user list shows status Active. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix); [12-admin-access-approvals](./screenshots/12-admin-access-approvals.png) |
| TC-04 | 1.3 | Sales | Sign in with the temporary password | Forced to change password before entering the workspace | Login 200 with mustChangePassword=true; workspace data refused before the change (HTTP 403 "You must change your password first."). | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-05 | 1.3 | Sales | Change password to a weak one (e.g. `password`) | Rejected with the strong-password rule | "password" → HTTP 400 "Password must be 8-72 characters with an uppercase letter, a lowercase letter, a number and a symbol.". A strong password was accepted (200) and the workspace opened. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-06 | US-01 | Anyone | Sign in with a wrong password | "Not recognized" error; no access | HTTP 401 "Invalid username or password." | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass; [02-sign-in-error](./screenshots/02-sign-in-error.png) |
| TC-07 | US-01 | Not signed in | Open the site in a private window, and call `GET /api/data/records` directly | Sign-in screen only; the API returns 401 | GET /api/data/records → HTTP 401 "Please log in."; site root → HTTP 200 (sign-in screen, see screenshot). | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass; [01-sign-in](./screenshots/01-sign-in.png) |
| TC-08 | 1.3 | Sales | Log out, then press Back in the browser | Still signed out; data not visible | Logout cleared the cookie; /api/me → HTTP 401 "Please log in.". Replaying a copied old cookie → HTTP 200 (accepted risk, see security review #4). | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass |
| TC-09 | 1.3 | Anyone | Forgot password → enter a staff email | Generic confirmation shown; reset email arrives; link sets a new password once | Unknown and known accounts get the same reply ("If the account has an email on file, a reset link has been sent."). Token reset: first use 200, reuse HTTP 400 "This reset link is invalid or has expired.", expired HTTP 400 "This reset link is invalid or has expired.". Email delivery not checked (no staff mailbox on file). | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-10 | 1.5 | Admin | Disable `test.inventory`, then try signing in as it | Sign-in refused; re-enable restores access | Disabled: login HTTP 403 "This account is not active. Please contact the Admin."; existing session /api/me → HTTP 401. Enabled: login HTTP 200. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-11 | 1.5 | Admin | Reset `test.sales` password | New temporary password shown; old sessions are signed out; user must change password | New temporary password returned; old session → HTTP 401 "Please log in."; next login requires a password change. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |

## 1.4 / 6.2: Role-based access

| ID | Req | Role | Steps | Expected | Actual | Status | Tester / date | Notes |
|---|---|---|---|---|---|---|---|---|
| TC-12 | 6.2 | Each role | Sign in as Admin, Sales, Inventory | Each lands on its own dashboard with its own navigation | qa_admin=Admin, qa_sales=Sales Management, qa_inventory=Inventory Management. Dashboards and navigation: see screenshots. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix); [10-admin-dashboard](./screenshots/10-admin-dashboard.png), [30-sales-home](./screenshots/30-sales-home.png), [40-inventory-home](./screenshots/40-inventory-home.png) |
| TC-13 | 1.4 | Sales | Try to open Admin screens (Subaccounts, Import CSV, Export) via the URL | Access denied / redirected | Redirected: 2.1-subaccounts → #/3-sales-dashboard; 2.7-csv-import → #/3-sales-dashboard; 2.9-data-export → #/3-sales-dashboard; 7-staff-accounts → #/3-sales-dashboard | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass; [30-sales-home](./screenshots/30-sales-home.png) |
| TC-14 | 1.4 | Inventory | Try to open Customers, Orders, Reservations via the URL | Access denied / redirected | Redirected: 3.11-customers → #/4-inventory-dashboard; 3.9-orders-status-tracking → #/4-inventory-dashboard; 5-reservations → #/4-inventory-dashboard; 3.13-create-purchase-order → #/4-inventory-dashboard | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass; [40-inventory-home](./screenshots/40-inventory-home.png) |
| TC-15 | 1.4 | Sales | With browser dev tools or Postman, call `GET /api/users` and `POST /api/data/import` with the Sales session | API returns 403 (server-side check, not only hidden buttons) | GET users → 403; POST data/import → 403; GET export/customers → 403; POST users → 403 | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-16 | 1.4 | Inventory | Call `POST /api/data/actions` with `screenId: "3.13-create-purchase-order"` using the Inventory session | API returns 403 (Inventory has no sales module) | HTTP 403 "You do not have access to this." | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-16b | RA 10173 | Inventory | Call `GET /api/data/records` with the Inventory session | `customers` is empty and orders have no contact number or address | customers empty; orders have no contact number or address. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |

## US-02 / 2.1–2.4: Products and stock

| ID | Req | Role | Steps | Expected | Actual | Status | Tester / date | Notes |
|---|---|---|---|---|---|---|---|---|
| TC-17 | US-02, 2.1 | Inventory | Add a new product manually | Product saved with code, name, prices, stock and threshold | Not available in the first run (no form existed). The *Add product* form was then built (Inventory workspace → Add product, Admin and Inventory). Checked against the real database: product TEST-ADD-1 saved with stock 6 and a Stock In movement; a repeated code was refused (409). Unit test added. The test product was deleted. | Pass | Automated testing, 2026-11-22 | Fixed after run 2. Re-tested on the live site (run 3): add 200, duplicate 409, Sales form refused 403. [42c](./screenshots/42c-add-product-form-filled.png), [42d](./screenshots/42d-add-product-confirm.png) |
| TC-18 | 5.5 | Admin | Import CSV → Products → import the two `TEST` products | Preview shows 2 valid rows; after import both appear with their stock | Imported 2 rows, created 2, stock added 14. TEST-001 stock 10, TEST-002 stock 4. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass; [13-inventory-products](./screenshots/13-inventory-products.png) |
| TC-19 | 5.5 | Admin | Import the same product CSV again | Rejected: file already imported, stock not added twice | HTTP 409 "This product file was already imported, so its stock was not added again. Change the quantities to import a new shipment."; stock unchanged (10). | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass |
| TC-20 | US-02 | Inventory | Inventory workspace → search/view products | Both products listed with category, size, cost/sell, stock, status | TEST-001: TEST Denim jacket, Outerwear, M, cost 200, price 500, stock 10, In stock. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix); [41-inventory-products](./screenshots/41-inventory-products.png) |
| TC-21 | 2.2 | Inventory | Add stock → `TEST-001` +5 | Stock 10 → 15; a *Stock In* movement is recorded | Stock 10 → 15; Stock In movement +5 recorded. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-22 | 2.2 | Inventory | Add stock with 0, -1 or `abc` | Rejected: must be a whole number of at least 1 | 0 → 400, -1 → 400, abc → 400; stock still 15. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-23 | US-02, 2.1 | Admin | Edit product `TEST-001`: change selling price to 550 | Saved; new price shows in lists. Old orders keep their price | Selling price now ₱550; ORD-2026-00001 still ₱500 per unit. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-24 | 2.1 | Inventory / Sales | Submit the Edit product form | Refused: only an Admin can edit products | Sales form HTTP 403 "Only an Admin can edit products."; Inventory form HTTP 403 "You do not have access to this."; Sales PUT 403. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |

## US-05 / 2.3: Low stock

| ID | Req | Role | Steps | Expected | Actual | Status | Tester / date | Notes |
|---|---|---|---|---|---|---|---|---|
| TC-25 | US-05 | Inventory | Open Low stock | Lists products at or below their threshold | TEST-002 status "Low stock". | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix); [14-low-stock](./screenshots/14-low-stock.png), [42-inventory-low-stock](./screenshots/42-inventory-low-stock.png) |
| TC-26 | US-05, 6.5 | Inventory | Sell or reserve `TEST-002` until stock ≤ 3 | Product appears in Low stock; a *Low Stock* notification appears for Inventory | TEST-002 stock 3 ≤ threshold 3; "Low Stock" notification visible to Inventory. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-27 | 2.3 | Admin | Edit `TEST-002` threshold to 0 | Product leaves the Low stock list | TEST-002 status now "In stock". | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |

## 3.1: Customers

| ID | Req | Role | Steps | Expected | Actual | Status | Tester / date | Notes |
|---|---|---|---|---|---|---|---|---|
| TC-28 | 3.1 | Sales | New customer with `09171234567` and full address | Saved as *Unverified* | Saved; status Unverified. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix); [31-sales-new-customer](./screenshots/31-sales-new-customer.png), [15-customers](./screenshots/15-customers.png) |
| TC-29 | 3.1 | Sales | New customer with `+63 918 123 4567` (spaces) | Saved; number normalized to `+639181234567` | Saved as +639990001002. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-30 | 3.1 | Sales | New customer with `12345`, `0817123456` or a landline | Rejected with the PH mobile format message | 12345 → 400; 0817123456 → 400; (02) 8123 4567 → 400 | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-31 | 3.1 | Sales | New customer with City or Province blank | Rejected: field is required | City blank HTTP 400 "City is required."; Province blank HTTP 400 "Province is required.". | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-32 | 3.1 | Sales | New customer reusing an existing number (in either `09` or `+639` form) | Rejected: customer already exists | HTTP 409 "A customer with that contact number already exists." | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-33 | 3.1 | Sales | Customers → Verify info on `TEST Ana Cruz` | Status changes to *Verified* | TEST Ana Cruz → Verified. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |

## US-03 / 3.2–3.4, 3.7–3.8: Orders, payment, invoice

| ID | Req | Role | Steps | Expected | Actual | Status | Tester / date | Notes |
|---|---|---|---|---|---|---|---|---|
| TC-34 | US-03, 3.2 | Sales | New purchase order: `TEST Ana Cruz`, `TEST-001` × 2, additional items `TEST-002 x 1` | Order (ORD-…) and PO (PO-…) created in *Pending Approval*; Admin gets an approval notification | ORD-2026-00001 (PO-2026-00001) Pending Approval; items TEST-001×2 @500.00/cost 200.00, TEST-002×1 @400.00/cost 150.00; Admin notified. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix); [32-sales-new-order](./screenshots/32-sales-new-order.png), [16-orders](./screenshots/16-orders.png) |
| TC-35 | 3.2 | Sales | New purchase order for more than the available stock | Rejected: only N available | HTTP 409 "Only 15 of TEST Denim jacket available." | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-36 | 3.2 | Sales | Additional items in a wrong format (e.g. `TEST-002 two`) | Rejected with the "PRODUCT-CODE x 2" hint | HTTP 400 "Additional item "TEST-002 two" must look like "PRODUCT-CODE x 2"." | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-37 | 3.2 | Admin | Orders → Approve the order | Status *Pending Payment* | Order status Pending Payment. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-38 | 3.3 | Sales | Record payment with GCash reference `TEST1234567` | Payment *Pending Verification*; Admin notified | Payment TEST1795347411823 ₱1400.00 Pending Verification; Admin notified. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-39 | 3.3 | Sales | Record the same GCash reference on another order | Rejected: reference already used | ORD-2026-00002: reusing TEST1795347411823 → HTTP 409 "That GCash reference number was already used.". | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-40 | 3.3 | Admin | Reject payment with a reason | Payment *Rejected*; Sales notified with the reason; order still *Pending Payment* | Payment Rejected ("TEST reference not found in GCash"); order still Pending Payment; Sales user notified. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-41 | US-03, US-04, 3.4, 3.8 | Admin | Record a new reference, then Verify payment | Order *Paid*; invoice INV-… issued; `TEST-001` stock −2, `TEST-002` −1; *Sale* movements recorded | Order Paid; INV-2026-00001 issued; TEST-001 15 → 13, TEST-002 4 → 3; 2 Sale movements. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix); [21-sales](./screenshots/21-sales.png) |
| TC-42 | 3.4 | Sales | Sales documents | PO and invoice listed for the order; no invoice exists before verification | ORD-2026-00001: Invoice, Purchase Order. ORD-2026-00002 (unpaid): Purchase Order only. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix); [20-sales-documents](./screenshots/20-sales-documents.png) |
| TC-43 | 3.7 | Sales | Orders → open the order → **Print for packer** | Print layout shows customer, address, items and quantities for the Packer | Print page (opened by Sales) shows TEST Ana Cruz, 123 Test St., TEST-001, TEST-002; quantities: shown. | Pass | Automated testing, 2026-11-22 | [17-order-detail](./screenshots/17-order-detail.png), [17b-print-for-packer](./screenshots/17b-print-for-packer.png) ; Live site run 3: Pass |
| TC-44 | 3.2 | Sales | Cancel an order in *Pending Payment* | Status *Cancelled*; stock unchanged | ORD-2026-00002 Cancelled; TEST-002 stock unchanged (3). | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |

## 3.5–3.6: Shipment and delivery

| ID | Req | Role | Steps | Expected | Actual | Status | Tester / date | Notes |
|---|---|---|---|---|---|---|---|---|
| TC-45 | 3.5 | Sales | Paid order → Mark packed → Ship with tracking number, customer **unverified** | Refused: verify the customer first | Packed; ship → HTTP 409 "Verify the customer's information before shipping.". | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-46 | 3.5 | Sales | Verify the customer, then Ship with `JT-TEST-001` | Order *Shipped*; tracking number saved | Order Shipped; tracking JT-TEST-001 saved. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-47 | 3.5 | Sales | Mark in transit | Shipment *In Transit* | Shipment In Transit. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-48 | 3.6 | Sales | Confirm delivery: *Delivered*, date/time, received by | Order *Delivered*; Delivery Receipt DR-… issued | Order Delivered; DR-2026-00001 issued. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-49 | 3.5 | Sales | On another shipped order, Confirm delivery: *Returned to sender* | Shipment *Returned* with reason; customer's returned-parcel count +1 and set back to *Unverified*; no DR | ORD-2026-00003: shipment Returned ("Returned to sender"); customer returned parcels 1, back to Unverified; no DR. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-50 | 3.2 | Sales | Complete the delivered order | Order *Completed* | Order Completed. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |

## 4.1–4.3: Reservations

| ID | Req | Role | Steps | Expected | Actual | Status | Tester / date | Notes |
|---|---|---|---|---|---|---|---|---|
| TC-51 | 4.1 | Sales | New reservation: `TEST Ben Reyes`, `TEST-001` × 1, agreed days 2 | RES-… created in *Pending Approval*; Admin notified; no pickup field present | RES-2026-00001 Pending Approval (2 agreed days); Admin notified. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix); [33-sales-new-reservation](./screenshots/33-sales-new-reservation.png), [18-reservations](./screenshots/18-reservations.png) |
| TC-52 | 4.1 | Sales | Agreed days 0, 256 or blank | Rejected | "0" → 400; "256" → 400; "" → 400 | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-53 | 4.1, 4.2 | Admin | Approve the reservation | *Active*; expiry = approval time + 2 days; stock −1 and reserved +1 | Active; expiry 48.0 h after approval; stock 12 → 11, reserved 0 → 1. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-54 | 4.1 | Admin | Reject another pending reservation | *Rejected*; stock unchanged | RES-2026-00002 Rejected; stock unchanged. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-55 | 4.2 | Sales | Cancel an *Active* reservation | *Cancelled*; held stock released | RES-2026-00003 Cancelled; stock 10 → 11, reserved 2 → 1. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-56 | 4.1 | Sales | Create order from an *Active* reservation, record and verify payment | Order *Paid*; reservation *Paid*; reserved quantity released without deducting stock twice | ORD-2026-00004 Paid; reservation Paid; stock unchanged (11), reserved 1 → 0 (no double deduction). | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-57 | 4.3, 6.5 | Admin | Make a reservation expire (approve with 1 day, then wait, or run the maintenance job after expiry) | Reservation *Voided*; stock released; creator notified. Reminder notification sent within 24 h before expiry | RES-2026-00004 Voided (Expired); stock 10 → 11; creator notified. RES-2026-00005 (expires in 24 h): reminder sent (1 total), then cancelled. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-58 | 4.3 | Anyone | Call `GET /api/operations/maintenance` without the `CRON_SECRET` header | 401 Unauthorized | No header → 401; wrong secret → 401; correct secret → 200. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |

## 4.4–4.5: Refunds

| ID | Req | Role | Steps | Expected | Actual | Status | Tester / date | Notes |
|---|---|---|---|---|---|---|---|---|
| TC-59 | 4.4 | Sales | New refund request on a *Delivered* order: item `TEST-001`, qty 1, days of ownership 3, condition *Good*, issue | RFD-… created in *Pending Approval*; Admin notified | RFD-2026-00001 Pending Approval, ₱500.00; Admin notified. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix); [34-sales-refund-request](./screenshots/34-sales-refund-request.png), [19-refunds](./screenshots/19-refunds.png) |
| TC-60 | 4.4 | Sales | Refund request on an order that isn't delivered, or qty more than ordered | Rejected | Cancelled order → HTTP 409 "This order is already Cancelled."; quantity 5 of 2 → HTTP 400 "Only 2 of this item was ordered.". | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-61 | 4.5 | Admin | Approve the non-defective refund | Stock +1; *Refund Return* movement | Approved; TEST-001 stock 11 → 12; Refund Return movement. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-62 | 4.5 | Sales + Admin | Refund with condition *Damaged*, approve | Stock unchanged; defective quantity +1; *Refund Defective* movement | RFD-2026-00002 approved; TEST-002 stock unchanged (3); defective 0 → 1. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-63 | 4.5 | Admin | Reject a refund with a reason | *Rejected*; inventory unchanged | RFD-2026-00003 Rejected; inventory unchanged. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |

## US-06, US-07 / 5.1–5.3: Sales, profit, dashboard, reports

Expected values below assume only TC-41's order is paid (2 × 500 + 1 × 400). Recalculate if your data differs.

| ID | Req | Role | Steps | Expected | Actual | Status | Tester / date | Notes |
|---|---|---|---|---|---|---|---|---|
| TC-64 | US-06, 5.1 | Admin | Reports → Sales | Sales = ₱1,400; cost = 2 × 200 + 1 × 150 = ₱550; profit = ₱850 | Gross TEST sales ₱2,400, cost ₱950, approved refunds ₱900 → dashboard net sales +₱1500 and profit +₱550, as calculated by hand. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix) |
| TC-65 | US-06 | Admin | Approve a ₱500 refund, reopen Reports | Net sales and profit reduced by the approved refund | Covered in TC-64: the ₱900 of approved refunds was subtracted from sales and profit. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass |
| TC-66 | US-07, 5.2 | Admin | Dashboard | Shows total sales, total profit, pending orders, unpaid reservations, items for shipping, completed orders, all matching the records | Pending orders 42, unpaid reservations 26, for shipping 33, completed 47: all equal to counts from the record lists. | Pass | Automated testing, 2026-11-22 | [10-admin-dashboard](./screenshots/10-admin-dashboard.png) ; Live site run 3: Pass |
| TC-67 | 5.3 | Admin | Reports → Weekly view | Covers Monday to the most recent Friday; switching to All time changes the totals | Friday review: 11/16/2026 – 11/21/2026. Switching Friday review week → All-time changes the totals (different). | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass; [22b-reports-weekly](./screenshots/22b-reports-weekly.png), [22c-reports-all-time](./screenshots/22c-reports-all-time.png) |
| TC-68 | 5.3 | Admin | Open Sales, Financial, Order and Stock reports | Each loads with data and no errors | Sales: loaded; Financial: loaded; Orders: loaded; Stock: loaded; browser console errors: 0. | Pass | Automated testing, 2026-11-22 | [22-report-sales](./screenshots/22-report-sales.png), [22-report-financial](./screenshots/22-report-financial.png), [22-report-orders](./screenshots/22-report-orders.png), [22-report-stock](./screenshots/22-report-stock.png) ; Live site run 3: Pass |
| TC-69 | 5.2 | Admin | Empty database (after Delete all data) | All dashboard values are 0; no sample data | Needs Delete all data on the shared database; not run by decision (existing data kept). No automated test covers it yet. | Not run | Automated testing, 2026-11-22 | Not run on the live site either (run 3) |

## 1.6 / 5.4–5.5: Export, import, delete all

| ID | Req | Role | Steps | Expected | Actual | Status | Tester / date | Notes |
|---|---|---|---|---|---|---|---|---|
| TC-70 | 5.4 | Admin | Export records → Download CSV and Download Excel | Files open; every record type included; Excel has one sheet per type | All 13 tables exported as CSV (rows: products 42, customers 203, orders 204, order_items 627, payments 123, shipments 81, reservations 85, refunds 15, stock_movements 316, invoices 164, purchase_orders 74, delivery_receipts 25, audit_log 146). Excel download checked in the browser. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass; [25-export-and-delete-all](./screenshots/25-export-and-delete-all.png) |
| TC-71 | 5.4 | Admin | Export after saving a product named `=1+1` | Value appears as text, not a formula | Product name "=1+1" exported as '=1+1 (spreadsheets show it as text). | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass |
| TC-72 | 5.5 | Admin | Import a malformed CSV, wrong headers, or a file over 2 MB | Rejected with a clear message; nothing saved | Missing/invalid columns → HTTP 400 "Data row 1: Product is required."; unsupported type → 400; empty file → 400; nothing saved. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass; [24-csv-import](./screenshots/24-csv-import.png) |
| TC-73 | — | Admin | Export records → Delete all data without typing the phrase | Button stays disabled | Checked in the browser (see screenshot). Server also refuses without the phrase (unit test). | Pass | Automated testing, 2026-11-22 | [26-delete-all-disabled](./screenshots/26-delete-all-disabled.png) ; Live site run 3: Pass |
| TC-74 | — | Admin | Type `DELETE ALL DATA` and confirm | Business data removed; staff accounts kept; dashboard shows zeros | Not run on the live database by decision (existing data kept). Covered by the route test and the manual check in TC-73. | Not run | Automated testing, 2026-11-22 | Not run on the live site either (run 3) |
| TC-75 | — | Sales | Call `POST /api/data/delete-all` with the Sales session | 403 | HTTP 403 "You do not have access to this." | Pass | Automated testing, 2026-11-22 | (auto: 401 when signed out); Live site run 3: Pass (run 1 failed before the DEF-01 fix) |

## 6.4–6.6: Notifications, wording, responsive app

| ID | Req | Role | Steps | Expected | Actual | Status | Tester / date | Notes |
|---|---|---|---|---|---|---|---|---|
| TC-76 | 6.5 | Each role | Open Notifications after TC-26, TC-34, TC-51, TC-59 | Each role sees only its own notifications; Mark all read clears the unread count | Admin: Approval/Payment/Refund; Sales: Payment/Refund/Reservation; Inventory: Low Stock. Mark all read → Inventory unread count 0. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass (run 1 failed before the DEF-01 fix); [27-notifications-admin](./screenshots/27-notifications-admin.png), [35-sales-notifications](./screenshots/35-sales-notifications.png) |
| TC-77 | 6.4 | Sales | Check sales documents and reservation screens | No "quotation" wording; no pickup fields on reservations | Checked Sales documents, Reservations, New reservation, New purchase order and Catalog: no "quotation", no pickup fields. | Pass | Automated testing, 2026-11-22 | Live site run 3: Pass |
| TC-78 | 6.6 | Each role | Repeat TC-12, TC-34 and TC-51 at 375 px width and on a real phone | Layout fits; navigation and forms usable; no horizontal scrolling | Edge 375×812 emulation: qa_admin 2-admin-dashboard: page width 375/375; qa_admin 3.9-orders-status-tracking: page width 375/375; qa_sales 3-sales-dashboard: page width 375/375; qa_sales 3.13-create-purchase-order: page width 375/375; qa_sales 5.1-new-reservation: page width 375/375; qa_inventory 4-inventory-dashboard: page width 375/375; qa_inventory 4-inventory-workspace: page width 375/375. Wide tables scroll inside their own box. Real-phone check still to do by the team. | Pass | Automated testing, 2026-11-22 | [51-dashboard-375px](./screenshots/51-dashboard-375px.png), [53-orders-375px](./screenshots/53-orders-375px.png), [57-new-order-375px](./screenshots/57-new-order-375px.png), [58-new-reservation-375px](./screenshots/58-new-reservation-375px.png), [59-inventory-375px](./screenshots/59-inventory-375px.png) ; Live site run 3: Pass |
| TC-79 | 6.6 | Anyone | Open `/mobile` | Same responsive app loads (role home after sign-in) | /mobile → sign-in form (no hash); after sign-in as Sales → #/3-sales-dashboard. | Pass | Automated testing, 2026-11-22 | [50-sign-in-375px](./screenshots/50-sign-in-375px.png) ; Live site run 3: Pass |

## Sign-off

| Role | Name | Date | Result |
|---|---|---|---|
| Tester(s) | | | |
| Team lead | | | |
| Owner (acceptance) | | | |
