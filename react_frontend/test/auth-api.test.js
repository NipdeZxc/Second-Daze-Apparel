import assert from "node:assert/strict";
import { after, afterEach, test } from "node:test";
import { getCurrentUser, requestPasswordReset, signIn, signOut } from "../src/api/auth.js";
import { mockBrowserSession } from "../test-support/browserSession.js";

const browser = mockBrowserSession();
after(browser.restore);

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

test("login uses the API session and trims the username", async () => {
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
  assert.match(request.options.headers["X-Session-Tab"], /^[a-f0-9]{32}$/);
  assert.deepEqual(JSON.parse(request.options.body), { username: "manager", password: "example" });
  assert.equal(result.status, "authenticated");
  assert.equal(result.user.role, "Sales Management");
});

test("login distinguishes invalid credentials and approval-required accounts", async () => {
  globalThis.fetch = async () => jsonResponse({ error: "Not authorized." }, 401);
  assert.deepEqual(await signIn({ username: "manager", password: "wrong" }), { status: "invalid" });

  globalThis.fetch = async () => jsonResponse({ error: "Account is pending approval." }, 403);
  assert.deepEqual(await signIn({ username: "manager", password: "example" }), { status: "pending" });
});

test("login rejects users with unsupported roles", async () => {
  globalThis.fetch = async () => jsonResponse({ user: { username: "viewer", role: "Viewer" } });
  await assert.rejects(signIn({ username: "viewer", password: "example" }), /unsupported user or role/);
});

test("session restoration reads the server session endpoint", async () => {
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

test("logout and password recovery use the API endpoints", async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return jsonResponse({ ok: true });
  };

  await signOut();
  assert.equal(request.url, "/api/logout");
  assert.equal(request.options.method, "POST");

  await requestPasswordReset("manager@example.com");
  assert.equal(request.url, "/api/forgot-password");
  assert.deepEqual(JSON.parse(request.options.body), { identifier: "manager@example.com" });
});

test("login, session restoration and logout consistently target the same tab", async () => {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return jsonResponse({ user: { username: "manager", role: "Sales Management" } });
  };
  await signIn({ username: "manager", password: "example" });
  await getCurrentUser();
  await signOut();
  const selectors = requests.map(({ options }) => options.headers["X-Session-Tab"]);
  assert.ok(selectors[0]);
  assert.deepEqual(selectors, [selectors[0], selectors[0], selectors[0]]);
});
