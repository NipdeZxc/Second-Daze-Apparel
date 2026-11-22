import assert from "node:assert/strict";
import test from "node:test";
import { canAccessScreen, homeScreenForRole, navigationForRole, normalizeRole } from "./roles.js";
import { screens } from "./screens.js";

test("each role has a dedicated desktop and mobile home screen", () => {
  assert.equal(homeScreenForRole("Admin"), "2-admin-dashboard");
  assert.equal(homeScreenForRole("Sales Management"), "2s-staff-dashboard");
  assert.equal(homeScreenForRole("Inventory Management"), "4.0-inventory-dashboard");
  assert.equal(homeScreenForRole("Admin", true), "8.1-mobile-admin-dashboard");
  assert.equal(homeScreenForRole("Sales Management", true), "8.4-mobile-orders");
  assert.equal(homeScreenForRole("Inventory Management", true), "8.5-mobile-low-stock");
});

test("role navigation only links to screens that exist", () => {
  const screenIds = new Set(screens.map((screen) => screen.id));
  for (const role of ["Admin", "Sales Management", "Inventory Management"]) {
    for (const screenId of navigationForRole(role)) {
      assert.ok(screenIds.has(screenId), `${role} desktop navigation references ${screenId}`);
    }
    for (const screenId of navigationForRole(role, true)) {
      assert.ok(screenIds.has(screenId), `${role} mobile navigation references ${screenId}`);
    }
  }
});

test("role guards cover admin, sales and inventory screens", () => {
  assert.equal(canAccessScreen("Sales Management", "2.1-subaccounts"), false);
  assert.equal(canAccessScreen("Inventory Management", "3.9-orders-status-tracking"), false);
  assert.equal(canAccessScreen("Sales Management", "4.2-low-stock-alerts"), false);
  assert.equal(canAccessScreen("Inventory Management", "4.2-low-stock-alerts"), true);
  assert.equal(canAccessScreen("Admin", "7-staff-accounts"), true);
  assert.equal(canAccessScreen("Sales Management", "1.5-change-password"), true);
  assert.equal(canAccessScreen("Inventory Management", "9-overlay-notifications-admin"), false);
  assert.equal(canAccessScreen("Inventory Management", "9.2-overlay-notifications-inventory"), true);
});

test("legacy role labels resolve to the current three roles", () => {
  assert.equal(normalizeRole("Staff"), "Sales Management");
  assert.equal(normalizeRole("Sales"), "Sales Management");
  assert.equal(normalizeRole("Inventory"), "Inventory Management");
  assert.equal(normalizeRole("Admin"), "Admin");
});
