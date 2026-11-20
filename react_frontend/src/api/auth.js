import { apiRequest } from "./client.js";

const supportedRoles = new Set(["Admin", "Sales Management", "Inventory Management"]);

export const demoLoginEnabled =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_LOGIN === "true";

export async function signIn({ username, password }) {
  if (demoLoginEnabled) {
    const demoUsername = username.trim().toLowerCase();
    if (demoUsername === "admin" && password === "admin") {
      return {
        status: "authenticated",
        user: { username: "admin", role: "Admin" },
        demo: true,
      };
    }

    if (demoUsername === "staff" && password === "staff") {
      return {
        status: "authenticated",
        user: { username: "staff", role: "Sales Management" },
        demo: true,
      };
    }

    if (demoUsername === "sales" && password === "sales") {
      return {
        status: "authenticated",
        user: { username: "sales", role: "Sales Management" },
        demo: true,
      };
    }

    if (demoUsername === "inventory" && password === "inventory") {
      return {
        status: "authenticated",
        user: { username: "inventory", role: "Inventory Management" },
        demo: true,
      };
    }

    if (demoUsername === "pending@demo.local" && password) {
      return { status: "pending" };
    }

    return { status: "invalid" };
  }

  try {
    const response = await apiRequest("/api/auth/login/", {
      method: "POST",
      body: { username, password },
    });

    if (typeof response?.user?.username !== "string") {
      throw new Error("The authentication API response must include a user with a username.");
    }
    if (!supportedRoles.has(response.user.role)) {
      throw new Error("The authentication API response must include a supported workspace role.");
    }

    return { status: "authenticated", user: response.user, demo: false };
  } catch (error) {
    if (error.status === 401) return { status: "invalid" };
    if (error.status === 403 && error.data?.code === "access_pending") {
      return { status: "pending" };
    }
    throw error;
  }
}

export async function signOut({ demo }) {
  if (!demo) {
    await apiRequest("/api/auth/logout/", { method: "POST" });
  }
}
