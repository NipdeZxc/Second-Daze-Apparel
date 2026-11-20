import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  changePassword,
  getCurrentUser,
  requestPasswordReset,
  resetPassword,
  signIn,
  signOut,
} from "../src/api/auth.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("login uses the Phase 1 endpoint and validates its user response", async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return jsonResponse({
      user: { username: "manager", role: "Sales Management", mustChangePassword: false },
    });
  };

  const result = await signIn({ username: "manager", password: "example" });

  assert.equal(request.url, "/api/login");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.credentials, "include");
  assert.deepEqual(JSON.parse(request.options.body), { username: "manager", password: "example" });
  assert.equal(result.status, "authenticated");
  assert.equal(result.user.role, "Sales Management");
});

test("session restoration reads the Phase 1 current-user endpoint", async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return jsonResponse({
      user: { username: "admin", role: "Admin", mustChangePassword: true },
    });
  };

  const user = await getCurrentUser();

  assert.equal(request.url, "/api/me");
  assert.equal(request.options.credentials, "include");
  assert.equal(user.mustChangePassword, true);
});

test("logout calls the Phase 1 session endpoint", async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return jsonResponse({ ok: true });
  };

  await signOut();

  assert.equal(request.url, "/api/logout");
  assert.equal(request.options.method, "POST");
});

test("password changes and recovery use the Phase 1 API contracts", async () => {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return jsonResponse({ ok: true });
  };

  await changePassword({ currentPassword: "Temporary1!", newPassword: "Updated2@" });
  await requestPasswordReset("manager@example.com");
  await resetPassword({ token: "reset-token", newPassword: "Updated2@" });

  assert.deepEqual(requests.map(({ url }) => url), [
    "/api/change-password",
    "/api/forgot-password",
    "/api/reset-password",
  ]);
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    currentPassword: "Temporary1!",
    newPassword: "Updated2@",
  });
  assert.deepEqual(JSON.parse(requests[1].options.body), { identifier: "manager@example.com" });
  assert.deepEqual(JSON.parse(requests[2].options.body), { token: "reset-token", newPassword: "Updated2@" });
});
