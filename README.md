# NBA Playoff Picks (self-hosted)

A local pick 'em bracket app for the 2026 NBA Playoffs. Runs on your Mac, accessible to friends over Tailscale.

## Requirements

- Node.js 18+ (`brew install node` if you don't have it)
- Tailscale installed and running on your Mac (already done)

## First-time setup

From the project root:

```bash
npm run install-all
```

This installs dependencies for the root, server, and client.

## Development (hot reload)

```bash
npm run dev
```

- Server runs on port **5174**
- Client (Vite dev server) runs on port **5173**
- Both bind to `0.0.0.0` so tailnet devices can reach them

Open `http://localhost:5173` on your Mac, or `http://<mac-tailscale-ip>:5173` from any other tailnet device.

## Production (single port, recommended for daily use)

Build the client and serve it from the Express server on one port:

```bash
npm run build    # builds client into client/dist
npm start        # starts server on port 5174, serves the built client too
```

Then visit:
- From your Mac: `http://localhost:5174`
- From tailnet: `http://<your-mac-name>.tail-xxxxx.ts.net:5174` (MagicDNS) or `http://<tailscale-ip>:5174`

Find your Mac's Tailscale name/IP with `tailscale status` or in the Tailscale menubar app.

## Run it forever in the background

A launchd plist template is checked into the repo. Install it once:

```bash
cp scripts/com.playoff-picks.plist ~/Library/LaunchAgents/com.playoff-picks.plist
npm run build           # build client → client/dist
npm run prod:start      # load the launchd job
npm run prod:status     # confirm PID + last-exit 0
npm run prod:logs       # see startup banner
```

Day-to-day commands:

```bash
npm run prod:deploy     # build + restart (use after code changes)
npm run prod:restart
npm run prod:stop
npm run prod:logs       # cat stdout
npm run prod:errors     # cat stderr
```

Full operations runbook: [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Data

SQLite file lives at `server/data.db`. Snapshot it:

```bash
npm run db:backup       # → backups/data-YYYYMMDD-HHMMSS.db
```

Restore by copying a snapshot back over `server/data.db` (stop the
service first; remove the `-wal`/`-shm` files alongside).

## Admin

Anyone can flip the Admin toggle on the Scores tab to mark winners. If you want to restrict that, set `ADMIN_PASSWORD` in `server/.env` and the app will prompt for it the first time Admin is enabled.

## Export

The Leaderboard tab has an Export button that downloads all picks + results as JSON. Keep a copy before the playoffs end as a trophy file.
