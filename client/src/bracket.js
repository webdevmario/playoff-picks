export const TEAMS = {
  DET: { id: "DET", name: "Pistons", city: "Detroit", seed: 1, conf: "E", color: "#C8102E", logo: "https://cdn.nba.com/logos/nba/1610612765/primary/L/logo.svg", logoAlt: "https://a.espncdn.com/i/teamlogos/nba/500/det.png" },
  ORL: { id: "ORL", name: "Magic", city: "Orlando", seed: 8, conf: "E", color: "#0077C0", logo: "https://cdn.nba.com/logos/nba/1610612753/primary/L/logo.svg", logoAlt: "https://a.espncdn.com/i/teamlogos/nba/500/orl.png" },
  CLE: { id: "CLE", name: "Cavaliers", city: "Cleveland", seed: 4, conf: "E", color: "#860038", logo: "https://cdn.nba.com/logos/nba/1610612739/primary/L/logo.svg", logoAlt: "https://a.espncdn.com/i/teamlogos/nba/500/cle.png" },
  TOR: { id: "TOR", name: "Raptors", city: "Toronto", seed: 5, conf: "E", color: "#CE1141", logo: "https://cdn.nba.com/logos/nba/1610612761/primary/L/logo.svg", logoAlt: "https://a.espncdn.com/i/teamlogos/nba/500/tor.png" },
  BOS: { id: "BOS", name: "Celtics", city: "Boston", seed: 2, conf: "E", color: "#007A33", logo: "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg", logoAlt: "https://a.espncdn.com/i/teamlogos/nba/500/bos.png" },
  PHI: { id: "PHI", name: "76ers", city: "Philadelphia", seed: 7, conf: "E", color: "#006BB6", logo: "https://cdn.nba.com/logos/nba/1610612755/primary/L/logo.svg", logoAlt: "https://a.espncdn.com/i/teamlogos/nba/500/phi.png" },
  NYK: { id: "NYK", name: "Knicks", city: "New York", seed: 3, conf: "E", color: "#F58426", logo: "https://cdn.nba.com/logos/nba/1610612752/primary/L/logo.svg", logoAlt: "https://a.espncdn.com/i/teamlogos/nba/500/ny.png" },
  ATL: { id: "ATL", name: "Hawks", city: "Atlanta", seed: 6, conf: "E", color: "#E03A3E", logo: "https://cdn.nba.com/logos/nba/1610612737/primary/L/logo.svg", logoAlt: "https://a.espncdn.com/i/teamlogos/nba/500/atl.png" },
  OKC: { id: "OKC", name: "Thunder", city: "Oklahoma City", seed: 1, conf: "W", color: "#007AC1", logo: "https://cdn.nba.com/logos/nba/1610612760/primary/L/logo.svg", logoAlt: "https://a.espncdn.com/i/teamlogos/nba/500/okc.png" },
  PHX: { id: "PHX", name: "Suns", city: "Phoenix", seed: 8, conf: "W", color: "#E56020", logo: "https://cdn.nba.com/logos/nba/1610612756/primary/L/logo.svg", logoAlt: "https://a.espncdn.com/i/teamlogos/nba/500/phx.png" },
  LAL: { id: "LAL", name: "Lakers", city: "Los Angeles", seed: 4, conf: "W", color: "#552583", logo: "https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg", logoAlt: "https://a.espncdn.com/i/teamlogos/nba/500/lal.png" },
  HOU: { id: "HOU", name: "Rockets", city: "Houston", seed: 5, conf: "W", color: "#CE1141", logo: "https://cdn.nba.com/logos/nba/1610612745/primary/L/logo.svg", logoAlt: "https://a.espncdn.com/i/teamlogos/nba/500/hou.png" },
  SAS: { id: "SAS", name: "Spurs", city: "San Antonio", seed: 2, conf: "W", color: "#8A8D8F", logo: "https://cdn.nba.com/logos/nba/1610612759/primary/L/logo.svg", logoAlt: "https://a.espncdn.com/i/teamlogos/nba/500/sa.png" },
  POR: { id: "POR", name: "Trail Blazers", city: "Portland", seed: 7, conf: "W", color: "#E03A3E", logo: "https://cdn.nba.com/logos/nba/1610612757/primary/L/logo.svg", logoAlt: "https://a.espncdn.com/i/teamlogos/nba/500/por.png" },
  DEN: { id: "DEN", name: "Nuggets", city: "Denver", seed: 3, conf: "W", color: "#FEC524", logo: "https://cdn.nba.com/logos/nba/1610612743/primary/L/logo.svg", logoAlt: "https://a.espncdn.com/i/teamlogos/nba/500/den.png" },
  MIN: { id: "MIN", name: "Timberwolves", city: "Minnesota", seed: 6, conf: "W", color: "#236192", logo: "https://cdn.nba.com/logos/nba/1610612750/primary/L/logo.svg", logoAlt: "https://a.espncdn.com/i/teamlogos/nba/500/min.png" },
};

