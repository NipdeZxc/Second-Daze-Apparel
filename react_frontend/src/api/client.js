import { getTabSessionId } from "./tabSession.js";

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export async function apiRequest(path, { method = "GET", body, headers = {}, signal } = {}) {
  const endpoint = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const tabSessionId = await getTabSessionId();
  const response = await fetch(endpoint, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
      "X-Session-Tab": tabSessionId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const contentType = response.headers.get("content-type") || "";
  const data = response.status === 204
    ? null
    : contentType.includes("json")
      ? await response.json()
      : await response.text();

  if (!response.ok) {
    const detail = data?.error ?? data?.detail ?? data?.message ?? (typeof data === "string" ? data.slice(0, 200) : "");
    const readable = typeof detail === "string"
      ? detail
      : detail?.message || detail?.code || JSON.stringify(detail);
    const error = new Error(readable || `Request failed with status ${response.status}.`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
