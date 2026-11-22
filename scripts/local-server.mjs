// Local stand-in for the Vercel deployment: serves react_frontend/dist and sends every /api/* request
// to the same router the Vercel functions use. Used for Phase 7 testing against the real database.
//
// Needs DB_*, SESSION_SECRET (and optionally CRON_SECRET) in the environment and a built frontend
// (npm run build). Run: node scripts/local-server.mjs   (PORT defaults to 3000)

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import apiHandler from "../api/[...route].js";
import healthHandler from "../api/health.js";

const PORT = Number(process.env.PORT || 3000);
const DIST = path.resolve("react_frontend/dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json" };

function vercelResponse(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(body)); return res; };
  res.send = (body) => { res.end(body); return res; };
  return res;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  try { return JSON.parse(text); } catch { return {}; }
}

function serveStatic(req, res) {
  const { pathname } = new URL(req.url, "http://localhost");
  let file = path.join(DIST, path.normalize(decodeURIComponent(pathname)));
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
  res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
}

http.createServer(async (req, res) => {
  vercelResponse(res);
  if (!req.url.startsWith("/api/")) return serveStatic(req, res);
  req.body = await readBody(req);
  return req.url.startsWith("/api/health") ? healthHandler(req, res) : apiHandler(req, res);
}).listen(PORT, () => console.log(`Local server on http://localhost:${PORT}`));
