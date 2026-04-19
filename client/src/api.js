// All API calls go through here
const BASE = ""; // same-origin; proxied in dev

const ADMIN_TOKEN_KEY = "admin_token";

const getAdminToken = () => localStorage.getItem(ADMIN_TOKEN_KEY);
const setAdminToken = (t) => {
  if (t) localStorage.setItem(ADMIN_TOKEN_KEY, t);
  else localStorage.removeItem(ADMIN_TOKEN_KEY);
};

const request = async (method, path, body, extraHeaders = {}) => {
  const headers = { ...extraHeaders };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getAdminToken();
  if (token) headers["x-admin-token"] = token;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let err;
    try { err = await res.json(); } catch { err = { error: res.statusText }; }
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
};

export const api = {
  createUser: (name, avatar) => request("POST", "/api/users", { name, avatar }),
  getUser: (id) => request("GET", `/api/users/${id}`),
  updateUser: (id, { name, avatar }) => request("PATCH", `/api/users/${id}`, { name, avatar }),
  updatePicks: (id, picks) => request("PUT", `/api/users/${id}/picks`, { picks }),
  lockPicks: (id) => request("POST", `/api/users/${id}/lock`),
  listEntries: () => request("GET", "/api/entries"),
  getResults: () => request("GET", "/api/results"),
  setResult: (matchupId, winner) => request("PUT", `/api/results/${matchupId}`, { winner }),
  adminStatus: () => request("GET", "/api/admin/status"),
  adminLogin: (password) => request("POST", "/api/admin/login", { password }),
  export: () => request("GET", "/api/export"),
  syncESPN: () => request("POST", "/api/sync-espn"),
  seriesStatus: () => request("GET", "/api/series-status"),
};

export { getAdminToken, setAdminToken };
