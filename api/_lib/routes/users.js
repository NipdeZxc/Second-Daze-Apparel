import { getPool } from "../../_db.js";
import { HttpError, parseId, requireFields, sendJson } from "../http.js";
import { generateTempPassword, hashPassword } from "../password.js";
import { audit, requireRole } from "../auth.js";

const SUB_ROLES = ["Sales Management", "Inventory Management"];

async function findTarget(id) {
  const [rows] = await getPool().query(
    `SELECT u.user_id, u.username, u.account_status, r.role_name
       FROM users u JOIN roles r ON r.role_id = u.role_id WHERE u.user_id = ?`,
    [id]
  );
  if (!rows[0]) throw new HttpError(404, "User not found.");
  return rows[0];
}

function assertManageable(admin, target) {
  if (target.user_id === admin.user_id || target.role_name === "Admin") {
    throw new HttpError(400, "Admin accounts cannot be changed here.");
  }
}

export async function listUsers(req, res) {
  await requireRole(req, "Admin");
  const [rows] = await getPool().query(
    `SELECT u.user_id AS id, u.full_name AS fullName, u.username, u.email, r.role_name AS role,
            u.account_status AS status, u.last_login_at AS lastLoginAt, u.created_at AS createdAt
       FROM users u JOIN roles r ON r.role_id = u.role_id ORDER BY u.created_at DESC`
  );
  sendJson(res, 200, { users: rows });
}

export async function createUser(req, res) {
  const admin = await requireRole(req, "Admin");
  requireFields(req.body, ["fullName", "username", "role"]);
  const fullName = req.body.fullName.trim();
  const username = req.body.username.trim();
  const email = typeof req.body.email === "string" && req.body.email.trim() ? req.body.email.trim() : null;

  if (fullName.length > 100) throw new HttpError(400, "Full name is too long.");
  if (!/^[A-Za-z0-9._-]{3,50}$/.test(username)) {
    throw new HttpError(400, "Username must be 3-50 characters: letters, numbers, dot, dash or underscore.");
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Invalid email.");
  if (!SUB_ROLES.includes(req.body.role)) throw new HttpError(400, "Role must be a sub account role.");

  const db = getPool();
  const [existing] = await db.query(`SELECT 1 FROM users WHERE username = ?`, [username]);
  if (existing.length) throw new HttpError(409, "That username is already taken.");

  const temporaryPassword = generateTempPassword();
  const [result] = await db.query(
    `INSERT INTO users (role_id, full_name, username, email, password_hash, must_change_password,
                        account_status, created_by, created_at, updated_at)
     VALUES ((SELECT role_id FROM roles WHERE role_name = ?), ?, ?, ?, ?, 1, 'Pending Approval', ?, ?, ?)`,
    [req.body.role, fullName, username, email, await hashPassword(temporaryPassword), admin.user_id, new Date(), new Date()]
  );
  await audit(admin.user_id, "create_user", "user", result.insertId, `${username} (${req.body.role})`);
  // Shown once so the Admin can hand it over; it is never stored in readable form.
  sendJson(res, 201, { id: result.insertId, username, temporaryPassword });
}

export async function approveUser(req, res, params) {
  const admin = await requireRole(req, "Admin");
  const target = await findTarget(parseId(params.id));
  assertManageable(admin, target);
  if (target.account_status !== "Pending Approval") throw new HttpError(409, "Account is not pending approval.");
  await getPool().query(
    `UPDATE users SET account_status = 'Active', approved_by = ?, approved_at = ? WHERE user_id = ?`,
    [admin.user_id, new Date(), target.user_id]
  );
  await audit(admin.user_id, "approve_user", "user", target.user_id);
  sendJson(res, 200, { ok: true });
}

export async function disableUser(req, res, params) {
  const admin = await requireRole(req, "Admin");
  const target = await findTarget(parseId(params.id));
  assertManageable(admin, target);
  await getPool().query(`UPDATE users SET account_status = 'Disabled' WHERE user_id = ?`, [target.user_id]);
  await audit(admin.user_id, "disable_user", "user", target.user_id);
  sendJson(res, 200, { ok: true });
}

export async function enableUser(req, res, params) {
  const admin = await requireRole(req, "Admin");
  const target = await findTarget(parseId(params.id));
  assertManageable(admin, target);
  if (target.account_status !== "Disabled") throw new HttpError(409, "Account is not disabled.");
  await getPool().query(`UPDATE users SET account_status = 'Active' WHERE user_id = ?`, [target.user_id]);
  await audit(admin.user_id, "enable_user", "user", target.user_id);
  sendJson(res, 200, { ok: true });
}

export async function resetUserPassword(req, res, params) {
  const admin = await requireRole(req, "Admin");
  const target = await findTarget(parseId(params.id));
  assertManageable(admin, target);
  const temporaryPassword = generateTempPassword();
  await getPool().query(
    `UPDATE users SET password_hash = ?, must_change_password = 1, failed_login_count = 0, locked_until = NULL
      WHERE user_id = ?`,
    [await hashPassword(temporaryPassword), target.user_id]
  );
  await audit(admin.user_id, "reset_password", "user", target.user_id);
  sendJson(res, 200, { username: target.username, temporaryPassword });
}
