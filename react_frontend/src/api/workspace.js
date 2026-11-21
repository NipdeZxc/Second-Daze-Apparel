import { apiRequest } from "./client.js";
import { emptyRecords } from "../data/workspace.js";

export async function getWorkspaceRecords({ signal } = {}) {
  const records = await apiRequest("/api/data/records", { signal });
  if (!records || !Array.isArray(records.products) || !Array.isArray(records.orders) || !Array.isArray(records.recentActivity)) {
    throw new Error("The workspace response does not match the expected API format.");
  }
  return { ...emptyRecords(), ...records };
}

export function submitWorkspaceAction({ screenId, values }) {
  return apiRequest("/api/data/actions", { method: "POST", body: { screenId, values } });
}

export function importRecords({ kind, fileName, records }) {
  return apiRequest("/api/data/import", { method: "POST", body: { kind, fileName, records } });
}

export function importDatasetBatch(files) {
  return apiRequest("/api/data/import-batch", { method: "POST", body: { files } });
}

export function updateRecord(kind, key, values) {
  return apiRequest(`/api/data/${kind}/${encodeURIComponent(key)}`, { method: "PUT", body: values });
}

export function deleteRecord(kind, id) {
  return apiRequest(`/api/data/${kind}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function runRowAction(path, value) {
  return apiRequest(`/api/${path}`, { method: "POST", body: value === undefined ? {} : { value } });
}

export function markNotificationsRead() {
  return apiRequest("/api/data/notifications-read", { method: "POST" });
}
