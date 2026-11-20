import { apiRequest } from "./client.js";

const supportedRoles = new Set(["Admin", "Sales Management", "Inventory Management"]);

function validateUser(user) {
  if (
    !user
    || typeof user.username !== "string"
    || !supportedRoles.has(user.role)
    || typeof user.mustChangePassword !== "boolean"
  ) {
    throw new Error("The authentication API returned an invalid user.");
  }
  return user;
}

export async function signIn({ username, password }) {
  try {
    const response = await apiRequest("/api/login", {
      method: "POST",
      body: { username, password },
    });
    return { status: "authenticated", user: validateUser(response?.user) };
  } catch (error) {
    if (error.status === 401) return { status: "invalid" };
    if (error.status === 403) return { status: "inactive", message: error.message };
    throw error;
  }
}

export async function getCurrentUser({ signal } = {}) {
  const response = await apiRequest("/api/me", { signal });
  return validateUser(response?.user);
}

export async function signOut() {
  await apiRequest("/api/logout", { method: "POST" });
}

export async function changePassword({ currentPassword, newPassword }) {
  return apiRequest("/api/change-password", {
    method: "POST",
    body: { currentPassword, newPassword },
  });
}

export async function requestPasswordReset(identifier) {
  return apiRequest("/api/forgot-password", {
    method: "POST",
    body: { identifier },
  });
}

export async function resetPassword({ token, newPassword }) {
  return apiRequest("/api/reset-password", {
    method: "POST",
    body: { token, newPassword },
  });
}
