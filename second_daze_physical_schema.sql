-- =====================================================================
--  SECOND DAZE APPAREL - Sales Tracking and Inventory Management System
--  PHYSICAL SCHEMA  (MySQL 8.0.16+ / InnoDB / utf8mb4)
--
--  Basis : SAD_PHASE_3_UI_UX.pdf (screens + mobile screens, pp. 2-6, 14-51)
--          Every column below traces to a field, label, status, or rule
--          that appears on a screen. Other project files = context only.
--  NOT used as basis: PDF pp. 7-13 (older template screens: branches,
--          Manager / Store Lead roles, Quotations, Transfers, evidence files).
--          They conflict with the 3-role, single-business scope.
--  Time zone: run the server/session in Asia/Manila (+08:00) so NOW()
--          and the auto-void event match the "PHT" times in the UI.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS second_daze
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE second_daze;

SET FOREIGN_KEY_CHECKS = 0;
DROP VIEW  IF EXISTS v_dashboard_summary, v_low_stock;
DROP TABLE IF EXISTS audit_log, notifications, refund_items, refunds,
  delivery_receipts, sales_documents, shipments, payments, order_items,
  orders, reservation_items, reservations, stock_movements, products,
  categories, customers, auth_tokens, access_requests, users,
  document_sequences;
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- 1. USER ACCESS  (UI pp. 3-6, 40, 43, 50)
-- =====================================================================

CREATE TABLE users (
  user_id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  staff_identifier VARCHAR(20)  NOT NULL,                 -- ADM-001, SLS-014, INV-008 ("Unique - Available" check)
  full_name        VARCHAR(100) NOT NULL,                 -- "Nina Mendoza"
  email            VARCHAR(120) NOT NULL,                 -- login, "Email / login *"
  password_hash    VARCHAR(255) NOT NULL,
  role             ENUM('Admin','Sales','Inventory') NOT NULL,   -- "Assigned role *"; Packer has no account
  account_status   ENUM('Awaiting Approval','Active','Disabled','Rejected')
                   NOT NULL DEFAULT 'Awaiting Approval',  -- Active / Awaiting access approval / Disabled
  created_by       INT UNSIGNED NULL,                     -- Admin who created the subaccount
  last_login_at    DATETIME NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_staff_identifier (staff_identifier),
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_role_status (role, account_status),
  CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users (user_id)
) ENGINE=InnoDB;

-- One row per access request / decision ("ACC-2026-021"; Approve / Reject; "Staff cannot approve their own access")
CREATE TABLE access_requests (
  access_request_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_no        VARCHAR(20)  NOT NULL,                -- ACC-2026-021
  user_id           INT UNSIGNED NOT NULL,
  assigned_role     ENUM('Sales','Inventory') NOT NULL,   -- "Role assigned by Admin"
  requested_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status            ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  decided_by        INT UNSIGNED NULL,
  decided_at        DATETIME NULL,
  decision_note     VARCHAR(255) NULL,
  PRIMARY KEY (access_request_id),
  UNIQUE KEY uq_access_request_no (request_no),
  KEY ix_access_requests_status (status, requested_at),
  CONSTRAINT fk_ar_user    FOREIGN KEY (user_id)    REFERENCES users (user_id),
  CONSTRAINT fk_ar_decider FOREIGN KEY (decided_by) REFERENCES users (user_id),
  CONSTRAINT ck_ar_not_self_approved CHECK (decided_by IS NULL OR decided_by <> user_id),
  CONSTRAINT ck_ar_decision_complete CHECK (
    (status = 'Pending' AND decided_by IS NULL AND decided_at IS NULL)
    OR (status <> 'Pending' AND decided_by IS NOT NULL AND decided_at IS NOT NULL))
) ENGINE=InnoDB;

-- Invitation links ("Create & send invitation") and "Reset your password" links
CREATE TABLE auth_tokens (
  token_id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  purpose     ENUM('Invitation','Password Reset') NOT NULL,
  token_hash  CHAR(64) NOT NULL,                          -- store SHA-256 of the token, never the token
  expires_at  DATETIME NOT NULL,
  used_at     DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_id),
  UNIQUE KEY uq_auth_token_hash (token_hash),
  KEY ix_auth_tokens_user (user_id, purpose),
  CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
-- 2. PRODUCTS & INVENTORY  (UI pp. 30-33, 46, 49)
-- =====================================================================

