import React from "react";
import { ChevronRight, Users, Check } from "lucide-react";
import { TEAMS, TOTAL_PICKS, ROUNDS, MAX_POINTS, scoreEntry } from "@shared/nba.js";
import { Avatar, Badge, Card, CardHeader, EmptyState, TeamLogo, cx } from "../components/ui.jsx";
import { fmtAgo, fmtDateTime, go, useNow } from "../lib/util.js";

const RankCell = ({ rank }) => (
  <span className={cx(
    "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold tabular",
    rank === 1 ? "bg-warn text-black" : rank === 2 ? "bg-faint/40 text-ink" : rank === 3 ? "bg-accent/20 text-accent" : "text-muted"
  )}>{rank}</span>
);

export default function StandingsView({ season, me }) {
  const now = useNow(60000);
  const revealed = season.status !== "open";
  const rows = season.entries
    .map((e) => ({ ...e, ...(e.picks ? scoreEntry(season.bracket, e.picks, season.results) : { points: 0, correct: 0, decided: 0, maxPoints: 0 }) }))
    .sort((a, b) => revealed ? (b.points - a.points || b.maxPoints - a.maxPoints || a.name.localeCompare(b.name)) : a.name.localeCompare(b.name));
  // Ties share a rank.
  rows.forEach((r, i) => { r.rank = i > 0 && rows[i - 1].points === r.points ? rows[i - 1].rank : i + 1; });

  const champCounts = {};
  if (revealed) for (const r of rows) if (r.picks?.FINALS) champCounts[r.picks.FINALS] = (champCounts[r.picks.FINALS] || 0) + 1;
  const champList = Object.entries(champCounts).sort((a, b) => b[1] - a[1]);

  const openRow = (r) => (r.picks ? go({ year: season.year, tab: "bracket", playerId: r.playerId === me.id ? null : r.playerId }) : null);

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
      <Card>
        <CardHeader
          title="Standings"
          subtitle={revealed
            ? `${rows.length} ${rows.length === 1 ? "bracket" : "brackets"} · ${Object.keys(season.results).length} of 15 series decided`
            : `Brackets are hidden until picks lock${season.lockAt ? ` ${fmtDateTime(season.lockAt)}` : ""}`}
        />
        {rows.length === 0 ? (
          <EmptyState icon={Users} title="No brackets yet">Be the first to fill one out.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-line text-[11px] uppercase tracking-wider text-muted">
                {revealed && <th className="w-12 py-2 pl-4 text-left font-semibold">#</th>}
                <th className={cx("py-2 text-left font-semibold", !revealed && "pl-4")}>Player</th>
                {revealed ? <>
                  <th className="py-2 text-left font-semibold">Champ</th>
                  <th className="py-2 text-right font-semibold hidden sm:table-cell">Correct</th>
                  <th className="py-2 text-right font-semibold hidden sm:table-cell" title="Points still possible">Max</th>
                  <th className="py-2 pr-2 text-right font-semibold">Pts</th>
                </> : <>
                  <th className="py-2 text-left font-semibold">Picks</th>
                  <th className="py-2 pr-2 text-right font-semibold hidden sm:table-cell">Updated</th>
                </>}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isMe = r.playerId === me.id;
                const clickable = !!r.picks;
                return (
                  <tr
                    key={r.playerId}
                    onClick={() => openRow(r)}
                    className={cx("border-b border-line last:border-0", isMe && "bg-accent/5", clickable && "cursor-pointer hover:bg-surface2")}
                  >
                    {revealed && <td className="py-2.5 pl-4"><RankCell rank={r.rank} /></td>}
                    <td className={cx("py-2.5", !revealed && "pl-4")}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar player={{ name: r.name, favTeam: r.favTeam }} size={28} />
                        <span className="font-semibold truncate">{r.name}</span>
                        {isMe && <Badge tone="accent">You</Badge>}
                      </div>
                    </td>
                    {revealed ? <>
                      <td className="py-2.5">{r.picks?.FINALS ? <TeamLogo team={r.picks.FINALS} size={24} className={season.results.FINALS && season.results.FINALS !== r.picks.FINALS ? "opacity-40 grayscale" : ""} /> : <span className="text-faint">–</span>}</td>
                      <td className="py-2.5 text-right tabular text-muted hidden sm:table-cell">{r.correct}/{r.decided}</td>
                      <td className="py-2.5 text-right tabular text-muted hidden sm:table-cell">{r.maxPoints}</td>
                      <td className="py-2.5 pr-2 text-right"><span className="font-display text-xl font-bold tabular">{r.points}</span></td>
                    </> : <>
                      <td className="py-2.5">
                        {r.pickCount === TOTAL_PICKS
                          ? <Badge tone="good"><Check size={11} /> Complete</Badge>
                          : <span className="text-muted tabular">{r.pickCount}/{TOTAL_PICKS}</span>}
                      </td>
                      <td className="py-2.5 pr-2 text-right text-xs text-muted hidden sm:table-cell">{fmtAgo(r.updatedAt, now)}</td>
                    </>}
                    <td className="pr-3 text-right">{clickable && <ChevronRight size={16} className="text-faint inline" />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <div className="space-y-4">
        {revealed && champList.length > 0 && (
          <Card>
            <CardHeader title="Champion picks" subtitle="Who the group has winning it all" />
            <div className="px-4 pb-4 space-y-2.5">
              {champList.map(([team, n]) => (
                <div key={team} className="flex items-center gap-2.5">
                  <TeamLogo team={team} size={24} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold">{TEAMS[team].name}</span>
                      <span className="text-muted tabular">{n} of {rows.length}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(n / rows.length) * 100}%`, backgroundColor: TEAMS[team].color }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
        <Card>
          <CardHeader title="Scoring" subtitle="Points double each round" />
          <dl className="px-4 pb-4 text-sm space-y-1.5">
            {ROUNDS.map((r) => (
              <div key={r.round} className="flex justify-between">
                <dt className="text-muted">{r.label}</dt>
                <dd className="font-semibold tabular">{r.points} {r.points === 1 ? "pt" : "pts"}</dd>
              </div>
            ))}
            <div className="flex justify-between pt-2 mt-2 border-t border-line">
              <dt className="font-semibold">Perfect bracket</dt>
              <dd className="font-bold tabular text-accent">{MAX_POINTS} pts</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
