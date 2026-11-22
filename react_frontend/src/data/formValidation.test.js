import test from "node:test";
import assert from "node:assert/strict";
import { isOptionalField, validateFormValues, validatePassword } from "./formValidation.js";
import { formFields, screens } from "../screens.js";

test("workspace form rules reject missing required fields but allow optional notes", () => {
  const errors = validateFormValues(["Customer", "Quantity", "Reservation note"], {
    Customer: "",
    Quantity: "",
    "Reservation note": "",
  });
  assert.deepEqual(Object.keys(errors).sort(), ["Customer", "Quantity"]);
  assert.equal(isOptionalField("Reservation note"), true);
  assert.equal(isOptionalField("Postal code"), true);
  assert.equal(isOptionalField("Customer"), false);
});

test("quantity, threshold and days use the same whole-number rules as the API", () => {
  const errors = validateFormValues(["Return quantity", "Low-stock threshold", "Days of ownership", "Agreed days"], {
    "Return quantity": "0",
    "Low-stock threshold": "2.5",
    "Days of ownership": "0",
    "Agreed days": "0",
  });
  assert.match(errors["Return quantity"], /greater than zero/);
  assert.match(errors["Low-stock threshold"], /whole number/);
  assert.equal(errors["Days of ownership"], undefined);
  assert.match(errors["Agreed days"], /greater than zero/);
});

test("contact numbers, email addresses and money values are validated before save", () => {
  const errors = validateFormValues(["Contact number", "Email", "Cost price"], {
    "Contact number": "12345",
    Email: "not-an-email",
    "Cost price": "10.999",
  });
  assert.match(errors["Contact number"], /09XXXXXXXXX/);
  assert.match(errors.Email, /valid email/);
  assert.match(errors["Cost price"], /two decimal places/);
  assert.equal(validateFormValues(["Contact number"], { "Contact number": "+639171234567" })["Contact number"], undefined);
});

test("strong-password rule matches the backend before reset or change", () => {
  assert.equal(validatePassword("weak"), "Password must be 8 to 72 characters.");
  assert.match(validatePassword("alllowercase1!"), /uppercase/);
  assert.equal(validatePassword("SecondDaze1!"), "");
});

test("phase 6 role dashboards and notification center exist", () => {
  const ids = screens.map((screen) => screen.id);
  for (const id of ["2-admin-dashboard", "2s-staff-dashboard", "4.0-inventory-dashboard", "2.10-notifications"]) {
    assert.ok(ids.includes(id), `missing screen ${id}`);
  }
  assert.equal(formFields["5.1-new-reservation"].includes("Agreed days"), true);
  assert.equal(formFields["5.1-new-reservation"].includes("Pickup note"), false);
  assert.equal(formFields["3.4-new-refund-request"].includes("Days of ownership"), true);
  assert.equal(screens.some((screen) => /quotation|pickup/i.test(`${screen.title} ${screen.description}`)), false);
});
