# Technological University of the Philippines  
## System Analysis and Design  

### Professor  
**Prof. PERAGRINO B. AMADOR JR**

### Section  
**BSIS - 3A**

### Team Information  
- **Team Number:** Team #8  
- **Team Leader:** JAE MARVIN L. SALAZAR  
- **Members:**  
  - EMMANUEL M. CARURUCAN 
  - ARMHEL G. MAYAO
  - MARC IÑIGO P. OROZCO  
  - RHEINWELL Q. PALOMARES  

## Instructional Materials  

- **Web App:** [BSIS Agile SAD Curriculum](https://tupcossad.netlify.app/)
- **Google Drive:** [Access Materials Here](https://drive.google.com/drive/folders/1e6S8s2XvSlx_qyoAlUGewRo02ndxR-e3?usp=drive_link)

## UI prototype

Each exported screen has its own HTML file in the repository root. Every page
uses the same `styles.css` and `app.js`; the reference PNGs remain beside the
pages. The prototype uses placeholder text throughout and does not connect to a
backend. Open `index.html` for the initial staff sign-in flow, or any of the
linked screens below. No build tools or dependencies are required.

The sign-in flow uses local UI state only. It does not authenticate users,
create accounts, or send password-reset emails. Enter `pending@demo.local` with
any non-empty password on the sign-in screen to preview the pending-approval
state. The dashboard screens use sample placeholder content.

### Screen files

- **Staff access**
  - [index.html](./index.html) — Screen 1
  - [1.1-sign-in-error.html](./1.1-sign-in-error.html) — Screen 1.1
  - [1.2-access-awaiting-approval.html](./1.2-access-awaiting-approval.html) — Screen 1.2
  - [1.3-forgot-password.html](./1.3-forgot-password.html) — Screen 1.3
- **Admin**
  - [2-admin-dashboard.html](./2-admin-dashboard.html)
  - [2.1-subaccounts.html](./2.1-subaccounts.html)
  - [2.2-access-approvals.html](./2.2-access-approvals.html)
  - [2.3-sales-documents.html](./2.3-sales-documents.html)
  - [2.4-refunds.html](./2.4-refunds.html)
  - [2.5-reservations.html](./2.5-reservations.html)
  - [2.6-reports.html](./2.6-reports.html)
- **Sales**
  - [3-sales-catalog.html](./3-sales-catalog.html)
  - [3.1-checkout-pending-payment.html](./3.1-checkout-pending-payment.html)
  - [3.2-sale-completed.html](./3.2-sale-completed.html)
  - [3.3-sales-documents.html](./3.3-sales-documents.html)
  - [3.4-new-refund-request.html](./3.4-new-refund-request.html)
  - [3.5-refund-condition-review.html](./3.5-refund-condition-review.html)
  - [3.6-approval-request-detail.html](./3.6-approval-request-detail.html)
  - [3.7-refund-completed.html](./3.7-refund-completed.html)
  - [3.8-checkout-gcash-payment.html](./3.8-checkout-gcash-payment.html)
  - [3.9-orders-status-tracking.html](./3.9-orders-status-tracking.html)
  - [3.10-order-detail-shipment.html](./3.10-order-detail-shipment.html)
  - [3.11-customers.html](./3.11-customers.html)
  - [3.12-new-customer-validation.html](./3.12-new-customer-validation.html)
  - [3.13-create-purchase-order.html](./3.13-create-purchase-order.html)
  - [3.14-confirm-delivery.html](./3.14-confirm-delivery.html)
  - [3.15-payment-not-received.html](./3.15-payment-not-received.html)
- **Inventory**
  - [4-inventory-workspace.html](./4-inventory-workspace.html)
  - [4.1-stock-movement-saved.html](./4.1-stock-movement-saved.html)
  - [4.2-low-stock-alerts.html](./4.2-low-stock-alerts.html)
  - [4.3-edit-product-admin-only.html](./4.3-edit-product-admin-only.html)
- **Reservations**
  - [5-reservations.html](./5-reservations.html)
  - [5.1-new-reservation.html](./5.1-new-reservation.html)
  - [5.2-expired-reservation-void-notice.html](./5.2-expired-reservation-void-notice.html)
  - [5.3-reservation-approved.html](./5.3-reservation-approved.html)
- **Reports and staff**
  - [6-sales-inventory-reports.html](./6-sales-inventory-reports.html)
  - [6.1-sales-inventory-reports-v2.html](./6.1-sales-inventory-reports-v2.html)
  - [7-staff-accounts.html](./7-staff-accounts.html)
- **Mobile**
  - [8-mobile-sign-in.html](./8-mobile-sign-in.html)
  - [8.1-mobile-admin-dashboard.html](./8.1-mobile-admin-dashboard.html)
  - [8.2-mobile-approvals.html](./8.2-mobile-approvals.html)
  - [8.3-mobile-checkout-gcash.html](./8.3-mobile-checkout-gcash.html)
  - [8.4-mobile-orders.html](./8.4-mobile-orders.html)
  - [8.5-mobile-low-stock.html](./8.5-mobile-low-stock.html)
  - [8.6-mobile-new-reservation.html](./8.6-mobile-new-reservation.html)
- **Overlays**
  - [9-overlay-notifications-admin.html](./9-overlay-notifications-admin.html)
  - [9.1-overlay-notifications-sales.html](./9.1-overlay-notifications-sales.html)
  - [9.2-overlay-notifications-inventory.html](./9.2-overlay-notifications-inventory.html)
  - [9.3-overlay-confirm-approve.html](./9.3-overlay-confirm-approve.html)

To run locally, start a static server from the repository root, for example
`python -m http.server 8000`, then open `http://localhost:8000`.
