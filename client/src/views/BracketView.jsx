import React from "react";
import { ArrowLeft, EyeOff, Lock } from "lucide-react";
import { TEAMS, TOTAL_PICKS, scoreEntry } from "@shared/nba.js";
import { FullBracket, RoundBracket } from "../components/Bracket.jsx";
import { Avatar, Card, EmptyState, ProgressBar, TeamLogo, Spinner } from "../components/ui.jsx";
import { fmtDateTime, go, ordinal } from "../lib/util.js";

const Stat = ({ label, children, sub }) => (
  <Card className="p-3.5">
    <div className="text-[11px] font-medium text-muted">{label}</div>
    <div className="mt-1 flex items-center gap-2 min-h-[32px]">{children}</div>
    {sub && <div className="mt-1 text-xs text-faint">{sub}</div>}
  </Card>
);

export const rankOf = (season, playerId) => {
  const scored = season.entries
    .filter((e) => e.picks)
    .map((e) => ({ id: e.playerId, ...scoreEntry(season.bracket, e.picks, season.results) }))
    .sort((a, b) => b.points - a.points || b.maxPoints - a.maxPoints);
  const me = scored.find((s) => s.id === playerId);
  if (!me) return null;
  return { rank: scored.filter((s) => s.points > me.points).length + 1, of: scored.length };
};

export default function BracketView({ season, me, picks, saveState, onPick, viewingId }) {
  const viewing = viewingId && viewingId !== me.id ? season.entries.find((e) => e.playerId === viewingId) : null;
  const isMine = !viewing;
  const open = season.status === "open";

  if (viewingId && viewingId !== me.id && (!viewing || !viewing.picks)) {
    return (
      <Card>
        <EmptyState icon={EyeOff} title="Bracket hidden" action={<button className="text-sm font-semibold text-accent" onClick={() => go({ year: season.year, tab: "standings" })}>Back to standings</button>}>
          Everyone's picks are revealed when picks lock{season.lockAt ? ` on ${fmtDateTime(season.lockAt)}` : ""}.
        </EmptyState>
      </Card>
    );
  }

  const shownPicks = isMine ? picks : viewing.picks;
  const count = Object.keys(shownPicks).length;
  const score = scoreEntry(season.bracket, shownPicks, season.results);
  const rank = rankOf(season, isMine ? me.id : viewing.playerId);
  const champ = shownPicks.FINALS;
  const canEdit = isMine && open;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {viewing && (
            <button onClick={() => go({ year: season.year, tab: "standings" })} className="p-1.5 -ml-1.5 rounded-md text-muted hover:text-ink hover:bg-surface2" aria-label="Back">
              <ArrowLeft size={18} />
            </button>
          )}
          <Avatar player={isMine ? me : { name: viewing.name, favTeam: viewing.favTeam }} size={36} />
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight truncate">{isMine ? "My bracket" : `${viewing.name}'s bracket`}</h1>
            <p className="text-xs text-muted">
              {canEdit
                ? <>Tap a team to advance it. Picks save automatically{season.lockAt ? ` and lock ${fmtDateTime(season.lockAt)}` : ""}.</>
                : <span className="inline-flex items-center gap-1"><Lock size={11} /> Picks are locked</span>}
            </p>
          </div>
        </div>
        {canEdit && saveState !== "idle" && (
          <div className="text-xs text-muted flex items-center gap-1.5 h-6">
            {saveState === "saving" && <><Spinner className="w-3 h-3" /> Saving…</>}
            {saveState === "saved" && "All changes saved"}
            {saveState === "error" && <span className="text-bad">Couldn't save. Retrying when you pick again.</span>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Picks made" sub={<ProgressBar value={count} max={TOTAL_PICKS} />}>
          <span className="text-2xl font-display font-bold tabular">{count}<span className="text-faint">/{TOTAL_PICKS}</span></span>
        </Stat>
        <Stat label="Champion pick">
          {champ ? <><TeamLogo team={champ} size={28} /><span className="text-sm font-semibold truncate">{TEAMS[champ].name}</span></> : <span className="text-sm text-faint">Not picked</span>}
        </Stat>
        <Stat label="Points" sub={season.status === "final" ? "Final" : season.status === "live" ? `${score.maxPoints} max possible` : "Scoring starts at tip-off"}>
          <span className="text-2xl font-display font-bold tabular">{score.points}</span>
          <span className="text-xs text-muted">{score.correct}/{score.decided} right</span>
        </Stat>
        <Stat label="Rank">
          {season.status !== "open" && rank
            ? <span className="text-2xl font-display font-bold">{ordinal(rank.rank)}<span className="text-sm font-sans font-normal text-muted ml-1">of {rank.of}</span></span>
            : <span className="text-sm text-faint">After picks lock</span>}
        </Stat>
      </div>

      <Card className="p-4 hidden lg:block">
        <FullBracket bracket={season.bracket} picks={shownPicks} results={season.results} onPick={canEdit ? onPick : null} />
      </Card>
      <div className="lg:hidden">
        <RoundBracket bracket={season.bracket} picks={shownPicks} results={season.results} series={season.series} onPick={canEdit ? onPick : null} />
      </div>
    </div>
  );
}
