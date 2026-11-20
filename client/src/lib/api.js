// Session token for this device. Profiles live on the server, so signing in
// on another device or URL is just "pick your name, enter your PIN".
const TOKEN_KEY = "pp.session";

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export const getToken = () => store.get(TOKEN_KEY);
export const setToken = (t) => store.set(TOKEN_KEY, t);
export const prefs = store;

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

const request = async (method, path, body) => {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError("Can't reach the server", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  return data;
};

export const api = {
  players: () => request("GET", "/api/players"),
  createPlayer: (body) => request("POST", "/api/players", body),
  signIn: (playerId, pin) => request("POST", "/api/session", { playerId, pin }),
  signOut: () => request("DELETE", "/api/session"),
  me: () => request("GET", "/api/me"),
  updateMe: (body) => request("PATCH", "/api/me", body),
  changePin: (currentPin, newPin) => request("POST", "/api/me/pin", { currentPin, newPin }),

  seasons: () => request("GET", "/api/seasons"),
  season: (year) => request("GET", `/api/seasons/${year}`),
  savePicks: (year, picks) => request("PUT", `/api/seasons/${year}/picks`, { picks }),

  admin: {
    info: () => request("GET", "/api/admin/info"),
    createSeason: (body) => request("POST", "/api/admin/seasons", body),
    updateSeason: (year, body) => request("PATCH", `/api/admin/seasons/${year}`, body),
    setResult: (year, matchupId, winner) => request("PUT", `/api/admin/seasons/${year}/results/${matchupId}`, { winner }),
    sync: (year) => request("POST", `/api/admin/seasons/${year}/sync`),
    players: () => request("GET", "/api/admin/players"),
    updatePlayer: (id, body) => request("PATCH", `/api/admin/players/${id}`, body),
    resetPin: (id) => request("POST", `/api/admin/players/${id}/reset-pin`),
    removePlayer: (id) => request("DELETE", `/api/admin/players/${id}`),
  },
};

export const downloadExport = async () => {
  const res = await fetch("/api/export", { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new ApiError("Export failed", res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: `playoff-picks-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
