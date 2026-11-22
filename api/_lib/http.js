export class HttpError extends Error {
  constructor(status, message, data = null) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export function sendJson(res, status, body) {
  res.status(status).setHeader("Cache-Control", "no-store");
  res.json(body);
}

export function requireFields(body, fields) {
  for (const field of fields) {
    if (typeof body?.[field] !== "string" || !body[field].trim()) {
      throw new HttpError(400, `${field} is required.`);
    }
  }
}

export function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid id.");
  return id;
}
