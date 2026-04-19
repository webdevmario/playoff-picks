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

The simplest option is a LaunchAgent. Create `~/Library/LaunchAgents/com.playoffpicks.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.playoffpicks</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/FULL/PATH/TO/playoff-picks-app/server/index.js</string>
  </array>
  <key>WorkingDirectory</key><string>/FULL/PATH/TO/playoff-picks-app</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/playoffpicks.log</string>
  <key>StandardErrorPath</key><string>/tmp/playoffpicks.err</string>
</dict>
</plist>
```

Then `launchctl load ~/Library/LaunchAgents/com.playoffpicks.plist`.

Replace `/FULL/PATH/TO/` with the real path. Find your node binary with `which node` (may be `/opt/homebrew/bin/node` on Apple Silicon).

## Data

SQLite file lives at `server/data.db`. Back it up by copying that file. Nothing else matters.

## Admin

Anyone can flip the Admin toggle on the Scores tab to mark winners. If you want to restrict that, set `ADMIN_PASSWORD` in `server/.env` and the app will prompt for it the first time Admin is enabled.

## Export

The Leaderboard tab has an Export button that downloads all picks + results as JSON. Keep a copy before the playoffs end as a trophy file.
