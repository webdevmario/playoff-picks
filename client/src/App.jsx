import React, { useState, useEffect, useCallback } from "react";
import { Lock, Trophy, RefreshCw, LogOut, Check, Edit3, Award, Copy, Download, X, Plus, ArrowRight, Shield, Info } from "lucide-react";
import {
  TEAMS, AVATARS,
  R1_MATCHUPS, SEMI_MATCHUPS, CF_MATCHUPS, FINALS_MATCHUP, ALL_MATCHUPS,
  getMatchupTeams, calculateScore, cascadeInvalidate,
} from "./bracket.js";
import { api, setAdminToken, getAdminToken } from "./api.js";

const CURRENT_USER_ID_KEY = "current_user_id";
const KNOWN_USERS_KEY = "known_user_ids";

const getKnownUsers = () => {
  try { return JSON.parse(localStorage.getItem(KNOWN_USERS_KEY) || "[]"); } catch { return []; }
};
const addKnownUser = (id, name, avatar) => {
  const known = getKnownUsers().filter((u) => u.id !== id);
  known.unshift({ id, name, avatar });
  localStorage.setItem(KNOWN_USERS_KEY, JSON.stringify(known));
};
const removeKnownUser = (id) => {
  const known = getKnownUsers().filter((u) => u.id !== id);
  localStorage.setItem(KNOWN_USERS_KEY, JSON.stringify(known));
};

// ============================================================
// Shared UI components
// ============================================================
const TeamLogo = ({ teamId, size = 40 }) => {
  const team = TEAMS[teamId];
  const [sourceIdx, setSourceIdx] = useState(0);
  if (!team) return <div style={{ width: size, height: size }} className="bg-zinc-800 rounded-full flex items-center justify-center text-zinc-500 text-xs font-bold">?</div>;
  const sources = [team.logo, team.logoAlt].filter(Boolean);
  if (sourceIdx >= sources.length) {
    return (
      <div style={{ width: size, height: size, backgroundColor: team.color }} className="rounded-full flex items-center justify-center text-white font-black tracking-tight">
        <span style={{ fontSize: Math.max(8, Math.round(size * 0.32)) }}>{team.id}</span>
      </div>
    );
  }
  return (
    <img key={sourceIdx} src={sources[sourceIdx]} alt={team.name} width={size} height={size} onError={() => setSourceIdx((i) => i + 1)} style={{ width: size, height: size, objectFit: "contain" }} />
  );
};

const TeamButton = ({ teamId, isPicked, isCorrect, isWrong, isActualWinner, disabled, onClick, compact = false }) => {
  const team = TEAMS[teamId];
  if (!teamId) {
    return (
      <div className={`flex items-center gap-2 ${compact ? "p-1.5" : "p-2"} rounded-lg bg-zinc-900/60 border border-zinc-800 border-dashed`}>
        <div className={`${compact ? "w-7 h-7" : "w-9 h-9"} rounded-full bg-zinc-800`} />
        <div className="flex-1"><div className="text-xs text-zinc-600 font-medium italic">TBD</div></div>
      </div>
    );
  }
  const borderClass = isPicked
    ? isCorrect ? "border-emerald-500 bg-emerald-500/10"
    : isWrong ? "border-red-500/60 bg-red-500/5 opacity-60"
    : "border-orange-400"
    : "border-zinc-800 hover:border-zinc-700";
  const style = isPicked && !isCorrect && !isWrong ? { borderColor: team.color, backgroundColor: `${team.color}15` } : {};
  return (
    <button
      onClick={onClick} disabled={disabled} style={style}
      className={`w-full flex items-center gap-2 ${compact ? "p-1.5" : "p-2.5"} rounded-lg bg-zinc-900/80 border-2 transition-all ${borderClass} ${disabled ? "cursor-default" : "active:scale-[0.98] cursor-pointer"} ${isActualWinner && !isPicked ? "ring-1 ring-amber-400/40" : ""}`}
    >
      <TeamLogo teamId={teamId} size={compact ? 28 : 36} />
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-zinc-500 tabular-nums">{team.seed}</span>
          <span className={`${compact ? "text-xs" : "text-sm"} font-bold text-white truncate`}>{team.name}</span>
        </div>
        {!compact && <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{team.city}</div>}
      </div>
      {isCorrect && <Check size={16} className="text-emerald-400 flex-shrink-0" />}
      {isActualWinner && !isPicked && <Trophy size={14} className="text-amber-400 flex-shrink-0" />}
    </button>
  );
};

const MatchupCard = ({ matchup, picks, results, onPick, locked }) => {
  const [teamA, teamB] = getMatchupTeams(matchup, picks);
  const pickedId = picks[matchup.id];
  const resultId = results[matchup.id];
  const hasResult = !!resultId;
  const getState = (teamId) => {
    if (!teamId) return {};
    const isPicked = pickedId === teamId;
    const isActualWinner = resultId === teamId;
    return { isPicked, isCorrect: isPicked && hasResult && isActualWinner, isWrong: isPicked && hasResult && !isActualWinner, isActualWinner };
  };
  const canPick = teamA && teamB && !locked;
  return (
    <div className="p-2.5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-1.5">
      <TeamButton teamId={teamA} {...getState(teamA)} disabled={!canPick || !teamA} onClick={() => canPick && teamA && onPick(matchup.id, teamA)} compact />
      <div className="flex items-center gap-2 px-1">
        <div className="flex-1 h-px bg-zinc-800" />
        <span className="text-[9px] text-zinc-600 font-bold tracking-wider">VS</span>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>
      <TeamButton teamId={teamB} {...getState(teamB)} disabled={!canPick || !teamB} onClick={() => canPick && teamB && onPick(matchup.id, teamB)} compact />
    </div>
  );
};

