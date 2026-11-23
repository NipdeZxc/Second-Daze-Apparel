import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, test } from "node:test";
import mysql from "mysql2/promise";
import { getSessionTabId, getSessionUser, setSession } from "./auth.js";
import { changePassword, login, logout } from "./routes/auth.js";
import { hashPassword } from "./password.js";

const previousSecret = process.env.SESSION_SECRET;
before(() => { process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex"); });
after(() => {
  if (previousSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = previousSecret;
});

test("three tab logins remain independent through logout, re-login and password changes", async (t) => {
  const password = "TabExample#2026";
  const passwordHash = await hashPassword(password);
  const users = new Map(["Admin", "Sales Management", "Inventory Management"].map((role_name, index) => [
    index + 1, {
      user_id: index + 1, username: `tab-${index + 1}`, full_name: `Tab ${index + 1}`, role_name,
      account_status: "Active", password_hash: passwordHash, must_change_password: 0,
      failed_login_count: 0, locked_until: null,
    },
  ]));
  t.mock.method(mysql, "createPool", () => ({
    async query(sql, params) {
      if (sql.includes("WHERE u.username = ?")) return [[...users.values()].filter((user) => user.username === params[0])];
      if (sql.includes("WHERE u.user_id = ?")) return [[users.get(params[0])].filter(Boolean)];
      if (sql.includes("UPDATE users SET password_hash")) {
        users.set(params[1], { ...users.get(params[1]), password_hash: params[0], must_change_password: 0 });
      }
      return [{ affectedRows: 1 }];
    },
  }));
  const jar = new Map();
  const res = {
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) {
      if (name === "Set-Cookie") {
        assert.match(value, /HttpOnly; Secure; SameSite=Strict/);
        const [cookie] = value.split(";");
        const split = cookie.indexOf("=");
        if (value.includes("Max-Age=0")) jar.delete(cookie.slice(0, split));
        else jar.set(cookie.slice(0, split), cookie.slice(split + 1));
      }
      return this;
    },
    json(body) { this.body = body; },
  };
  const ids = ["a".repeat(32), "b".repeat(32), "c".repeat(32)];
  const request = (index, body) => ({
    headers: { "x-session-tab": ids[index], cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; ") },
    body,
  });
  for (let index = 0; index < 3; index++) {
    await login(request(index, { username: `tab-${index + 1}`, password }), res);
    assert.equal(res.statusCode, 200);
  }
  assert.equal(jar.size, 3);
  for (let index = 0; index < 3; index++) assert.equal((await getSessionUser(request(index))).user_id, index + 1);

  setSession(res, users.get(1));
  await logout(request(1), res);
  assert.equal(await getSessionUser(request(1)), null, "A signed-out tab must not fall back to the legacy cookie");
  assert.equal((await getSessionUser(request(0))).user_id, 1);
  assert.equal((await getSessionUser(request(2))).user_id, 3);
  assert.equal((await getSessionUser({ headers: { cookie: request(0).headers.cookie } })).user_id, 1);

  await login(request(1, { username: "tab-1", password }), res);
  assert.equal((await getSessionUser(request(1))).user_id, 1);
  assert.equal((await getSessionUser(request(2))).user_id, 3);
  await changePassword(request(0, { currentPassword: password, newPassword: "TabUpdated#2026" }), res);
  assert.equal((await getSessionUser(request(0))).user_id, 1, "Password changes must refresh the initiating tab's cookie");
  assert.equal(await getSessionUser(request(1)), null, "Password changes must invalidate other sessions for that account");
  assert.equal((await getSessionUser(request(2))).user_id, 3);
  users.set(3, { ...users.get(3), account_status: "Disabled" });
  assert.equal(await getSessionUser(request(2)), null);
});

test("tab tokens cannot be transplanted to another tab or accepted after expiry", async (t) => {
  const id = "a".repeat(32);
  let cookie;
  setSession({ setHeader(name, value) { cookie = value.split(";")[0]; } }, {
    user_id: 1, password_hash: "synthetic-password-hash",
  }, { headers: { "x-session-tab": id } });
  const otherId = "b".repeat(32);
  assert.equal(await getSessionUser({ headers: { "x-session-tab": otherId, cookie: cookie.replace(id, otherId) } }), null);
  const now = Date.now();
  t.mock.method(Date, "now", () => now + 9 * 60 * 60 * 1000);
  assert.equal(await getSessionUser({ headers: { "x-session-tab": id, cookie } }), null);
});

test("invalid tab selectors are rejected instead of selecting a shared cookie", async () => {
  assert.equal(getSessionTabId({ headers: {} }), null);
  for (const value of ["", "bad; cookie=value", ["a".repeat(32)]]) {
    assert.throws(() => getSessionTabId({ headers: { "x-session-tab": value } }), /Invalid tab session identifier/);
    await assert.rejects(login({ headers: { "x-session-tab": value }, body: {} }, {}), /Invalid tab session identifier/);
  }
});
