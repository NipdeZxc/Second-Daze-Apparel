import assert from "node:assert/strict";
import test from "node:test";
import { isValidPhilippineMobileNumber, normalizePhilippineMobileNumber } from "../src/formValidation.js";

test("accepts Philippine mobile numbers in local and international notation", () => {
  for (const number of ["09171234567", "+639171234567", "639171234567", "(0917) 123-4567"]) {
    assert.equal(isValidPhilippineMobileNumber(number), true, number);
  }
  assert.equal(normalizePhilippineMobileNumber("639171234567"), "+639171234567");
});

test("rejects malformed or non-mobile phone numbers", () => {
  for (const number of ["0917123456", "+6391712345678", "0212345678", "0917ABC4567", ""]) {
    assert.equal(isValidPhilippineMobileNumber(number), false, number);
  }
});
