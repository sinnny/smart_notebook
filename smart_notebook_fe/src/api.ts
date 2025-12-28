import { v7 as uuidv7 } from "uuid";

const USER_UUID_LOCALSTORAGE_KEY = "smart_notebook_uuid";
const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
export const API_BASE_URL =
  typeof envBaseUrl === "string" && envBaseUrl.trim()
    ? envBaseUrl.trim().replace(/\/$/, "")
    : "/api";

const getUserId = () => {
  const existsUserUuid = localStorage.getItem(USER_UUID_LOCALSTORAGE_KEY);

  if (!!existsUserUuid) return existsUserUuid;

  const newUuid = uuidv7();
  localStorage.setItem(USER_UUID_LOCALSTORAGE_KEY, newUuid);

  return newUuid;
};

// Helper to get headers with Auth
export const getAuthHeaders = (): HeadersInit => {
  return {
    "Content-Type": "application/json",
    "X-User-Id": getUserId(),
  };
};
