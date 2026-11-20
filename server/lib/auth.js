import crypto from "node:crypto";

export const PIN_RE = /^\d{4}$/;

export const hashPin = (pin) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${hash}`;
};

export const checkPin = (pin, stored) => {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  const candidate = crypto.scryptSync(pin, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
};

export const newToken = () => crypto.randomBytes(32).toString("base64url");
export const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// A 4-digit PIN is guessable, so slow down repeated misses per player.
const attempts = new Map(); // playerId -> { fails, until }
const MAX_FAILS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

export const lockoutRemaining = (playerId) => {
  const a = attempts.get(playerId);
  if (!a || !a.until) return 0;
  const left = a.until - Date.now();
  if (left <= 0) { attempts.delete(playerId); return 0; }
  return left;
};

export const recordFail = (playerId) => {
  const a = attempts.get(playerId) || { fails: 0, until: 0 };
  a.fails += 1;
  if (a.fails >= MAX_FAILS) { a.until = Date.now() + LOCKOUT_MS; a.fails = 0; }
  attempts.set(playerId, a);
  return MAX_FAILS - a.fails;
};

export const clearFails = (playerId) => attempts.delete(playerId);
