import { MATCHUPS, teamsFor, fromEspnAbbr } from "../../shared/nba.js";

const SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";

// Past days whose games are all final never change, so keep them per process.
const dayCache = new Map(); // "YYYYMMDD" -> games[]

const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");

const parseEvent = (event) => {
  if (event.season?.slug !== "post-season") return null;
  const comp = event.competitions?.[0];
  if (!comp || comp.series?.type !== "playoff") return null;
  const home = comp.competitors?.find((c) => c.homeAway === "home");
  const away = comp.competitors?.find((c) => c.homeAway === "away");
  const homeTeam = fromEspnAbbr(home?.team?.abbreviation);
  const awayTeam = fromEspnAbbr(away?.team?.abbreviation);
  if (!homeTeam || !awayTeam) return null;
  const state = comp.status?.type?.state; // pre | in | post
  const completed = !!comp.status?.type?.completed;
  const homeScore = Number(home.score || 0);
  const awayScore = Number(away.score || 0);
  return {
    id: event.id,
    date: event.date,
    homeTeam, awayTeam,
    homeScore: state === "pre" ? null : homeScore,
    awayScore: state === "pre" ? null : awayScore,
    state, completed,
    detail: comp.status?.type?.shortDetail || "",
    winner: completed ? (homeScore > awayScore ? homeTeam : awayTeam) : null,
  };
};

const fetchDay = async (day) => {
  if (dayCache.has(day)) return dayCache.get(day);
  const res = await fetch(`${SCOREBOARD}?dates=${day}`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  const data = await res.json();
  const games = (data.events || []).map(parseEvent).filter(Boolean);
  const isPast = day < ymd(new Date(Date.now() - 36 * 3600 * 1000));
  if (isPast && games.every((g) => g.completed)) dayCache.set(day, games);
  return games;
};

// The playoffs run mid-April to late June.
export const inPlayoffWindow = (year, now = new Date()) =>
  now >= new Date(Date.UTC(year, 3, 10)) && now <= new Date(Date.UTC(year, 5, 30));

const summarize = (a, b, winsA, winsB) => {
  if (winsA === 4) return `${a} wins ${winsA}-${winsB}`;
  if (winsB === 4) return `${b} wins ${winsB}-${winsA}`;
  if (winsA === winsB) return winsA === 0 ? "Series starts soon" : `Series tied ${winsA}-${winsB}`;
  return winsA > winsB ? `${a} leads ${winsA}-${winsB}` : `${b} leads ${winsB}-${winsA}`;
};

/**
 * Pull every playoff game for a season and work out each series.
 * `manual` results (set by an admin) win over ESPN when they disagree.
 * Returns { winners: {matchupId: team}, series: {matchupId: {...}} }.
 */
export const fetchSeason = async (year, bracket, manual = {}) => {
  const start = new Date(Date.UTC(year, 3, 10));
  const end = new Date(Math.min(Date.now() + 7 * 86400000, Date.UTC(year, 5, 30)));
  const days = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) days.push(ymd(d));

  const games = [];
  for (let i = 0; i < days.length; i += 8) {
    const batch = await Promise.all(days.slice(i, i + 8).map((day) => fetchDay(day).catch(() => [])));
    batch.forEach((g) => games.push(...g));
  }

  // Walk rounds in order so later rounds know who advanced.
  const winners = {};
  const series = {};
  const known = { ...manual };
  for (const m of MATCHUPS) {
    const [a, b] = teamsFor(m.id, bracket, known);
    if (!a || !b) continue;
    const pair = new Set([a, b]);
    const list = games
      .filter((g) => pair.has(g.homeTeam) && pair.has(g.awayTeam))
      .sort((x, y) => new Date(x.date) - new Date(y.date))
      .map((g, i) => ({ ...g, game: i + 1 }));
    if (list.length === 0) continue;
    const winsA = list.filter((g) => g.winner === a).length;
    const winsB = list.filter((g) => g.winner === b).length;
    const next = list.find((g) => !g.completed) || null;
    series[m.id] = {
      teams: [a, b], wins: [winsA, winsB],
      summary: summarize(a, b, winsA, winsB),
      games: list.filter((g) => g.completed || g.state === "in"),
      next: next && { date: next.date, detail: next.detail, state: next.state, game: next.game },
    };
    const espnWinner = winsA === 4 ? a : winsB === 4 ? b : null;
    if (espnWinner) winners[m.id] = espnWinner;
    if (!known[m.id] && espnWinner) known[m.id] = espnWinner;
  }
  return { winners, series };
};
