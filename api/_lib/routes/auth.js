import { getPool } from "../../_db.js";
import { HttpError, requireFields, sendJson } from "../http.js";
import { assertStrongPassword, hashPassword, verifyPassword } from "../password.js";
import { audit, clearSession, publicUser, requireUser, setSession } from "../auth.js";

const SELECT_USER = `SELECT u.*, u.email AS username,
                            CASE u.role WHEN 'Sales' THEN 'Sales Management'
                                        WHEN 'Inventory' THEN 'Inventory Management'
                                        ELSE u.role END AS role_name,
                            0 AS must_change_password FROM users u`;

export async function login(req, res) {
  requireFields(req.body, ["username", "password"]);
  const { username, password } = req.body;
  const db = getPool();
  const [rows] = await db.query(
    `${SELECT_USER} WHERE LOWER(u.email) = LOWER(?) OR u.staff_identifier = ? LIMIT 1`,
    [username.trim(), username.trim()]
  );
  const user = rows[0];

  const valid = await verifyPassword(password, user?.password_hash);
  if (!user || !valid) {
    throw new HttpError(401, "Invalid username or password.");
  }

  if (user.account_status !== "Active") {
    throw new HttpError(403, "This account is not active. Please contact the Admin.");
  }

  await db.query(`UPDATE users SET last_login_at = ? WHERE user_id = ?`, [new Date(), user.user_id]);
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
  await getPool().query(`UPDATE users SET password_hash = ? WHERE user_id = ?`, [
    passwordHash,
    user.user_id,
  ]);
  await audit(user.user_id, "change_password", "user", user.user_id);
  // The old session is no longer valid after the hash changes, so issue a fresh one.
  setSession(res, { ...user, password_hash: passwordHash });
  sendJson(res, 200, { ok: true });
}
