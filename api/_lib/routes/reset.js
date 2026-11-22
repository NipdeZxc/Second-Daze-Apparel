import crypto from "node:crypto";
import { getPool } from "../../_db.js";
import { HttpError, requireFields, sendJson } from "../http.js";
import { assertStrongPassword, hashPassword } from "../password.js";
import { audit } from "../auth.js";
import { appUrl, sendPasswordResetEmail } from "../mailer.js";

const TOKEN_MINUTES = 30;
const COOLDOWN_SECONDS = 60;
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

export async function forgotPassword(req, res) {
  requireFields(req.body, ["identifier"]);
  const identifier = req.body.identifier.trim();
  const db = getPool();

  const [rows] = await db.query(
    `SELECT user_id, full_name, email FROM users
      WHERE (username = ? OR email = ?) AND account_status = 'Active' AND email IS NOT NULL LIMIT 1`,
    [identifier, identifier]
  );
  const user = rows[0];

  if (user) {
    const [recent] = await db.query(
      `SELECT 1 FROM password_resets WHERE user_id = ? AND created_at > ? LIMIT 1`,
      [user.user_id, new Date(Date.now() - COOLDOWN_SECONDS * 1000)]
    );
    if (!recent.length) {
      const token = crypto.randomBytes(32).toString("hex");
      await db.query(`UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL`, [
        new Date(),
        user.user_id,
      ]);
      await db.query(
        `INSERT INTO password_resets (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)`,
        [user.user_id, sha256(token), new Date(Date.now() + TOKEN_MINUTES * 60 * 1000), new Date()]
      );
      try {
        await sendPasswordResetEmail(user.email, user.full_name, `${appUrl()}/?reset=${token}`);
        await audit(user.user_id, "forgot_password");
      } catch (error) {
        console.error("Reset email failed:", error.code || error.message);
      }
    }
  }

  // Same answer whether or not the account exists, so usernames cannot be guessed.
  sendJson(res, 200, { message: "If the account has an email on file, a reset link has been sent." });
}

export async function resetPassword(req, res) {
  requireFields(req.body, ["token", "newPassword"]);
  assertStrongPassword(req.body.newPassword);
  const db = getPool();

  const [rows] = await db.query(
    `SELECT reset_id, user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`,
    [sha256(req.body.token), new Date()]
  );
  if (!rows[0]) throw new HttpError(400, "This reset link is invalid or has expired.");

  await db.query(
    `UPDATE users SET password_hash = ?, must_change_password = 0, failed_login_count = 0, locked_until = NULL
      WHERE user_id = ?`,
    [await hashPassword(req.body.newPassword), rows[0].user_id]
  );
  await db.query(`UPDATE password_resets SET used_at = ? WHERE reset_id = ?`, [new Date(), rows[0].reset_id]);
  await audit(rows[0].user_id, "reset_password_by_email", "user", rows[0].user_id);
  sendJson(res, 200, { ok: true });
}
