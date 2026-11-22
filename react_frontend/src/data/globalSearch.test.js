import assert from "node:assert/strict";
import test from "node:test";
import { findGlobalSearchResults } from "./globalSearch.js";

test("global search matches records across accessible modules case-insensitively", () => {
  const records = {
    orders: [{ id: 1, order_number: "ORD-100", customer_name: "Ada Reyes", status: "Paid" }],
    products: [{ id: 2, product_code: "SKU-42", product_name: "Blue Jacket", category: "Outerwear" }],
    customers: [{ id: 3, full_name: "Ada Reyes", contact_number: "09123456789" }],
  };

  const { results, total } = findGlobalSearchResults("ada", records, "Sales Management");

  assert.equal(total, 2);
  assert.deepEqual(results.map((result) => result.category), ["Customer", "Order"]);
  assert.equal(results[0].screenId, "3.11-customers");
  assert.equal(results[1].screenId, "3.9-orders-status-tracking");
});

test("global search routes product results to the role-accessible module", () => {
  const records = { products: [{ product_code: "SKU-42", product_name: "Blue Jacket" }] };

  assert.equal(findGlobalSearchResults("sku-42", records, "Sales Management").results[0].screenId, "3-sales-catalog");
  assert.equal(findGlobalSearchResults("sku-42", records, "Inventory Management").results[0].screenId, "4-inventory-workspace");
});

test("global search omits inaccessible records and requires at least two characters", () => {
  const records = {
    orders: [{ order_number: "ORD-100" }],
    refunds: [{ refund_number: "RFD-100", reason: "Defect" }],
  };

  assert.equal(findGlobalSearchResults("ORD", records, "Inventory Management").total, 0);
  assert.equal(findGlobalSearchResults("R", records, "Admin").total, 0);
  assert.equal(findGlobalSearchResults("RFD", records, "Admin").results[0].screenId, "2.4-refunds");
});
