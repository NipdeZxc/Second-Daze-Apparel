import { apiRequest } from "./client.js";

export async function getWorkspaceOverview({ signal } = {}) {
  const overview = await apiRequest("/api/workspace/overview/", { signal });
  if (
    !overview
    || !overview.queues
    || !Number.isInteger(overview.queues.accessApprovals)
    || overview.queues.accessApprovals < 0
    || !Number.isInteger(overview.queues.ordersToFulfill)
    || overview.queues.ordersToFulfill < 0
    || !Number.isInteger(overview.queues.lowStockItems)
    || overview.queues.lowStockItems < 0
    || !Array.isArray(overview.recentActivity)
    || !overview.recentActivity.every((activity) =>
      typeof activity?.id === "string"
      && typeof activity.message === "string"
      && typeof activity.createdAt === "string"
      && !Number.isNaN(Date.parse(activity.createdAt)),
    )
    || typeof overview.updatedAt !== "string"
    || Number.isNaN(Date.parse(overview.updatedAt))
  ) {
    throw new Error("The workspace overview response does not match the expected API format.");
  }
  return overview;
}

export async function submitWorkspaceAction({ source, screenId, values }) {
  return apiRequest("/api/workspace/actions/", {
    method: "POST",
    body: { source, screenId, values },
  });
}
