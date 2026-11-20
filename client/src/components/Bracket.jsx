import React, { useMemo, useState } from "react";
import { Check, X, Trophy, ChevronRight } from "lucide-react";
import { TEAMS, MATCHUPS, MATCHUP_BY_ID, ROUNDS, teamsFor, seedOf, eliminatedTeams } from "@shared/nba.js";
import { TeamLogo, Segmented, Button, cx } from "./ui.jsx";

// How a team in a matchup box should look, given the viewer's picks and real results.
const rowState = ({ team, matchupId, picks, results, out }) => {
  if (!team) return { kind: "tbd" };
  const picked = picks[matchupId] === team;
  const result = results[matchupId];
  if (picked) {
    if (result) return { kind: result === team ? "won" : "lost", picked };
    if (out.has(team)) return { kind: "busted", picked };
    return { kind: "picked", picked };
  }
  if (result === team) return { kind: "winner" };
  return { kind: "idle" };
};

export const TeamRow = ({ team, seed, state, onClick, size = "md", points }) => {
  const t = TEAMS[team];
  const md = size === "md";
  if (state.kind === "tbd") {
    return (
      <div className={cx("flex items-center gap-2 px-2.5 text-faint", md ? "h-12" : "h-8")}>
        <span className={cx("rounded-full border border-dashed border-line", md ? "w-7 h-7" : "w-5 h-5")} />
        <span className="text-xs">TBD</span>
      </div>
    );
  }
  const strike = state.kind === "lost" || state.kind === "busted";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cx(
        "relative w-full flex items-center gap-2 px-2.5 text-left transition-colors",
        md ? "h-12" : "h-8",
        onClick && "hover:bg-surface2 cursor-pointer",
        state.kind === "picked" && "bg-accent/10",
        state.kind === "won" && "bg-good/10",
        strike && "bg-bad/5",
      )}
    >
      {state.picked && <span className={cx("absolute left-0 top-1 bottom-1 w-[3px] rounded-r", state.kind === "won" ? "bg-good" : strike ? "bg-bad" : "bg-accent")} />}
      <span className={cx("tabular text-[11px] w-3.5 text-right flex-shrink-0", state.picked ? "text-ink" : "text-faint")}>{seed}</span>
      <TeamLogo team={team} size={md ? 28 : 20} className={strike ? "opacity-50 grayscale" : ""} />
      <span className="min-w-0 flex-1">
        <span className={cx("block truncate", md ? "text-sm" : "text-[13px]", state.picked ? "font-semibold text-ink" : "font-medium text-muted", strike && "line-through decoration-bad/70 text-muted")}>
          {md && <span className="font-normal text-muted mr-1">{t.city}</span>}{t.name}
        </span>
      </span>
      {state.kind === "won" && <span className="flex items-center gap-0.5 text-good text-[11px] font-semibold">{md && points ? `+${points}` : ""}<Check size={14} /></span>}
      {strike && <X size={14} className="text-bad flex-shrink-0" />}
      {state.kind === "winner" && <Check size={14} className="text-faint flex-shrink-0" />}
    </Tag>
  );
};

const MatchupBox = ({ id, bracket, picks, results, out, onPick, size, className }) => {
  const m = MATCHUP_BY_ID[id];
  const [a, b] = teamsFor(id, bracket, picks);
  const needsPick = onPick && a && b && !picks[id];
  const row = (team) => (
    <TeamRow
      team={team} size={size} points={m.points}
      seed={team ? seedOf(bracket, team) : null}
      state={rowState({ team, matchupId: id, picks, results, out })}
      onClick={onPick && team && a && b ? () => onPick(id, team) : undefined}
    />
  );
  return (
    <div className={cx("bg-surface border rounded-lg overflow-hidden", needsPick ? "border-accent/50" : "border-line", id === "FINALS" && "ring-1 ring-warn/40", className)}>
      {row(a)}
      <div className="h-px bg-line" />
      {row(b)}
    </div>
  );
};

