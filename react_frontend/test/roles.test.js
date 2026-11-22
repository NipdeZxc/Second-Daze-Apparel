import test from "node:test";
import assert from "node:assert/strict";
import { canAccessScreen, homeScreenForRole, navigationForRole, normalizeRole } from "../src/roles.js";
import { formFields, screens } from "../src/screens.js";

test("each business role opens its own dashboard", () => {
  assert.equal(homeScreenForRole("Admin"), "2-admin-dashboard");
  assert.equal(homeScreenForRole("Sales Management"), "3-sales-dashboard");
  assert.equal(homeScreenForRole("Inventory Management"), "4-inventory-dashboard");
});

test("role navigation only contains existing screens", () => {
  const screenIds = new Set(screens.map((screen) => screen.id));
  for (const role of ["Admin", "Sales Management", "Inventory Management"]) {
    for (const screenId of navigationForRole(role)) {
      assert.ok(screenIds.has(screenId), `${role} navigation references ${screenId}`);
    }
  }
});

test("role access separates sales, inventory, and admin workspaces", () => {
  assert.equal(canAccessScreen("Sales Management", "3-sales-dashboard"), true);
  assert.equal(canAccessScreen("Inventory Management", "4-inventory-dashboard"), true);
  assert.equal(canAccessScreen("Sales Management", "4-inventory-dashboard"), false);
  assert.equal(canAccessScreen("Inventory Management", "3-sales-dashboard"), false);
  assert.equal(canAccessScreen("Sales Management", "2.1-subaccounts"), false);
  assert.equal(canAccessScreen("Sales Management", "3.6-approval-request-detail"), false);
  assert.equal(canAccessScreen("Inventory Management", "4.3-edit-product-admin-only"), false);
  assert.equal(canAccessScreen("Admin", "4.3-edit-product-admin-only"), true);
  assert.equal(canAccessScreen("Unknown", "2.1-subaccounts"), false);
});

test("legacy Staff role resolves to Sales Management", () => {
  assert.equal(normalizeRole("Staff"), "Sales Management");
  assert.equal(homeScreenForRole("Staff"), "3-sales-dashboard");
});

test("reservation and sales-document wording follows the task list", () => {
  const reservationFields = formFields["5.1-new-reservation"].join(" ").toLowerCase();
  const salesDocuments = screens.find((screen) => screen.id === "2.3-sales-documents").description.toLowerCase();
  assert.equal(reservationFields.includes("pickup"), false);
  assert.equal(salesDocuments.includes("quotation"), false);
});