CREATE TABLE categories (
  category_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(40) NOT NULL,                       -- Tops, Bottoms, Outerwear, Tees, Accessories
  PRIMARY KEY (category_id),
  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB;

-- One row per SKU (the UI treats size/color as part of the SKU: "SKU-102 - Size M - Dusty Pink")
CREATE TABLE products (
  product_id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku                 VARCHAR(20)  NOT NULL,              -- SKU-102
  product_name        VARCHAR(120) NOT NULL,              -- "Product name *"
  category_id         INT UNSIGNED NOT NULL,              -- "Category *"
  size                VARCHAR(20)  NOT NULL,              -- M, XL, 28, "One size"
  color               VARCHAR(40)  NULL,                  -- Dusty Pink (refund screen)
  cost_price          DECIMAL(10,2) NOT NULL,             -- "Cost price *"
  selling_price       DECIMAL(10,2) NOT NULL,             -- "Selling price *"
  qty_available       INT NOT NULL DEFAULT 0,             -- sellable; excludes reserved + defective
  qty_reserved        INT NOT NULL DEFAULT 0,             -- held for approved reservations
  qty_defective       INT NOT NULL DEFAULT 0,             -- quarantined, never sellable
  low_stock_threshold INT NOT NULL DEFAULT 8,             -- "Low-stock threshold *" (Admin edits)
  status              ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  created_by          INT UNSIGNED NOT NULL,              -- Inventory adds items
  updated_by          INT UNSIGNED NULL,                  -- Admin edits product info
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id),
  UNIQUE KEY uq_products_sku (sku),
  KEY ix_products_category (category_id),
  KEY ix_products_name (product_name),
  KEY ix_products_stock (status, qty_available),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (category_id),
  CONSTRAINT fk_products_created  FOREIGN KEY (created_by)  REFERENCES users (user_id),
  CONSTRAINT fk_products_updated  FOREIGN KEY (updated_by)  REFERENCES users (user_id),
  CONSTRAINT ck_products_prices CHECK (cost_price >= 0 AND selling_price >= 0),
  CONSTRAINT ck_products_qty    CHECK (qty_available >= 0 AND qty_reserved >= 0 AND qty_defective >= 0),
  CONSTRAINT ck_products_threshold CHECK (low_stock_threshold >= 0)
) ENGINE=InnoDB;

-- Ledger: every stock change is recorded here ("Change stock from Stock movements so every change is recorded")
CREATE TABLE stock_movements (
  movement_id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  movement_no       VARCHAR(30) NOT NULL,                 -- MOV-2026-611
  movement_group    VARCHAR(30) NULL,                     -- SALE-2048 ("Movement group")
  product_id        INT UNSIGNED NOT NULL,
  movement_type     ENUM('Initial','Restock','Sale','Reservation Hold','Reservation Release',
                         'Refund Restock','Defective Quarantine','Adjustment') NOT NULL,
  available_change  INT NOT NULL DEFAULT 0,               -- "+12", "-2"
  reserved_change   INT NOT NULL DEFAULT 0,               -- "Reserved -2"
  defective_change  INT NOT NULL DEFAULT 0,               -- "Defective units +1"
  available_before  INT NOT NULL,                         -- "Before 3 -> After 15"
  available_after   INT NOT NULL,
  purchase_reference VARCHAR(30) NULL,                    -- "Purchase reference PO-2026-118" (free text)
  reference_type    ENUM('Order','Reservation','Refund','Manual') NOT NULL DEFAULT 'Manual',
  reference_id      INT UNSIGNED NULL,
  reference_no      VARCHAR(30) NULL,                     -- ORD-2041, RSV-304, QTN-112
  reason            VARCHAR(255) NULL,                    -- "Reason", e.g. restock note
  recorded_by       INT UNSIGNED NULL,                    -- NULL = system action (auto-void)
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (movement_id),
  UNIQUE KEY uq_stock_movement_no (movement_no),
  KEY ix_sm_product_date (product_id, created_at),
  KEY ix_sm_group (movement_group),
  KEY ix_sm_reference (reference_type, reference_id),
  CONSTRAINT fk_sm_product FOREIGN KEY (product_id)  REFERENCES products (product_id),
  CONSTRAINT fk_sm_user    FOREIGN KEY (recorded_by) REFERENCES users (user_id),
  CONSTRAINT ck_sm_nonzero CHECK (available_change <> 0 OR reserved_change <> 0 OR defective_change <> 0),
  CONSTRAINT ck_sm_after   CHECK (available_after = available_before + available_change)
) ENGINE=InnoDB;

-- =====================================================================
-- 3. CUSTOMERS  (UI pp. 25-26, 24)
-- =====================================================================

CREATE TABLE customers (
  customer_id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_code  VARCHAR(20)  NOT NULL,                   -- CUST-089
  full_name      VARCHAR(100) NOT NULL,                   -- "Full name *"
  social_handle  VARCHAR(80)  NULL,                       -- "Social media handle" @bea.alonzo
  contact_number VARCHAR(20)  NOT NULL,                   -- "Contact number *" (0912 345 6789)
  email          VARCHAR(120) NULL,                       -- "digital copy sent to the email on file"
  address        VARCHAR(255) NULL,                       -- "Address *"
  city           VARCHAR(80)  NULL,                       -- "City *"
  province       VARCHAR(80)  NULL,                       -- "Province *"
  postal_code    VARCHAR(10)  NULL,                       -- "Postal code *" (required for J&T)
  is_verified    TINYINT(1)   NOT NULL DEFAULT 0,         -- "Save customer" vs "Save as unverified"
  verified_at    DATETIME NULL,
  created_by     INT UNSIGNED NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_id),
  UNIQUE KEY uq_customers_code (customer_code),
  KEY ix_customers_name (full_name),
  KEY ix_customers_contact (contact_number),
  CONSTRAINT fk_customers_created_by FOREIGN KEY (created_by) REFERENCES users (user_id),
  -- Unverified rows may hold incomplete/invalid data (e.g. "0917 22"); verified rows must pass every UI check.
  CONSTRAINT ck_customers_verified CHECK (
    is_verified = 0 OR (
      contact_number REGEXP '^09[0-9]{9}$'               -- "11-digit mobile number"
      AND address     IS NOT NULL AND CHAR_LENGTH(TRIM(address)) > 0
      AND city        IS NOT NULL AND province IS NOT NULL
      AND postal_code REGEXP '^[0-9]{4}$'))
) ENGINE=InnoDB;

