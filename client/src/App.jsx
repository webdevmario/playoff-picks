import React, { useCallback, useEffect, useRef, useState } from "react";
import { Network, Trophy, CalendarDays, Settings, CalendarClock, WifiOff } from "lucide-react";
import { TEAMS, sanitize } from "@shared/nba.js";
import { api, getToken, setToken } from "./lib/api.js";
import { useRoute, go, useNow, fmtCountdown } from "./lib/util.js";
import { Avatar, Badge, Button, Card, EmptyState, Logo, Spinner, TeamLogo, UiProvider, cx, useUi } from "./components/ui.jsx";
import SignIn from "./views/SignIn.jsx";
import BracketView from "./views/BracketView.jsx";
import StandingsView from "./views/StandingsView.jsx";
import ScoresView from "./views/ScoresView.jsx";
import AdminView from "./views/AdminView.jsx";
import ProfileSheet from "./views/ProfileSheet.jsx";

const TABS = [
  { id: "bracket", label: "Bracket", icon: Network },
  { id: "standings", label: "Standings", icon: Trophy },
  { id: "scores", label: "Scores", icon: CalendarDays },
  { id: "admin", label: "Admin", icon: Settings, admin: true },
];

const StatusChip = ({ season }) => {
  const now = useNow(30000);
  if (!season) return null;
  if (season.status === "open") {
    return season.lockAt
      ? <Badge tone="accent">Locks in {fmtCountdown(season.lockAt - now)}</Badge>
      : <Badge tone="accent">Picks open</Badge>;
  }
  if (season.status === "live") return <Badge tone="live">● Live</Badge>;
  if (season.status === "final") {
    return <Badge tone="neutral"><TeamLogo team={season.results.FINALS} size={14} /> {TEAMS[season.results.FINALS]?.name} won</Badge>;
  }
  return null;
};

