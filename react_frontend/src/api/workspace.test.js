import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createSubaccount, markNotificationsRead, submitWorkspaceAction } from "./workspace.js";

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

test("subaccounts are created through the admin users endpoint", async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return jsonResponse({ id: 3, username: "stocklead", temporaryPassword: "Temp1!" }, 201);
  };

  const result = await createSubaccount({
    fullName: "Stock Lead",
    username: "stocklead",
    email: "lead@example.com",
    role: "Inventory Management",
  });

  assert.equal(request.url, "/api/users");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.credentials, "include");
  assert.deepEqual(JSON.parse(request.options.body), {
    fullName: "Stock Lead",
    username: "stocklead",
    email: "lead@example.com",
    role: "Inventory Management",
  });
  assert.equal(result.temporaryPassword, "Temp1!");
});

test("workspace actions and notification reads use their Phase 6 endpoints", async () => {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return jsonResponse({ ok: true });
  };

  await submitWorkspaceAction({ screenId: "5.1-new-reservation", values: { Quantity: "1" } });
  await markNotificationsRead();

  assert.equal(requests[0].url, "/api/data/actions");
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    screenId: "5.1-new-reservation",
    values: { Quantity: "1" },
  });
  assert.equal(requests[1].url, "/api/data/notifications-read");
  assert.equal(requests[1].options.method, "POST");
});