-- =====================================================================
-- 4. RESERVATIONS  (UI pp. 20, 34-37, 47)
-- =====================================================================

CREATE TABLE reservations (
  reservation_id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reservation_no   VARCHAR(20) NOT NULL,                  -- RSV-309
  customer_id      INT UNSIGNED NOT NULL,                 -- "Customer *"
  fulfillment_type ENUM('Store Pickup','Delivery') NOT NULL DEFAULT 'Store Pickup',
  requested_by     INT UNSIGNED NOT NULL,                 -- Sales (M. Santos)
  requested_at     DATETIME NOT NULL,                     -- "Request entered" (day 1)
  agreed_days      TINYINT UNSIGNED NOT NULL,             -- "Agreed days *" (user input, inclusive count)
  expires_at       DATETIME NOT NULL,                     -- requested_at + (agreed_days-1) days, same time of day
  subtotal         DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,      -- "Flat discount"
  reserve_amount   DECIMAL(10,2) NOT NULL DEFAULT 0,      -- "Amount to reserve"
  payment_status   ENUM('Unpaid','Paid') NOT NULL DEFAULT 'Unpaid',
  status           ENUM('Awaiting Approval','Approved','Paid','Expired','Rejected','Cancelled')
                   NOT NULL DEFAULT 'Awaiting Approval',  -- Approved = "stock is on hold"; Expired = auto-voided
  approved_by      INT UNSIGNED NULL,                     -- Admin decision
  approved_at      DATETIME NULL,
  hold_activated_at DATETIME NULL,                        -- stock hold starts on approval
  rejection_reason VARCHAR(255) NULL,                     -- "Required only when rejecting"
  pickup_note      VARCHAR(255) NULL,                     -- "Pickup note"
  voided_at        DATETIME NULL,                         -- auto-void or cancel time
  voided_by        INT UNSIGNED NULL,                     -- NULL + status Expired = system auto-void
  void_reason      VARCHAR(255) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (reservation_id),
  UNIQUE KEY uq_reservations_no (reservation_no),
  KEY ix_res_customer (customer_id),
  KEY ix_res_status_expiry (status, payment_status, expires_at),   -- used by the auto-void job
  CONSTRAINT fk_res_customer  FOREIGN KEY (customer_id)  REFERENCES customers (customer_id),
  CONSTRAINT fk_res_requester FOREIGN KEY (requested_by) REFERENCES users (user_id),
  CONSTRAINT fk_res_approver  FOREIGN KEY (approved_by)  REFERENCES users (user_id),
  CONSTRAINT fk_res_voider    FOREIGN KEY (voided_by)    REFERENCES users (user_id),
  CONSTRAINT ck_res_days   CHECK (agreed_days >= 1),
  CONSTRAINT ck_res_expiry CHECK (expires_at >= requested_at),
  CONSTRAINT ck_res_amount CHECK (reserve_amount = subtotal - discount_amount)
) ENGINE=InnoDB;

CREATE TABLE reservation_items (
  reservation_item_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reservation_id      INT UNSIGNED NOT NULL,
  product_id          INT UNSIGNED NOT NULL,
  quantity            INT UNSIGNED NOT NULL,
  unit_price          DECIMAL(10,2) NOT NULL,             -- price agreed at request time
  line_total          DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  PRIMARY KEY (reservation_item_id),
  UNIQUE KEY uq_resitem (reservation_id, product_id),
  KEY ix_resitem_product (product_id),
  CONSTRAINT fk_resitem_res     FOREIGN KEY (reservation_id) REFERENCES reservations (reservation_id) ON DELETE CASCADE,
  CONSTRAINT fk_resitem_product FOREIGN KEY (product_id)     REFERENCES products (product_id),
  CONSTRAINT ck_resitem_qty CHECK (quantity > 0)
) ENGINE=InnoDB;

-- =====================================================================
-- 5. ORDERS, PAYMENTS, SHIPMENTS  (UI pp. 14-16, 22-24, 28-29, 44-45)
-- =====================================================================