function Shell() {
  const { toast } = useUi();
  const route = useRoute();
  const [me, setMe] = useState(null);
  const [booting, setBooting] = useState(true);
  const [seasons, setSeasons] = useState(null);
  const [season, setSeason] = useState(null);
  const [offline, setOffline] = useState(false);
  const [picks, setPicks] = useState({});
  const [saveState, setSaveState] = useState("idle");
  const [showProfile, setShowProfile] = useState(false);
  const pendingSave = useRef(null);
  const editing = useRef(false); // true while local picks are ahead of the server
  const editSeq = useRef(0);
  const picksRef = useRef(picks); // latest picks, even between renders
  useEffect(() => { if (!editing.current) picksRef.current = picks; }, [picks]);

  // ----- boot: who am I, which seasons exist -----
  useEffect(() => {
    (async () => {
      try {
        const list = await api.seasons();
        setSeasons(list);
        if (getToken()) {
          try { setMe(await api.me()); }
          catch (e) { if (e.status === 401) setToken(null); else throw e; }
        }
      } catch {
        setOffline(true);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const year = route.year || seasons?.[0]?.year || null;

  const loadSeason = useCallback(async () => {
    if (!year) return;
    try {
      const data = await api.season(year);
      setSeason(data);
      setOffline(false);
      // A season created elsewhere (another admin, another tab) shows up in the picker.
      api.seasons().then((list) => setSeasons((prev) => (JSON.stringify(prev) === JSON.stringify(list) ? prev : list))).catch(() => {});
      if (!editing.current) {
        const mine = data.entries.find((e) => e.playerId === me?.id);
        setPicks(mine?.picks || {});
      }
    } catch (e) {
      if (e.status === 0) setOffline(true);
      else if (e.status === 404) go({ year: seasons?.[0]?.year, tab: route.tab });
    }
  }, [year, me?.id]);

  useEffect(() => {
    if (!me) return;
    editing.current = false;
    setSeason((s) => (s?.year === year ? s : null));
    loadSeason();
    const t = setInterval(loadSeason, 30000);
    const onVis = () => document.visibilityState === "visible" && loadSeason();
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [loadSeason, me]);

  const reloadAll = async (goYear) => {
    const list = await api.seasons();
    setSeasons(list);
    if (goYear && goYear !== year) go({ year: goYear, tab: "admin" });
    else await loadSeason();
  };

  // ----- picks: optimistic, saved after a short pause -----
  const onPick = (matchupId, team) => {
    if (!season || season.status !== "open") return;
    editing.current = true;
    const seq = ++editSeq.current;
    picksRef.current = sanitize(season.bracket, { ...picksRef.current, [matchupId]: team });
    setPicks(picksRef.current);
    setSaveState("saving");
    clearTimeout(pendingSave.current);
    pendingSave.current = setTimeout(async () => {
      try {
        await api.savePicks(season.year, picksRef.current);
        // Newer picks may have been made while this one was in flight; let their save finish first.
        if (seq !== editSeq.current) return;
        setSaveState("saved");
        editing.current = false;
        loadSeason();
      } catch (e) {
        if (seq !== editSeq.current) return;
        setSaveState("error");
        toast(e.message, "bad");
        if (e.status === 403) { editing.current = false; loadSeason(); }
      }
    }, 500);
  };

  const signedIn = ({ token, player, pinCreated }) => {
    setToken(token);
    setMe(player);
    if (pinCreated) toast("PIN saved. Use it to sign in on any device.");
  };

  const signOut = async () => {
    await api.signOut().catch(() => {});
    setToken(null);
    setMe(null);
    setShowProfile(false);
    setSeason(null);
  };

  if (booting) return <div className="min-h-screen flex items-center justify-center"><Spinner className="text-muted" /></div>;

  if (!me) {
    if (offline) return <Offline />;
    const latest = seasons?.[0];
    return <SignIn onSignedIn={signedIn} seasonLabel={latest ? `${latest.status === "final" ? latest.year + 1 : latest.year} NBA Playoffs` : "NBA Playoffs bracket challenge"} />;
  }

  const tabs = TABS.filter((t) => !t.admin || me.isAdmin);
  const tab = tabs.some((t) => t.id === route.tab) ? route.tab : "bracket";
  const latest = seasons?.[0];
  const offseason = latest && latest.status === "final" && year === latest.year;

  let body;
  if (!seasons?.length && tab !== "admin") {
    body = (
      <Card>
        <EmptyState icon={CalendarClock} title="No season yet" action={me.isAdmin && <Button onClick={() => go({ year: null, tab: "admin" })}>Set up a season</Button>}>
          Brackets open once the playoff seeds are set in April.
        </EmptyState>
      </Card>
    );
  } else if (tab === "admin") {
    body = <AdminView me={me} season={season} seasons={seasons || []} reload={loadSeason} reloadAll={reloadAll} />;
  } else if (!season) {
    body = <div className="py-20 flex justify-center"><Spinner className="text-muted" /></div>;
  } else if (tab === "standings") {
    body = <StandingsView season={season} me={me} />;
  } else if (tab === "scores") {
    body = <ScoresView season={season} me={me} myPicks={picks} reload={loadSeason} />;
  } else {
    body = <BracketView season={season} me={me} picks={picks} saveState={saveState} onPick={onPick} viewingId={route.playerId} />;
  }

  return (
    <div className="min-h-screen pb-20 md:pb-10">
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-line">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => go({ year, tab: "bracket" })} className="flex items-center gap-2 flex-shrink-0">
            <Logo size={28} />
            <span className="font-bold tracking-tight hidden sm:inline">Playoff Picks</span>
          </button>
          {seasons?.length > 0 && (
            <select
              aria-label="Season"
              value={year || ""}
              onChange={(e) => go({ year: Number(e.target.value), tab })}
              className="h-8 pl-2.5 pr-7 rounded-lg bg-surface2 border border-line text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              {seasons.map((s) => <option key={s.year} value={s.year}>{s.year}</option>)}
            </select>
          )}
          <nav className="hidden md:flex items-center gap-1 ml-4 h-full">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => go({ year, tab: t.id })}
                className={cx("relative h-full px-3 text-sm font-medium transition-colors", tab === t.id ? "text-ink" : "text-muted hover:text-ink")}
              >
                {t.label}
                {tab === t.id && <span className="absolute left-3 right-3 bottom-0 h-0.5 bg-accent rounded-full" />}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden sm:inline-flex"><StatusChip season={season} /></span>
            <button onClick={() => setShowProfile(true)} className="flex items-center gap-2 rounded-full hover:bg-surface2 p-0.5 pr-0.5 sm:pr-3" aria-label="Profile">
              <Avatar player={me} size={30} />
              <span className="hidden sm:inline text-sm font-medium max-w-[120px] truncate">{me.name}</span>
            </button>
          </div>
        </div>
        {offline && (
          <div className="bg-bad/10 text-bad text-xs font-medium text-center py-1.5 flex items-center justify-center gap-1.5">
            <WifiOff size={12} /> Can't reach the server. Retrying…
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-4">
        {offseason && tab !== "admin" && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-line bg-surface">
            <CalendarClock size={18} className="text-accent flex-shrink-0" />
            <div className="flex-1 text-sm">
              <span className="font-semibold">{latest.year + 1} playoffs:</span>{" "}
              <span className="text-muted">brackets open in April, once the seeds are set. Here's how {latest.year} finished.</span>
            </div>
            {me.isAdmin && <Button size="sm" variant="secondary" onClick={() => go({ year, tab: "admin" })}>Set up {latest.year + 1}</Button>}
          </div>
        )}
        <div className="sm:hidden"><StatusChip season={season} /></div>
        {body}
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-line pb-safe">
        <div className="flex">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => go({ year, tab: t.id })} className={cx("flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium", tab === t.id ? "text-accent" : "text-muted")}>
              <t.icon size={20} strokeWidth={tab === t.id ? 2.4 : 1.8} />
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {showProfile && <ProfileSheet me={me} onClose={() => setShowProfile(false)} onUpdated={setMe} onSignOut={signOut} />}
    </div>
  );
}

const Offline = () => (
  <div className="min-h-screen flex items-center justify-center px-6">
    <Card className="max-w-sm w-full">
      <EmptyState icon={WifiOff} title="Can't reach Playoff Picks" action={<Button onClick={() => window.location.reload()}>Try again</Button>}>
        Make sure Tailscale is on for this device, then try again.
      </EmptyState>
    </Card>
  </div>
);

export default function App() {
  return (
    <UiProvider>
      <Shell />
    </UiProvider>
  );
}
