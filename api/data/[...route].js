import apiHandler from "../[...route].js";

export function normalizeDataRouteUrl(requestUrl = "/") {
  const url = new URL(requestUrl, "http://localhost");
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] === "api") segments.shift();
  if (segments[0] === "data") segments.shift();
  return `/api/data/${segments.join("/")}${url.search}`;
}

export default function handler(req, res) {
  req.url = normalizeDataRouteUrl(req.url);
  return apiHandler(req, res);
}
