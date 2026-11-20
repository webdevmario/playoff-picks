import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { X, Check, AlertCircle } from "lucide-react";
import { TEAMS, teamLogo } from "@shared/nba.js";
import { initials } from "../lib/util.js";

export const cx = (...c) => c.filter(Boolean).join(" ");

export const Logo = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="14" className="fill-accent" />
    <circle cx="32" cy="32" r="18" fill="none" stroke="#fff" strokeWidth="3.5" />
    <path d="M14 32h36M32 14v36M19.5 19.5c6 5 6 20 0 25M44.5 19.5c-6 5-6 20 0 25" fill="none" stroke="#fff" strokeWidth="3" />
  </svg>
);

export const Button = ({ variant = "primary", size = "md", className, children, ...props }) => (
  <button
    {...props}
    className={cx(
      "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      size === "sm" ? "h-8 px-3 text-xs" : size === "lg" ? "h-12 px-5 text-base" : "h-10 px-4 text-sm",
      variant === "primary" && "bg-accent text-accent-ink hover:bg-accent/90",
      variant === "secondary" && "bg-surface border border-line text-ink hover:bg-surface2",
      variant === "ghost" && "text-muted hover:text-ink hover:bg-surface2",
      variant === "danger" && "bg-bad text-white hover:bg-bad/90",
      className
    )}
  >
    {children}
  </button>
);

export const Card = ({ className, children, ...props }) => (
  <div {...props} className={cx("bg-surface border border-line rounded-xl shadow-card", className)}>{children}</div>
);

export const CardHeader = ({ title, subtitle, action }) => (
  <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
    <div className="min-w-0">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const Badge = ({ tone = "neutral", className, children }) => (
  <span
    className={cx(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
      tone === "neutral" && "bg-surface2 text-muted",
      tone === "accent" && "bg-accent/10 text-accent",
      tone === "good" && "bg-good/10 text-good",
      tone === "bad" && "bg-bad/10 text-bad",
      tone === "live" && "bg-bad text-white",
      className
    )}
  >
    {children}
  </span>
);

export const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="block text-xs font-medium text-muted mb-1.5">{label}</span>
    {children}
    {hint && <span className="block text-xs text-faint mt-1">{hint}</span>}
  </label>
);

export const inputClass =
  "w-full h-10 px-3 rounded-lg bg-surface border border-line text-ink text-sm placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent";

export const TeamLogo = ({ team, size = 24, className }) => {
  const [failed, setFailed] = useState(false);
  const t = TEAMS[team];
  if (!t) return <span className={cx("inline-block rounded-full bg-surface2 flex-shrink-0", className)} style={{ width: size, height: size }} />;
  if (failed) {
    return (
      <span
        className={cx("inline-flex items-center justify-center rounded-full text-white font-bold flex-shrink-0", className)}
        style={{ width: size, height: size, backgroundColor: t.color, fontSize: Math.max(7, size * 0.32) }}
      >
        {t.abbr}
      </span>
    );
  }
  return (
    <img
      src={teamLogo(team)} alt="" width={size} height={size} loading="lazy"
      onError={() => setFailed(true)}
      className={cx("object-contain flex-shrink-0", className)} style={{ width: size, height: size }}
    />
  );
};

export const Avatar = ({ player, size = 32, className }) => {
  const color = TEAMS[player?.favTeam]?.color;
  return (
    <span
      className={cx("inline-flex items-center justify-center rounded-full font-semibold flex-shrink-0 select-none", !color && "bg-surface2 text-ink border border-line", className)}
      style={{ width: size, height: size, fontSize: size * 0.4, ...(color ? { backgroundColor: color, color: "#fff" } : {}) }}
    >
      {initials(player?.name)}
    </span>
  );
};

export const Segmented = ({ options, value, onChange, className }) => (
  <div className={cx("inline-flex p-1 rounded-lg bg-surface2 border border-line", className)} role="tablist">
    {options.map((o) => (
      <button
        key={o.value} role="tab" aria-selected={value === o.value}
        onClick={() => onChange(o.value)}
        className={cx(
          "flex-1 px-3 h-8 rounded-md text-xs font-semibold whitespace-nowrap transition-colors",
          value === o.value ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
        )}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export const Spinner = ({ className }) => (
  <span className={cx("inline-block w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin", className)} />
);

export const ProgressBar = ({ value, max }) => (
  <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
    <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${Math.round((value / max) * 100)}%` }} />
  </div>
);

export const EmptyState = ({ icon: Icon, title, children, action }) => (
  <div className="text-center py-12 px-6">
    {Icon && <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-surface2 flex items-center justify-center"><Icon size={22} className="text-muted" /></div>}
    <h3 className="text-base font-semibold text-ink">{title}</h3>
    {children && <div className="text-sm text-muted mt-1 max-w-sm mx-auto">{children}</div>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// Bottom sheet on phones, centered dialog on larger screens.
export const Sheet = ({ title, onClose, children, footer, wide = false }) => {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div role="dialog" aria-modal="true" className={cx("w-full bg-surface border border-line shadow-pop rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col", wide ? "sm:max-w-2xl" : "sm:max-w-md")}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-line flex-shrink-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {onClose && <button onClick={onClose} className="p-1.5 -mr-1.5 rounded-md text-muted hover:text-ink hover:bg-surface2" aria-label="Close"><X size={18} /></button>}
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-line flex justify-end gap-2 pb-safe flex-shrink-0">{footer}</div>}
      </div>
    </div>
  );
};

// ---------- Confirm + toasts ----------
const UiContext = createContext(null);
export const useUi = () => useContext(UiContext);

export const UiProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const toast = useCallback((message, tone = "good") => {
    const id = Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const confirm = useCallback((opts) => new Promise((resolve) => setConfirmState({ ...opts, resolve })), []);
  const close = (v) => { confirmState?.resolve(v); setConfirmState(null); };

  return (
    <UiContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="fixed z-[70] left-1/2 -translate-x-1/2 bottom-20 sm:bottom-6 space-y-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-ink text-bg text-sm font-medium shadow-pop">
            {t.tone === "bad" ? <AlertCircle size={16} className="text-bad flex-shrink-0" /> : <Check size={16} className="text-good flex-shrink-0" />}
            {t.message}
          </div>
        ))}
      </div>
      {confirmState && (
        <Sheet
          title={confirmState.title}
          onClose={() => close(false)}
          footer={<>
            <Button variant="secondary" onClick={() => close(false)}>{confirmState.cancelLabel || "Cancel"}</Button>
            <Button variant={confirmState.danger ? "danger" : "primary"} onClick={() => close(true)}>{confirmState.confirmLabel || "Confirm"}</Button>
          </>}
        >
          <p className="text-sm text-muted">{confirmState.message}</p>
        </Sheet>
      )}
    </UiContext.Provider>
  );
};
