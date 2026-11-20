import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

import { openDb, tx, newId, DB_PATH } from "./lib/db.js";
import { PIN_RE, hashPin, checkPin, newToken, hashToken, lockoutRemaining, recordFail, clearFails } from "./lib/auth.js";
import { fetchSeason, inPlayoffWindow } from "./lib/espn.js";
import {
  TEAMS, MATCHUP_BY_ID, bracketFromSeeds, validateSeeds, teamsFor, sanitize, seasonStatus,
} from "../shared/nba.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const PORT = Number(process.env.PORT || 5174);
// Loopback only: `tailscale serve` is the way in from other devices.
const HOST = process.env.HOST || "127.0.0.1";

const db = openDb();

// ============================================================
// Helpers
// ============================================================
const now = () => Date.now();
const parse = (s, fallback) => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };

const playerJson = (p) => p && ({ id: p.id, name: p.name, favTeam: p.fav_team, isAdmin: !!p.is_admin, hasPin: !!p.pin_hash });

const cleanName = (name) => (typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "");
const nameError = (name, exceptId = null) => {
  if (!name || name.length > 24) return "Name must be 1–24 characters";
  const clash = db.prepare("SELECT id FROM players WHERE name = ? COLLATE NOCASE").get(name);
  if (clash && clash.id !== exceptId) return "Someone already has that name";
  return null;
};
const favTeamValue = (t) => (t && TEAMS[t] ? t : null);

const getSeason = (year) => {
  const row = db.prepare("SELECT * FROM seasons WHERE year = ?").get(year);
  if (!row) return null;
  return { year: row.year, bracket: parse(row.bracket, null), lockAt: row.lock_at, series: parse(row.series, {}), syncedAt: row.synced_at };
};

const getResults = (year) => {
  const rows = db.prepare("SELECT matchup_id, winner, source FROM results WHERE season = ?").all(year);
  const winners = {}, sources = {};
  for (const r of rows) { winners[r.matchup_id] = r.winner; sources[r.matchup_id] = r.source; }
  return { winners, sources };
};

// Remove results that no longer fit the bracket (e.g. an earlier result was cleared).
const resanitizeResults = (year, bracket) => {
  const { winners } = getResults(year);
  const keep = sanitize(bracket, winners);
  for (const id of Object.keys(winners)) {
    if (!keep[id]) db.prepare("DELETE FROM results WHERE season = ? AND matchup_id = ?").run(year, id);
  }
};

const issueSession = (playerId) => {
  const token = newToken();
  db.prepare("INSERT INTO sessions (token_hash, player_id, created_at, last_seen_at) VALUES (?, ?, ?, ?)")
    .run(hashToken(token), playerId, now(), now());
  return token;
};

// ============================================================
// App + auth middleware
// ============================================================
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));

app.use((req, _res, next) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token) {
    const th = hashToken(token);
    const row = db.prepare(
      "SELECT p.* FROM sessions s JOIN players p ON p.id = s.player_id WHERE s.token_hash = ?"
    ).get(th);
    if (row) {
      req.player = row;
      req.tokenHash = th;
      db.prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?").run(now(), th);
    }
  }
  next();
});

const requirePlayer = (req, res, next) => (req.player ? next() : res.status(401).json({ error: "Please sign in" }));
const requireAdmin = (req, res, next) => (req.player?.is_admin ? next() : res.status(403).json({ error: "Admins only" }));

const route = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error(`${req.method} ${req.path}:`, e);
    res.status(500).json({ error: "Something went wrong on the server" });
  }
};

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ============================================================
// Players & sessions
// ============================================================
app.get("/api/players", route((_req, res) => {
  const rows = db.prepare("SELECT * FROM players ORDER BY name COLLATE NOCASE").all();
  res.json(rows.map(playerJson));
}));

