import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import crypto from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 5174);
const HOST = process.env.HOST || "0.0.0.0";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;

// ============================================================
// Database setup
// ============================================================
const DB_PATH = path.join(__dirname, "data.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar TEXT NOT NULL,
    picks TEXT NOT NULL DEFAULT '{}',
    locked INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS results (
    matchup_id TEXT PRIMARY KEY,
    winner TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
  );
`);

// ============================================================
// Bracket constants (mirrored in client; kept here for validation)
// ============================================================
const VALID_TEAMS = new Set([
  "DET","ORL","CLE","TOR","BOS","PHI","NYK","ATL",
  "OKC","PHX","LAL","HOU","SAS","POR","DEN","MIN"
]);

const VALID_MATCHUPS = new Set([
  "E1","E2","E3","E4","W1","W2","W3","W4",
  "ES1","ES2","WS1","WS2",
  "ECF","WCF","FINALS"
]);

const generateUserId = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
};

// ============================================================
// Express app
// ============================================================
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors());

// ----- admin check middleware -----
const isAdminAuthed = (req) => {
  if (!ADMIN_PASSWORD) return true; // no password set, admin is open
  const token = req.headers["x-admin-token"];
  if (!token) return false;
  const row = db.prepare("SELECT token FROM admin_sessions WHERE token = ?").get(token);
  return !!row;
};

// ============================================================
// Auth-like endpoints (no password, just ID-based like the artifact)
// ============================================================
app.post("/api/users", (req, res) => {
  const { name, avatar } = req.body || {};
  if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 40) {
    return res.status(400).json({ error: "Invalid name" });
  }
  if (!avatar || typeof avatar !== "string" || avatar.length > 8) {
    return res.status(400).json({ error: "Invalid avatar" });
  }

  // generate unique ID (retry if collision, extremely unlikely)
  let id;
  for (let i = 0; i < 10; i++) {
    id = generateUserId();
    const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
    if (!existing) break;
    id = null;
  }
  if (!id) return res.status(500).json({ error: "Could not generate unique ID" });

  const now = Date.now();
  db.prepare(
    "INSERT INTO users (id, name, avatar, picks, locked, created_at, updated_at) VALUES (?, ?, ?, '{}', 0, ?, ?)"
  ).run(id, name.trim(), avatar, now, now);

  res.json({ id, name: name.trim(), avatar, picks: {}, locked: false });
});

app.get("/api/users/:id", (req, res) => {
  const row = db.prepare("SELECT id, name, avatar, picks, locked FROM users WHERE id = ?").get(req.params.id.toUpperCase());
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json({ ...row, picks: JSON.parse(row.picks), locked: !!row.locked });
});

app.patch("/api/users/:id", (req, res) => {
  const id = req.params.id.toUpperCase();
  const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Not found" });

  const { name, avatar } = req.body || {};
  const updates = [];
  const values = [];
  if (name && typeof name === "string" && name.trim().length > 0 && name.length <= 40) {
    updates.push("name = ?");
    values.push(name.trim());
  }
  if (avatar && typeof avatar === "string" && avatar.length <= 8) {
    updates.push("avatar = ?");
    values.push(avatar);
  }
  if (updates.length === 0) return res.status(400).json({ error: "No valid updates" });
  updates.push("updated_at = ?");
  values.push(Date.now());
  values.push(id);

  db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  const row = db.prepare("SELECT id, name, avatar, picks, locked FROM users WHERE id = ?").get(id);
  res.json({ ...row, picks: JSON.parse(row.picks), locked: !!row.locked });
});

// ============================================================
// Picks
// ============================================================
app.put("/api/users/:id/picks", (req, res) => {
  const id = req.params.id.toUpperCase();
  const user = db.prepare("SELECT id, locked FROM users WHERE id = ?").get(id);
  if (!user) return res.status(404).json({ error: "Not found" });
  if (user.locked) return res.status(403).json({ error: "Picks are locked" });

  const { picks } = req.body || {};
  if (!picks || typeof picks !== "object") return res.status(400).json({ error: "Invalid picks" });

  // Validate picks
  for (const [matchupId, teamId] of Object.entries(picks)) {
    if (!VALID_MATCHUPS.has(matchupId)) return res.status(400).json({ error: `Invalid matchup: ${matchupId}` });
    if (!VALID_TEAMS.has(teamId)) return res.status(400).json({ error: `Invalid team: ${teamId}` });
  }

  db.prepare("UPDATE users SET picks = ?, updated_at = ? WHERE id = ?").run(
    JSON.stringify(picks),
    Date.now(),
    id
  );
  res.json({ ok: true });
});

app.post("/api/users/:id/lock", (req, res) => {
  const id = req.params.id.toUpperCase();
  const user = db.prepare("SELECT id, locked FROM users WHERE id = ?").get(id);
  if (!user) return res.status(404).json({ error: "Not found" });
  if (user.locked) return res.status(400).json({ error: "Already locked" });

  db.prepare("UPDATE users SET locked = 1, updated_at = ? WHERE id = ?").run(Date.now(), id);
  res.json({ ok: true });
});

// ============================================================
// Leaderboard - returns all entries
// ============================================================
app.get("/api/entries", (req, res) => {
  const rows = db.prepare("SELECT id, name, avatar, picks, locked FROM users ORDER BY created_at ASC").all();
  res.json(rows.map((r) => ({ ...r, picks: JSON.parse(r.picks), locked: !!r.locked })));
});

// ============================================================
// Results (admin-only when ADMIN_PASSWORD is set)
// ============================================================
app.get("/api/results", (req, res) => {
  const rows = db.prepare("SELECT matchup_id, winner FROM results").all();
  const out = {};
  for (const row of rows) out[row.matchup_id] = row.winner;
  res.json(out);
});

app.put("/api/results/:matchupId", (req, res) => {
  if (!isAdminAuthed(req)) return res.status(401).json({ error: "Admin auth required" });
  const matchupId = req.params.matchupId;
  const { winner } = req.body || {};
  if (!VALID_MATCHUPS.has(matchupId)) return res.status(400).json({ error: "Invalid matchup" });
  if (winner !== null && !VALID_TEAMS.has(winner)) return res.status(400).json({ error: "Invalid team" });

  const now = Date.now();
  if (winner === null) {
    db.prepare("DELETE FROM results WHERE matchup_id = ?").run(matchupId);
  } else {
    db.prepare(
      "INSERT INTO results (matchup_id, winner, updated_at) VALUES (?, ?, ?) ON CONFLICT(matchup_id) DO UPDATE SET winner = excluded.winner, updated_at = excluded.updated_at"
    ).run(matchupId, winner, now);
  }
  res.json({ ok: true });
});

// ============================================================
// Admin auth
// ============================================================
app.get("/api/admin/status", (req, res) => {
  res.json({ requiresPassword: !!ADMIN_PASSWORD, authed: isAdminAuthed(req) });
});

app.post("/api/admin/login", (req, res) => {
  if (!ADMIN_PASSWORD) return res.json({ ok: true, token: null });
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Wrong password" });
  const token = crypto.randomBytes(24).toString("hex");
  db.prepare("INSERT INTO admin_sessions (token, created_at) VALUES (?, ?)").run(token, Date.now());
  res.json({ ok: true, token });
});

// ============================================================
// Export all data (public, it's all shared anyway)
// ============================================================
app.get("/api/export", (req, res) => {
  const entries = db.prepare("SELECT id, name, avatar, picks, locked, created_at, updated_at FROM users").all()
    .map((r) => ({ ...r, picks: JSON.parse(r.picks), locked: !!r.locked }));
  const resultsRows = db.prepare("SELECT matchup_id, winner, updated_at FROM results").all();
  const results = {};
  for (const row of resultsRows) results[row.matchup_id] = row.winner;

  res.json({
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    entries,
    results,
  });
});

// ============================================================
// ESPN auto-sync
// ============================================================
const R1_MATCHUPS = [
  { id: "E1", a: "DET", b: "ORL" }, { id: "E2", a: "CLE", b: "TOR" },
  { id: "E3", a: "BOS", b: "PHI" }, { id: "E4", a: "NYK", b: "ATL" },
  { id: "W1", a: "OKC", b: "PHX" }, { id: "W2", a: "LAL", b: "HOU" },
  { id: "W3", a: "SAS", b: "POR" }, { id: "W4", a: "DEN", b: "MIN" },
];

// Map ESPN abbreviations to our team IDs (most match, but some differ)
const ESPN_ABBREV_MAP = {
  DET: "DET", ORL: "ORL", CLE: "CLE", TOR: "TOR",
  BOS: "BOS", PHI: "PHI", NY: "NYK", NYK: "NYK", ATL: "ATL",
  OKC: "OKC", PHX: "PHX", LAL: "LAL", HOU: "HOU",
  SA: "SAS", SAS: "SAS", POR: "POR", DEN: "DEN", MIN: "MIN",
};

const findMatchupForTeams = (teamA, teamB) => {
  const a = ESPN_ABBREV_MAP[teamA], b = ESPN_ABBREV_MAP[teamB];
  if (!a || !b) return null;
  return R1_MATCHUPS.find((m) => (m.a === a && m.b === b) || (m.a === b && m.b === a));
};

// Returns { winners: { matchupId: teamId }, seriesStatus: { matchupId: { summary, teamA, teamB, winsA, winsB, completed, games[] } } }
const fetchESPNScores = async () => {
  const winners = new Map();
  const statusMap = new Map();
  const gamesDataMap = new Map(); // matchupId -> Map<eventId, gameObject>

  const now = new Date();
  const dates = [];
  for (let i = 0; i < 60; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10).replace(/-/g, ""));
  }

  for (const date of dates) {
    try {
      const resp = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date}`);
      if (!resp.ok) continue;
      const data = await resp.json();
      if (!data.events) continue;

      for (const event of data.events) {
        if (event.season?.slug !== "post-season") continue;
        const comp = event.competitions?.[0];
        if (!comp) continue;
        const series = comp.series;
        if (!series || !series.competitors || series.competitors.length < 2) continue;

        const competitors = comp.competitors;
        if (!competitors || competitors.length < 2) continue;

        const teamA = competitors[0]?.team?.abbreviation;
        const teamB = competitors[1]?.team?.abbreviation;
        const matchup = findMatchupForTeams(teamA, teamB);
        if (!matchup) continue;

        // Build team-to-wins mapping from series competitors
        const winsById = {};
        for (const sc of series.competitors) winsById[sc.id] = sc.wins || 0;
        const teamAId = competitors[0]?.id || competitors[0]?.team?.id;
        const teamBId = competitors[1]?.id || competitors[1]?.team?.id;
        const winsA = winsById[teamAId] || 0;
        const winsB = winsById[teamBId] || 0;

        // Keep the most recent status per matchup (highest total games)
        const existing = statusMap.get(matchup.id);
        const totalGames = winsA + winsB;
        if (!existing || totalGames >= existing._totalGames) {
          const idA = ESPN_ABBREV_MAP[teamA];
          const idB = ESPN_ABBREV_MAP[teamB];
          statusMap.set(matchup.id, {
            summary: series.summary || "",
            teamA: idA, teamB: idB,
            winsA, winsB,
            completed: !!series.completed,
            _totalGames: totalGames,
          });
        }

        if (series.completed) {
          const winnerComp = series.competitors.find((c) => c.wins >= 4);
          if (winnerComp) {
            const winnerTeam = competitors.find((c) => c.id === winnerComp.id || c.team?.id === winnerComp.id);
            const winnerESPN = winnerTeam?.team?.abbreviation;
            const winnerId = ESPN_ABBREV_MAP[winnerESPN];
            if (winnerId) winners.set(matchup.id, winnerId);
          }
        }

        // Collect per-game data for completed individual games
        if (comp.status?.type?.completed && event.id) {
          const matchupGames = gamesDataMap.get(matchup.id) || new Map();
          if (!matchupGames.has(event.id)) {
            const homeComp = competitors.find((c) => c.homeAway === "home") || competitors[1];
            const awayComp = competitors.find((c) => c.homeAway === "away") || competitors[0];
            matchupGames.set(event.id, {
              date: event.date || `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`,
              homeTeam: ESPN_ABBREV_MAP[homeComp?.team?.abbreviation] || null,
              awayTeam: ESPN_ABBREV_MAP[awayComp?.team?.abbreviation] || null,
              homeScore: parseInt(homeComp?.score || "0", 10),
              awayScore: parseInt(awayComp?.score || "0", 10),
              status: comp.status?.type?.description || "Final",
            });
            gamesDataMap.set(matchup.id, matchupGames);
          }
        }
      }
    } catch {
      // Skip failed dates
    }
  }

  // Assemble final seriesStatus with sorted games arrays
  const seriesStatus = {};
  for (const [id, s] of statusMap) {
    const { _totalGames, ...rest } = s;
    const matchupGames = gamesDataMap.get(id);
    const games = matchupGames
      ? [...matchupGames.values()]
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .map((g, i) => ({ ...g, gameNumber: i + 1 }))
      : [];
    seriesStatus[id] = { ...rest, games };
  }

  return { winners: Object.fromEntries(winners), seriesStatus };
};

