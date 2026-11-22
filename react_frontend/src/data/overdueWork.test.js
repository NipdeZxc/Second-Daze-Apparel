import assert from "node:assert/strict";
import test from "node:test";
import { buildOverdueWorkQueue } from "./overdueWork.js";

const now = new Date("2026-11-22T11:00:00Z");

const records = {
  orders: [
    { id: 1, order_number: "ORD-APPROVAL", status: "Pending Approval", ordered_at: "2026-11-20T10:00:00Z" },
    { id: 2, order_number: "ORD-PAYMENT", status: "Pending Payment", ordered_at: "2026-11-21T10:00:00Z" },
    { id: 3, order_number: "ORD-NEW-PAYMENT", status: "Pending Payment", ordered_at: "2026-11-21T12:00:00Z" },
    { id: 4, order_number: "ORD-FULFILL", status: "Paid", ordered_at: "2026-11-19T10:00:00Z", verified_at: "2026-11-20T10:00:00Z" },
    { id: 5, order_number: "ORD-NEW-FULFILL", status: "For Shipping", ordered_at: "2026-11-19T10:00:00Z", verified_at: "2026-11-20T12:00:00Z" },
    { id: 6, order_number: "ORD-COMPLETE", status: "Completed", ordered_at: "2026-11-18T10:00:00Z" },
  ],
  accounts: [
    { id: 7, full_name: "Pending User", username: "pending-user", status: "Pending Approval", created_at: "2026-11-20T10:00:00Z" },
  ],
  refunds: [
    { id: 8, refund_number: "REF-OLD", status: "Pending Approval", refund_date: "2026-11-19T10:00:00Z" },
    { id: 9, refund_number: "REF-NEW", status: "Pending Approval", refund_date: "2026-11-19T12:00:00Z" },
  ],
  reservations: [
    { id: 10, reservation_number: "RES-EXPIRED", status: "Active", expires_at: "2026-11-22T10:00:00Z" },
    { id: 11, reservation_number: "RES-SOON", status: "Active", expires_at: "2026-11-23T10:00:00Z" },
    { id: 12, reservation_number: "RES-FAR", status: "Active", expires_at: "2026-11-24T12:00:00Z" },
    { id: 13, reservation_number: "RES-APPROVAL", status: "Pending Approval", created_at: "2026-11-20T10:00:00Z", expires_at: "2026-11-25T10:00:00Z" },
  ],
};

test("overdue queue applies the approved aging windows and flags reservation expiry", () => {
  const items = buildOverdueWorkQueue(records, "Admin", now);
  const entries = new Map(items.map((item) => [item.title, item]));

  assert.ok(entries.has("ORD-APPROVAL"));
  assert.ok(entries.has("ORD-PAYMENT"));
  assert.ok(entries.has("ORD-FULFILL"));
  assert.ok(entries.has("Pending User"));
  assert.ok(entries.has("REF-OLD"));
  assert.ok(entries.has("RES-APPROVAL"));
  assert.equal(entries.get("RES-EXPIRED").urgency, "overdue");
  assert.equal(entries.get("RES-SOON").urgency, "due-soon");
  assert.equal(entries.has("ORD-NEW-PAYMENT"), false);
  assert.equal(entries.has("ORD-NEW-FULFILL"), false);
  assert.equal(entries.has("ORD-COMPLETE"), false);
  assert.equal(entries.has("REF-NEW"), false);
  assert.equal(entries.has("RES-FAR"), false);
});

test("overdue queue only includes records whose destination is accessible to the role", () => {
  const salesItems = buildOverdueWorkQueue(records, "Sales Management", now);
  const salesTitles = salesItems.map((item) => item.title);

  assert.ok(salesTitles.includes("ORD-PAYMENT"));
  assert.ok(salesTitles.includes("ORD-FULFILL"));
  assert.ok(salesTitles.includes("RES-EXPIRED"));
  assert.ok(salesTitles.includes("RES-SOON"));
  assert.equal(salesTitles.includes("ORD-APPROVAL"), false);
  assert.equal(salesTitles.includes("Pending User"), false);
  assert.equal(salesTitles.includes("REF-OLD"), false);
  assert.deepEqual(buildOverdueWorkQueue(records, "Inventory Management", now), []);
});
