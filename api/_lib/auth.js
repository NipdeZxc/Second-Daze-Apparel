import crypto from "node:crypto";
import { getPool } from "../_db.js";
import { HttpError } from "./http.js";

const COOKIE = "sd_session";
const TTL_SECONDS = 8 * 60 * 60;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new HttpError(500, "Server is not configured.");
  return value;
}

const b64 = (input) => Buffer.from(input).toString("base64url");
const mac = (data) => crypto.createHmac("sha256", secret()).update(data).digest("base64url");
// Ties a session to the current password so a change or reset signs everyone out.
const fingerprint = (passwordHash) =>
  crypto.createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);

function sign(payload) {
  const body = b64(JSON.stringify(payload));
  return `${body}.${mac(body)}`;
}

function verify(token) {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature) return null;
  const expected = mac(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    return payload.exp > Date.now() / 1000 ? payload : null;
  } catch {
    return null;
  }
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split(/=(.*)/s))
      .filter(([name]) => name)
      .map(([name, value]) => [name, value])
  );
}

export function setSession(res, user) {
  const token = sign({
    uid: user.user_id,
    fp: fingerprint(user.password_hash),
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  });
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TTL_SECONDS}`
  );
}

export function clearSession(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
}

export function publicUser(row) {
  return {
    id: row.user_id,
    fullName: row.full_name,
    username: row.username,
    email: row.email,
    role: row.role_name,
    status: row.account_status,
    mustChangePassword: Boolean(row.must_change_password),
  };
}

export async function getSessionUser(req) {
  const payload = verify(parseCookies(req.headers.cookie)[COOKIE]);
  if (!payload) return null;
  const [rows] = await getPool().query(
    `SELECT u.*, r.role_name FROM users u JOIN roles r ON r.role_id = u.role_id WHERE u.user_id = ?`,
    [payload.uid]
  );
  const user = rows[0];
  if (!user || user.account_status !== "Active") return null;
  if (payload.fp !== fingerprint(user.password_hash)) return null;
  return user;
}

export async function requireUser(req, { allowPasswordChange = false } = {}) {
  const user = await getSessionUser(req);
  if (!user) throw new HttpError(401, "Please log in.");
  if (user.must_change_password && !allowPasswordChange) {
    throw new HttpError(403, "You must change your password first.");
  }
  return user;
}

export async function requireRole(req, ...roles) {
  const user = await requireUser(req);
  if (!roles.includes(user.role_name)) throw new HttpError(403, "You do not have access to this.");
  return user;
}

export async function audit(userId, action, entityType = null, entityId = null, details = null) {
  await getPool().query(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, action, entityType, entityId, details, new Date()]
  );
}