app.post("/api/players", route((req, res) => {
  const name = cleanName(req.body?.name);
  const pin = String(req.body?.pin ?? "");
  const err = nameError(name);
  if (err) return res.status(400).json({ error: err });
  if (!PIN_RE.test(pin)) return res.status(400).json({ error: "PIN must be 4 digits" });

  const id = newId();
  const t = now();
  const noAdmins = !db.prepare("SELECT 1 FROM players WHERE is_admin = 1").get();
  db.prepare("INSERT INTO players (id, name, fav_team, pin_hash, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, name, favTeamValue(req.body?.favTeam), hashPin(pin), noAdmins ? 1 : 0, t, t);
  const player = db.prepare("SELECT * FROM players WHERE id = ?").get(id);
  res.json({ token: issueSession(id), player: playerJson(player) });
}));

app.post("/api/session", route((req, res) => {
  const { playerId } = req.body || {};
  const pin = String(req.body?.pin ?? "");
  const player = db.prepare("SELECT * FROM players WHERE id = ?").get(playerId);
  if (!player) return res.status(404).json({ error: "Player not found" });
  if (!PIN_RE.test(pin)) return res.status(400).json({ error: "PIN must be 4 digits" });

  const wait = lockoutRemaining(player.id);
  if (wait) return res.status(429).json({ error: `Too many tries. Try again in ${Math.ceil(wait / 60000)} min.` });

  // Players carried over from the old app have no PIN yet: the first one they enter becomes it.
  if (!player.pin_hash) {
    db.prepare("UPDATE players SET pin_hash = ?, updated_at = ? WHERE id = ?").run(hashPin(pin), now(), player.id);
    const updated = db.prepare("SELECT * FROM players WHERE id = ?").get(player.id);
    return res.json({ token: issueSession(player.id), player: playerJson(updated), pinCreated: true });
  }

  if (!checkPin(pin, player.pin_hash)) {
    const left = recordFail(player.id);
    const wait2 = lockoutRemaining(player.id);
    return res.status(401).json({
      error: wait2 ? "Too many tries. Try again in 5 min." : `Wrong PIN${left <= 2 ? ` (${left} ${left === 1 ? "try" : "tries"} left)` : ""}`,
    });
  }
  clearFails(player.id);
  res.json({ token: issueSession(player.id), player: playerJson(player) });
}));

app.delete("/api/session", route((req, res) => {
  if (req.tokenHash) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(req.tokenHash);
  res.json({ ok: true });
}));

app.get("/api/me", requirePlayer, (req, res) => res.json(playerJson(req.player)));

app.patch("/api/me", requirePlayer, route((req, res) => {
  const me = req.player;
  const name = req.body?.name !== undefined ? cleanName(req.body.name) : me.name;
  const err = nameError(name, me.id);
  if (err) return res.status(400).json({ error: err });
  const fav = req.body?.favTeam !== undefined ? favTeamValue(req.body.favTeam) : me.fav_team;
  db.prepare("UPDATE players SET name = ?, fav_team = ?, updated_at = ? WHERE id = ?").run(name, fav, now(), me.id);
  res.json(playerJson(db.prepare("SELECT * FROM players WHERE id = ?").get(me.id)));
}));

app.post("/api/me/pin", requirePlayer, route((req, res) => {
  const current = String(req.body?.currentPin ?? "");
  const next = String(req.body?.newPin ?? "");
  if (!checkPin(current, req.player.pin_hash)) return res.status(401).json({ error: "Current PIN is wrong" });
  if (!PIN_RE.test(next)) return res.status(400).json({ error: "New PIN must be 4 digits" });
  db.prepare("UPDATE players SET pin_hash = ?, updated_at = ? WHERE id = ?").run(hashPin(next), now(), req.player.id);
  // Sign out other devices.
  db.prepare("DELETE FROM sessions WHERE player_id = ? AND token_hash != ?").run(req.player.id, req.tokenHash);
  res.json({ ok: true });
}));

// ============================================================
// Seasons
// ============================================================
app.get("/api/seasons", route((_req, res) => {
  const rows = db.prepare("SELECT year FROM seasons ORDER BY year DESC").all();
  res.json(rows.map(({ year }) => {
    const s = getSeason(year);
    const { winners } = getResults(year);
    return { year, status: seasonStatus(s, winners), lockAt: s.lockAt, champion: winners.FINALS || null };
  }));
}));

app.get("/api/seasons/:year", route((req, res) => {
  const year = Number(req.params.year);
  const season = getSeason(year);
  if (!season) return res.status(404).json({ error: "No such season" });
  const { winners, sources } = getResults(year);
  const status = seasonStatus(season, winners);
  const revealAll = status !== "open";
  const me = req.player?.id;

  const rows = db.prepare(`
    SELECT e.player_id, e.picks, e.updated_at, p.name, p.fav_team
    FROM entries e JOIN players p ON p.id = e.player_id
    WHERE e.season = ? ORDER BY p.name COLLATE NOCASE
  `).all(year);
  const entries = rows.map((r) => {
    const picks = parse(r.picks, {});
    const visible = revealAll || r.player_id === me;
    return {
      playerId: r.player_id, name: r.name, favTeam: r.fav_team,
      pickCount: Object.keys(picks).length, updatedAt: r.updated_at,
      picks: visible ? picks : null,
    };
  });

  res.json({
    year, status, bracket: season.bracket, lockAt: season.lockAt,
    results: winners, resultSources: sources,
    series: season.series, syncedAt: season.syncedAt,
    entries,
  });
}));

app.put("/api/seasons/:year/picks", requirePlayer, route((req, res) => {
  const year = Number(req.params.year);
  const season = getSeason(year);
  if (!season) return res.status(404).json({ error: "No such season" });
  const { winners } = getResults(year);
  if (seasonStatus(season, winners) !== "open") return res.status(403).json({ error: "Picks are locked for this season" });

  const raw = req.body?.picks;
  if (!raw || typeof raw !== "object") return res.status(400).json({ error: "Invalid picks" });
  for (const id of Object.keys(raw)) if (!MATCHUP_BY_ID[id]) return res.status(400).json({ error: `Unknown matchup ${id}` });
  const picks = sanitize(season.bracket, raw);

  const t = now();
  db.prepare(`
    INSERT INTO entries (season, player_id, picks, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(season, player_id) DO UPDATE SET picks = excluded.picks, updated_at = excluded.updated_at
  `).run(year, req.player.id, JSON.stringify(picks), t, t);
  res.json({ picks, updatedAt: t });
}));

app.get("/api/export", requirePlayer, route((_req, res) => {
  const seasons = db.prepare("SELECT year FROM seasons ORDER BY year").all().map(({ year }) => {
    const s = getSeason(year);
    const { winners } = getResults(year);
    const entries = db.prepare(
      "SELECT p.name, e.picks, e.updated_at FROM entries e JOIN players p ON p.id = e.player_id WHERE e.season = ?"
    ).all(year).map((e) => ({ player: e.name, picks: parse(e.picks, {}), updatedAt: new Date(e.updated_at).toISOString() }));
    return { year, bracket: s.bracket, lockAt: s.lockAt && new Date(s.lockAt).toISOString(), results: winners, entries };
  });
  res.setHeader("Content-Disposition", `attachment; filename="playoff-picks-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({ exportedAt: new Date().toISOString(), schemaVersion: 2, seasons });
}));

// ============================================================
// Admin
// ============================================================
const admin = express.Router();
admin.use(requirePlayer, requireAdmin);

admin.get("/info", (_req, res) => res.json({ dbPath: DB_PATH }));

admin.post("/seasons", route((req, res) => {
  const year = Number(req.body?.year);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return res.status(400).json({ error: "Invalid year" });
  if (getSeason(year)) return res.status(409).json({ error: `${year} already exists` });
  const err = validateSeeds(req.body?.seeds);
  if (err) return res.status(400).json({ error: err });
  const lockAt = req.body?.lockAt ? Number(req.body.lockAt) : null;
  const t = now();
  db.prepare("INSERT INTO seasons (year, bracket, lock_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(year, JSON.stringify(bracketFromSeeds(req.body.seeds)), lockAt, t, t);
  res.json({ ok: true });
}));

admin.patch("/seasons/:year", route((req, res) => {
  const year = Number(req.params.year);
  const season = getSeason(year);
  if (!season) return res.status(404).json({ error: "No such season" });
  tx(db, () => {
    if (req.body?.seeds) {
      const err = validateSeeds(req.body.seeds);
      if (err) throw Object.assign(new Error(err), { status: 400 });
      const bracket = bracketFromSeeds(req.body.seeds);
      db.prepare("UPDATE seasons SET bracket = ?, updated_at = ? WHERE year = ?").run(JSON.stringify(bracket), now(), year);
      // Keep whatever picks still make sense with the new seeds.
      for (const e of db.prepare("SELECT player_id, picks FROM entries WHERE season = ?").all(year)) {
        db.prepare("UPDATE entries SET picks = ? WHERE season = ? AND player_id = ?")
          .run(JSON.stringify(sanitize(bracket, parse(e.picks, {}))), year, e.player_id);
      }
      resanitizeResults(year, bracket);
    }
    if (req.body && "lockAt" in req.body) {
      const lockAt = req.body.lockAt ? Number(req.body.lockAt) : null;
      db.prepare("UPDATE seasons SET lock_at = ?, updated_at = ? WHERE year = ?").run(lockAt, now(), year);
    }
  });
  res.json({ ok: true });
}));

admin.put("/seasons/:year/results/:matchupId", route((req, res) => {
  const year = Number(req.params.year);
  const season = getSeason(year);
  if (!season?.bracket) return res.status(404).json({ error: "No such season" });
  const id = req.params.matchupId;
  if (!MATCHUP_BY_ID[id]) return res.status(400).json({ error: "Unknown matchup" });
  const winner = req.body?.winner ?? null;
  tx(db, () => {
    if (winner === null) {
      db.prepare("DELETE FROM results WHERE season = ? AND matchup_id = ?").run(year, id);
    } else {
      const [a, b] = teamsFor(id, season.bracket, getResults(year).winners);
      if (winner !== a && winner !== b) throw Object.assign(new Error("That team isn't in this series"), { status: 400 });
      db.prepare(`
        INSERT INTO results (season, matchup_id, winner, source, updated_at) VALUES (?, ?, ?, 'manual', ?)
        ON CONFLICT(season, matchup_id) DO UPDATE SET winner = excluded.winner, source = 'manual', updated_at = excluded.updated_at
      `).run(year, id, winner, now());
    }
    resanitizeResults(year, season.bracket);
  });
  res.json({ ok: true });
}));

const syncSeason = async (year) => {
  const season = getSeason(year);
  if (!season?.bracket) return { updated: 0 };
  const manual = Object.fromEntries(
    db.prepare("SELECT matchup_id, winner FROM results WHERE season = ? AND source = 'manual'").all(year)
      .map((r) => [r.matchup_id, r.winner])
  );
  const { winners, series } = await fetchSeason(year, season.bracket, manual);
  let updated = 0;
  tx(db, () => {
    const current = getResults(year);
    for (const [id, w] of Object.entries(winners)) {
      if (current.sources[id] === "manual" || current.winners[id] === w) continue;
      db.prepare(`
        INSERT INTO results (season, matchup_id, winner, source, updated_at) VALUES (?, ?, ?, 'espn', ?)
        ON CONFLICT(season, matchup_id) DO UPDATE SET winner = excluded.winner, source = 'espn', updated_at = excluded.updated_at
      `).run(year, id, w, now());
      updated++;
    }
    resanitizeResults(year, season.bracket);
    db.prepare("UPDATE seasons SET series = ?, synced_at = ? WHERE year = ?").run(JSON.stringify(series), now(), year);
  });
  if (updated) console.log(`[espn] ${year}: ${updated} series result(s) updated`);
  return { updated };
};

admin.post("/seasons/:year/sync", route(async (req, res) => {
  try {
    res.json(await syncSeason(Number(req.params.year)));
  } catch (e) {
    res.status(502).json({ error: `ESPN sync failed: ${e.message}` });
  }
}));

admin.get("/players", route((_req, res) => {
  const rows = db.prepare(`
    SELECT p.*, (SELECT MAX(last_seen_at) FROM sessions s WHERE s.player_id = p.id) AS last_seen
    FROM players p ORDER BY p.name COLLATE NOCASE
  `).all();
  res.json(rows.map((p) => ({ ...playerJson(p), lastSeenAt: p.last_seen })));
}));

admin.patch("/players/:id", route((req, res) => {
  const p = db.prepare("SELECT * FROM players WHERE id = ?").get(req.params.id);
  if (!p) return res.status(404).json({ error: "Player not found" });
  if ("isAdmin" in (req.body || {})) {
    if (!req.body.isAdmin && p.id === req.player.id) return res.status(400).json({ error: "You can't remove your own admin access" });
    db.prepare("UPDATE players SET is_admin = ?, updated_at = ? WHERE id = ?").run(req.body.isAdmin ? 1 : 0, now(), p.id);
  }
  if (req.body?.name !== undefined) {
    const name = cleanName(req.body.name);
    const err = nameError(name, p.id);
    if (err) return res.status(400).json({ error: err });
    db.prepare("UPDATE players SET name = ?, updated_at = ? WHERE id = ?").run(name, now(), p.id);
  }
  res.json({ ok: true });
}));

// Clears the PIN; the player picks a new one the next time they sign in.
admin.post("/players/:id/reset-pin", route((req, res) => {
  const p = db.prepare("SELECT id FROM players WHERE id = ?").get(req.params.id);
  if (!p) return res.status(404).json({ error: "Player not found" });
  tx(db, () => {
    db.prepare("UPDATE players SET pin_hash = NULL, updated_at = ? WHERE id = ?").run(now(), p.id);
    db.prepare("DELETE FROM sessions WHERE player_id = ?").run(p.id);
  });
  clearFails(p.id);
  res.json({ ok: true });
}));

admin.delete("/players/:id", route((req, res) => {
  if (req.params.id === req.player.id) return res.status(400).json({ error: "You can't remove yourself" });
  db.prepare("DELETE FROM players WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
}));

app.use("/api/admin", admin);
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

// Errors thrown with a .status inside tx() land here.
app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ error: err.status ? err.message : "Something went wrong on the server" });
});

// ============================================================
// Built client
// ============================================================
const dist = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(dist)) {
  app.use("/assets", express.static(path.join(dist, "assets"), { immutable: true, maxAge: "1y" }));
  app.use(express.static(dist, { index: false }));
  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(dist, "index.html"));
  });
}

// ============================================================
// ESPN auto-sync: every 10 minutes during the playoffs, plus a one-time
// backfill for any past season that has never been synced.
// ============================================================
const autoSync = async () => {
  for (const { year } of db.prepare("SELECT year FROM seasons WHERE bracket IS NOT NULL").all()) {
    const s = getSeason(year);
    const final = seasonStatus(s, getResults(year).winners) === "final";
    const neverSynced = !s.syncedAt && year <= new Date().getFullYear();
    if ((inPlayoffWindow(year) && !final) || neverSynced) {
      await syncSeason(year).catch((e) => console.error(`[espn] ${year} sync failed:`, e.message));
    }
  }
};
setTimeout(autoSync, 3000);
setInterval(autoSync, 10 * 60 * 1000);

app.listen(PORT, HOST, () => {
  console.log(`Playoff Picks on http://${HOST}:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
  if (!fs.existsSync(dist)) console.log("No client build found; use the Vite dev server (port 5173).");
});
