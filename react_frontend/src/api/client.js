const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export async function apiRequest(path, { method = "GET", body, headers = {}, signal } = {}) {
  const endpoint = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(endpoint, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
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
    const error = new Error(
      data?.detail || data?.message || data?.error || `Request failed with status ${response.status}.`,
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
