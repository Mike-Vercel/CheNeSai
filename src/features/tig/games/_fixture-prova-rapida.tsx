"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { PlayerGameProps, TvGameProps } from "./ui-contract";

/**
 * ⚠️ FIXTURE DI SVILUPPO DEL RAMO CORE: le schermate della meccanica di prova «prova-rapida» (4 opzioni, risposta di
 * squadra). Servono a costruire e provare il core (telefono, PC con tastiera, TV); al merge il ramo GIOCHI registra
 * le schermate vere in `MECHANIC_UIS`.
 */
interface View {
  question: string;
  options: string[];
}
interface Reveal {
  answer: number;
  answerText: string;
  explain: string;
}
const LETTERS = ["A", "B", "C", "D"];
const COLORS = ["#ff2d3d", "#ffb020", "#39e0ff", "#9b5cff"];

export function ProvaRapidaPlayer(props: PlayerGameProps) {
  const view = props.view as View | null;
  const reveal = props.reveal as Reveal | null;
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const open = props.stage === "play" && !props.submitted;
  const send = async (choice: number | null) => {
    if (choice === null || busy || !props.canSubmit || !open) return;
    setBusy(true);
    setErr(null);
    const r = await props.submit({ choice });
    setBusy(false);
    if (!r.ok) setErr(r.reason ?? "Invio non riuscito");
  };
  useAnswerKeys({ enabled: open, count: 4, onPick: (i) => setPicked(i), onConfirm: props.canSubmit ? () => void send(picked) : null });
  if (!view) return null;
  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-balance text-center text-[clamp(1.15rem,4.6vw,1.7rem)] font-extrabold leading-tight">{view.question}</p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {view.options.map((o, i) => {
          const isAnswer = reveal?.answer === i;
          return (
            <button
              key={i}
              type="button"
              disabled={!open || busy}
              onClick={() => (props.canSubmit ? setPicked(i) : setPicked(i))}
              aria-pressed={picked === i}
              className={clsx(
                "flex min-h-[4rem] items-center gap-3 rounded-2xl border-2 px-4 text-left text-lg font-extrabold transition active:scale-[0.98]",
                picked === i ? "border-white bg-white/15" : "border-white/12 bg-black/45",
                reveal && (isAnswer ? "!border-[#7cff4f] !bg-[#7cff4f]/20" : "opacity-50"),
              )}
            >
              <span className="tig-display grid h-10 w-10 shrink-0 place-items-center rounded-xl text-2xl text-black" style={{ background: COLORS[i] }}>
                {LETTERS[i]}
              </span>
              <span className="min-w-0 flex-1">{o}</span>
              <kbd className="hidden rounded border border-white/25 px-1.5 text-xs text-white/50 [@media(pointer:fine)]:inline">{i + 1}</kbd>
            </button>
          );
        })}
      </div>
      {open && props.canSubmit && (
        <button type="button" className="tig-btn tig-btn-red w-full text-2xl" disabled={picked === null || busy} onClick={() => void send(picked)}>
          {busy ? "Invio…" : picked === null ? "Scegli una risposta" : `INVIA ${LETTERS[picked]}`}
        </button>
      )}
      {open && !props.canSubmit && <p className="text-center text-sm font-bold text-white/70">La risposta della squadra la invia il capitano: indicagli la tua scelta.</p>}
      {props.submitted && !reveal && <p className="tig-panel rounded-2xl px-4 py-3 text-center text-lg font-extrabold text-[#ffd15c]">Risposta inviata ✓ Aspettiamo gli altri tavoli…</p>}
      {reveal && (
        <div className="tig-panel rounded-2xl px-4 py-3 text-center">
          <p className="text-sm font-black uppercase tracking-widest text-white/60">Risposta giusta</p>
          <p className="text-xl font-extrabold text-[#7cff4f]">
            {LETTERS[reveal.answer]} · {reveal.answerText}
          </p>
          <p className="mt-1 text-sm font-bold text-white/70">{reveal.explain}</p>
        </div>
      )}
      {err && <p className="text-center text-sm font-bold text-[#ff8a95]">{err}</p>}
    </div>
  );
}

export function ProvaRapidaTv(props: TvGameProps) {
  const view = props.view as View | null;
  const reveal = props.reveal as Reveal | null;
  if (!view) return null;
  return (
    <div className="flex w-full flex-col items-center gap-[2.4vmin]">
      <p className="tig-panel max-w-[78vw] text-balance rounded-3xl px-[3vmin] py-[2vmin] text-center text-[clamp(1.4rem,4.4vmin,3.4rem)] font-extrabold leading-tight">{view.question}</p>
      <div className="grid w-[min(86vw,150vmin)] grid-cols-2 gap-[1.6vmin]">
        {view.options.map((o, i) => (
          <div
            key={i}
            className={clsx("tig-panel flex items-center gap-[1.6vmin] rounded-2xl px-[2vmin] py-[1.6vmin] transition", reveal && (reveal.answer === i ? "tig-pop !border-[#7cff4f] shadow-[0_0_50px_rgba(124,255,79,.45)]" : "opacity-35"))}
          >
            <span className="tig-display grid h-[6vmin] w-[6vmin] shrink-0 place-items-center rounded-xl text-[4vmin] text-black" style={{ background: COLORS[i] }}>
              {LETTERS[i]}
            </span>
            <span className="text-[clamp(1rem,3.2vmin,2.4rem)] font-extrabold">{o}</span>
          </div>
        ))}
      </div>
      {reveal && <p className="max-w-[70vw] text-center text-[2.4vmin] font-bold text-white/75">{reveal.explain}</p>}
    </div>
  );
}
