import { apiRequest } from "./client.js";
import { isSupportedRole } from "../roles.js";

function validateUser(user) {
  if (!user || typeof user.username !== "string" || !isSupportedRole(user.role)) {
    throw new Error("The authentication API returned an unsupported user or role.");
  }
  return user;
}

export async function signIn({ username, password }) {
  try {
    const response = await apiRequest("/api/login", {
      method: "POST",
      body: { username: username.trim(), password },
    });

    if (typeof response?.user?.username !== "string") {
      throw new Error("The authentication API response must include a user with a username.");
    }

    return { status: "authenticated", user: validateUser(response.user) };
  } catch (error) {
    if (error.status === 401) return { status: "invalid" };
    if (error.status === 403) return { status: "pending" };
    throw error;
  }
}

export async function signOut() {
  await apiRequest("/api/logout", { method: "POST" });
}

export async function getCurrentUser() {
  const response = await apiRequest("/api/me");
  return response?.user ? validateUser(response.user) : null;
}

export function requestPasswordReset(identifier) {
  return apiRequest("/api/forgot-password", { method: "POST", body: { identifier } });
}
