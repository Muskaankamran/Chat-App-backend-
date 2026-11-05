import { API_URL } from "./apollo.js";

async function postAuth(path, data) {
  const response = await fetch(`${API_URL}/api/auth/${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || "Authentication request failed.");
  }
  return result;
}

export function login(credentials) {
  return postAuth("login", credentials);
}

export function register(details) {
  return postAuth("register", details);
}

export async function logout() {
  const response = await fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || "Could not log out.");
  }
}
