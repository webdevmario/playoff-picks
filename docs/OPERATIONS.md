# Operations

How Playoff Picks runs on the Mac mini, and how to fix it when it doesn't.

```
phone / laptop on the tailnet
        │  https://<mac>.<tailnet>.ts.net:8447
        ▼
tailscale serve (HTTPS, tailnet only)
        │  http://127.0.0.1:5174
        ▼
node server/index.js  (launchd: com.playoff-picks)
        │  API + built client (client/dist)
        ▼
~/Library/Application Support/playoff-picks/playoff-picks.db  (SQLite, WAL)
```

The server listens on loopback only, so the HTTPS address above is the one way
in from other devices. That keeps every device on the same URL (no more
separate `localhost` / `100.x` / `ts.net` copies of the app).

## Deploy

```bash
git pull                 # in ~/Documents/development/projects/playoff-picks
npm run install-all      # only when dependencies changed
npm run prod:deploy      # build client + restart the service
npm run prod:status      # launchd entry + {"ok":true}
```

## First-time setup on a Mac

```bash
npm run install-all
npm run build
npm run prod:install     # copies the launchd plist and starts it
npm run tailscale:serve  # HTTPS :8447 → 127.0.0.1:5174 (persists across reboots)
npm run tailscale:url
```

Other apps on this Mac already use `tailscale serve` ports 443 and 8443–8446;
Playoff Picks takes 8447.

## launchd

- Plist template: `scripts/com.playoff-picks.plist`. `npm run prod:install`
  copies it to `~/Library/LaunchAgents/`.
- Starts at login, restarts on crash (throttled to every 30 s).
- Runs whatever Node `nvm` defaults to. Any Node 22.13+ works; there are no
  native modules, so Node upgrades no longer break the service.

| Task | Command |
|---|---|
| Restart | `npm run prod:restart` |
| Stop | `npm run prod:stop` |
| Status | `npm run prod:status` |
| Recent output | `npm run prod:logs` |
| Recent errors | `npm run prod:errors` |

### If the app won't load

1. `npm run prod:status`. No `{"ok":true}` means the server is down; check
   `npm run prod:errors`.
2. Port taken: `lsof -i :5174`.
3. Server is up but other devices can't reach it: `tailscale serve status`
   should list `:8447 → http://127.0.0.1:5174`. If not, `npm run tailscale:serve`.
4. Tailscale is on for that device, and it's signed into the same tailnet.

## Data

Database: `~/Library/Application Support/playoff-picks/playoff-picks.db`
(override with `DATA_DIR` in `server/.env`).

### Backups

```bash
npm run db:backup   # → ~/Backups/playoff-picks/playoff-picks-YYYYMMDD-HHMMSS.db (keeps 30)
```

It uses SQLite's `.backup`, so it's safe while the server runs. Run it before
each season starts and after the Finals. Admin → Data → **Export JSON** is a
readable copy of everything as well.

### Restore

```bash
npm run prod:stop
cp ~/Backups/playoff-picks/playoff-picks-YYYYMMDD-HHMMSS.db \
   ~/Library/Application\ Support/playoff-picks/playoff-picks.db
rm -f ~/Library/Application\ Support/playoff-picks/playoff-picks.db-{wal,shm}
npm run prod:start
```

Only delete the `-wal`/`-shm` files when restoring a `.backup` snapshot. On a
live database the WAL can hold most of the data.

### The 2026 database

Before v2 the data lived in `server/data.db` inside the repo.
`npm run db:migrate-legacy` copied it (players, 2026 picks and results) into
the new database and left a copy of the old files in
`~/Backups/playoff-picks/legacy-*`. Players carried over have no PIN; the
first PIN each one enters becomes theirs.

## Admin access

The first player created (Mario, for the migrated data) is the admin. Admins
can grant admin to others in **Admin → Players**.
