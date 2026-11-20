import React, { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Delete, Plus } from "lucide-react";
import { TEAMS } from "@shared/nba.js";
import { api } from "../lib/api.js";
import { Avatar, Button, Card, Field, Logo, Spinner, cx, inputClass } from "../components/ui.jsx";

export const TeamSelect = ({ value, onChange, placeholder = "No favorite team" }) => (
  <select value={value || ""} onChange={(e) => onChange(e.target.value || null)} className={inputClass}>
    <option value="">{placeholder}</option>
    {[["E", "Eastern Conference"], ["W", "Western Conference"]].map(([conf, label]) => (
      <optgroup key={conf} label={label}>
        {Object.values(TEAMS).filter((t) => t.conf === conf).map((t) => (
          <option key={t.abbr} value={t.abbr}>{t.city} {t.name}</option>
        ))}
      </optgroup>
    ))}
  </select>
);

// Four-dot PIN entry with an on-screen keypad (and keyboard support).
export const PinPad = ({ label, error, busy, onComplete, resetKey }) => {
  const [pin, setPin] = useState("");
  useEffect(() => setPin(""), [resetKey]);

  const press = (d) => {
    if (busy) return;
    setPin((p) => {
      if (p.length >= 4) return p;
      const next = p + d;
      if (next.length === 4) setTimeout(() => onComplete(next), 80);
      return next;
    });
  };
  const back = () => !busy && setPin((p) => p.slice(0, -1));

  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex flex-col items-center">
      <p className="text-sm font-medium text-ink">{label}</p>
      <div className={cx("flex gap-4 my-5", error && "animate-[shake_0.3s]")}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cx("w-3.5 h-3.5 rounded-full border-2 transition-colors", i < pin.length ? "bg-accent border-accent" : "border-faint")} />
        ))}
      </div>
      <p className="h-5 text-xs text-bad mb-2" role="alert">{busy ? <Spinner className="text-muted" /> : error}</p>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} onClick={() => press(d)} className="w-16 h-16 rounded-full bg-surface2 text-xl font-semibold text-ink hover:bg-line active:scale-95 transition">{d}</button>
        ))}
        <span />
        <button onClick={() => press("0")} className="w-16 h-16 rounded-full bg-surface2 text-xl font-semibold text-ink hover:bg-line active:scale-95 transition">0</button>
        <button onClick={back} aria-label="Delete" className="w-16 h-16 rounded-full flex items-center justify-center text-muted hover:text-ink active:scale-95 transition"><Delete size={22} /></button>
      </div>
    </div>
  );
};

// Creating a PIN asks twice.
const NewPinFlow = ({ onDone, busy, error: outerError }) => {
  const [first, setFirst] = useState(null);
  const [error, setError] = useState(null);
  const [resetKey, setResetKey] = useState(0);
  return (
    <PinPad
      key={first ? "confirm" : "create"}
      label={first ? "Enter it again to confirm" : "Create a 4-digit PIN"}
      error={error || outerError}
      busy={busy}
      resetKey={resetKey}
      onComplete={(pin) => {
        if (!first) { setFirst(pin); setError(null); return; }
        if (pin !== first) { setFirst(null); setError("PINs didn't match. Try again."); setResetKey((k) => k + 1); return; }
        onDone(pin);
      }}
    />
  );
};

export default function SignIn({ onSignedIn, seasonLabel }) {
  const [players, setPlayers] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [step, setStep] = useState({ kind: "choose" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [name, setName] = useState("");
  const [favTeam, setFavTeam] = useState(null);

  useEffect(() => {
    api.players().then(setPlayers).catch((e) => setLoadError(e.message));
  }, []);

  const signIn = async (player, pin) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.signIn(player.id, pin);
      onSignedIn(res);
    } catch (e) {
      setError(e.message);
      setAttempt((a) => a + 1);
      setBusy(false);
    }
  };

  const create = async (pin) => {
    setBusy(true);
    setError(null);
    try {
      onSignedIn(await api.createPlayer({ name, favTeam, pin }));
    } catch (e) {
      setError(e.message);
      setBusy(false);
      setStep({ kind: "new" });
    }
  };

  const back = () => { setStep({ kind: "choose" }); setError(null); setBusy(false); };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo size={48} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Playoff Picks</h1>
          <p className="text-sm text-muted mt-1">{seasonLabel}</p>
        </div>

        <Card className="p-5">
          {step.kind === "choose" && (
            <>
              <h2 className="text-sm font-semibold mb-3">Who's picking?</h2>
              {loadError && <p className="text-sm text-bad">{loadError}</p>}
              {!players && !loadError && <div className="py-6 flex justify-center"><Spinner className="text-muted" /></div>}
              {players && (
                <div className="space-y-1.5">
                  {players.map((p) => (
                    <button key={p.id} onClick={() => { setStep({ kind: "pin", player: p }); setError(null); }} className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-line hover:bg-surface2 hover:border-faint transition-colors text-left">
                      <Avatar player={p} size={36} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold truncate">{p.name}</span>
                        {!p.hasPin && <span className="block text-xs text-muted">First time here: you'll set a PIN</span>}
                      </span>
                      <ChevronRight size={16} className="text-faint" />
                    </button>
                  ))}
                  <button onClick={() => { setStep({ kind: "new" }); setError(null); }} className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-dashed border-line hover:bg-surface2 transition-colors text-left">
                    <span className="w-9 h-9 rounded-full bg-accent/10 text-accent flex items-center justify-center"><Plus size={18} /></span>
                    <span className="text-sm font-semibold">New player</span>
                  </button>
                </div>
              )}
            </>
          )}

          {step.kind === "pin" && (
            <>
              <button onClick={back} className="flex items-center gap-1 text-xs font-medium text-muted hover:text-ink mb-4"><ArrowLeft size={14} /> Back</button>
              <div className="flex flex-col items-center mb-4">
                <Avatar player={step.player} size={56} />
                <div className="mt-2 text-base font-semibold">{step.player.name}</div>
              </div>
              {step.player.hasPin ? (
                <PinPad label="Enter your PIN" error={error} busy={busy} resetKey={attempt} onComplete={(pin) => signIn(step.player, pin)} />
              ) : (
                <NewPinFlow busy={busy} error={error} onDone={(pin) => signIn(step.player, pin)} />
              )}
            </>
          )}

          {step.kind === "new" && (
            <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) { setError(null); setStep({ kind: "newPin" }); } }} className="space-y-4">
              <button type="button" onClick={back} className="flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"><ArrowLeft size={14} /> Back</button>
              <Field label="Name">
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Your name" className={inputClass} />
              </Field>
              <Field label="Favorite team" hint="Sets your avatar color.">
                <TeamSelect value={favTeam} onChange={setFavTeam} />
              </Field>
              {error && <p className="text-sm text-bad">{error}</p>}
              <Button type="submit" className="w-full" disabled={!name.trim()}>Continue</Button>
            </form>
          )}

          {step.kind === "newPin" && (
            <>
              <button onClick={() => setStep({ kind: "new" })} className="flex items-center gap-1 text-xs font-medium text-muted hover:text-ink mb-4"><ArrowLeft size={14} /> Back</button>
              <div className="flex flex-col items-center mb-4">
                <Avatar player={{ name, favTeam }} size={56} />
                <div className="mt-2 text-base font-semibold">{name}</div>
              </div>
              <NewPinFlow busy={busy} error={error} onDone={create} />
            </>
          )}
        </Card>
        <p className="text-xs text-faint text-center mt-4">Your PIN works on any device. Each device remembers you after you sign in.</p>
      </div>
    </div>
  );
}
