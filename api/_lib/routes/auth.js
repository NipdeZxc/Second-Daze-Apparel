import { getPool } from "../../_db.js";
import { HttpError, requireFields, sendJson } from "../http.js";
import { assertStrongPassword, hashPassword, verifyPassword } from "../password.js";
import { audit, clearSession, publicUser, requireUser, setSession } from "../auth.js";

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

const SELECT_USER = `SELECT u.*, r.role_name FROM users u JOIN roles r ON r.role_id = u.role_id`;

// Testing only: with ENABLE_TEST_ACCOUNTS=true the weak admin/admin and staff/staff
// logins are created in the database on first use. Leave it unset in production.
const TEST_ACCOUNTS = {
  admin: { role: "Admin", fullName: "Test Admin" },
  staff: { role: "Sales Management", fullName: "Test Staff" },
};

async function ensureTestAccount(db, username, password) {
  const account = Object.hasOwn(TEST_ACCOUNTS, username) ? TEST_ACCOUNTS[username] : null;
  if (process.env.ENABLE_TEST_ACCOUNTS !== "true" || !account || password !== username) return;
  const [existing] = await db.query(`SELECT 1 FROM users WHERE username = ?`, [username]);
  if (existing.length) return;
  await db.query(
    `INSERT INTO users (role_id, full_name, username, password_hash, must_change_password, account_status, approved_at)
     VALUES ((SELECT role_id FROM roles WHERE role_name = ?), ?, ?, ?, 0, 'Active', ?)`,
    [account.role, account.fullName, username, await hashPassword(password), new Date()]
  );
}

export async function login(req, res) {
  requireFields(req.body, ["username", "password"]);
  const { username, password } = req.body;
  const db = getPool();
  await ensureTestAccount(db, username.trim(), password);
  const [rows] = await db.query(`${SELECT_USER} WHERE u.username = ?`, [username.trim()]);
  const user = rows[0];

  if (user?.locked_until && user.locked_until > new Date()) {
    throw new HttpError(423, "Too many failed attempts. Try again in a few minutes.");
  }

  const valid = await verifyPassword(password, user?.password_hash);
  if (!user || !valid) {
    if (user) {
      const failures = user.failed_login_count + 1;
      const lockedUntil =
        failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null;
      await db.query(`UPDATE users SET failed_login_count = ?, locked_until = ? WHERE user_id = ?`, [
        lockedUntil ? 0 : failures,
        lockedUntil,
        user.user_id,
      ]);
      await audit(user.user_id, "login_failed");
    }
    throw new HttpError(401, "Invalid username or password.");
  }

  if (user.account_status !== "Active") {
    throw new HttpError(403, "This account is not active. Please contact the Admin.");
  }

  await db.query(
    `UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = ? WHERE user_id = ?`,
    [new Date(), user.user_id]
  );
  await audit(user.user_id, "login");
  setSession(res, user);
  sendJson(res, 200, { user: publicUser(user) });
}

export async function logout(req, res) {
  clearSession(res);
  sendJson(res, 200, { ok: true });
}

export async function me(req, res) {
  const user = await requireUser(req, { allowPasswordChange: true });
  sendJson(res, 200, { user: publicUser(user) });
}

export async function changePassword(req, res) {
  const user = await requireUser(req, { allowPasswordChange: true });
  requireFields(req.body, ["currentPassword", "newPassword"]);
  const { currentPassword, newPassword } = req.body;

  if (!(await verifyPassword(currentPassword, user.password_hash))) {
    throw new HttpError(401, "Current password is incorrect.");
  }
  if (currentPassword === newPassword) {
    throw new HttpError(400, "The new password must be different from the current one.");
  }
  assertStrongPassword(newPassword);

  const passwordHash = await hashPassword(newPassword);
  await getPool().query(`UPDATE users SET password_hash = ?, must_change_password = 0 WHERE user_id = ?`, [
    passwordHash,
    user.user_id,
  ]);
  await audit(user.user_id, "change_password", "user", user.user_id);
  // The old session is no longer valid after the hash changes, so issue a fresh one.
  setSession(res, { ...user, password_hash: passwordHash });
  sendJson(res, 200, { ok: true });
}
