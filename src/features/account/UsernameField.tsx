"use client";

import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { USERNAME_MAX, validateUsername } from "@/lib/game-engine/public-game";

export type UsernameStatus = "idle" | "checking" | "ok" | "error";

/**
 * Campo username con controllo dal vivo: prima le regole (3–20 caratteri, lettere, numeri, _ e .),
 * poi la disponibilità sul server (senza distinzione tra maiuscole e minuscole).
 */
export function UsernameField({
  value,
  onChange,
  onStatus,
  id = "username",
}: {
  value: string;
  onChange: (v: string) => void;
  onStatus?: (s: UsernameStatus) => void;
  id?: string;
}) {
  const [status, setStatus] = useState<UsernameStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const v = value.trim();
    let cancelled = false;
    const t = setTimeout(
      () => {
        if (!v) {
          setStatus("idle");
          setMessage(null);
          return;
        }
        const local = validateUsername(v);
        if (!local.ok) {
          setStatus("error");
          setMessage(local.message);
          return;
        }
        setStatus("checking");
        setMessage(null);
        fetch(`/api/account/username?u=${encodeURIComponent(v)}`, { cache: "no-store" })
          .then((r) => r.json() as Promise<{ available?: boolean; message?: string | null; error?: { message?: string } }>)
          .then((r) => {
            if (cancelled) return;
            if (r.available) {
              setStatus("ok");
              setMessage("Disponibile");
            } else {
              setStatus("error");
              setMessage(r.message ?? r.error?.message ?? "Non disponibile");
            }
          })
          .catch(() => {
            if (!cancelled) {
              setStatus("idle");
              setMessage(null);
            }
          });
      },
      v ? 350 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value]);

  useEffect(() => onStatus?.(status), [status, onStatus]);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-extrabold text-white">
        Username
      </label>
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-white/40">
          @
        </span>
        <input
          id={id}
          name="username"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\s/g, "").slice(0, USERNAME_MAX))}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-invalid={status === "error"}
          data-ok={status === "ok"}
          aria-describedby={`${id}-help`}
          className="qz-field rounded-2xl h-14 w-full pl-9 pr-12 text-[17px]"
          placeholder="il_tuo_nome"
        />
        <span aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
          {status === "checking" && (
            <svg viewBox="0 0 24 24" className="qz-spinner h-5 w-5 text-white/60" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          )}
          {status === "ok" && (
            <svg viewBox="0 0 24 24" className="h-6 w-6 animate-pop-in text-lime" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          )}
          {status === "error" && (
            <svg viewBox="0 0 24 24" className="h-5 w-5 animate-pop-in text-[#ff5470]" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          )}
        </span>
      </div>
      <p id={`${id}-help`} aria-live="polite" className={clsx("mt-1.5 text-sm font-bold", status === "error" ? "text-[#ff9db0]" : status === "ok" ? "text-lime" : "text-white/65")}>
        {status === "checking" ? "Controllo…" : (message ?? "3–20 caratteri: lettere, numeri, _ e punto. Si vede in alto quando sei collegato; in partita scegli il nome che vuoi.")}
      </p>
    </div>
  );
}
