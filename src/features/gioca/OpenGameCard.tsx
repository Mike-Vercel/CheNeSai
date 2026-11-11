"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHostCommand } from "./use-host-command";
import { useDeviceKind } from "./use-device";

export interface OpenGameInfo {
  id: string;
  code: string;
  players: number;
  label: string;
}

/**
 * «Hai una partita in corso»: una sola scheda compatta sopra la nuova partita (solo se c'è una
 * partita ancora aperta). Riprendi: dal computer il pannello col TV, dal telefono la scelta
 * televisore / questo telefono. Termina: chiude la partita (podio) dopo una conferma.
 */
export function OpenGameCard({ game, others }: { game: OpenGameInfo; others: number }) {
  const router = useRouter();
  const handheld = useDeviceKind() === "handheld";
  const { run, busy, error } = useHostCommand(game.id);
  const [confirm, setConfirm] = useState(false);
  return (
    <section aria-label="Partita in corso" className="flex flex-col gap-3 rounded-[24px] bg-[#1f5c3d]/35 p-4 ring-1 ring-[#5dffab]/30 sm:p-5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="relative flex h-3 w-3 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5dffab] opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-[#5dffab]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-black text-white">Hai una partita in corso</p>
          <p className="text-sm font-bold text-white/75">
            <span className="font-display tracking-[0.14em] text-gold">{game.code}</span> · {game.players} {game.players === 1 ? "giocatore" : "giocatori"} · {game.label}
            {others > 0 && ` · altre ${others} nel profilo`}
          </p>
        </div>
      </div>
      {confirm ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-white">Chiudere la partita e mostrare il podio?</span>
          <button
            type="button"
            disabled={!!busy}
            className="rounded-full bg-flame px-4 py-2 text-sm font-black text-white disabled:opacity-50"
            onClick={() => void run("finish").then((ok) => ok && router.refresh())}
          >
            Sì, termina
          </button>
          <button type="button" className="rounded-full px-3 py-2 text-sm font-bold text-white/80" onClick={() => setConfirm(false)}>
            No
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Link href={handheld ? `/gioca/schermo/${game.id}` : `/gioca/partita/${game.id}`} className="flex-1 rounded-full bg-gold px-5 py-2.5 text-center font-display text-xl text-ink transition hover:bg-white sm:flex-none">
            Riprendi
          </Link>
          <button type="button" className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-black text-white hover:bg-white/20" onClick={() => setConfirm(true)}>
            Termina
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm font-bold text-[#ffb3c1]">
          {error}
        </p>
      )}
    </section>
  );
}