export const ChampionCard = ({ picks, results, compact = false }) => {
  const champ = picks.FINALS;
  const actual = results.FINALS;
  return (
    <div className={cx("rounded-xl border text-center", compact ? "p-3" : "p-4", champ ? "border-warn/40 bg-warn/5" : "border-dashed border-line")}>
      <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-warn">
        <Trophy size={12} /> Champion
      </div>
      {champ ? (
        <div className="mt-2 flex flex-col items-center">
          <TeamLogo team={champ} size={compact ? 36 : 48} />
          <div className="mt-1.5 text-sm font-semibold">{TEAMS[champ].name}</div>
          {actual && (
            <div className={cx("text-xs font-semibold mt-0.5", actual === champ ? "text-good" : "text-bad")}>
              {actual === champ ? "Called it" : `${TEAMS[actual].name} won`}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-2 text-xs text-muted">Pick a Finals winner</div>
      )}
    </div>
  );
};

// ---------- Desktop: the whole bracket on one screen ----------
const W = 154, G = 16, H = 67, HEADER = 28;
const TOPS = { 1: [0, 95, 190, 285], 2: [47.5, 237.5], 3: [142.5], 4: [142.5] };
const COLS = { E1: 0, E2: 0, E3: 0, E4: 0, ES1: 1, ES2: 1, ECF: 2, FINALS: 3, WCF: 4, WS1: 5, WS2: 5, W1: 6, W2: 6, W3: 6, W4: 6 };
const POS = Object.fromEntries(MATCHUPS.map((m) => {
  const idx = m.round === 1 || m.round === 2 ? Number(m.id.slice(-1)) - 1 : 0;
  return [m.id, { x: COLS[m.id] * (W + G), y: HEADER + TOPS[m.round][idx] }];
}));
const WIDTH = 7 * W + 6 * G;
const HEIGHT = HEADER + 285 + H;
const COL_LABELS = ["First Round", "Conf Semis", "Conf Finals", "NBA Finals", "Conf Finals", "Conf Semis", "First Round"];

const connector = (childId, parentId) => {
  const c = POS[childId], p = POS[parentId];
  const cy = c.y + H / 2, py = p.y + H / 2;
  if (c.x < p.x) {
    const x1 = c.x + W, mid = x1 + G / 2;
    return `M${x1} ${cy}H${mid}V${py}H${p.x}`;
  }
  const mid = c.x - G / 2;
  return `M${c.x} ${cy}H${mid}V${py}H${p.x + W}`;
};

export const FullBracket = ({ bracket, picks, results, onPick }) => {
  const out = useMemo(() => eliminatedTeams(bracket, results), [bracket, results]);
  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <div className="relative mx-auto" style={{ width: WIDTH, height: HEIGHT }}>
        {COL_LABELS.map((label, i) => (
          <div key={i} className={cx("absolute top-0 text-center text-[11px] font-semibold uppercase tracking-wider", i === 3 ? "text-warn" : "text-muted")} style={{ left: i * (W + G), width: W }}>
            {label}
          </div>
        ))}
        <svg className="absolute inset-0 pointer-events-none" width={WIDTH} height={HEIGHT}>
          {MATCHUPS.filter((m) => m.from).flatMap((m) => m.from.map((child) => (
            <path key={`${child}-${m.id}`} d={connector(child, m.id)} className="stroke-line" strokeWidth="1.5" fill="none" />
          )))}
        </svg>
        {MATCHUPS.map((m) => (
          <div key={m.id} className="absolute" style={{ left: POS[m.id].x, top: POS[m.id].y, width: W }}>
            <MatchupBox id={m.id} bracket={bracket} picks={picks} results={results} out={out} onPick={onPick} size="sm" />
          </div>
        ))}
        <div className="absolute" style={{ left: POS.FINALS.x, top: HEADER + 4, width: W }}>
          <ChampionCard picks={picks} results={results} compact />
        </div>
      </div>
      <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-faint mx-auto mt-2" style={{ width: WIDTH }}>
        <span>Eastern Conference</span>
        <span>Western Conference</span>
      </div>
    </div>
  );
};

// ---------- Phone/tablet: one round at a time ----------
export const RoundBracket = ({ bracket, picks, results, series, onPick }) => {
  const out = useMemo(() => eliminatedTeams(bracket, results), [bracket, results]);
  const firstOpen = ROUNDS.find((r) => MATCHUPS.some((m) => m.round === r.round && !picks[m.id]))?.round || 1;
  const [round, setRound] = useState(onPick ? firstOpen : 1);
  const inRound = MATCHUPS.filter((m) => m.round === round);
  const roundDone = inRound.every((m) => picks[m.id]);
  const next = ROUNDS[round];

  const group = (conf, label) => {
    const list = inRound.filter((m) => m.conf === conf);
    if (!list.length) return null;
    return (
      <section className="space-y-2.5">
        {label && <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</h3>}
        {list.map((m) => {
          const s = series?.[m.id];
          return (
            <div key={m.id}>
              <MatchupBox id={m.id} bracket={bracket} picks={picks} results={results} out={out} onPick={onPick} size="md" />
              {s && <div className="text-xs text-muted mt-1 px-1">{s.summary}</div>}
            </div>
          );
        })}
      </section>
    );
  };

  return (
    <div className="space-y-4">
      <Segmented
        className="w-full"
        value={round}
        onChange={setRound}
        options={ROUNDS.map((r) => ({ value: r.round, label: r.short }))}
      />
      <div className="text-xs text-muted">{ROUNDS[round - 1].label} · {ROUNDS[round - 1].points} {ROUNDS[round - 1].points === 1 ? "point" : "points"} per correct pick</div>
      {round === 4 ? (
        <div className="space-y-4">
          {group(null, null)}
          <ChampionCard picks={picks} results={results} />
        </div>
      ) : (
        <>
          {group("E", "East")}
          {group("W", "West")}
        </>
      )}
      {onPick && roundDone && next && (
        <Button variant="secondary" className="w-full" onClick={() => { setRound(next.round); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
          Next: {next.label} <ChevronRight size={16} />
        </Button>
      )}
    </div>
  );
};