CREATE TABLE orders (
  order_id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_no         VARCHAR(20) NOT NULL,                  -- ORD-2048
  customer_id      INT UNSIGNED NOT NULL,                 -- "Customer association"
  reservation_id   INT UNSIGNED NULL,                     -- set when a reservation becomes an order
  order_source     ENUM('Live Selling','Reservation','Sales Counter') NOT NULL DEFAULT 'Live Selling',
  status           ENUM('Draft','Pending Payment','Awaiting Verification','For Shipping',
                        'Shipped','Completed','Returned','Voided') NOT NULL DEFAULT 'Draft',
                   -- UI "Delivered" tab = Completed; "Returned" = failed delivery / returned parcel
  subtotal         DECIMAL(10,2) NOT NULL DEFAULT 0,      -- "Subtotal - 4 units"
  discount_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,      -- "Flat discount"
  total_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,      -- "Total due"
  total_cost       DECIMAL(10,2) NOT NULL DEFAULT 0,      -- sum(qty * unit_cost) -> profit report
  total_profit     DECIMAL(10,2) GENERATED ALWAYS AS (total_amount - total_cost) STORED,
  notes            VARCHAR(255) NULL,                     -- checkout "Notes"
  created_by       INT UNSIGNED NOT NULL,                 -- cashier / Sales
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at          DATETIME NULL,                         -- Admin verified the payment
  stock_deducted_at DATETIME NULL,                        -- "Four units were deducted once" (idempotency guard)
  completed_at     DATETIME NULL,
  voided_at        DATETIME NULL,
  voided_by        INT UNSIGNED NULL,
  void_reason      VARCHAR(255) NULL,                     -- "Void order and release stock"
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  UNIQUE KEY uq_orders_no (order_no),
  KEY ix_orders_customer (customer_id),
  KEY ix_orders_status (status, created_at),
  KEY ix_orders_paid (paid_at),
  KEY ix_orders_reservation (reservation_id),
  CONSTRAINT fk_orders_customer    FOREIGN KEY (customer_id)    REFERENCES customers (customer_id),
  CONSTRAINT fk_orders_reservation FOREIGN KEY (reservation_id) REFERENCES reservations (reservation_id),
  CONSTRAINT fk_orders_created_by  FOREIGN KEY (created_by)     REFERENCES users (user_id),
  CONSTRAINT fk_orders_voided_by   FOREIGN KEY (voided_by)      REFERENCES users (user_id),
  CONSTRAINT ck_orders_totals CHECK (total_amount = subtotal - discount_amount AND discount_amount >= 0)
) ENGINE=InnoDB;

CREATE TABLE order_items (
  order_item_id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id            INT UNSIGNED NOT NULL,
  product_id          INT UNSIGNED NOT NULL,
  quantity            INT UNSIGNED NOT NULL,              -- "x2"
  unit_price          DECIMAL(10,2) NOT NULL,             -- price kept at time of sale (price edits never change old orders)
  unit_cost           DECIMAL(10,2) NOT NULL,             -- cost snapshot for profit
  allocated_discount  DECIMAL(10,2) NOT NULL DEFAULT 0,   -- share of the flat discount (Jacket 147.60 / Tees 111.98 / Bag 80.42)
  line_total          DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  net_paid_amount     DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price - allocated_discount) STORED, -- refund ceiling
  PRIMARY KEY (order_item_id),
  UNIQUE KEY uq_order_item (order_id, product_id),
  KEY ix_oi_product (product_id),
  CONSTRAINT fk_oi_order   FOREIGN KEY (order_id)   REFERENCES orders (order_id) ON DELETE CASCADE,
  CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES products (product_id),
  CONSTRAINT ck_oi_qty  CHECK (quantity > 0),
  CONSTRAINT ck_oi_disc CHECK (allocated_discount >= 0)
) ENGINE=InnoDB;

