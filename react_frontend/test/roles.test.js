import test from "node:test";
import assert from "node:assert/strict";
import { canAccessScreen, homeScreenForRole, navigationForRole, normalizeRole } from "../src/roles.js";
import { screens } from "../src/screens.js";

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

test("non-admin roles cannot enter admin-only screens", () => {
  assert.equal(canAccessScreen("Sales Management", "2.1-subaccounts"), false);
  assert.equal(canAccessScreen("Inventory Management", "4.3-edit-product-admin-only"), false);
  assert.equal(canAccessScreen("Admin", "4.3-edit-product-admin-only"), true);
});

test("legacy Staff role resolves to Sales Management", () => {
  assert.equal(normalizeRole("Staff"), "Sales Management");
  assert.equal(homeScreenForRole("Staff"), "3-sales-dashboard");
});
