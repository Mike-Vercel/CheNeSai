"use client";

import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Ingresso con il codice partita (campo + pulsante) su fondo nero.
 * compact: sul telefono resta grande, dal tablet in su diventa una riga sottile (home, sotto GIOCA).
 */
export function JoinByCode({ cta = "GIOCA", inputId = "code", autoFocus, compact }: { cta?: string; inputId?: string; autoFocus?: boolean; compact?: boolean } = {}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const valid = /^[A-Z0-9]{4,8}$/.test(code);
  return (
    <form
      className="flex w-full gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) router.push(`/play/${code}`);
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        Codice partita
      </label>
      <input
        id={inputId}
        autoFocus={autoFocus}
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
        placeholder="CODICE"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        className={clsx(
          "qz-field h-14 min-w-0 rounded-2xl flex-1 px-4 text-center font-display text-2xl tracking-[0.3em]",
          compact && "md:h-12 md:rounded-full md:text-xl md:tracking-[0.25em]",
        )}
      />
      <button
        type="submit"
        disabled={!valid}
        className={clsx(
          "h-14 shrink-0 rounded-2xl px-6 font-display text-xl transition active:scale-95",
          valid ? "bg-white text-ink hover:bg-gold" : "cursor-not-allowed bg-coal-3 text-white/55",
          compact && "md:h-12 md:rounded-full md:px-5 md:text-lg",
        )}
      >
        {cta}
      </button>
    </form>
  );
}
