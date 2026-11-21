import { HttpError, sendJson } from "./_lib/http.js";
import { changePassword, login, logout, me } from "./_lib/routes/auth.js";
import {
  approveUser,
  createUser,
  disableUser,
  enableUser,
  listUsers,
  resetUserPassword,
} from "./_lib/routes/users.js";
import { exportTable } from "./_lib/routes/export.js";
import { forgotPassword, resetPassword } from "./_lib/routes/reset.js";
import { importDatasetBatch } from "./_lib/routes/dataset-import.js";
import {
  getRecords,
  deleteRecord,
  importRecords,
  markNotificationsRead,
  runFormAction,
  runRowAction,
  updateRecord,
} from "./_lib/routes/data.js";

// One catch-all function keeps the project under Vercel's function limit.
const routes = [
  ["POST", "login", login],
  ["POST", "logout", logout],
  ["GET", "me", me],
  ["POST", "change-password", changePassword],
  ["POST", "forgot-password", forgotPassword],
  ["POST", "reset-password", resetPassword],
  ["GET", "users", listUsers],
  ["POST", "users", createUser],
  ["POST", "users/:id/approve", approveUser],
  ["POST", "users/:id/disable", disableUser],
  ["POST", "users/:id/enable", enableUser],
  ["POST", "users/:id/reset-password", resetUserPassword],
  ["GET", "export/:name", exportTable],
  ["GET", "data/records", getRecords],
  ["POST", "data/import", importRecords],
  ["POST", "data/import-batch", importDatasetBatch],
  ["DELETE", "data/:kind/:id", deleteRecord],
  ["POST", "data/actions", runFormAction],
  ["POST", "data/notifications-read", markNotificationsRead],
  ["PUT", "data/:kind/:id", updateRecord],
  ["POST", "data/:kind/:id/:action", runRowAction],
];

function match(method, segments) {
  for (const [routeMethod, pattern, handler] of routes) {
    const parts = pattern.split("/");
    if (routeMethod !== method || parts.length !== segments.length) continue;
    const params = {};
    const ok = parts.every((part, i) => {
      if (part.startsWith(":")) {
        params[part.slice(1)] = segments[i];
        return true;
      }
      return part === segments[i];
    });
    if (ok) return { handler, params };
  }
  return null;
}

export default async function handler(req, res) {
  try {
    const { pathname } = new URL(req.url, "http://localhost");
    const segments = pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
    const found = match(req.method, segments);
    if (!found) throw new HttpError(404, "Not found.");
    req.body = req.body && typeof req.body === "object" ? req.body : {};
    await found.handler(req, res, found.params);
  } catch (error) {
    if (error instanceof HttpError) return sendJson(res, error.status, { error: error.message });
    console.error(error);
    sendJson(res, 500, { error: "Something went wrong." });
  }
}
