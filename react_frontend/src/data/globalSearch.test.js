import assert from "node:assert/strict";
import test from "node:test";
import { findGlobalSearchResults, globalSearchHref, matchesGlobalSearch, searchFromHash } from "./globalSearch.js";

test("global search matches accessible records and prioritizes matching titles", () => {
  const records = {
    orders: [{ id: 1, order_number: "ORD-100", customer_name: "Ada Reyes", status: "Paid" }],
    customers: [{ id: 2, full_name: "Ada Reyes", contact_number: "09123456789" }],
  };
  const { results, total } = findGlobalSearchResults("  ADA  ", records, "Sales Management");
  assert.equal(total, 2);
  assert.deepEqual(results.map((result) => result.category), ["Customer", "Order"]);
  assert.equal(results[0].screenId, "3.11-customers");
  assert.equal(results[1].screenId, "3.9-orders-status-tracking");
});

test("every collection links to a filter that matches the destination record", () => {
  const records = {
    orders: [{ id: 1, order_number: "ORD-100", customer_name: "Matching customer" }],
    products: [{ id: 2, product_code: "SKU-42", product_name: "Matching Jacket" }],
    customers: [{ id: 3, full_name: "Matching customer", contact_number: "09123456789" }],
    sales: [{ id: 4, sale_no: "SALE-matching", order_no: "ORD-100" }],
    reservations: [{ id: 5, reservation_number: "RES-100", customer_name: "Matching customer" }],
    refunds: [{ id: 6, refund_number: "REF-100", reason: "Matching defect" }],
    documents: [{ id: 7, doc_number: "DOC-100", doc_type: "Matching document" }],
    accounts: [{ id: 8, full_name: "Matching staff", username: "staff+matching & helper" }],
    notifications: [{ id: 9, message: "Matching stock & order? Check #100" }],
  };
  for (const role of ["Admin", "Sales Management", "Inventory Management", "Staff"]) {
    const { results } = findGlobalSearchResults("matching", records, role, 100);
    for (const result of results.filter((item) => item.category !== "Page")) {
      const kind = result.id.split("-")[0];
      const targetRows = kind === "sales" && role !== "Admin" ? records.orders : records[kind];
      const query = searchFromHash(globalSearchHref(result));
      assert.equal(query, result.query);
      assert.ok(targetRows.some((record) => matchesGlobalSearch(record, query)), `${role}: ${result.category}`);
    }
  }
  assert.equal(findGlobalSearchResults("sku-42", records, "Sales Management").results[0].screenId, "3-sales-catalog");
  assert.equal(findGlobalSearchResults("sku-42", records, "Inventory Management").results[0].screenId, "4-inventory-workspace");
});

test("global search isolates roles, includes accessible pages, and rejects short queries", () => {
  const records = {
    orders: [{ order_number: "ORD-secret" }],
    refunds: [{ refund_number: "REF-secret" }],
    accounts: [{ username: "secret", full_name: "Secret staff" }],
  };
  assert.equal(findGlobalSearchResults("secret", records, "Inventory Management").total, 0);
  assert.deepEqual(findGlobalSearchResults("secret", records, "Sales Management").results.map((result) => result.category), ["Order", "Refund"]);
  assert.equal(findGlobalSearchResults("secret", records, "unknown").total, 0);
  assert.equal(findGlobalSearchResults("R", records, "Admin").total, 0);
  for (const role of ["Admin", "Sales Management", "Inventory Management"]) {
    const { results } = findGlobalSearchResults("reports", {}, role);
    assert.ok(results.length);
    assert.ok(results.every((result) => result.category === "Page"));
    assert.ok(results.every((result) => !globalSearchHref(result).includes("?search=")));
  }
  assert.equal(findGlobalSearchResults("subaccounts", {}, "Inventory Management").total, 0);
});

test("search limits results without losing the total and ignores nested data", () => {
  const products = Array.from({ length: 12 }, (_, index) => ({ id: index, product_code: `CODE-${index}`, product_name: `Match jacket ${index}` }));
  const { results, total } = findGlobalSearchResults("match jacket", { products }, "Admin", 5);
  assert.equal(results.length, 5);
  assert.equal(total, 12);
  assert.equal(matchesGlobalSearch({ actions: [{ label: "secret" }], notes: null }, "object"), false);
  assert.equal(searchFromHash("#/3.11-customers"), "");
});

test("global search includes actual API address, price and document creator fields", () => {
  const records = {
    customers: [{ full_name: "Ada Reyes", contact_number: "09123456789", street_address: "Azure Lane" }],
    products: [{ product_code: "SKU-42", product_name: "Blue Jacket", selling_price: 1234 }],
    documents: [{ doc_number: "DOC-100", issued_by: "Azure Staff" }],
  };
  assert.deepEqual(findGlobalSearchResults("azure", records, "Admin").results.map((result) => result.category), ["Customer", "Document"]);
  assert.equal(findGlobalSearchResults("1234", records, "Sales Management").results[0].category, "Product");
});
