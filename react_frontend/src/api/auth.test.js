import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  changePassword,
  getCurrentUser,
  requestPasswordReset,
  resetPassword,
  signIn,
  signOut,
} from "./auth.js";

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

test("login posts to the session endpoint and returns the backend role", async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return jsonResponse({
      user: { username: "manager", role: "Sales Management", mustChangePassword: false },
    });
  };

  const result = await signIn({ username: " manager ", password: "example" });

  assert.equal(request.url, "/api/login");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.credentials, "include");
  assert.deepEqual(JSON.parse(request.options.body), { username: "manager", password: "example" });
  assert.equal(result.status, "authenticated");
  assert.equal(result.user.role, "Sales Management");
});

test("login distinguishes pending, disabled, and invalid accounts", async () => {
  globalThis.fetch = async () => jsonResponse({ error: "Pending", data: { status: "pending" } }, 403);
  assert.equal((await signIn({ username: "new", password: "pw" })).status, "pending");

  globalThis.fetch = async () => jsonResponse({ error: "Disabled", data: { status: "disabled" } }, 403);
  assert.equal((await signIn({ username: "old", password: "pw" })).status, "disabled");

  globalThis.fetch = async () => jsonResponse({ error: "invalid" }, 401);
  assert.equal((await signIn({ username: "new", password: "pw" })).status, "invalid");
});

test("session restoration and logout use the Phase 1 endpoints", async () => {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return url === "/api/me"
      ? jsonResponse({ user: { username: "admin", role: "Admin", mustChangePassword: true } })
      : jsonResponse({ ok: true });
  };

  const controller = new AbortController();
  const user = await getCurrentUser({ signal: controller.signal });
  await signOut();

  assert.equal(requests[0].url, "/api/me");
  assert.equal(requests[0].options.credentials, "include");
  assert.equal(requests[0].options.signal, controller.signal);
  assert.equal(user.mustChangePassword, true);
  assert.equal(requests[1].url, "/api/logout");
  assert.equal(requests[1].options.method, "POST");
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
