// Bracket rules shared by the server and the client.
// A season stores only its seeds (and the first-round pairings); everything
// else here is derived from that.

export const TEAMS = {
  // Eastern Conference
  ATL: { abbr: "ATL", city: "Atlanta", name: "Hawks", conf: "E", color: "#E03A3E", espn: "atl" },
  BOS: { abbr: "BOS", city: "Boston", name: "Celtics", conf: "E", color: "#007A33", espn: "bos" },
  BKN: { abbr: "BKN", city: "Brooklyn", name: "Nets", conf: "E", color: "#000000", espn: "bkn" },
  CHA: { abbr: "CHA", city: "Charlotte", name: "Hornets", conf: "E", color: "#1D1160", espn: "cha" },
  CHI: { abbr: "CHI", city: "Chicago", name: "Bulls", conf: "E", color: "#CE1141", espn: "chi" },
  CLE: { abbr: "CLE", city: "Cleveland", name: "Cavaliers", conf: "E", color: "#860038", espn: "cle" },
  DET: { abbr: "DET", city: "Detroit", name: "Pistons", conf: "E", color: "#C8102E", espn: "det" },
  IND: { abbr: "IND", city: "Indiana", name: "Pacers", conf: "E", color: "#002D62", espn: "ind" },
  MIA: { abbr: "MIA", city: "Miami", name: "Heat", conf: "E", color: "#98002E", espn: "mia" },
  MIL: { abbr: "MIL", city: "Milwaukee", name: "Bucks", conf: "E", color: "#00471B", espn: "mil" },
  NYK: { abbr: "NYK", city: "New York", name: "Knicks", conf: "E", color: "#F58426", espn: "ny" },
  ORL: { abbr: "ORL", city: "Orlando", name: "Magic", conf: "E", color: "#0077C0", espn: "orl" },
  PHI: { abbr: "PHI", city: "Philadelphia", name: "76ers", conf: "E", color: "#006BB6", espn: "phi" },
  TOR: { abbr: "TOR", city: "Toronto", name: "Raptors", conf: "E", color: "#CE1141", espn: "tor" },
  WAS: { abbr: "WAS", city: "Washington", name: "Wizards", conf: "E", color: "#002B5C", espn: "wsh" },
  // Western Conference
  DAL: { abbr: "DAL", city: "Dallas", name: "Mavericks", conf: "W", color: "#00538C", espn: "dal" },
  DEN: { abbr: "DEN", city: "Denver", name: "Nuggets", conf: "W", color: "#0E2240", espn: "den" },
  GSW: { abbr: "GSW", city: "Golden State", name: "Warriors", conf: "W", color: "#1D428A", espn: "gs" },
  HOU: { abbr: "HOU", city: "Houston", name: "Rockets", conf: "W", color: "#CE1141", espn: "hou" },
  LAC: { abbr: "LAC", city: "LA", name: "Clippers", conf: "W", color: "#C8102E", espn: "lac" },
  LAL: { abbr: "LAL", city: "Los Angeles", name: "Lakers", conf: "W", color: "#552583", espn: "lal" },
  MEM: { abbr: "MEM", city: "Memphis", name: "Grizzlies", conf: "W", color: "#5D76A9", espn: "mem" },
  MIN: { abbr: "MIN", city: "Minnesota", name: "Timberwolves", conf: "W", color: "#236192", espn: "min" },
  NOP: { abbr: "NOP", city: "New Orleans", name: "Pelicans", conf: "W", color: "#0C2340", espn: "no" },
  OKC: { abbr: "OKC", city: "Oklahoma City", name: "Thunder", conf: "W", color: "#007AC1", espn: "okc" },
  PHX: { abbr: "PHX", city: "Phoenix", name: "Suns", conf: "W", color: "#E56020", espn: "phx" },
  POR: { abbr: "POR", city: "Portland", name: "Trail Blazers", conf: "W", color: "#E03A3E", espn: "por" },
  SAC: { abbr: "SAC", city: "Sacramento", name: "Kings", conf: "W", color: "#5A2D81", espn: "sac" },
  SAS: { abbr: "SAS", city: "San Antonio", name: "Spurs", conf: "W", color: "#8A8D8F", espn: "sa" },
  UTA: { abbr: "UTA", city: "Utah", name: "Jazz", conf: "W", color: "#002B5C", espn: "utah" },
};

export const teamLogo = (abbr) => (TEAMS[abbr] ? `https://a.espncdn.com/i/teamlogos/nba/500/${TEAMS[abbr].espn}.png` : null);

// ESPN's scoreboard abbreviations -> ours
const ESPN_TO_ABBR = Object.fromEntries(Object.values(TEAMS).map((t) => [t.espn.toUpperCase(), t.abbr]));
export const fromEspnAbbr = (a) => (a ? TEAMS[a.toUpperCase()]?.abbr || ESPN_TO_ABBR[a.toUpperCase()] || null : null);

export const ROUNDS = [
  { round: 1, label: "First Round", short: "Round 1", points: 1 },
  { round: 2, label: "Conference Semifinals", short: "Semis", points: 2 },
  { round: 3, label: "Conference Finals", short: "Conf Finals", points: 4 },
  { round: 4, label: "NBA Finals", short: "Finals", points: 8 },
];
export const MAX_POINTS = 8 * 1 + 4 * 2 + 2 * 4 + 8; // 32

