import React, { useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { TEAMS, MATCHUPS, ROUNDS, teamsFor, seedOf } from "@shared/nba.js";
import { Badge, Button, Card, TeamLogo, cx, useUi } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { fmtAgo, fmtDateTime, fmtDay, useNow } from "../lib/util.js";

const SeriesCard = ({ m, season, myPicks }) => {
  const [openLog, setOpenLog] = useState(false);
  const { bracket, results, series } = season;
  const [a, b] = teamsFor(m.id, bracket, results);
  const s = series?.[m.id];
  const winner = results[m.id];
  const myPick = myPicks[m.id];
  const revealed = season.status !== "open";
  const pickedBy = (team) => season.entries.filter((e) => e.picks?.[m.id] === team).length;
  const totalPicks = season.entries.filter((e) => e.picks?.[m.id]).length;

  if (!a || !b) {
    const side = (id) => {
      const [x, y] = teamsFor(id, bracket, results);
      return x && y ? `${x}/${y} winner` : null;
    };
    const desc = m.round === 4
      ? "East champion vs West champion"
      : [side(m.from[0]), side(m.from[1])].every(Boolean) ? `${side(m.from[0])} vs ${side(m.from[1])}` : `${m.conf === "E" ? "East" : "West"} ${ROUNDS[m.round - 1].label.toLowerCase()}`;
    return (
      <Card className="p-3.5">
        <div className="text-xs text-faint">{desc}</div>
        <div className="text-sm text-muted mt-1">Waiting on the previous round</div>
      </Card>
    );
  }

  const live = s?.games?.some((g) => g.state === "in");
  const wins = s && s.teams[0] === a ? s.wins : s ? [s.wins[1], s.wins[0]] : [0, 0];

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-3.5 pt-3 pb-1">
        <span className="text-xs text-muted">{s?.summary || "Not started"}</span>
        <span className="flex items-center gap-1.5">
          {live && <Badge tone="live">Live</Badge>}
          {winner && <Badge tone="good">Final</Badge>}
        </span>
      </div>
      {[a, b].map((team, i) => {
        const lost = winner && winner !== team;
        return (
          <div key={team} className="flex items-center gap-2.5 px-3.5 h-11">
            <span className="text-[11px] text-faint tabular w-3.5 text-right">{seedOf(bracket, team)}</span>
            <TeamLogo team={team} size={26} className={lost ? "opacity-40" : ""} />
            <span className={cx("flex-1 min-w-0 truncate text-sm", lost ? "text-muted" : "font-semibold")}>{TEAMS[team].name}</span>
            {myPick === team && <Badge tone={winner ? (winner === team ? "good" : "bad") : "accent"}>Pick</Badge>}
            {revealed && totalPicks > 0 && <span className="text-[11px] text-faint tabular w-10 text-right" title="Players who picked them">{pickedBy(team)}/{totalPicks}</span>}
            <span className={cx("font-display text-2xl font-bold tabular w-6 text-right", lost ? "text-faint" : winner === team ? "text-good" : "")}>{wins[i]}</span>
          </div>
        );
      })}
      {s?.next && !winner && (
        <div className="px-3.5 pb-2 text-xs text-muted">Game {s.next.game}: {s.next.state === "in" ? s.next.detail : fmtDateTime(s.next.date)}</div>
      )}
      {s?.games?.length > 0 && (
        <>
          <button onClick={() => setOpenLog((v) => !v)} className="w-full flex items-center justify-center gap-1 h-9 border-t border-line text-xs font-medium text-muted hover:text-ink hover:bg-surface2">
            {openLog ? "Hide games" : `Game log (${s.games.length})`} <ChevronDown size={14} className={cx("transition-transform", openLog && "rotate-180")} />
          </button>
          {openLog && (
            <table className="w-full text-xs border-t border-line">
              <tbody>
                {s.games.map((g) => {
                  const awayWon = g.awayScore > g.homeScore;
                  return (
                    <tr key={g.id} className="border-b border-line last:border-0">
                      <td className="py-2 pl-3.5 text-muted">G{g.game}</td>
                      <td className="py-2 text-muted">{fmtDay(g.date)}</td>
                      <td className={cx("py-2 text-right", awayWon ? "font-semibold" : "text-muted")}>{g.awayTeam} {g.awayScore}</td>
                      <td className="py-2 text-center text-faint">@</td>
                      <td className={cx("py-2 pr-3.5", !awayWon ? "font-semibold" : "text-muted")}>{g.homeScore} {g.homeTeam}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </Card>
  );
};

export default function ScoresView({ season, me, myPicks, reload }) {
  const now = useNow(30000);
  const { toast } = useUi();
  const [syncing, setSyncing] = useState(false);

  const sync = async () => {
    setSyncing(true);
    try {
      const r = await api.admin.sync(season.year);
      await reload();
      toast(r.updated ? `Updated ${r.updated} series from ESPN` : "Already up to date");
    } catch (e) {
      toast(e.message, "bad");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Series</h1>
          <p className="text-xs text-muted">Results update from ESPN every 10 minutes during the playoffs · last update {fmtAgo(season.syncedAt, now)}</p>
        </div>
        {me.isAdmin && (
          <Button variant="secondary" size="sm" onClick={sync} disabled={syncing}>
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> Sync
          </Button>
        )}
      </div>
      {ROUNDS.map((r) => (
        <section key={r.round}>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2.5">{r.label}</h2>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {MATCHUPS.filter((m) => m.round === r.round).map((m) => <SeriesCard key={m.id} m={m} season={season} myPicks={myPicks} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
