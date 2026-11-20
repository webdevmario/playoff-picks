# Playoff Picks

A self-hosted NBA playoffs bracket challenge for family and friends. It runs on
the Mac mini and is reached over Tailscale at one HTTPS address:

```
https://<mac>.<tailnet>.ts.net:8447
```

- **Profiles live on the server.** Pick your name and enter your 4-digit PIN on
  any phone or computer; that device remembers you after that.
- **Seasons.** Each year gets its own bracket. Past seasons stay browsable from
  the year picker in the header.
- **Picks lock at a deadline** the admin sets (usually tip-off of game 1).
  Until then, everyone's brackets are hidden from each other.
- **Results sync from ESPN** every 10 minutes during the playoffs. An admin can
  override any series by hand.
- **Scoring:** 1 / 2 / 4 / 8 points per round, 32 for a perfect bracket.

## Each spring

1. After the play-in, open **Admin → New season**, enter the 8 East and 8 West
   seeds, and set **Picks lock at** to the first game's tip-off.
2. Send the link around. New people tap **New player**; returning players
   sign in with their PIN.
3. That's it. Results fill in from ESPN as series end.

Forgot a PIN? **Admin → Players → reset** (the key icon). They choose a new PIN
the next time they sign in.

## Where things live

| What | Where |
|---|---|
| Database | `~/Library/Application Support/playoff-picks/playoff-picks.db` |
| Backups | `~/Backups/playoff-picks/` (`npm run db:backup`) |
| Logs | `~/Library/Logs/playoff-picks.log`, `playoff-picks-error.log` |
| Service | `~/Library/LaunchAgents/com.playoff-picks.plist` |

The database is outside the repo on purpose: every checkout and worktree uses
the same data, and a fresh clone can't lose it.

## Develop

```bash
npm run install-all
npm run dev          # API on 5174, Vite on 5173 (proxies /api)
```

`npm run dev` uses the real database. To work against throwaway data, put
`DATA_DIR=/tmp/pp-dev` in `server/.env` (and stop the production service first,
since both use port 5174).

Requires Node 22.13+ (uses the built-in `node:sqlite`, so there are no native
modules to rebuild after a Node upgrade).

See [docs/OPERATIONS.md](docs/OPERATIONS.md) for deploys, Tailscale and restores.