-- GCash payment record: Sales records it, Admin verifies it (no live GCash API)
CREATE TABLE payments (
  payment_id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id            INT UNSIGNED NOT NULL,
  payment_method      ENUM('GCash','Cash') NOT NULL DEFAULT 'GCash',   -- p.22: "GCash - only method enabled"; Cash appears in demo pp.2,15,16,21
  amount_paid         DECIMAL(10,2) NOT NULL,             -- "Amount paid"
  amount_tendered     DECIMAL(10,2) NULL,                 -- cash only
  change_due          DECIMAL(10,2) NULL,                 -- cash only
  gcash_reference_no  VARCHAR(20) NULL,                   -- "7012 345 678 901" stored digits only; must be unique
  payment_date        DATETIME NULL,                      -- "Payment date"
  payment_status      ENUM('Unpaid','Awaiting Verification','Verified','Not Verified')
                      NOT NULL DEFAULT 'Unpaid',          -- "Awaiting Admin verification", "Payment not verified"
  recorded_by         INT UNSIGNED NOT NULL,              -- Sales
  recorded_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_by         INT UNSIGNED NULL,                  -- Admin
  verified_at         DATETIME NULL,
  verification_note   VARCHAR(255) NULL,                  -- "Reference number not found in GCash..."
  resubmit_count      TINYINT UNSIGNED NOT NULL DEFAULT 0, -- "Resubmit for verification"
  PRIMARY KEY (payment_id),
  UNIQUE KEY uq_payments_gcash_ref (gcash_reference_no),
  KEY ix_payments_order (order_id),
  KEY ix_payments_status (payment_status),
  CONSTRAINT fk_pay_order    FOREIGN KEY (order_id)    REFERENCES orders (order_id),
  CONSTRAINT fk_pay_recorder FOREIGN KEY (recorded_by) REFERENCES users (user_id),
  CONSTRAINT fk_pay_verifier FOREIGN KEY (verified_by) REFERENCES users (user_id),
  CONSTRAINT ck_pay_amount CHECK (amount_paid >= 0),
  CONSTRAINT ck_pay_ref_format CHECK (gcash_reference_no IS NULL OR gcash_reference_no REGEXP '^[0-9]{13}$'),
  CONSTRAINT ck_pay_ref_required CHECK (
    payment_method <> 'GCash' OR payment_status = 'Unpaid' OR gcash_reference_no IS NOT NULL),
  CONSTRAINT ck_pay_verified CHECK (
    payment_status <> 'Verified' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
) ENGINE=InnoDB;

-- Shipment record: J&T Express, updated manually (no live J&T link)
CREATE TABLE shipments (
  shipment_id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  shipment_no        VARCHAR(20) NOT NULL,                -- SHP-2048
  order_id           INT UNSIGNED NOT NULL,
  courier            VARCHAR(40) NOT NULL DEFAULT 'J&T Express',
  tracking_number    VARCHAR(40) NULL,                    -- SD2048JT1101
  shipment_status    ENUM('Pending','Packed','Shipped','Delivered','Returned') NOT NULL DEFAULT 'Pending',
                     -- "Shipped" is shown as "In transit"; Returned = failed delivery
  packed_at          DATETIME NULL,                       -- "Packed" step (Packer works from "Print order")
  packed_marked_by   INT UNSIGNED NULL,
  shipped_at         DATETIME NULL,                       -- "Handed to courier"
  delivered_at       DATETIME NULL,                       -- "Date and time delivered *"
  received_by        VARCHAR(100) NULL,                   -- "Received by"
  returned_at        DATETIME NULL,
  return_reason      VARCHAR(255) NULL,
  updated_by         INT UNSIGNED NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (shipment_id),
  UNIQUE KEY uq_shipments_no (shipment_no),
  KEY ix_shipments_order (order_id),
  KEY ix_shipments_tracking (tracking_number),
  KEY ix_shipments_status (shipment_status),
  CONSTRAINT fk_ship_order  FOREIGN KEY (order_id)         REFERENCES orders (order_id),
  CONSTRAINT fk_ship_packer FOREIGN KEY (packed_marked_by) REFERENCES users (user_id),
  CONSTRAINT fk_ship_user   FOREIGN KEY (updated_by)       REFERENCES users (user_id)
) ENGINE=InnoDB;

-- =====================================================================
-- 6. SALES DOCUMENTS  (UI pp. 2, 17, 24, 27, 28)
--    Invoice / Purchase Order / Delivery Receipt share one header table
--    (the Sales documents screen lists and filters them together).
-- =====================================================================

CREATE TABLE sales_documents (
  document_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  doc_type        ENUM('Invoice','Purchase Order','Delivery Receipt') NOT NULL,
  doc_number      VARCHAR(25) NOT NULL,                   -- INV-2026-0482, PO-2026-119, DR-2026-0482
  order_id        INT UNSIGNED NOT NULL,
  payment_id      INT UNSIGNED NULL,                      -- invoice: payment summary
  status          ENUM('Draft','Pending Approval','Approved','Issued','Rejected','Voided')
                  NOT NULL DEFAULT 'Draft',               -- "Awaiting Admin approval", "Approved - Issued"
  subtotal        DECIMAL(10,2) NULL,                     -- snapshot printed on the document
  discount_amount DECIMAL(10,2) NULL,
  total_amount    DECIMAL(10,2) NULL,
  admin_note      VARCHAR(255) NULL,                      -- "Note for the Admin (optional)"
  prepared_by     INT UNSIGNED NOT NULL,                  -- "Prepared by M. Santos"
  approved_by     INT UNSIGNED NULL,                      -- "Admin approved - J. Imperial"
  approved_at     DATETIME NULL,
  rejection_reason VARCHAR(255) NULL,
  issued_at       DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (document_id),
  UNIQUE KEY uq_sales_doc_number (doc_number),
  UNIQUE KEY uq_sales_doc_order_type (order_id, doc_type),
  KEY ix_sales_doc_status (doc_type, status),
  CONSTRAINT fk_sd_order    FOREIGN KEY (order_id)    REFERENCES orders (order_id),
  CONSTRAINT fk_sd_payment  FOREIGN KEY (payment_id)  REFERENCES payments (payment_id),
  CONSTRAINT fk_sd_prepared FOREIGN KEY (prepared_by) REFERENCES users (user_id),
  CONSTRAINT fk_sd_approved FOREIGN KEY (approved_by) REFERENCES users (user_id),
  CONSTRAINT ck_sd_issued CHECK (status NOT IN ('Approved','Issued') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
) ENGINE=InnoDB;

-- Delivery Receipt extras: proof of delivery, issued only after delivery is confirmed
CREATE TABLE delivery_receipts (
  document_id   INT UNSIGNED NOT NULL,                    -- = sales_documents.document_id (doc_type = Delivery Receipt)
  shipment_id   INT UNSIGNED NOT NULL,
  delivered_at  DATETIME NOT NULL,                        -- "Date and time delivered *"
  received_by   VARCHAR(100) NOT NULL,                    -- "Received by"
  PRIMARY KEY (document_id),
  UNIQUE KEY uq_dr_shipment (shipment_id),
  CONSTRAINT fk_dr_document FOREIGN KEY (document_id) REFERENCES sales_documents (document_id) ON DELETE CASCADE,
  CONSTRAINT fk_dr_shipment FOREIGN KEY (shipment_id) REFERENCES shipments (shipment_id)
) ENGINE=InnoDB;

-- =====================================================================
-- 7. REFUNDS  (UI pp. 18-19, 21)
-- =====================================================================

CREATE TABLE refunds (
  refund_id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  refund_no            VARCHAR(20) NOT NULL,              -- RFD-112
  order_id             INT UNSIGNED NOT NULL,             -- "Order number *"
  requested_by         INT UNSIGNED NOT NULL,             -- Sales
  requested_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  days_of_ownership    INT UNSIGNED NOT NULL,             -- "14 days of ownership" (order date -> request date)
  issue_reason         VARCHAR(255) NOT NULL,             -- "Issue / reason *"
  inspection_note      VARCHAR(500) NULL,                 -- "Inspection note"
  refund_method        ENUM('Cash','GCash') NOT NULL DEFAULT 'Cash',   -- "Requested method"
  refund_amount        DECIMAL(10,2) NOT NULL,            -- "Requested refund amount *" (sum of items)
  approved_amount      DECIMAL(10,2) NULL,                -- Admin approves the amount
  status               ENUM('Awaiting Approval','Condition Review','Approved','Completed','Rejected')
                       NOT NULL DEFAULT 'Awaiting Approval',
  approved_by          INT UNSIGNED NULL,
  approved_at          DATETIME NULL,
  rejection_reason     VARCHAR(255) NULL,
  condition_reviewed_by INT UNSIGNED NULL,                -- R. Dela Cruz quarantined the jacket
  condition_reviewed_at DATETIME NULL,
  refunded_by          INT UNSIGNED NULL,                 -- Sales issues the payout
  refunded_at          DATETIME NULL,
  refund_receipt_no    VARCHAR(25) NULL,                  -- RRC-2026-0112
  customer_notified_at DATETIME NULL,
  PRIMARY KEY (refund_id),
  UNIQUE KEY uq_refunds_no (refund_no),
  UNIQUE KEY uq_refunds_receipt (refund_receipt_no),
  KEY ix_refunds_order (order_id),
  KEY ix_refunds_status (status, requested_at),
  CONSTRAINT fk_ref_order    FOREIGN KEY (order_id)              REFERENCES orders (order_id),
  CONSTRAINT fk_ref_req      FOREIGN KEY (requested_by)          REFERENCES users (user_id),
  CONSTRAINT fk_ref_appr     FOREIGN KEY (approved_by)           REFERENCES users (user_id),
  CONSTRAINT fk_ref_cond     FOREIGN KEY (condition_reviewed_by) REFERENCES users (user_id),
  CONSTRAINT fk_ref_paid     FOREIGN KEY (refunded_by)           REFERENCES users (user_id),
  CONSTRAINT ck_ref_amounts  CHECK (refund_amount >= 0 AND (approved_amount IS NULL OR approved_amount <= refund_amount)),
  CONSTRAINT ck_ref_approval CHECK (status NOT IN ('Approved','Completed') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
) ENGINE=InnoDB;

CREATE TABLE refund_items (
  refund_item_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  refund_id          INT UNSIGNED NOT NULL,
  order_item_id      INT UNSIGNED NOT NULL,
  product_id         INT UNSIGNED NOT NULL,
  quantity           INT UNSIGNED NOT NULL,               -- "Return quantity *" (<= purchased - previously refunded)
  item_condition     ENUM('Defective','Non-defective') NOT NULL,   -- "Item condition *"
  inventory_action   ENUM('Exclude From Stock','Return To Stock') NOT NULL,
  list_amount        DECIMAL(10,2) NOT NULL,              -- "Jacket list price x 1" 1,450.00
  discount_share     DECIMAL(10,2) NOT NULL DEFAULT 0,    -- "Allocated order discount" -147.60
  max_refund_amount  DECIMAL(10,2) NOT NULL,              -- "Maximum line refund" 1,302.40 (net amount actually paid)
  refund_amount      DECIMAL(10,2) NOT NULL,
  quarantine_ref     VARCHAR(20) NULL,                    -- QTN-112 (defective items only)
  PRIMARY KEY (refund_item_id),
  UNIQUE KEY uq_refund_item (refund_id, order_item_id),
  KEY ix_ri_order_item (order_item_id),
  KEY ix_ri_product (product_id),
  CONSTRAINT fk_ri_refund     FOREIGN KEY (refund_id)     REFERENCES refunds (refund_id) ON DELETE CASCADE,
  CONSTRAINT fk_ri_order_item FOREIGN KEY (order_item_id) REFERENCES order_items (order_item_id),
  CONSTRAINT fk_ri_product    FOREIGN KEY (product_id)    REFERENCES products (product_id),
  CONSTRAINT ck_ri_qty     CHECK (quantity > 0),
  CONSTRAINT ck_ri_ceiling CHECK (refund_amount >= 0 AND refund_amount <= max_refund_amount),
  CONSTRAINT ck_ri_net     CHECK (max_refund_amount = list_amount - discount_share),
  -- Fixed inventory rule: defective -> deducted/quarantined, non-defective -> back to stock
  CONSTRAINT ck_ri_rule CHECK (
    (item_condition = 'Defective'     AND inventory_action = 'Exclude From Stock')
 OR (item_condition = 'Non-defective' AND inventory_action = 'Return To Stock'))
) ENGINE=InnoDB;

-- =====================================================================
-- 8. NOTIFICATIONS, AUDIT TRAIL, NUMBERING  (UI pp. 36, 48-51, 50)
-- =====================================================================

CREATE TABLE notifications (
  notification_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED NOT NULL,                  -- recipient
  type            ENUM('Access Request','Payment To Verify','Payment Verified','Refund Request',
                       'Refund Approved','Reservation Request','Reservation Approved','Reservation Rejected',
                       'Void Notice','Low Stock','Stock Saved','Document Approval') NOT NULL,
  title           VARCHAR(120) NOT NULL,                  -- "Void notice - RSV-304"
  message         VARCHAR(255) NOT NULL,                  -- "Unpaid at deadline - stock released"
  entity_type     VARCHAR(30) NULL,                       -- 'reservation','order','refund','product','user','document'
  entity_id       INT UNSIGNED NULL,
  is_read         TINYINT(1) NOT NULL DEFAULT 0,          -- "Mark all read"
  read_at         DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id),
  KEY ix_notif_user (user_id, is_read, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- "This decision is saved with your name and the time ... view it in the audit trail."
-- Also feeds the timelines on reservation, refund, order and payment history panels.
CREATE TABLE audit_log (
  audit_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id INT UNSIGNED NULL,                        -- NULL = system (auto-void)
  action        VARCHAR(60) NOT NULL,                     -- 'Request submitted','Approved','Rejected','Auto-voided',...
  entity_type   VARCHAR(30) NOT NULL,
  entity_id     INT UNSIGNED NOT NULL,
  entity_no     VARCHAR(30) NULL,                         -- RSV-304, RFD-112, ORD-2048
  from_status   VARCHAR(30) NULL,
  to_status     VARCHAR(30) NULL,
  note          VARCHAR(500) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (audit_id),
  KEY ix_audit_entity (entity_type, entity_id, created_at),
  KEY ix_audit_actor (actor_user_id, created_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users (user_id)
) ENGINE=InnoDB;

-- Atomic counters for formatted numbers (ORD-2048, INV-2026-0482, RSV-309 ...).
-- seq_year = 0 for series that do not restart yearly.
CREATE TABLE document_sequences (
  seq_key     VARCHAR(10) NOT NULL,                       -- ORD, RSV, RFD, SHP, INV, PO, DR, MOV, RRC, QTN, ACC, CUST
  seq_year    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  last_number INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (seq_key, seq_year)
) ENGINE=InnoDB;

-- =====================================================================
-- 9. SEED DATA
-- =====================================================================
INSERT INTO categories (name) VALUES ('Tops'),('Bottoms'),('Outerwear'),('Tees'),('Accessories');

-- =====================================================================
-- 10. VIEWS  (dashboard + low-stock screens)
-- =====================================================================

-- Low-stock list (pp. 32, 46). "Critical" rule is inferred from the mockup data:
-- Critical when available is below half the threshold (3 of 8), otherwise Low.
CREATE VIEW v_low_stock AS
SELECT p.product_id, p.sku, p.product_name, c.name AS category, p.size,
       p.qty_available, p.qty_reserved, p.qty_defective, p.low_stock_threshold,
       CASE WHEN p.qty_available * 2 < p.low_stock_threshold THEN 'Critical' ELSE 'Low' END AS alert_level
FROM products p
JOIN categories c ON c.category_id = p.category_id
WHERE p.status = 'Active' AND p.qty_available <= p.low_stock_threshold;

-- Admin dashboard cards (pp. 39, 42): current month sales/profit + live counters.
CREATE VIEW v_dashboard_summary AS
SELECT
  COALESCE(SUM(CASE WHEN o.status IN ('For Shipping','Shipped','Completed')
                     AND o.paid_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN o.total_amount END), 0) AS total_sales,
  COALESCE(SUM(CASE WHEN o.status IN ('For Shipping','Shipped','Completed')
                     AND o.paid_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN o.total_cost END), 0)   AS total_cost,
  COALESCE(SUM(CASE WHEN o.status IN ('For Shipping','Shipped','Completed')
                     AND o.paid_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN o.total_profit END), 0) AS total_profit,
  COALESCE(SUM(o.status IN ('Pending Payment','Awaiting Verification')), 0) AS pending_orders,
  COALESCE(SUM(o.status = 'For Shipping'), 0)                                 AS items_for_shipping,
  COALESCE(SUM(o.status = 'Completed'
               AND o.completed_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')), 0)  AS completed_orders,
  (SELECT COUNT(*) FROM reservations r
    WHERE r.status = 'Approved' AND r.payment_status = 'Unpaid')              AS unpaid_reservations,
  (SELECT COUNT(*) FROM shipments s
    WHERE s.shipment_status = 'Returned'
      AND s.returned_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01'))                AS returned_parcels
FROM orders o;

-- =====================================================================
-- 11. AUTOMATION: number generator + auto-void of unpaid reservations
-- =====================================================================
DELIMITER $$

-- Usage: CALL sp_next_number('ORD', 0, @n);  -> app formats CONCAT('ORD-', @n)
CREATE PROCEDURE sp_next_number(IN p_key VARCHAR(10), IN p_year SMALLINT UNSIGNED, OUT p_value INT UNSIGNED)
BEGIN
  INSERT INTO document_sequences (seq_key, seq_year, last_number)
  VALUES (p_key, p_year, LAST_INSERT_ID(1))
  ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1);
  SET p_value = LAST_INSERT_ID();
END$$

-- Voids approved reservations that are still unpaid after expires_at, releases the held
-- stock (Reserved -n, Available +n), notifies the requesting Sales user, and logs it.
-- Paid reservations are never touched (UI p.36-37 "Only unpaid holds expire").
CREATE PROCEDURE sp_void_expired_reservations()
BEGIN
  DECLARE v_done   INT DEFAULT 0;
  DECLARE v_res_id INT UNSIGNED;
  DECLARE v_res_no VARCHAR(20);
  DECLARE v_req_by INT UNSIGNED;

  DECLARE cur CURSOR FOR
    SELECT reservation_id, reservation_no, requested_by
    FROM reservations
    WHERE status = 'Approved' AND payment_status = 'Unpaid' AND expires_at < NOW();

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  OPEN cur;
  void_loop: LOOP
    FETCH cur INTO v_res_id, v_res_no, v_req_by;
    IF v_done = 1 THEN LEAVE void_loop; END IF;

    START TRANSACTION;

    UPDATE reservations
       SET status = 'Expired', voided_at = NOW(), voided_by = NULL,
           void_reason = 'Unpaid at deadline (auto-void)'
     WHERE reservation_id = v_res_id AND status = 'Approved' AND payment_status = 'Unpaid';

    IF ROW_COUNT() = 1 THEN
      UPDATE products p
        JOIN reservation_items ri ON ri.product_id = p.product_id
         SET p.qty_available = p.qty_available + ri.quantity,
             p.qty_reserved  = p.qty_reserved  - ri.quantity
       WHERE ri.reservation_id = v_res_id;

      INSERT INTO stock_movements
        (movement_no, movement_group, product_id, movement_type,
         available_change, reserved_change, defective_change,
         available_before, available_after,
         reference_type, reference_id, reference_no, reason, recorded_by)
      SELECT CONCAT('MOV-SYS-', ri.reservation_item_id), CONCAT('VOID-', v_res_no), ri.product_id, 'Reservation Release',
             ri.quantity, -ri.quantity, 0,
             p.qty_available - ri.quantity, p.qty_available,
             'Reservation', v_res_id, v_res_no, 'Auto-void: unpaid at deadline', NULL
        FROM reservation_items ri
        JOIN products p ON p.product_id = ri.product_id
       WHERE ri.reservation_id = v_res_id;

      INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
      VALUES (v_req_by, 'Void Notice', CONCAT('Void notice - ', v_res_no),
              'Unpaid at deadline - stock released', 'reservation', v_res_id);

      INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, entity_no, from_status, to_status, note)
      VALUES (NULL, 'Auto-voided', 'reservation', v_res_id, v_res_no, 'Approved', 'Expired',
              'Deadline passed while unpaid; held units released');
    END IF;

    COMMIT;
  END LOOP;
  CLOSE cur;
END$$

DELIMITER ;

-- Requires: SET GLOBAL event_scheduler = ON;   (or event_scheduler=ON in my.ini)
CREATE EVENT ev_void_expired_reservations
  ON SCHEDULE EVERY 1 MINUTE
  DO CALL sp_void_expired_reservations();

-- =====================================================================
-- END OF SCHEMA  -  20 tables, 2 views, 2 procedures, 1 event
-- =====================================================================
