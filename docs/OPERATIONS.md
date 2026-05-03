# Operations Guide

Everything you need to run NBA Playoff Picks on your Mac and reach it
from your friends' tailnet devices.

This mirrors the pattern used for `financial-insider` and
`tater-tot-brain-gym` — same mental model, slightly different stack
(plain Express + better-sqlite3 instead of Prisma).

---

## How it all fits together

```
┌──────────────────────────────────────────────────────────────┐
│                          Mac                                 │
│                                                              │
│  ┌────────────────┐   ┌────────────────┐   ┌─────────────┐  │
│  │  Express +     │──▶│ better-sqlite3 │   │  Tailscale  │  │
│  │  server/index  │   │ server/data.db │   │    (VPN)    │  │
│  │  (port 5174)   │   └────────────────┘   └──────┬──────┘  │
│  │                │                               │         │
│  │ serves API +   │                               │         │
│  │ built client   │                               │         │
│  └───────┬────────┘                               │         │
└──────────┼────────────────────────────────────────┼─────────┘
           │                                        │
           ▼                                        ▼
   http://<mac-name>.<tailnet>.ts.net:5174    Private tailnet
   (only reachable from your devices)
```

Three pieces:

1. **Express server** — serves the JSON API and the pre-built React
   client on a single port (5174).
2. **SQLite database** — one file at `server/data.db` (plus
   `data.db-wal` and `data.db-shm` for WAL mode).
3. **Tailscale** — a private mesh VPN. Each device gets a `100.x.x.x`
   IP and a stable `<host>.<tailnet>.ts.net` MagicDNS name.

The Express server is managed by **launchd** so it auto-starts at
login and auto-restarts on crash.

---

## Development vs. production

### Production (the default — what your friends actually use)

- launchd runs `node server/index.js` on port 5174.
- Express serves both `/api/*` and the static `client/dist/` build.
- Reachable at `http://<mac-name>.<tailnet>.ts.net:5174` (or
  `http://100.x.x.x:5174`).

### Development (when you're working on code)

- Stop the production service.
- `npm run dev` runs the server (5174, `tsx watch`-style) and the
  Vite dev server (5173) side by side via `concurrently`.
- Vite proxies `/api` to 5174.
- You work at `http://localhost:5173` (or
  `http://<mac-name>.<tailnet>.ts.net:5173` from another tailnet
  device — Vite is configured with `host: 0.0.0.0`).

### Switching between them

```bash
# Stop production, hop into dev
npm run prod:stop
npm run dev

# Done coding, push back to production
npm run prod:deploy   # = build + prod:restart
```

`prod:deploy` runs `npm run build` (client → `client/dist/`) and then
`prod:restart`. Always rebuild before restarting prod if you changed
client code — the server serves the built bundle, not source.

---

## launchd

The plist that defines the service lives at:

```
~/Library/LaunchAgents/com.playoff-picks.plist
```

A template is checked into the repo at
`scripts/com.playoff-picks.plist`. To install (or reinstall after
moving the project):

```bash
cp scripts/com.playoff-picks.plist ~/Library/LaunchAgents/com.playoff-picks.plist
npm run prod:start
npm run prod:status
```

### What the plist does

- **RunAtLoad: true** — starts the server at login (or when the plist
  is loaded).
- **KeepAlive: true** — restarts the server if it crashes.
- **ProgramArguments** — sources nvm, cds into `server/`, runs
  `node index.js`.
- **StandardOutPath / StandardErrorPath** —
  `/tmp/playoff-picks.log` and `/tmp/playoff-picks-error.log`.

### Common commands

```bash
# Wrappers (npm)
npm run prod:start
npm run prod:stop
npm run prod:restart
npm run prod:status
npm run prod:logs       # cat stdout
npm run prod:errors     # cat stderr
npm run prod:deploy     # build + restart

# Raw equivalents
launchctl load   ~/Library/LaunchAgents/com.playoff-picks.plist
launchctl unload ~/Library/LaunchAgents/com.playoff-picks.plist
launchctl list | grep playoff-picks
```

### If the service won't start

1. **Port in use.** Something else is on 5174:
   `lsof -ti:5174 | xargs kill -9`.
2. **nvm path wrong.** The plist sources `~/.nvm/nvm.sh` — confirm
   `echo $NVM_DIR` matches.
3. **Node version drift.** After an `nvm` switch, `npm run prod:restart`.
4. **Plist syntax.** `plutil ~/Library/LaunchAgents/com.playoff-picks.plist`.

---

## Tailscale

### Find this Mac's tailnet address

```bash
tailscale ip -4         # 100.x.x.x
tailscale status        # full device list
hostname                # local hostname (used as MagicDNS prefix)
```

### Add a friend's device

1. They install Tailscale (App Store / Play Store / brew).
2. Either share the same account, or invite them as a separate user
   in [the Tailscale admin](https://login.tailscale.com/admin) → Users.
3. They open `http://<your-mac-name>.<tailnet>.ts.net:5174` and Add to
   Home Screen so it looks like an app.

### If a device can't reach the app

1. Tailscale active on both ends? (menu bar / phone toggle)
2. `ping <mac-name>.<tailnet>.ts.net` from the device.
3. `curl http://<mac-name>.<tailnet>.ts.net:5174/` should return the
   app HTML.
4. If that fails, check `npm run prod:status` and `npm run prod:errors`.

---

## Database

### Where it lives

```
server/data.db        # primary SQLite file
server/data.db-wal    # write-ahead log
server/data.db-shm    # shared memory (also part of WAL)
```

All three files matter when the server is running — back them up as a
set or stop the server first for a clean copy.

### Backups

```bash
npm run db:backup
# → backups/data-YYYYMMDD-HHMMSS.db
```

Run while the server is up (better-sqlite3's WAL mode tolerates this
for a snapshot) or stop first if you want the cleanest possible copy.

For automated weekly backup:

```bash
crontab -e
# Add (Sunday 3am):
0 3 * * 0 cd ~/Documents/development/projects/playoff-picks && /opt/homebrew/bin/npm run db:backup
```

### Restoring

```bash
npm run prod:stop
cp backups/data-20260403-030000.db server/data.db
rm -f server/data.db-wal server/data.db-shm   # discard stale WAL
npm run prod:start
```

### Schema changes

The schema is defined inline in `server/index.js` with
`CREATE TABLE IF NOT EXISTS …`. For additive changes (new columns,
new tables), you can edit the source and add an `ALTER TABLE` block
guarded by a feature check or a try/catch. For destructive changes,
back up first.

---

## Updating the app

```bash
# After code changes:
npm run prod:deploy
npm run prod:logs
```

If something looks off:

```bash
npm run prod:errors
npm run prod:status
```

---

## Quick reference

| Task                         | Command                                                   |
|------------------------------|-----------------------------------------------------------|
| Start production             | `npm run prod:start`                                      |
| Stop production              | `npm run prod:stop`                                       |
| Restart production           | `npm run prod:restart`                                    |
| Deploy code changes          | `npm run prod:deploy`                                     |
| Check service status         | `npm run prod:status`                                     |
| View stdout                  | `npm run prod:logs`                                       |
| View stderr                  | `npm run prod:errors`                                     |
| Kill stuck process on 5174   | `lsof -ti:5174 \| xargs kill -9`                          |
| Tailscale IP                 | `tailscale ip -4`                                         |
| Tailscale status             | `tailscale status`                                        |
| Backup DB                    | `npm run db:backup`                                       |
| Open the app (local)         | http://localhost:5174                                     |
| Open the app (tailnet)       | http://&lt;mac&gt;.&lt;tailnet&gt;.ts.net:5174            |