// ============================================================
// Main App
// ============================================================
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [picks, setPicks] = useState({});
  const [locked, setLocked] = useState(false);
  const [results, setResults] = useState({});
  const [allEntries, setAllEntries] = useState([]);
  const [tab, setTab] = useState("picks");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [adminStatus, setAdminStatus] = useState({ requiresPassword: false, authed: true });
  const [showProfile, setShowProfile] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [connErr, setConnErr] = useState(null);
  const [seriesStatus, setSeriesStatus] = useState({});

  // ----- bootstrap -----
  useEffect(() => {
    (async () => {
      try {
        const status = await api.adminStatus();
        setAdminStatus(status);
        await refreshAll();
        const uid = localStorage.getItem(CURRENT_USER_ID_KEY);
        if (uid) {
          try {
            const user = await api.getUser(uid);
            setCurrentUser({ id: user.id, name: user.name, avatar: user.avatar });
            setPicks(user.picks || {});
            setLocked(!!user.locked);
            addKnownUser(user.id, user.name, user.avatar);
          } catch (e) {
            localStorage.removeItem(CURRENT_USER_ID_KEY);
          }
        }
      } catch (e) {
        setConnErr(e.message || "Can't reach server");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      const [res, entries, status] = await Promise.all([api.getResults(), api.listEntries(), api.seriesStatus().catch(() => ({}))]);
      setResults(res);
      setAllEntries(entries);
      setSeriesStatus(status);
      setConnErr(null);
    } catch (e) {
      setConnErr(e.message || "Can't reach server");
    }
  }, []);

  // poll every 15s for shared state
  useEffect(() => {
    const interval = setInterval(refreshAll, 15000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  const signUp = async (name, avatar) => {
    try {
      const user = await api.createUser(name, avatar);
      setCurrentUser({ id: user.id, name: user.name, avatar: user.avatar });
      setPicks(user.picks || {});
      setLocked(!!user.locked);
      localStorage.setItem(CURRENT_USER_ID_KEY, user.id);
      addKnownUser(user.id, user.name, user.avatar);
      refreshAll();
    } catch (e) {
      setDialog({ title: "Couldn't create bracket", message: e.message, confirmLabel: "OK", onConfirm: () => setDialog(null) });
    }
  };

  const switchToUser = async (userId) => {
    try {
      const user = await api.getUser(userId);
      setCurrentUser({ id: user.id, name: user.name, avatar: user.avatar });
      setPicks(user.picks || {});
      setLocked(!!user.locked);
      localStorage.setItem(CURRENT_USER_ID_KEY, user.id);
      addKnownUser(user.id, user.name, user.avatar);
      refreshAll();
    } catch (e) {
      removeKnownUser(userId);
      setDialog({ title: "Profile not found", message: "That profile no longer exists on the server.", confirmLabel: "OK", onConfirm: () => setDialog(null) });
    }
  };

  const updateProfile = async (name, avatar) => {
    if (!currentUser) return;
    try {
      const updated = await api.updateUser(currentUser.id, { name, avatar });
      setCurrentUser({ id: updated.id, name: updated.name, avatar: updated.avatar });
      addKnownUser(updated.id, updated.name, updated.avatar);
      refreshAll();
    } catch (e) {
      setDialog({ title: "Couldn't save", message: e.message, confirmLabel: "OK", onConfirm: () => setDialog(null) });
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setPicks({});
    setLocked(false);
    localStorage.removeItem(CURRENT_USER_ID_KEY);
  };

  const saveToStorage = async (nextPicks) => {
    if (!currentUser) return;
    setSaving(true);
    try {
      await api.updatePicks(currentUser.id, nextPicks);
      refreshAll();
    } catch (e) {
      setDialog({ title: "Couldn't save picks", message: e.message, confirmLabel: "OK", onConfirm: () => setDialog(null) });
    } finally {
      setSaving(false);
    }
  };

  const onPick = (matchupId, teamId) => {
    if (locked) return;
    const next = cascadeInvalidate({ ...picks, [matchupId]: teamId }, matchupId);
    setPicks(next);
    saveToStorage(next);
  };

  const onLock = async () => {
    const r1Count = R1_MATCHUPS.filter((m) => picks[m.id]).length;
    if (r1Count < 8) {
      setDialog({ title: "Not so fast", message: `You need all 8 first round picks before locking. You've made ${r1Count}/8.`, confirmLabel: "OK", onConfirm: () => setDialog(null) });
      return;
    }
    const semiCount = SEMI_MATCHUPS.filter((m) => picks[m.id]).length;
    const cfCount = CF_MATCHUPS.filter((m) => picks[m.id]).length;
    const finalsPick = picks["FINALS"];

    const doLock = async () => {
      setDialog(null);
      try {
        await api.lockPicks(currentUser.id);
        setLocked(true);
        refreshAll();
        setDialog({ title: "Locked in!", message: "Your bracket is official. Check the Bracket tab to see your full prediction. Good luck!", confirmLabel: "Let's go", variant: "success", icon: "lock", onConfirm: () => setDialog(null) });
      } catch (e) {
        setDialog({ title: "Couldn't lock", message: e.message, confirmLabel: "OK", onConfirm: () => setDialog(null) });
      }
    };

    if (semiCount < 4 || cfCount < 2 || !finalsPick) {
      setDialog({ title: "Later rounds incomplete", message: "Some Semis, Conference Finals, or the Finals pick are missing. If you lock now, you can't earn those points.", confirmLabel: "Lock anyway", cancelLabel: "Keep picking", onConfirm: doLock, onCancel: () => setDialog(null) });
    } else {
      setDialog({ title: "Lock in your bracket?", message: "After this, your picks are final. You can't change them once they're locked.", confirmLabel: "Lock it in", cancelLabel: "Wait", onConfirm: doLock, onCancel: () => setDialog(null) });
    }
  };

  const setOfficialResult = async (matchupId, teamId) => {
    try {
      await api.setResult(matchupId, teamId);
      const next = cascadeInvalidate(teamId === null ? Object.fromEntries(Object.entries(results).filter(([k]) => k !== matchupId)) : { ...results, [matchupId]: teamId }, matchupId);
      setResults(next);
      refreshAll();
    } catch (e) {
      if (e.message.includes("Admin")) {
        setShowAdminLogin(true);
      } else {
        setDialog({ title: "Couldn't update", message: e.message, confirmLabel: "OK", onConfirm: () => setDialog(null) });
      }
    }
  };

  const toggleAdmin = async () => {
    if (adminMode) {
      setAdminMode(false);
      return;
    }
    if (adminStatus.requiresPassword && !getAdminToken()) {
      setShowAdminLogin(true);
      return;
    }
    setAdminMode(true);
  };

  const doAdminLogin = async (password) => {
    try {
      const res = await api.adminLogin(password);
      if (res.token) setAdminToken(res.token);
      setAdminStatus({ ...adminStatus, authed: true });
      setShowAdminLogin(false);
      setAdminMode(true);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  const exportData = async () => {
    try {
      const data = await api.export();
      const payload = {
        ...data,
        bracket: {
          teams: TEAMS,
          matchups: { round1: R1_MATCHUPS, semis: SEMI_MATCHUPS, conferenceFinals: CF_MATCHUPS, finals: FINALS_MATCHUP },
        },
      };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `playoff-picks-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setDialog({ title: "Export failed", message: e.message, confirmLabel: "OK", onConfirm: () => setDialog(null) });
    }
  };

  const myScore = currentUser ? calculateScore(picks, results) : { score: 0, correct: 0, totalDecided: 0 };
  const leaderboard = allEntries
    .map((e) => { const s = calculateScore(e.picks || {}, results); return { ...e, ...s }; })
    .sort((a, b) => b.score - a.score || b.correct - a.correct);

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><div className="text-zinc-500">Loading...</div></div>;
  }

  if (connErr && !currentUser) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-3">
          <div className="text-5xl">🏀</div>
          <div className="text-lg font-black text-white">Can't reach server</div>
          <div className="text-sm text-zinc-400">{connErr}</div>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-orange-500 text-black rounded-lg text-xs font-black uppercase tracking-wider">Retry</button>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Onboarding onSignUp={signUp} allEntries={allEntries} onSelectUser={switchToUser} />;
  }

  const r1Done = R1_MATCHUPS.filter((m) => picks[m.id]).length;
  const totalPicks = ALL_MATCHUPS.filter((m) => picks[m.id]).length;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-10 bg-black/95 backdrop-blur border-b border-zinc-900">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.25em] text-orange-500">2026 Playoffs</div>
            <h1 className="text-xl font-black text-white leading-none" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.02em" }}>PLAYOFF PICKS</h1>
          </div>
          <button onClick={() => setShowProfile(true)} className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700">
            <span className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-base">{currentUser.avatar}</span>
            <span className="text-xs font-bold text-white max-w-[80px] truncate">{currentUser.name}</span>
          </button>
        </div>
        <nav className="px-2 pb-2 flex gap-1">
          {[{ id: "picks", label: "Picks" }, { id: "bracket", label: "Bracket" }, { id: "scores", label: "Scores" }, { id: "leaderboard", label: "Ranks" }].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2 px-3 text-[11px] font-black uppercase tracking-wider rounded-lg transition-colors ${tab === t.id ? "bg-white text-black" : "text-zinc-500 hover:text-white"}`}>
              {t.label}
            </button>
          ))}
        </nav>
        {connErr && (
          <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-center text-[10px] font-bold text-red-300">
            Offline. Reconnecting...
          </div>
        )}
      </header>

      <main className="px-4 py-4 pb-24">
        {tab === "picks" && <PicksView picks={picks} results={results} locked={locked} onPick={onPick} onLock={onLock} saving={saving} r1Done={r1Done} totalPicks={totalPicks} myScore={myScore} />}
        {tab === "bracket" && <VisualBracket picks={picks} results={results} totalPicks={totalPicks} />}
        {tab === "scores" && <ScoresView results={results} myPicks={picks} adminMode={adminMode} toggleAdmin={toggleAdmin} setOfficialResult={setOfficialResult} refreshAll={refreshAll} seriesStatus={seriesStatus} setSeriesStatus={setSeriesStatus} />}
        {tab === "leaderboard" && <LeaderboardView leaderboard={leaderboard} results={results} currentUser={currentUser} onExport={exportData} />}
      </main>

      {showProfile && (
        <ProfileModal currentUser={currentUser} onClose={() => setShowProfile(false)} onSave={async (name, avatar) => { await updateProfile(name, avatar); setShowProfile(false); }} onLogout={() => { setShowProfile(false); handleLogout(); }} onSwitchUser={(id) => { setShowProfile(false); switchToUser(id); }} />
      )}
      {showAdminLogin && (
        <AdminLoginModal onClose={() => setShowAdminLogin(false)} onLogin={doAdminLogin} />
      )}
      {dialog && <ConfirmDialog {...dialog} />}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function useBodyScrollLock() {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
}

function ConfirmDialog({ title, message, confirmLabel, cancelLabel, variant, icon, onConfirm, onCancel }) {
  useBodyScrollLock();
  return (
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-zinc-900 border-2 border-zinc-600 rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
        <div className="p-5">
          {icon === "lock" && (
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mx-auto mb-3">
              <Lock size={20} className="text-emerald-400" />
            </div>
          )}
          <h3 className="text-lg font-black text-white uppercase tracking-wider mb-2 text-center" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }}>{title}</h3>
          <p className="text-sm text-zinc-400 leading-relaxed text-center">{message}</p>
        </div>
        {onCancel ? (
          <div className="flex border-t border-zinc-800">
            <button onClick={onCancel} className="flex-1 py-4 bg-zinc-800 text-white text-xs font-black uppercase tracking-wider hover:bg-zinc-700">{cancelLabel || "Cancel"}</button>
            <button onClick={onConfirm} className={`flex-1 py-4 text-xs font-black uppercase tracking-wider ${variant === "danger" ? "bg-red-500 text-white hover:bg-red-400" : variant === "success" ? "bg-emerald-500 text-black hover:bg-emerald-400" : "bg-orange-500 text-black hover:bg-orange-400"}`}>{confirmLabel || "Confirm"}</button>
          </div>
        ) : (
          <button onClick={onConfirm} className={`w-full py-4 text-xs font-black uppercase tracking-wider border-t border-zinc-800 ${variant === "danger" ? "bg-red-500 text-white hover:bg-red-400" : variant === "success" ? "bg-emerald-500 text-black hover:bg-emerald-400" : "bg-orange-500 text-black hover:bg-orange-400"}`}>{confirmLabel || "OK"}</button>
        )}
      </div>
    </div>
  );
}

function Onboarding({ onSignUp, allEntries, onSelectUser }) {
  const [mode, setMode] = useState("choose"); // "choose" | "create" | "join"
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [submitting, setSubmitting] = useState(false);
  const knownUsers = getKnownUsers();

  const header = (
    <div className="mb-8 text-center">
      <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30">
        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
        <span className="text-[10px] font-bold text-orange-400 uppercase tracking-[0.2em]">2026 Playoffs · Live</span>
      </div>
      <h1 className="text-6xl font-black text-white leading-none mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.02em" }}>
        PLAYOFF<br /><span className="text-orange-500">PICKS</span>
      </h1>
      <p className="text-sm text-zinc-500 mt-3">Pick every series. Track every win.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {header}

          {mode === "choose" && (
            <div className="space-y-3">
              {knownUsers.length > 0 && (
                <>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2">Continue as</label>
                  {knownUsers.map((u) => (
                    <button key={u.id} onClick={() => { setSubmitting(true); onSelectUser(u.id); }} className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border-2 border-zinc-800 hover:border-orange-500/60 transition-colors">
                      <span className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-xl">{u.avatar}</span>
                      <span className="text-sm font-bold text-white flex-1 text-left truncate">{u.name}</span>
                      <ArrowRight size={16} className="text-zinc-500" />
                    </button>
                  ))}
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-zinc-800" />
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">or</span>
                    <div className="flex-1 h-px bg-zinc-800" />
                  </div>
                </>
              )}
              <button onClick={() => setMode("create")} className="w-full py-4 bg-orange-500 hover:bg-orange-400 text-black font-black uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2">
                <Plus size={18} /> New Bracket
              </button>
              {allEntries.length > 0 && (
                <button onClick={() => setMode("join")} className="w-full py-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-colors">
                  I already have a bracket on another device
                </button>
              )}
            </div>
          )}

          {mode === "create" && (
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2">Your display name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marcus" className="w-full px-4 py-3 bg-zinc-900 border-2 border-zinc-800 rounded-xl text-white text-base font-bold focus:border-orange-500 focus:outline-none" autoFocus maxLength={24} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2">Pick an avatar</label>
                <div className="grid grid-cols-8 gap-1.5">
                  {AVATARS.map((a) => (
                    <button key={a} onClick={() => setAvatar(a)} className={`aspect-square text-2xl rounded-lg border-2 transition-all ${avatar === a ? "border-orange-500 bg-orange-500/10 scale-105" : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"}`}>{a}</button>
                  ))}
                </div>
              </div>
              <button onClick={async () => { if (!name.trim()) return; setSubmitting(true); await onSignUp(name, avatar); setSubmitting(false); }} disabled={!name.trim() || submitting} className="w-full py-4 bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black uppercase tracking-wider rounded-xl transition-colors">
                {submitting ? "Creating..." : "Create my bracket"}
              </button>
              <button onClick={() => setMode("choose")} className="w-full py-3 text-xs font-bold text-zinc-500 hover:text-white">Back</button>
            </div>
          )}

          {mode === "join" && (
            <div className="space-y-3">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1">Select your profile</label>
              <div className="max-h-[50vh] overflow-y-auto space-y-2 -mx-1 px-1">
                {allEntries.map((e) => (
                  <button key={e.id} onClick={() => { setSubmitting(true); onSelectUser(e.id); }} disabled={submitting} className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border-2 border-zinc-800 hover:border-orange-500/60 transition-colors">
                    <span className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-xl">{e.avatar || "🏀"}</span>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-sm font-bold text-white truncate">{e.name}</div>
                      <div className="text-[10px] text-zinc-500">{Object.keys(e.picks || {}).length} picks · {e.locked ? "Locked" : "In progress"}</div>
                    </div>
                    <ArrowRight size={16} className="text-zinc-500 flex-shrink-0" />
                  </button>
                ))}
              </div>
              <button onClick={() => setMode("choose")} className="w-full py-3 text-xs font-bold text-zinc-500 hover:text-white">Back</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileModal({ currentUser, onClose, onSave, onLogout, onSwitchUser }) {
  const [name, setName] = useState(currentUser.name);
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  useBodyScrollLock();
  const hasChanges = name.trim() !== currentUser.name || avatar !== currentUser.avatar;
  const otherUsers = getKnownUsers().filter((u) => u.id !== currentUser.id);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-sm bg-zinc-900 border-t-2 sm:border-2 sm:rounded-2xl border-zinc-600 rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/60">
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-white">Profile</h3>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">Display name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} className="w-full px-3 py-2.5 bg-zinc-800 border-2 border-zinc-700 rounded-lg text-white text-sm font-bold focus:border-orange-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">Avatar</label>
            <div className="grid grid-cols-8 gap-1.5">
              {AVATARS.map((a) => (
                <button key={a} onClick={() => setAvatar(a)} className={`aspect-square text-xl rounded-lg border-2 transition-all ${avatar === a ? "border-orange-500 bg-orange-500/10" : "border-zinc-700 bg-zinc-800"}`}>{a}</button>
              ))}
            </div>
          </div>
          <button onClick={() => onSave(name, avatar)} disabled={!hasChanges || !name.trim()} className="w-full py-3 bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-black uppercase tracking-wider rounded-xl transition-colors">
            Save changes
          </button>

          {otherUsers.length > 0 && (
            <div className="pt-2 border-t border-zinc-800">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">Switch player</label>
              <div className="space-y-1.5">
                {otherUsers.map((u) => (
                  <button key={u.id} onClick={() => onSwitchUser(u.id)} className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-orange-500/60 transition-colors">
                    <span className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-lg">{u.avatar}</span>
                    <span className="text-sm font-bold text-white flex-1 text-left truncate">{u.name}</span>
                    <ArrowRight size={14} className="text-zinc-500" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-zinc-800">
            {!confirmingLogout ? (
              <button onClick={() => setConfirmingLogout(true)} className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold text-zinc-500 hover:text-zinc-300">
                <LogOut size={14} /> Switch to a different player
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-zinc-400 text-center">This will take you back to the player select screen.</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmingLogout(false)} className="flex-1 py-2.5 bg-zinc-800 text-white text-xs font-bold rounded-lg hover:bg-zinc-700">Cancel</button>
                  <button onClick={onLogout} className="flex-1 py-2.5 bg-zinc-700 text-white text-xs font-black uppercase tracking-wider rounded-lg hover:bg-zinc-600">Continue</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminLoginModal({ onClose, onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    const res = await onLogin(password);
    if (!res.ok) {
      setError(res.error || "Wrong password");
      setSubmitting(false);
    }
  };

  useBodyScrollLock();
  return (
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-zinc-900 border-2 border-zinc-600 rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
        <div className="p-5 space-y-4">
          <div className="w-12 h-12 rounded-full bg-orange-500/15 border border-orange-500/40 flex items-center justify-center mx-auto">
            <Shield size={20} className="text-orange-400" />
          </div>
          <h3 className="text-lg font-black text-white uppercase tracking-wider text-center" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }}>Admin Login</h3>
          <p className="text-xs text-zinc-400 text-center">Enter the admin password to update series results.</p>
          <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Password" className="w-full px-3 py-2.5 bg-zinc-800 border-2 border-zinc-700 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none" autoFocus />
          {error && <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">{error}</div>}
        </div>
        <div className="flex border-t border-zinc-800">
          <button onClick={onClose} className="flex-1 py-4 bg-zinc-800 text-white text-xs font-black uppercase tracking-wider hover:bg-zinc-700">Cancel</button>
          <button onClick={submit} disabled={!password || submitting} className="flex-1 py-4 bg-orange-500 text-black text-xs font-black uppercase tracking-wider hover:bg-orange-400 disabled:bg-zinc-700 disabled:text-zinc-500">
            {submitting ? "Checking..." : "Unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PicksView({ picks, results, locked, onPick, onLock, saving, r1Done, totalPicks, myScore }) {
  const renderRound = (label, matchups, conf = null) => {
    const filtered = conf ? matchups.filter((m) => m.conf === conf) : matchups;
    return (
      <div className="space-y-3">
        <RoundLabel>{label}</RoundLabel>
        <div className="space-y-4">
          {filtered.map((m) => <MatchupCard key={m.id} matchup={m} picks={picks} results={results} onPick={onPick} locked={locked} />)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-md mx-auto">
      <div className={`p-4 rounded-2xl border-2 ${locked ? "bg-emerald-500/5 border-emerald-500/30" : "bg-zinc-900 border-zinc-800"}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {locked ? <Lock size={16} className="text-emerald-400" /> : <Edit3 size={16} className="text-orange-400" />}
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">{locked ? "Locked In" : "Editable"}</span>
          </div>
          {saving && <span className="text-[10px] text-zinc-500">Saving...</span>}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="R1 Picks" value={`${r1Done}/8`} />
          <Stat label="Total Picks" value={`${totalPicks}/15`} />
          <Stat label="Points" value={`${myScore.score}`} accent={myScore.score > 0 ? "#22c55e" : null} />
        </div>
        {myScore.totalDecided > 0 && (
          <div className="mt-3 text-[10px] text-zinc-500 text-center">{myScore.correct} of {myScore.totalDecided} decided series correct</div>
        )}
      </div>

      <div className="space-y-6">
        <SectionHeader title="Eastern Conference" accent="#007A33" />
        {renderRound("First Round · 1 pt each", R1_MATCHUPS, "E")}
        {renderRound("Conference Semifinals · 2 pts each", SEMI_MATCHUPS, "E")}
        {renderRound("Conference Finals · 4 pts", CF_MATCHUPS, "E")}
      </div>

      <div className="space-y-6">
        <SectionHeader title="Western Conference" accent="#E03A3E" />
        {renderRound("First Round · 1 pt each", R1_MATCHUPS, "W")}
        {renderRound("Conference Semifinals · 2 pts each", SEMI_MATCHUPS, "W")}
        {renderRound("Conference Finals · 4 pts", CF_MATCHUPS, "W")}
      </div>

      <div className="space-y-3">
        <SectionHeader title="NBA Finals" accent="#F5A524" />
        <RoundLabel>Championship · 8 pts</RoundLabel>
        <MatchupCard matchup={FINALS_MATCHUP} picks={picks} results={results} onPick={onPick} locked={locked} />
      </div>

      {!locked && (
        <button onClick={onLock} disabled={r1Done < 8} className="w-full py-4 mt-4 bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2">
          <Lock size={16} />
          {r1Done < 8 ? `Complete Round 1 (${r1Done}/8)` : "Lock In My Picks"}
        </button>
      )}
      {locked && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
          <Lock size={20} className="text-emerald-400 mx-auto mb-1" />
          <div className="text-sm font-bold text-white">Picks locked</div>
          <div className="text-xs text-zinc-500 mt-1">Check the Bracket tab to see your full prediction.</div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Visual bracket
// ============================================================
const BRACKET_LAYOUT = { width: 780, height: 560, boxW: 96, boxH: 70 };
const BRACKET_POSITIONS = {
  E1: { left: 0, top: 64 }, E2: { left: 0, top: 188 }, E3: { left: 0, top: 312 }, E4: { left: 0, top: 436 },
  ES1: { left: 114, top: 126 }, ES2: { left: 114, top: 374 },
  ECF: { left: 228, top: 250 }, FINALS: { left: 342, top: 250 }, WCF: { left: 456, top: 250 },
  WS1: { left: 570, top: 126 }, WS2: { left: 570, top: 374 },
  W1: { left: 684, top: 64 }, W2: { left: 684, top: 188 }, W3: { left: 684, top: 312 }, W4: { left: 684, top: 436 },
};
const BRACKET_CONNECTIONS = [
  ["E1", "ES1"], ["E2", "ES1"], ["E3", "ES2"], ["E4", "ES2"],
  ["ES1", "ECF"], ["ES2", "ECF"], ["ECF", "FINALS"], ["FINALS", "WCF"],
  ["WCF", "WS1"], ["WCF", "WS2"],
  ["WS1", "W1"], ["WS1", "W2"], ["WS2", "W3"], ["WS2", "W4"],
];

const getConnectorPath = (fromId, toId) => {
  const from = BRACKET_POSITIONS[fromId];
  const to = BRACKET_POSITIONS[toId];
  const { boxW, boxH } = BRACKET_LAYOUT;
  const fromCY = from.top + boxH / 2;
  const toCY = to.top + boxH / 2;
  if (from.left < to.left) {
    const fromRight = from.left + boxW;
    const midX = (fromRight + to.left) / 2;
    return `M ${fromRight} ${fromCY} H ${midX} V ${toCY} H ${to.left}`;
  }
  const toRight = to.left + boxW;
  const midX = (from.left + toRight) / 2;
  return `M ${from.left} ${fromCY} H ${midX} V ${toCY} H ${toRight}`;
};

function VisualBracket({ picks, results, totalPicks }) {
  const allComplete = totalPicks === 15;
  const champion = picks.FINALS;
  const championWinner = results.FINALS;

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-8">
      {allComplete && champion ? (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/25 via-orange-500/15 to-transparent border-2 border-amber-500/50 text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-400 mb-3 flex items-center justify-center gap-2">
            <Trophy size={12} /> Your Champion Pick
          </div>
          <div className="flex items-center justify-center gap-3">
            <TeamLogo teamId={champion} size={56} />
            <div className="text-left">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{TEAMS[champion].city}</div>
              <div className="text-4xl font-black text-white leading-none" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.02em" }}>
                {TEAMS[champion].name.toUpperCase()}
              </div>
            </div>
          </div>
          {championWinner && (
            <div className={`mt-3 text-[11px] font-black uppercase tracking-wider ${championWinner === champion ? "text-emerald-400" : "text-red-400"}`}>
              {championWinner === champion ? "✓ Correct!" : "✗ Didn't win"}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-zinc-900 border-2 border-zinc-800 text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1">Bracket Progress</div>
          <div className="text-3xl font-black text-white leading-none mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{totalPicks}/15</div>
          <p className="text-xs text-zinc-500 mt-2">Fill in every round on the Picks tab to complete your prediction.</p>
        </div>
      )}

      <div className="sm:hidden flex items-center justify-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
        <span>←</span> Swipe to see full bracket <span>→</span>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 pb-2">
        <div className="relative" style={{ width: BRACKET_LAYOUT.width, height: BRACKET_LAYOUT.height + 40, minWidth: BRACKET_LAYOUT.width }}>
          <div className="absolute top-0 left-0 w-full flex text-[9px] font-black uppercase tracking-[0.15em] text-zinc-500">
            <div style={{ width: BRACKET_LAYOUT.boxW, marginLeft: 0 }} className="text-center">R1</div>
            <div style={{ width: BRACKET_LAYOUT.boxW, marginLeft: 18 }} className="text-center">Semis</div>
            <div style={{ width: BRACKET_LAYOUT.boxW, marginLeft: 18 }} className="text-center">Conf Final</div>
            <div style={{ width: BRACKET_LAYOUT.boxW, marginLeft: 18 }} className="text-amber-400 text-center">Finals</div>
            <div style={{ width: BRACKET_LAYOUT.boxW, marginLeft: 18 }} className="text-center">Conf Final</div>
            <div style={{ width: BRACKET_LAYOUT.boxW, marginLeft: 18 }} className="text-center">Semis</div>
            <div style={{ width: BRACKET_LAYOUT.boxW, marginLeft: 18 }} className="text-center">R1</div>
          </div>
          <div className="absolute left-0 font-black text-[10px] uppercase tracking-[0.25em]" style={{ top: 20, color: "#22c55e" }}>● Eastern Conference</div>
          <div className="absolute right-0 font-black text-[10px] uppercase tracking-[0.25em]" style={{ top: 20, color: "#ef4444" }}>Western Conference ●</div>

          <svg className="absolute pointer-events-none" style={{ top: 40, left: 0 }} width={BRACKET_LAYOUT.width} height={BRACKET_LAYOUT.height}>
            {BRACKET_CONNECTIONS.map(([from, to]) => {
              const hasPick = picks[from] && picks[to];
              const hasResult = results[from] && results[to];
              let stroke = "#27272a";
              let strokeWidth = 1.5;
              if (hasResult && results[from] === results[to]) { stroke = "#10b981"; strokeWidth = 2; }
              else if (hasPick && picks[from] === picks[to]) { stroke = "#52525b"; strokeWidth = 2; }
              return <path key={`${from}-${to}`} d={getConnectorPath(from, to)} stroke={stroke} strokeWidth={strokeWidth} fill="none" />;
            })}
          </svg>

          <div className="absolute" style={{ top: 40, left: 0, width: BRACKET_LAYOUT.width, height: BRACKET_LAYOUT.height }}>
            {Object.entries(BRACKET_POSITIONS).map(([matchupId, pos]) => {
              const matchup = ALL_MATCHUPS.find((m) => m.id === matchupId);
              return (
                <div key={matchupId} className="absolute" style={{ left: pos.left, top: pos.top, width: BRACKET_LAYOUT.boxW, height: BRACKET_LAYOUT.boxH }}>
                  <HBracketBox matchup={matchup} picks={picks} results={results} isFinals={matchupId === "FINALS"} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-orange-400"></span>Your pick</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/40 border border-emerald-500"></span>Actual winner</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-zinc-700 border-dashed"></span>TBD</span>
      </div>
    </div>
  );
}

function HBracketBox({ matchup, picks, results, isFinals = false }) {
  const [teamA, teamB] = getMatchupTeams(matchup, picks);
  const pick = picks[matchup.id];
  const winner = results[matchup.id];

  const renderTeam = (tid) => {
    if (!tid) {
      return (
        <div className="flex items-center gap-1 px-1.5 h-[30px] rounded bg-zinc-950/60 border border-zinc-800 border-dashed">
          <div className="w-4 h-4 rounded-full bg-zinc-800 flex-shrink-0" />
          <span className="text-[9px] text-zinc-600 italic">TBD</span>
        </div>
      );
    }
    const team = TEAMS[tid];
    const isPicked = pick === tid;
    const isActualWinner = winner === tid;
    const isWrong = isPicked && winner && winner !== tid;
    let classes = "flex items-center gap-1 px-1.5 h-[30px] rounded border min-w-0 overflow-hidden";
    let style = {};
    if (isActualWinner) classes += " bg-emerald-500/20 border-emerald-500/60";
    else if (isWrong) classes += " bg-red-500/10 border-red-500/40 opacity-60";
    else if (isPicked) { classes += " border-2"; style = { borderColor: team.color, backgroundColor: `${team.color}25` }; }
    else classes += " bg-zinc-950/80 border-zinc-800/60 opacity-70";
    return (
      <div className={classes} style={style}>
        <span className={`text-[9px] font-bold flex-shrink-0 tabular-nums w-3 text-center ${isPicked || isActualWinner ? "text-zinc-300" : "text-zinc-600"}`}>{team.seed}</span>
        <TeamLogo teamId={tid} size={18} />
        <span className={`text-[10px] font-black truncate ${isPicked || isActualWinner ? "text-white" : "text-zinc-500"}`}>{team.id}</span>
        {isActualWinner && <Check size={10} className="text-emerald-400 flex-shrink-0 ml-auto" />}
      </div>
    );
  };

  return (
    <div className={`p-1 overflow-hidden rounded-lg space-y-0.5 ${isFinals ? "bg-amber-500/10 border border-amber-500/40" : "bg-zinc-900/60 border border-zinc-800/60"}`} style={{ width: BRACKET_LAYOUT.boxW, height: BRACKET_LAYOUT.boxH }}>
      {renderTeam(teamA)}
      {renderTeam(teamB)}
    </div>
  );
}

function ScoresView({ results, myPicks, adminMode, toggleAdmin, setOfficialResult, refreshAll, seriesStatus, setSeriesStatus }) {
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [selectedMatchup, setSelectedMatchup] = useState(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshAll();
    setTimeout(() => setRefreshing(false), 400);
  };

  const handleESPNSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await api.syncESPN();
      if (res.seriesStatus) setSeriesStatus(res.seriesStatus);
      await refreshAll();
      setSyncMsg(res.updated > 0 ? `Updated ${res.updated} series from ESPN` : "All series up to date");
    } catch (e) {
      setSyncMsg("Sync failed: " + e.message);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  };

  const renderMatchup = (m, label) => {
    const [teamA, teamB] = getMatchupTeams(m, results);
    const winner = results[m.id];
    const myPick = myPicks[m.id];
    const status = seriesStatus[m.id];
    const hasGames = status?.games?.length > 0;

    if (!teamA || !teamB) {
      return (
        <div key={m.id} className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 border-dashed">
          <div className="text-[10px] font-black uppercase tracking-wider text-zinc-600 mb-1">{label}</div>
          <div className="text-xs text-zinc-600 italic">Awaiting previous round</div>
        </div>
      );
    }

    return (
      <div key={m.id} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</div>
          <div className="flex items-center gap-2">
            {winner ? (
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Decided</div>
            ) : status && (status.winsA > 0 || status.winsB > 0) ? (
              <div className="text-[10px] font-bold text-amber-400 tracking-wider">{status.summary}</div>
            ) : null}
            {hasGames && (
              <button
                onClick={() => setSelectedMatchup(m.id)}
                className="p-0.5 text-zinc-600 hover:text-zinc-300 transition-colors rounded"
                title="View game log"
              >
                <Info size={13} />
              </button>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          {[teamA, teamB].map((tid) => {
            const team = TEAMS[tid];
            const isWinner = winner === tid;
            const isMyPick = myPick === tid;
            return (
              <div key={tid} className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${isWinner ? "bg-emerald-500/10 border-emerald-500/40" : winner ? "bg-zinc-950 border-zinc-900 opacity-50" : "bg-zinc-950 border-zinc-900"}`}>
                <TeamLogo teamId={tid} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-bold text-zinc-500 flex-shrink-0">{team.seed}</span>
                    <span className="text-sm font-bold text-white truncate">{team.name}</span>
                    {isMyPick && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 uppercase flex-shrink-0">Pick</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isWinner && <Trophy size={14} className="text-emerald-400" />}
                  {adminMode && (
                    <button onClick={() => setOfficialResult(m.id, isWinner ? null : tid)} className={`text-[9px] font-black px-2 py-1 rounded uppercase ${isWinner ? "bg-emerald-500 text-black" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                      {isWinner ? "Clear" : "Win"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 max-w-md mx-auto">
      <div className="flex gap-2">
        <button onClick={handleESPNSync} disabled={syncing} className="flex-1 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:bg-zinc-800 disabled:opacity-50">
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing..." : "Sync from ESPN"}
        </button>
        <button onClick={toggleAdmin} className={`px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider border transition-colors ${adminMode ? "bg-orange-500 text-black border-orange-500" : "bg-zinc-900 text-zinc-400 border-zinc-800"}`}>
          {adminMode ? "Admin On" : "Admin"}
        </button>
      </div>
      {syncMsg && (
        <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 text-center">{syncMsg}</div>
      )}

      {adminMode && (
        <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30">
          <div className="text-xs text-orange-300 leading-relaxed">
            <strong className="font-black uppercase tracking-wider text-orange-400">Admin mode:</strong> Tap <span className="font-bold">Win</span> next to a team when their series ends.
          </div>
        </div>
      )}

      <SectionHeader title="Eastern Conference" accent="#007A33" />
      <RoundLabel>First Round</RoundLabel>
      {R1_MATCHUPS.filter((m) => m.conf === "E").map((m) => renderMatchup(m, `Game ${m.id}`))}
      <RoundLabel>Conference Semis</RoundLabel>
      {SEMI_MATCHUPS.filter((m) => m.conf === "E").map((m) => renderMatchup(m, "Semifinal"))}
      <RoundLabel>Conference Finals</RoundLabel>
      {CF_MATCHUPS.filter((m) => m.conf === "E").map((m) => renderMatchup(m, "East Finals"))}

      <SectionHeader title="Western Conference" accent="#E03A3E" />
      <RoundLabel>First Round</RoundLabel>
      {R1_MATCHUPS.filter((m) => m.conf === "W").map((m) => renderMatchup(m, `Game ${m.id}`))}
      <RoundLabel>Conference Semis</RoundLabel>
      {SEMI_MATCHUPS.filter((m) => m.conf === "W").map((m) => renderMatchup(m, "Semifinal"))}
      <RoundLabel>Conference Finals</RoundLabel>
      {CF_MATCHUPS.filter((m) => m.conf === "W").map((m) => renderMatchup(m, "West Finals"))}

      <SectionHeader title="NBA Finals" accent="#F5A524" />
      {renderMatchup(FINALS_MATCHUP, "Championship")}

      {selectedMatchup && seriesStatus[selectedMatchup] && (
        <GameDetailModal
          status={seriesStatus[selectedMatchup]}
          onClose={() => setSelectedMatchup(null)}
        />
      )}
    </div>
  );
}

function LeaderboardView({ leaderboard, results, currentUser, onExport }) {
  const [viewingEntry, setViewingEntry] = useState(null);
  const myEntry = leaderboard.find((e) => e.id === currentUser.id);
  const myPicks = myEntry?.picks || {};

  if (leaderboard.length === 0) {
    return <div className="max-w-md mx-auto text-center py-12"><Trophy size={40} className="text-zinc-700 mx-auto mb-3" /><div className="text-sm text-zinc-500">No picks submitted yet.</div></div>;
  }
  const totalDecided = Object.keys(results).length;
  return (
    <div className="space-y-3 max-w-md mx-auto">
      <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20">
        <div className="flex items-center gap-2 mb-1">
          <Trophy size={14} className="text-amber-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Standings</span>
        </div>
        <div className="text-xs text-zinc-400">{leaderboard.length} {leaderboard.length === 1 ? "entry" : "entries"} · {totalDecided} series decided</div>
      </div>

      {leaderboard.map((entry, i) => {
        const isMe = entry.id === currentUser.id;
        const rank = i + 1;
        return (
          <div
            key={entry.id}
            onClick={entry.locked ? () => setViewingEntry(entry) : undefined}
            className={[
              "flex items-center gap-3 p-3 rounded-xl border transition-colors",
              isMe ? "bg-orange-500/10 border-orange-500/40" : "bg-zinc-900 border-zinc-800",
              entry.locked
                ? `cursor-pointer select-none active:opacity-75 ${isMe ? "hover:border-orange-500/70" : "hover:border-zinc-600"}`
                : "",
            ].join(" ")}
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${rank === 1 ? "bg-amber-400 text-black" : rank === 2 ? "bg-zinc-300 text-black" : rank === 3 ? "bg-amber-700 text-white" : "bg-zinc-800 text-zinc-400"}`}>{rank}</div>
            <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-xl flex-shrink-0">{entry.avatar || "🏀"}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white truncate">{entry.name}</span>
                {isMe && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-orange-500 text-black uppercase">You</span>}
                {entry.locked && <Lock size={10} className="text-zinc-500" />}
              </div>
              <div className="text-[10px] text-zinc-500">{entry.correct}/{entry.totalDecided} correct</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="text-right">
                <div className="text-2xl font-black text-white leading-none" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{entry.score}</div>
                <div className="text-[9px] text-zinc-500 uppercase tracking-wider">pts</div>
              </div>
              {entry.locked
                ? <ArrowRight size={14} className="text-zinc-600" />
                : <div className="w-[14px]" />
              }
            </div>
          </div>
        );
      })}

      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 mt-6">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2 flex items-center gap-1.5"><Award size={12} /> Scoring</div>
        <div className="space-y-1 text-xs text-zinc-400">
          <div className="flex justify-between"><span>First Round</span><span className="font-bold">1 pt each</span></div>
          <div className="flex justify-between"><span>Conference Semis</span><span className="font-bold">2 pts each</span></div>
          <div className="flex justify-between"><span>Conference Finals</span><span className="font-bold">4 pts each</span></div>
          <div className="flex justify-between"><span>NBA Finals</span><span className="font-bold">8 pts</span></div>
          <div className="flex justify-between pt-1 border-t border-zinc-800 mt-1"><span className="text-white">Max possible</span><span className="font-black text-orange-400">32 pts</span></div>
        </div>
      </div>

      <button onClick={onExport} className="w-full mt-2 py-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl text-xs font-black uppercase tracking-wider text-white flex items-center justify-center gap-2">
        <Download size={14} /> Export All Data (JSON)
      </button>

      {viewingEntry && (
        <PlayerPicksModal
          entry={viewingEntry}
          results={results}
          currentUser={currentUser}
          myPicks={myPicks}
          onClose={() => setViewingEntry(null)}
        />
      )}
    </div>
  );
}

function PlayerPicksModal({ entry, results, currentUser, myPicks, onClose }) {
  useBodyScrollLock();
  if (!entry.locked) return null;

  const isMe = entry.id === currentUser.id;
  const rounds = [
    { label: "First Round", pts: 1, matchups: R1_MATCHUPS },
    { label: "Conference Semis", pts: 2, matchups: SEMI_MATCHUPS },
    { label: "Conference Finals", pts: 4, matchups: CF_MATCHUPS },
    { label: "NBA Finals", pts: 8, matchups: [FINALS_MATCHUP] },
  ];

  // Compute diff summary (only when viewing someone else)
  let diffCount = 0;
  let sharedCount = 0;
  if (!isMe) {
    const allMatchups = [...R1_MATCHUPS, ...SEMI_MATCHUPS, ...CF_MATCHUPS, FINALS_MATCHUP];
    for (const m of allMatchups) {
      const theirPick = entry.picks?.[m.id];
      const myPick = myPicks[m.id];
      if (theirPick && myPick) {
        sharedCount++;
        if (theirPick !== myPick) diffCount++;
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-sm bg-zinc-900 border-t-2 sm:border-2 sm:rounded-2xl border-zinc-600 rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/60">
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 flex items-center gap-3 px-4 py-3">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-xl flex-shrink-0">{entry.avatar || "🏀"}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white truncate">{entry.name}</h3>
              {isMe && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-orange-500 text-black uppercase">You</span>}
            </div>
            <div className="text-[10px] text-zinc-500">{entry.score} pts · {entry.correct}/{entry.totalDecided} correct</div>
            {!isMe && sharedCount > 0 && (
              <div className="text-[10px] text-zinc-600 mt-0.5">
                {diffCount === 0 ? "Your brackets match" : `You differ on ${diffCount} of ${sharedCount} picks`}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white flex-shrink-0"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-5">
          {rounds.map(({ label, pts, matchups }) => (
            <div key={label}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{label}</span>
                <span className="text-[10px] font-bold text-zinc-700">· {pts} pt{pts > 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-1.5">
                {matchups.map((matchup) => {
                  const pick = entry.picks?.[matchup.id];
                  const result = results[matchup.id];
                  const isCorrect = pick && result && pick === result;
                  const isWrong = pick && result && pick !== result;
                  const myPick = !isMe ? myPicks[matchup.id] : null;
                  const isDivergent = !isMe && !!pick && !!myPick && pick !== myPick;

                  if (!pick) {
                    return (
                      <div key={matchup.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50">
                        <div className="w-6 h-6 rounded-full bg-zinc-700 flex-shrink-0" />
                        <span className="text-xs text-zinc-600 italic flex-1">No pick</span>
                      </div>
                    );
                  }

                  const team = TEAMS[pick];
                  return (
                    <div key={matchup.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${isCorrect ? "bg-emerald-500/10 border-emerald-500/30" : isWrong ? "bg-zinc-800 border-zinc-700 opacity-60" : "bg-zinc-800/60 border-zinc-700/60"}`}>
                      <TeamLogo teamId={pick} size={26} />
                      <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-zinc-600 flex-shrink-0">{team.seed}</span>
                        <span className="text-xs font-bold text-white truncate">{team.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isDivergent && (
                          <span className="text-[9px] font-bold text-orange-400/70">you: {TEAMS[myPick]?.id ?? myPick}</span>
                        )}
                        {isCorrect && <span className="text-[10px] font-black text-emerald-400">+{pts}</span>}
                        {isCorrect && <Check size={12} className="text-emerald-400" />}
                        {isWrong && <X size={12} className="text-red-400" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GameDetailModal({ status, onClose }) {
  useBodyScrollLock();
  const teamA = TEAMS[status.teamA];
  const teamB = TEAMS[status.teamB];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-sm bg-zinc-900 border-t-2 sm:border-2 sm:rounded-2xl border-zinc-600 rounded-t-2xl max-h-[85vh] overflow-y-auto shadow-2xl shadow-black/60">
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-black uppercase tracking-wider text-white leading-tight">
              {teamA?.name ?? status.teamA} vs {teamB?.name ?? status.teamB}
            </h3>
            {status.summary && (
              <div className="text-[10px] text-amber-400 font-bold mt-0.5">{status.summary}</div>
            )}
          </div>
          <button onClick={onClose} className="ml-3 p-1 text-zinc-500 hover:text-white flex-shrink-0">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {status.games?.length > 0 ? (
            status.games.map((game) => {
              const dateStr = new Date(game.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
              const homeWon = game.homeScore > game.awayScore;
              return (
                <div key={game.gameNumber} className="p-3 rounded-xl bg-zinc-800 border border-zinc-700">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Game {game.gameNumber}</span>
                    <span className="text-[10px] text-zinc-600">{dateStr} · {game.status}</span>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { teamId: game.awayTeam, score: game.awayScore, won: !homeWon, side: "Away" },
                      { teamId: game.homeTeam, score: game.homeScore, won: homeWon, side: "Home" },
                    ].map(({ teamId, score, won, side }) => (
                      <div key={teamId} className="flex items-center gap-2">
                        <TeamLogo teamId={teamId} size={22} />
                        <span className={`text-xs font-bold flex-1 truncate ${won ? "text-white" : "text-zinc-500"}`}>
                          {TEAMS[teamId]?.name ?? teamId}
                        </span>
                        <span className="text-[9px] text-zinc-700 uppercase tracking-wider w-8 text-right">{side}</span>
                        <span className={`text-sm font-black tabular-nums w-8 text-right ${won ? "text-white" : "text-zinc-500"}`}>{score}</span>
                        <div className="w-3">{won && <Check size={11} className="text-emerald-400" />}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-10 text-center text-zinc-600 text-sm">No completed games yet</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div>
      <div className="text-[9px] font-black uppercase tracking-wider text-zinc-500 mb-0.5">{label}</div>
      <div className="text-xl font-black" style={{ fontFamily: "'Bebas Neue', sans-serif", color: accent || "#fff" }}>{value}</div>
    </div>
  );
}

function SectionHeader({ title, accent }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="w-1 h-6 rounded-full" style={{ backgroundColor: accent }} />
      <h2 className="text-2xl font-black text-white leading-none" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.02em" }}>{title}</h2>
    </div>
  );
}

function RoundLabel({ children }) {
  return <div className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 pt-1 pb-0.5">{children}</div>;
}
