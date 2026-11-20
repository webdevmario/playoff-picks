import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// One database for every checkout and worktree, outside the repo.
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR.replace(/^~(?=$|\/)/, os.homedir()))
  : path.join(os.homedir(), "Library", "Application Support", "playoff-picks");
export const DB_PATH = path.join(DATA_DIR, "playoff-picks.db");

const SCHEMA_VERSION = 2;

export const openDb = (file = DB_PATH) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      fav_team TEXT,
      pin_hash TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS players_name ON players(name COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS seasons (
      year INTEGER PRIMARY KEY,
      bracket TEXT,
      lock_at INTEGER,
      series TEXT NOT NULL DEFAULT '{}',
      synced_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
      season INTEGER NOT NULL REFERENCES seasons(year) ON DELETE CASCADE,
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      picks TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (season, player_id)
    );

    CREATE TABLE IF NOT EXISTS results (
      season INTEGER NOT NULL REFERENCES seasons(year) ON DELETE CASCADE,
      matchup_id TEXT NOT NULL,
      winner TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (season, matchup_id)
    );
  `);
  db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', ?)").run(String(SCHEMA_VERSION));
  return db;
};

export const tx = (db, fn) => {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
};

export const newId = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};
