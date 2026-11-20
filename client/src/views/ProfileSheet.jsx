import React, { useState } from "react";
import { LogOut } from "lucide-react";
import { api, prefs } from "../lib/api.js";
import { Avatar, Button, Field, Segmented, Sheet, inputClass, useUi } from "../components/ui.jsx";
import { TeamSelect } from "./SignIn.jsx";

const applyTheme = (t) => {
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  prefs.set("pp.theme", t === "system" ? null : t);
};

export default function ProfileSheet({ me, onClose, onUpdated, onSignOut }) {
  const { toast } = useUi();
  const [name, setName] = useState(me.name);
  const [favTeam, setFavTeam] = useState(me.favTeam);
  const [theme, setTheme] = useState(prefs.get("pp.theme") || "system");
  const [pins, setPins] = useState({ current: "", next: "" });
  const [busy, setBusy] = useState(false);
  const dirty = name.trim() !== me.name || favTeam !== me.favTeam;

  const save = async () => {
    setBusy(true);
    try {
      onUpdated(await api.updateMe({ name, favTeam }));
      toast("Profile saved");
    } catch (e) { toast(e.message, "bad"); }
    finally { setBusy(false); }
  };

  const changePin = async (e) => {
    e.preventDefault();
    try {
      await api.changePin(pins.current, pins.next);
      setPins({ current: "", next: "" });
      toast("PIN changed. Other devices were signed out.");
    } catch (err) { toast(err.message, "bad"); }
  };

  const pinInput = (key, label) => (
    <Field label={label}>
      <input
        type="password" inputMode="numeric" autoComplete="off" maxLength={4} pattern="\d{4}"
        value={pins[key]} onChange={(e) => setPins({ ...pins, [key]: e.target.value.replace(/\D/g, "") })}
        className={inputClass}
      />
    </Field>
  );

  return (
    <Sheet title="Profile" onClose={onClose}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Avatar player={{ name, favTeam }} size={48} />
          <div>
            <div className="font-semibold">{me.name}</div>
            <div className="text-xs text-muted">{me.isAdmin ? "Admin" : "Player"}</div>
          </div>
        </div>

        <section className="space-y-3">
          <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} className={inputClass} /></Field>
          <Field label="Favorite team"><TeamSelect value={favTeam} onChange={setFavTeam} /></Field>
          <Button onClick={save} disabled={!dirty || !name.trim() || busy} className="w-full">Save profile</Button>
        </section>

        <form onSubmit={changePin} className="space-y-3 pt-5 border-t border-line">
          <h3 className="text-sm font-semibold">Change PIN</h3>
          <div className="grid grid-cols-2 gap-3">
            {pinInput("current", "Current PIN")}
            {pinInput("next", "New PIN")}
          </div>
          <Button type="submit" variant="secondary" className="w-full" disabled={pins.current.length !== 4 || pins.next.length !== 4}>Change PIN</Button>
        </form>

        <section className="space-y-2 pt-5 border-t border-line">
          <h3 className="text-sm font-semibold">Appearance</h3>
          <Segmented
            className="w-full"
            value={theme}
            onChange={(t) => { setTheme(t); applyTheme(t); }}
            options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]}
          />
        </section>

        <Button variant="secondary" className="w-full" onClick={onSignOut}><LogOut size={16} /> Sign out of this device</Button>
      </div>
    </Sheet>
  );
}
