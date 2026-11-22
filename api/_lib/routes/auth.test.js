import assert from "node:assert/strict";
import test from "node:test";
import { testAccountsEnabled } from "./auth.js";

test("test accounts are never enabled on the production deployment", () => {
  assert.equal(testAccountsEnabled({ ENABLE_TEST_ACCOUNTS: "true" }), true);
  assert.equal(testAccountsEnabled({ ENABLE_TEST_ACCOUNTS: "true", VERCEL_ENV: "production" }), false);
  assert.equal(testAccountsEnabled({ ENABLE_TEST_ACCOUNTS: "true", NODE_ENV: "production" }), false);
  assert.equal(testAccountsEnabled({}), false);
});
