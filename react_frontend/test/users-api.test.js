import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { approveUser, createUser, disableUser, enableUser, listUsers, resetUserPassword } from "../src/api/users.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("user management calls the API and validates the account list", async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ users: [{ id: 1, role: "Sales Management" }] }), {
      headers: { "Content-Type": "application/json" },
    });
  };

  assert.deepEqual(await listUsers(), [{ id: 1, role: "Sales Management" }]);
  assert.equal(request.url, "/api/users");
  assert.equal(request.options.credentials, "include");
});

test("subaccount creation and lifecycle actions use their protected endpoints", async () => {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  };

  await createUser({ fullName: "Sales User", username: "sales.user", role: "Sales Management" });
  await approveUser("7");
  await disableUser("7");
  await enableUser("7");
  await resetUserPassword("7");

  assert.deepEqual(requests.map(({ url }) => url), [
    "/api/users",
    "/api/users/7/approve",
    "/api/users/7/disable",
    "/api/users/7/enable",
    "/api/users/7/reset-password",
  ]);
  assert.equal(requests[0].options.method, "POST");
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    fullName: "Sales User",
    username: "sales.user",
    role: "Sales Management",
  });
});
