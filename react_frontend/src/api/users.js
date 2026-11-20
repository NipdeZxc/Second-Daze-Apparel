import { apiRequest } from "./client.js";

export async function listUsers({ signal } = {}) {
  const response = await apiRequest("/api/users", { signal });
  if (!Array.isArray(response?.users)) {
    throw new Error("The users API response must contain a users list.");
  }
  return response.users;
}

export async function createUser(values) {
  return apiRequest("/api/users", { method: "POST", body: values });
}

export async function approveUser(id) {
  return apiRequest(`/api/users/${encodeURIComponent(id)}/approve`, { method: "POST" });
}

export async function disableUser(id) {
  return apiRequest(`/api/users/${encodeURIComponent(id)}/disable`, { method: "POST" });
}

export async function enableUser(id) {
  return apiRequest(`/api/users/${encodeURIComponent(id)}/enable`, { method: "POST" });
}

export async function resetUserPassword(id) {
  return apiRequest(`/api/users/${encodeURIComponent(id)}/reset-password`, { method: "POST" });
}
