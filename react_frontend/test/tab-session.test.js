import assert from "node:assert/strict";
import test from "node:test";
import { mockBrowserSession } from "../test-support/browserSession.js";

test("tab selectors survive reloads but copied or fresh tabs get independent selectors", async (t) => {
  const original = mockBrowserSession();
  t.after(original.restore);
  const first = await import("../src/api/tabSession.js?first");
  const firstId = await first.getTabSessionId();
  assert.equal(await first.getTabSessionId(), firstId);

  const duplicate = mockBrowserSession(new Map(original.storage), original.locks);
  const second = await import("../src/api/tabSession.js?duplicate");
  const duplicateId = await second.getTabSessionId();
  assert.notEqual(duplicateId, firstId);
  assert.equal([...original.storage.values()][0], firstId);
  duplicate.restore();

  const fresh = mockBrowserSession(new Map(), original.locks);
  const third = await import("../src/api/tabSession.js?fresh");
  assert.notEqual(await third.getTabSessionId(), firstId);
  fresh.restore();

  original.locks.delete(`second-daze-session-${firstId}`);
  const reloaded = await import("../src/api/tabSession.js?reload");
  assert.equal(await reloaded.getTabSessionId(), firstId);
});

test("unavailable tab isolation and corrupted tab storage fail explicitly", async (t) => {
  const browser = mockBrowserSession(new Map([["sd_session_tab", "invalid"]]));
  t.after(browser.restore);
  const corrupted = await import("../src/api/tabSession.js?corrupted");
  await assert.rejects(corrupted.getTabSessionId(), /Invalid tab session data/);
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
  const unsupported = await import("../src/api/tabSession.js?unsupported");
  await assert.rejects(unsupported.getTabSessionId(), /cannot isolate tab logins/);
});