// Fixed matchup ids. First-round teams come from the season's bracket.
export const MATCHUPS = [
  { id: "E1", round: 1, conf: "E" }, { id: "E2", round: 1, conf: "E" },
  { id: "E3", round: 1, conf: "E" }, { id: "E4", round: 1, conf: "E" },
  { id: "W1", round: 1, conf: "W" }, { id: "W2", round: 1, conf: "W" },
  { id: "W3", round: 1, conf: "W" }, { id: "W4", round: 1, conf: "W" },
  { id: "ES1", round: 2, conf: "E", from: ["E1", "E2"] }, { id: "ES2", round: 2, conf: "E", from: ["E3", "E4"] },
  { id: "WS1", round: 2, conf: "W", from: ["W1", "W2"] }, { id: "WS2", round: 2, conf: "W", from: ["W3", "W4"] },
  { id: "ECF", round: 3, conf: "E", from: ["ES1", "ES2"] },
  { id: "WCF", round: 3, conf: "W", from: ["WS1", "WS2"] },
  { id: "FINALS", round: 4, conf: null, from: ["ECF", "WCF"] },
].map((m) => ({ ...m, points: ROUNDS[m.round - 1].points }));

export const MATCHUP_BY_ID = Object.fromEntries(MATCHUPS.map((m) => [m.id, m]));
export const TOTAL_PICKS = MATCHUPS.length; // 15

// Standard NBA first-round pairings by seed index (0 = 1 seed):
// top half 1v8 and 4v5, bottom half 3v6 and 2v7.
const STANDARD_PAIRS = [[0, 7], [3, 4], [2, 5], [1, 6]];

export const bracketFromSeeds = (seeds) => {
  const r1 = {};
  for (const conf of ["E", "W"]) {
    STANDARD_PAIRS.forEach(([hi, lo], i) => { r1[`${conf}${i + 1}`] = [seeds[conf][hi], seeds[conf][lo]]; });
  }
  return { seeds, r1 };
};

export const seedOf = (bracket, abbr) => {
  if (!bracket) return null;
  for (const conf of ["E", "W"]) {
    const i = bracket.seeds?.[conf]?.indexOf(abbr);
    if (i >= 0) return i + 1;
  }
  return null;
};

export const validateSeeds = (seeds) => {
  if (!seeds || typeof seeds !== "object") return "Seeds are required";
  const seen = new Set();
  for (const conf of ["E", "W"]) {
    const list = seeds[conf];
    if (!Array.isArray(list) || list.length !== 8) return `Pick all 8 ${conf === "E" ? "East" : "West"} seeds`;
    for (const abbr of list) {
      if (!TEAMS[abbr]) return `Unknown team: ${abbr}`;
      if (TEAMS[abbr].conf !== conf) return `${abbr} isn't in the ${conf === "E" ? "East" : "West"}`;
      if (seen.has(abbr)) return `${abbr} is seeded twice`;
      seen.add(abbr);
    }
  }
  return null;
};

// The two teams in a matchup, given picks (for a bracket) or results (for reality).
export const teamsFor = (matchupId, bracket, chosen) => {
  const m = MATCHUP_BY_ID[matchupId];
  if (!m || !bracket) return [null, null];
  if (m.round === 1) return bracket.r1[m.id] || [null, null];
  return [chosen[m.from[0]] || null, chosen[m.from[1]] || null];
};

// Drop any pick that isn't one of the two teams it could be (walks rounds in order).
export const sanitize = (bracket, chosen) => {
  const out = {};
  for (const m of MATCHUPS) {
    const pick = chosen?.[m.id];
    if (!pick) continue;
    const [a, b] = teamsFor(m.id, bracket, out);
    if (pick === a || pick === b) out[m.id] = pick;
  }
  return out;
};

export const eliminatedTeams = (bracket, results) => {
  const out = new Set();
  for (const m of MATCHUPS) {
    const w = results[m.id];
    if (!w) continue;
    const [a, b] = teamsFor(m.id, bracket, results);
    if (a && a !== w) out.add(a);
    if (b && b !== w) out.add(b);
  }
  return out;
};

export const scoreEntry = (bracket, picks = {}, results = {}) => {
  const out = eliminatedTeams(bracket, results);
  let points = 0, correct = 0, decided = 0, remaining = 0;
  for (const m of MATCHUPS) {
    const pick = picks[m.id];
    const result = results[m.id];
    if (result) {
      decided++;
      if (pick === result) { points += m.points; correct++; }
    } else if (pick && !out.has(pick)) {
      remaining += m.points;
    }
  }
  return { points, correct, decided, maxPoints: points + remaining };
};

// "setup" (no bracket yet) → "open" (taking picks) → "live" (locked, games on) → "final"
export const seasonStatus = (season, results, now = Date.now()) => {
  if (!season?.bracket) return "setup";
  if (results?.FINALS) return "final";
  if (season.lockAt && now >= season.lockAt) return "live";
  return "open";
};

export const pickState = (bracket, picks, results, matchupId, team) => {
  // How a picked team in a matchup is doing: "won" | "lost" | "busted" | "pending"
  if (!team || picks[matchupId] !== team) return null;
  const result = results[matchupId];
  if (result) return result === team ? "won" : "lost";
  if (eliminatedTeams(bracket, results).has(team)) return "busted";
  return "pending";
};
