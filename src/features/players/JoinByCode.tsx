"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinByCode() {
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
      <label htmlFor="code" className="sr-only">
        Codice partita
      </label>
      <input
        id="code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
        placeholder="CODICE"
        autoCapitalize="characters"
        autoComplete="off"
        inputMode="text"
        className="h-14 min-w-0 flex-1 rounded-2xl border-[3px] border-gold/70 bg-white px-4 text-center font-display text-2xl tracking-[0.3em] text-ink placeholder:text-ink/30 focus:border-cyan focus:outline-none"
      />
      <button
        type="submit"
        disabled={!valid}
        className="h-14 shrink-0 rounded-2xl border-[3px] border-[#b8770a] bg-gradient-to-b from-[#ffe680] to-gold-deep px-5 font-display text-xl text-ink shadow-[0_4px_0_#9a5d00] disabled:opacity-50"
      >
        GIOCA
      </button>
    </form>
  );
}