// Cache series status in memory (refreshed on sync)
let cachedSeriesStatus = {};

const applyWinners = (winners) => {
  const now = Date.now();
  let updated = 0;
  for (const [matchupId, winner] of Object.entries(winners)) {
    const existing = db.prepare("SELECT winner FROM results WHERE matchup_id = ?").get(matchupId);
    if (!existing || existing.winner !== winner) {
      db.prepare(
        "INSERT INTO results (matchup_id, winner, updated_at) VALUES (?, ?, ?) ON CONFLICT(matchup_id) DO UPDATE SET winner = excluded.winner, updated_at = excluded.updated_at"
      ).run(matchupId, winner, now);
      updated++;
    }
  }
  return updated;
};

// Sync endpoint
app.post("/api/sync-espn", async (req, res) => {
  try {
    const { winners, seriesStatus } = await fetchESPNScores();
    cachedSeriesStatus = seriesStatus;
    const updated = applyWinners(winners);
    const rows = db.prepare("SELECT matchup_id, winner FROM results").all();
    const allResults = {};
    for (const row of rows) allResults[row.matchup_id] = row.winner;
    res.json({ ok: true, updated, results: allResults, seriesStatus });
  } catch (e) {
    res.status(500).json({ error: "ESPN sync failed: " + e.message });
  }
});