export const AVATARS = ["🏀", "🏆", "🔥", "⚡", "🎯", "🐉", "👑", "🚀", "💎", "⭐", "🦁", "🦅", "🐺", "🎮", "🎱", "🧢", "🐶", "🐱", "🦊", "🐻", "🦄", "🐼", "🌈", "🍕"];

export const R1_MATCHUPS = [
  { id: "E1", conf: "E", a: "DET", b: "ORL", points: 1 },
  { id: "E2", conf: "E", a: "CLE", b: "TOR", points: 1 },
  { id: "E3", conf: "E", a: "BOS", b: "PHI", points: 1 },
  { id: "E4", conf: "E", a: "NYK", b: "ATL", points: 1 },
  { id: "W1", conf: "W", a: "OKC", b: "PHX", points: 1 },
  { id: "W2", conf: "W", a: "LAL", b: "HOU", points: 1 },
  { id: "W3", conf: "W", a: "SAS", b: "POR", points: 1 },
  { id: "W4", conf: "W", a: "DEN", b: "MIN", points: 1 },
];

export const SEMI_MATCHUPS = [
  { id: "ES1", conf: "E", sourceA: "E1", sourceB: "E2", points: 2 },
  { id: "ES2", conf: "E", sourceA: "E3", sourceB: "E4", points: 2 },
  { id: "WS1", conf: "W", sourceA: "W1", sourceB: "W2", points: 2 },
  { id: "WS2", conf: "W", sourceA: "W3", sourceB: "W4", points: 2 },
];

export const CF_MATCHUPS = [
  { id: "ECF", conf: "E", sourceA: "ES1", sourceB: "ES2", points: 4 },
  { id: "WCF", conf: "W", sourceA: "WS1", sourceB: "WS2", points: 4 },
];

export const FINALS_MATCHUP = { id: "FINALS", sourceA: "ECF", sourceB: "WCF", points: 8 };

export const ALL_MATCHUPS = [...R1_MATCHUPS, ...SEMI_MATCHUPS, ...CF_MATCHUPS, FINALS_MATCHUP];

export const getMatchupTeams = (matchup, picks) => {
  if (matchup.a && matchup.b) return [matchup.a, matchup.b];
  const a = picks[matchup.sourceA] || null;
  const b = picks[matchup.sourceB] || null;
  return [a, b];
};

export const calculateScore = (picks, results) => {
  let score = 0;
  let correct = 0;
  let totalDecided = 0;
  for (const m of ALL_MATCHUPS) {
    if (results[m.id]) {
      totalDecided++;
      if (picks[m.id] === results[m.id]) {
        score += m.points;
        correct++;
      }
    }
  }
  return { score, correct, totalDecided };
};

// Cascade-clear downstream picks if an earlier pick changes and invalidates them
export const cascadeInvalidate = (picksOrResults, changedId) => {
  const next = { ...picksOrResults };
  const invalidate = (mId) => {
    for (const m of ALL_MATCHUPS) {
      if (m.sourceA === mId || m.sourceB === mId) {
        const [newA, newB] = getMatchupTeams(m, next);
        if (next[m.id] && next[m.id] !== newA && next[m.id] !== newB) {
          delete next[m.id];
          invalidate(m.id);
        }
      }
    }
  };
  invalidate(changedId);
  return next;
};
