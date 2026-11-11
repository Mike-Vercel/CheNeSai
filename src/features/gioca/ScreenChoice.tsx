"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { enterFullscreen, lockPortrait, unlockMobileAudio } from "./mobile-show";

function TvIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-14 w-14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="9" width="40" height="25" rx="4" />
      <path d="M17 41h14M24 34v7" />
      <rect x="31" y="20" width="9" height="16" rx="2" fill="#170824" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-14 w-14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="14" y="4" width="20" height="40" rx="4" />
      <path d="M21 38h6" />
      <path d="M19 15l10 6-10 6z" fill="currentColor" />
    </svg>
  );
}

/**
 * Partita creata dal TELEFONO: dove si gioca?
 *  A. «Sul televisore»: il TV mostra lo show (pagina /tv + codice di 4 cifre) e il telefono fa da telecomando.
 *  B. «Su questo telefono»: tutto lo show qui, in verticale (anche l'intro), e l'host gioca dallo stesso schermo.
 * Il tocco su B serve anche a sbloccare audio e schermo intero (regola dei browser).
 */
export function ScreenChoice({ sessionId, code }: { sessionId: string; code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"tv" | "phone" | null>(null);

  async function onPhone() {
    setBusy("phone");
    // tutto dentro il tocco: audio, schermo intero, verticale
    await Promise.all([unlockMobileAudio(), enterFullscreen().then((fs) => (fs ? lockPortrait() : undefined))]);
    router.push(`/gioca/telefono/${sessionId}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="text-center">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-white/55">
          Partita creata · codice <span className="font-display tracking-[0.18em] text-gold">{code}</span>
        </p>
        <h1 className="mt-2 font-display text-4xl leading-none">Dove giochiamo?</h1>
      </header>

      <button
        type="button"
        disabled={!!busy}
        onClick={() => {
          setBusy("tv");
          router.push(`/gioca/telecomando/${sessionId}`);
        }}
        className="group flex items-center gap-4 rounded-[28px] bg-gradient-to-br from-[#2a1460] to-[#170824] p-5 text-left ring-2 ring-[#7fc3ff]/40 transition active:scale-[0.98] disabled:opacity-60"
      >
        <span className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-[#087cff]/25 text-[#9fd0ff]">
          <TvIcon />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-3xl leading-none text-white">Sul televisore</span>
          <span className="mt-1.5 block text-[15px] font-bold leading-snug text-white/75">Lo show va sul TV di casa o del locale, il telefono diventa il telecomando.</span>
          <span className="mt-1 block text-xs font-bold text-white/50">Smart TV, Chromecast con Google TV, Fire TV o un PC collegato</span>
        </span>
      </button>

      <button
        type="button"
        disabled={!!busy}
        onClick={() => void onPhone()}
        className="group flex items-center gap-4 rounded-[28px] bg-gradient-to-br from-[#5a0f3c] to-[#170824] p-5 text-left ring-2 ring-gold/50 transition active:scale-[0.98] disabled:opacity-60"
      >
        <span className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-gold/20 text-gold">
          <PhoneIcon />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-3xl leading-none text-white">Su questo telefono</span>
          <span className="mt-1.5 block text-[15px] font-bold leading-snug text-white/75">Tutto lo show qui, in verticale: presentatori, voci e domande. E giochi anche tu.</span>
          <span className="mt-1 block text-xs font-bold text-white/50">Gli amici entrano dal loro telefono con il link</span>
        </span>
      </button>

      {busy && <p className="text-center text-sm font-bold text-white/70">Un attimo…</p>}
      <p className="text-center text-sm font-bold text-white/55">
        Hai un PC collegato al TV?{" "}
        <Link href={`/gioca/tv/${sessionId}`} className="text-white/80 underline underline-offset-4">
          Apri qui lo schermo TV
        </Link>
      </p>
    </div>
  );
}
