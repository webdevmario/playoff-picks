// One-time move from the old single-season database (server/data.db) to the
// shared database in ~/Library/Application Support/playoff-picks/.
//
//   node scripts/migrate-legacy.js [path/to/old/data.db]
//
// The old files are copied to ~/Backups/playoff-picks/ first and never modified.
// Old players keep their ids; they have no PIN, so the first PIN each one
// enters becomes theirs.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, tx, DB_PATH } from "../server/lib/db.js";
import { sanitize } from "../shared/nba.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const legacyPath = path.resolve(process.argv[2] || path.join(root, "server", "data.db"));
if (!fs.existsSync(legacyPath)) {
  console.error(`No legacy database at ${legacyPath}`);
  process.exit(1);
}

// The 2026 bracket as the old app hard-coded it (its first-round order isn't the standard one).
const BRACKET_2026 = {
  seeds: {
    E: ["DET", "BOS", "NYK", "CLE", "TOR", "ATL", "PHI", "ORL"],
    W: ["OKC", "SAS", "DEN", "LAL", "HOU", "MIN", "POR", "PHX"],
  },
  r1: {
    E1: ["DET", "ORL"], E2: ["CLE", "TOR"], E3: ["BOS", "PHI"], E4: ["NYK", "ATL"],
    W1: ["OKC", "PHX"], W2: ["LAL", "HOU"], W3: ["SAS", "POR"], W4: ["DEN", "MIN"],
  },
};

const db = openDb();
if (db.prepare("SELECT COUNT(*) AS n FROM players").get().n > 0) {
  console.error(`${DB_PATH} already has players; not importing twice.`);
  process.exit(1);
}

// 1. Back up the old files (db + WAL + SHM: the WAL holds most of the data).
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backupRoot = process.env.BACKUP_DIR || path.join(os.homedir(), "Backups", "playoff-picks");
const backupDir = path.join(backupRoot, `legacy-${stamp}`);
fs.mkdirSync(backupDir, { recursive: true });
for (const suffix of ["", "-wal", "-shm"]) {
  if (fs.existsSync(legacyPath + suffix)) fs.copyFileSync(legacyPath + suffix, path.join(backupDir, path.basename(legacyPath) + suffix));
}
console.log(`Backed up old files to ${backupDir}`);

// 2. Read from the backup copy so the original is untouched.
const old = new DatabaseSync(path.join(backupDir, path.basename(legacyPath)));
const users = old.prepare("SELECT id, name, picks, created_at, updated_at FROM users ORDER BY created_at").all();
const results = old.prepare("SELECT matchup_id, winner, updated_at FROM results").all();
old.close();

tx(db, () => {
  const t = Date.now();
  const lockAt = Math.max(...users.map((u) => u.updated_at), 0) || t;
  db.prepare("INSERT INTO seasons (year, bracket, lock_at, created_at, updated_at) VALUES (2026, ?, ?, ?, ?)")
    .run(JSON.stringify(BRACKET_2026), lockAt, t, t);

  users.forEach((u, i) => {
    db.prepare("INSERT INTO players (id, name, fav_team, pin_hash, is_admin, created_at, updated_at) VALUES (?, ?, NULL, NULL, ?, ?, ?)")
      .run(u.id, u.name.trim(), i === 0 ? 1 : 0, u.created_at, u.updated_at);
    const picks = sanitize(BRACKET_2026, JSON.parse(u.picks || "{}"));
    db.prepare("INSERT INTO entries (season, player_id, picks, created_at, updated_at) VALUES (2026, ?, ?, ?, ?)")
      .run(u.id, JSON.stringify(picks), u.created_at, u.updated_at);
  });

  for (const r of results) {
    db.prepare("INSERT INTO results (season, matchup_id, winner, source, updated_at) VALUES (2026, ?, ?, 'espn', ?)")
      .run(r.matchup_id, r.winner, r.updated_at);
  }
});

console.log(`Imported ${users.length} players, ${results.length} results into ${DB_PATH}`);
console.log(`Admin: ${users[0]?.name ?? "(none)"}`);
