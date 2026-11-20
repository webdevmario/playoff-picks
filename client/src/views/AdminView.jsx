import React, { useEffect, useState } from "react";
import { Download, RefreshCw, Shield, KeyRound, Trash2 } from "lucide-react";
import { TEAMS, MATCHUPS, ROUNDS, teamsFor, validateSeeds } from "@shared/nba.js";
import { api, downloadExport } from "../lib/api.js";
import { Avatar, Badge, Button, Card, CardHeader, Field, TeamLogo, cx, inputClass, useUi } from "../components/ui.jsx";
import { fmtAgo, fmtDateTime, fromLocalInput, toLocalInput } from "../lib/util.js";

const SeedPicker = ({ seeds, onChange }) => (
  <div className="grid sm:grid-cols-2 gap-4">
    {[["E", "East"], ["W", "West"]].map(([conf, label]) => {
      const teams = Object.values(TEAMS).filter((t) => t.conf === conf);
      return (
        <div key={conf} className="space-y-1.5">
          <div className="text-xs font-semibold text-muted">{label}</div>
          {Array.from({ length: 8 }, (_, i) => {
            const value = seeds[conf][i] || "";
            const taken = new Set(seeds[conf].filter((x, j) => x && j !== i));
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 text-right text-xs text-faint tabular">{i + 1}</span>
                <TeamLogo team={value} size={22} />
                <select
                  value={value}
                  onChange={(e) => { const next = [...seeds[conf]]; next[i] = e.target.value; onChange({ ...seeds, [conf]: next }); }}
                  className={cx(inputClass, "h-9")}
                >
                  <option value="">Select team</option>
                  {teams.map((t) => <option key={t.abbr} value={t.abbr} disabled={taken.has(t.abbr)}>{t.city} {t.name}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      );
    })}
  </div>
);

const emptySeeds = () => ({ E: Array(8).fill(""), W: Array(8).fill("") });

const SeasonSetup = ({ seasons, season, reloadAll }) => {
  const { toast, confirm } = useUi();
  const latest = seasons[0]?.year;
  const [mode, setMode] = useState(season ? "edit" : "new");
  const [year, setYear] = useState((latest || new Date().getFullYear() - 1) + 1);
  const [seeds, setSeeds] = useState(season?.bracket?.seeds ? structuredClone(season.bracket.seeds) : emptySeeds());
  const [lockAt, setLockAt] = useState(toLocalInput(season?.lockAt));
  const [busy, setBusy] = useState(false);
  const hasEntries = season?.entries?.some((e) => e.pickCount > 0);

  useEffect(() => {
    setMode(season ? "edit" : "new");
    setSeeds(season?.bracket?.seeds ? structuredClone(season.bracket.seeds) : emptySeeds());
    setLockAt(toLocalInput(season?.lockAt));
  }, [season?.year]);

  const switchMode = (m) => {
    setMode(m);
    if (m === "new") { setSeeds(emptySeeds()); setLockAt(""); }
    else { setSeeds(structuredClone(season.bracket.seeds)); setLockAt(toLocalInput(season.lockAt)); }
  };

  const seedError = validateSeeds(seeds);

  const save = async () => {
    setBusy(true);
    try {
      if (mode === "new") {
        await api.admin.createSeason({ year: Number(year), seeds, lockAt: fromLocalInput(lockAt) });
        toast(`${year} season created`);
        await reloadAll(Number(year));
      } else {
        const seedsChanged = JSON.stringify(seeds) !== JSON.stringify(season.bracket.seeds);
        if (seedsChanged && hasEntries && !(await confirm({
          title: "Change seeds?", confirmLabel: "Change seeds", danger: true,
          message: "Picks that no longer fit the new matchups will be cleared from everyone's bracket.",
        }))) { setBusy(false); return; }
        await api.admin.updateSeason(season.year, { lockAt: fromLocalInput(lockAt), ...(seedsChanged ? { seeds } : {}) });
        toast("Season saved");
        await reloadAll(season.year);
      }
    } catch (e) {
      toast(e.message, "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title={mode === "new" ? "Start a new season" : `${season.year} season`}
        subtitle={mode === "new" ? "Enter the 16 playoff seeds once the play-in is done." : "Seeds and pick deadline"}
        action={season && (
          <Button size="sm" variant="ghost" onClick={() => switchMode(mode === "new" ? "edit" : "new")}>
            {mode === "new" ? `Edit ${season.year}` : "New season"}
          </Button>
        )}
      />
      <div className="px-4 pb-4 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          {mode === "new" && (
            <Field label="Playoff year">
              <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className={inputClass} />
            </Field>
          )}
          <Field label="Picks lock at" hint="Usually tip-off of the first playoff game. Brackets stay hidden until then.">
            <input type="datetime-local" value={lockAt} onChange={(e) => setLockAt(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <SeedPicker seeds={seeds} onChange={setSeeds} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted">{seedError || (lockAt ? `Locks ${fmtDateTime(fromLocalInput(lockAt))}` : "No deadline set: picks stay open")}</span>
          <Button onClick={save} disabled={busy || !!seedError}>{mode === "new" ? "Create season" : "Save"}</Button>
        </div>
      </div>
    </Card>
  );
};

const ResultsEditor = ({ season, reload }) => {
  const { toast } = useUi();
  const [busy, setBusy] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const set = async (id, winner) => {
    setBusy(id);
    try { await api.admin.setResult(season.year, id, winner); await reload(); }
    catch (e) { toast(e.message, "bad"); }
    finally { setBusy(null); }
  };
  const sync = async () => {
    setSyncing(true);
    try {
      const r = await api.admin.sync(season.year);
      await reload();
      toast(r.updated ? `Updated ${r.updated} series from ESPN` : "Already up to date");
    } catch (e) { toast(e.message, "bad"); }
    finally { setSyncing(false); }
  };

  return (
    <Card>
      <CardHeader
        title="Results"
        subtitle={`ESPN fills these in automatically. A result you set by hand wins over ESPN. Last sync ${fmtAgo(season.syncedAt)}.`}
        action={<Button size="sm" variant="secondary" onClick={sync} disabled={syncing}><RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> Sync ESPN</Button>}
      />
      <div className="px-4 pb-4 space-y-4">
        {ROUNDS.map((r) => (
          <div key={r.round}>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">{r.label}</div>
            <div className="divide-y divide-line border border-line rounded-lg">
              {MATCHUPS.filter((m) => m.round === r.round).map((m) => {
                const [a, b] = teamsFor(m.id, season.bracket, season.results);
                const winner = season.results[m.id];
                const source = season.resultSources?.[m.id];
                return (
                  <div key={m.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="w-14 text-xs text-faint">{m.id}</span>
                    {a && b ? (
                      <div className="flex-1 flex flex-wrap items-center gap-1.5">
                        {[a, b].map((t) => (
                          <button
                            key={t} disabled={busy === m.id}
                            onClick={() => set(m.id, winner === t ? null : t)}
                            className={cx("flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs font-semibold transition-colors",
                              winner === t ? "bg-good/10 border-good text-good" : "border-line text-muted hover:text-ink hover:bg-surface2")}
                          >
                            <TeamLogo team={t} size={16} /> {t}
                          </button>
                        ))}
                        {winner && <Badge>{source === "manual" ? "Set by hand" : "ESPN"}</Badge>}
                      </div>
                    ) : <span className="flex-1 text-xs text-faint">Waiting on earlier round</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

const PlayersAdmin = ({ me }) => {
  const { toast, confirm } = useUi();
  const [players, setPlayers] = useState([]);
  const load = () => api.admin.players().then(setPlayers).catch((e) => toast(e.message, "bad"));
  useEffect(() => { load(); }, []);

  const act = async (fn, msg) => {
    try { await fn(); toast(msg); load(); } catch (e) { toast(e.message, "bad"); }
  };

  return (
    <Card>
      <CardHeader title="Players" subtitle="Reset a forgotten PIN: they'll choose a new one next time they sign in." />
      <div className="divide-y divide-line border-t border-line">
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
            <Avatar player={p} size={32} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold truncate">{p.name}</span>
                {p.isAdmin && <Badge tone="accent">Admin</Badge>}
                {!p.hasPin && <Badge>No PIN yet</Badge>}
              </div>
              <div className="text-xs text-muted">Last seen {fmtAgo(p.lastSeenAt)}</div>
            </div>
            <div className="flex items-center gap-1">
              {p.id !== me.id && (
                <Button size="sm" variant="ghost" title={p.isAdmin ? "Remove admin" : "Make admin"} onClick={() => act(() => api.admin.updatePlayer(p.id, { isAdmin: !p.isAdmin }), p.isAdmin ? `${p.name} is no longer an admin` : `${p.name} is now an admin`)}>
                  <Shield size={14} />
                </Button>
              )}
              {p.hasPin && (
                <Button size="sm" variant="ghost" title="Reset PIN" onClick={async () => {
                  if (await confirm({ title: `Reset ${p.name}'s PIN?`, message: "They'll be signed out everywhere and pick a new PIN next time.", confirmLabel: "Reset PIN" }))
                    act(() => api.admin.resetPin(p.id), "PIN reset");
                }}>
                  <KeyRound size={14} />
                </Button>
              )}
              {p.id !== me.id && (
                <Button size="sm" variant="ghost" title="Remove player" onClick={async () => {
                  if (await confirm({ title: `Remove ${p.name}?`, message: "This deletes their brackets in every season. It can't be undone.", confirmLabel: "Remove", danger: true }))
                    act(() => api.admin.removePlayer(p.id), `${p.name} removed`);
                }}>
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

const DataCard = () => {
  const { toast } = useUi();
  const [info, setInfo] = useState(null);
  useEffect(() => { api.admin.info().then(setInfo).catch(() => {}); }, []);
  return (
    <Card>
      <CardHeader title="Data" subtitle="Every season's brackets and results." />
      <div className="px-4 pb-4 space-y-3">
        {info && <div className="text-xs text-muted break-all">Stored in <code className="text-ink">{info.dbPath}</code></div>}
        <Button variant="secondary" size="sm" onClick={() => downloadExport().catch((e) => toast(e.message, "bad"))}><Download size={14} /> Export JSON</Button>
      </div>
    </Card>
  );
};

export default function AdminView({ me, season, seasons, reload, reloadAll }) {
  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-4 items-start">
      <div className="space-y-4">
        <SeasonSetup seasons={seasons} season={season} reloadAll={reloadAll} />
        {season?.bracket && <ResultsEditor season={season} reload={reload} />}
      </div>
      <div className="space-y-4">
        <PlayersAdmin me={me} />
        <DataCard />
      </div>
    </div>
  );
}
