import { useEffect, useState } from "react";

// ---------- Hash routes: #/<year>/<tab>[/<playerId>] ----------
const parseHash = () => {
  const [year, tab, playerId] = window.location.hash.replace(/^#\/?/, "").split("/");
  return { year: year ? Number(year) || null : null, tab: tab || "bracket", playerId: playerId || null };
};

export const useRoute = () => {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
};

export const go = ({ year, tab = "bracket", playerId = null }) => {
  const next = `#/${year ?? ""}/${tab}${playerId ? `/${playerId}` : ""}`;
  if (window.location.hash !== next) window.location.hash = next;
  window.scrollTo({ top: 0 });
};

// ---------- Time ----------
export const useNow = (ms = 30000) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
};

export const fmtDateTime = (ms) =>
  new Date(ms).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export const fmtDay = (ms) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const fmtCountdown = (ms) => {
  if (ms <= 0) return "now";
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), min = m % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${min}m`;
  return `${min}m`;
};

export const fmtAgo = (ms, now = Date.now()) => {
  if (!ms) return "never";
  const s = Math.round((now - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return fmtDay(ms);
};

// <input type="datetime-local"> wants local time without a zone
export const toLocalInput = (ms) => {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (s) => (s ? new Date(s).getTime() : null);

export const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

export const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
