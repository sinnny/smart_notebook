const envBaseUrl = import.meta.env.VITE_API_BASE_URL;

export const API_BASE_URL =
  typeof envBaseUrl === "string" && envBaseUrl.trim()
    ? envBaseUrl.trim().replace(/\/$/, "")
    : "/api";

// Helper to get or create a User ID (UUID v4)
export const getUserId = (): string => {
  const STORAGE_KEY = "smart_notebook_user_id";
  let userId = localStorage.getItem(STORAGE_KEY);

  if (!userId) {
    // Simple UUID v4 generator
    userId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, userId);
  }

  return userId;
};

// Helper to get headers with Auth
export const getAuthHeaders = (): HeadersInit => {
  return {
    "Content-Type": "application/json",
    "X-User-Id": getUserId(),
  };
};

