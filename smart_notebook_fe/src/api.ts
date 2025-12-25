const envBaseUrl = import.meta.env.VITE_API_BASE_URL;

export const API_BASE_URL =
  typeof envBaseUrl === "string" && envBaseUrl.trim()
    ? envBaseUrl.trim().replace(/\/$/, "")
    : "/api";