// Series status endpoint (returns cached live status)
app.get("/api/series-status", (req, res) => {
  res.json(cachedSeriesStatus);
});

// Auto-sync every 10 minutes
const autoSync = async () => {
  try {
    const { winners, seriesStatus } = await fetchESPNScores();
    cachedSeriesStatus = seriesStatus;
    const updated = applyWinners(winners);
    if (updated > 0) {
      for (const [matchupId, winner] of Object.entries(winners)) {
        console.log(`   ESPN sync: ${matchupId} → ${winner}`);
      }
    }
  } catch (e) {
    console.error("   ESPN auto-sync error:", e.message);
  }
};

// Run initial sync after startup, then every 10 min
setTimeout(autoSync, 5000);
setInterval(autoSync, 10 * 60 * 1000);

// ============================================================
// Serve built client in production
// ============================================================
const clientDistPath = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

// ============================================================
// Start
// ============================================================
app.listen(PORT, HOST, () => {
  console.log(`\n🏀 Playoff Picks server running`);
  console.log(`   Local:     http://localhost:${PORT}`);
  console.log(`   Tailnet:   http://<your-mac-tailscale-ip>:${PORT}`);
  console.log(`   DB:        ${DB_PATH}`);
  if (ADMIN_PASSWORD) {
    console.log(`   Admin:     password-protected`);
  } else {
    console.log(`   Admin:     open (set ADMIN_PASSWORD in server/.env to restrict)`);
  }
  if (!fs.existsSync(clientDistPath)) {
    console.log(`\n   Dev mode: visit Vite dev server on port 5173 for UI.`);
  }
  console.log("");
});
