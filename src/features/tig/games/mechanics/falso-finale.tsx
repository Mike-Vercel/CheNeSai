"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { FalsoReveal, FalsoSubmission, FalsoView } from "@/lib/tig/games/mechanics/falso-finale";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, elapsedOf, Explain, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useClock, useSubmit } from "../kit/ui";
import { secsTo } from "./m5-kit";

type P = PlayerGameProps<FalsoView, null, FalsoSubmission, FalsoReveal>;
type T = TvGameProps<FalsoView, FalsoReveal>;
type Board = FalsoView["board"];

/** Animazioni proprie del falso finale (pioggia di dobloni e crepa), con prefisso tg5- per non toccare il kit. */
const FX = `
@keyframes tg5-fall { from { transform: translate3d(0,-12vh,0); } to { transform: translate3d(var(--dx),112vh,0); } }
@keyframes tg5-flip { 0%,100% { transform: scaleX(1); } 50% { transform: scaleX(0.18); } }
@keyframes tg5-glitch { 0%,100% { transform: none; } 20% { transform: translate(-0.4%,0.3%) skewX(-4deg); } 40% { transform: translate(0.5%,-0.2%) skewX(3deg); } 60% { transform: translate(-0.2%,0.1%); } }
.tg5-coin { position:absolute; top:0; width:var(--sz); height:var(--sz); animation: tg5-fall linear infinite; }
.tg5-coin > span { display:block; width:100%; height:100%; border-radius:9999px; animation: tg5-flip 0.9s ease-in-out infinite;
  background: radial-gradient(circle at 34% 28%, #fff4c8 0 7%, transparent 30%), radial-gradient(circle at 50% 50%, #ffd56b 0 50%, #e2a12a 62%, #b97c1c 78%, #8a5514 100%);
  box-shadow: inset 0 0 0 0.12em rgba(122,78,16,.55), 0 0.15em 0.3em rgba(0,0,0,.45); }
.tg5-glitch { animation: tg5-glitch 420ms steps(2) 3; }
@media (prefers-reduced-motion: reduce) { .tg5-coin { display:none; } .tg5-glitch { animation:none; } }
`;

/** Pioggia di dobloni d'oro (al posto dei coriandoli): posizioni e tempi fissi, uguali su ogni schermo. */
const COINS = Array.from({ length: 30 }, (_, i) => ({
  left: (i * 37 + 3) % 100,
  delay: (i * 0.31) % 3.6,
  dur: 3 + ((i * 7) % 10) / 5,
  dx: `${((i * 13) % 9) - 4}vw`,
  size: `${1.1 + ((i * 5) % 4) * 0.25}cqw`,
  flip: `${(i * 0.17) % 0.9}s`,
}));

/**
 * La classifica finta su pergamena (la «mappa» dei punteggi), righe nell'ordine scritto: alcuni enigmi dipendono
 * proprio dall'ordine. La prima riga ha il bagliore d'oro della vittoria (finta).
 */
function BoardTable({ board, tv = false }: { board: Board; tv?: boolean }) {
  return (
    <table className={clsx("w-full border-separate", tv ? "border-spacing-y-[0.3cqw]" : "border-spacing-y-1")} aria-label={board.title}>
      <thead>
        <tr className={clsx("text-left font-extrabold uppercase text-(--tg-burnt-ink)", tv ? "text-[0.95cqw] tracking-[0.18em]" : "text-[11px] tracking-[0.14em]")}>
          <th className={tv ? "w-[3cqw] px-[0.5cqw]" : "w-8 px-1"}>#</th>
          <th className={tv ? "px-[0.5cqw]" : "px-1"}>Squadra</th>
          {board.noteLabel && <th className={tv ? "px-[0.5cqw]" : "px-1"}>{board.noteLabel}</th>}
          <th className={clsx("text-right", tv ? "px-[0.8cqw]" : "px-2")}>Punti</th>
        </tr>
      </thead>
      <tbody>
        {board.rows.map((r, i) => (
          <tr key={i} className={clsx(tv ? "text-[1.7cqw]" : "text-base", i === 0 ? "bg-(--tg-gold)/45" : "bg-(--tg-burnt)/12")}>
            <td className={clsx("tg-num rounded-l-[0.6em] text-(--tg-burnt-ink)", tv ? "px-[0.5cqw] py-[0.3cqw]" : "px-1 py-1.5")}>{i + 1}</td>
            <td className={clsx("font-extrabold", tv ? "px-[0.5cqw]" : "px-1")}>{r.name}</td>
            {board.noteLabel && <td className={clsx("font-bold text-(--tg-burnt-ink)", tv ? "px-[0.5cqw]" : "px-1")}>{r.note ?? ""}</td>}
            <td className={clsx("tg-num rounded-r-[0.6em] text-right", tv ? "px-[0.8cqw]" : "px-2")}>{r.pts.toLocaleString("it-IT")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Foglio di pergamena con titolo e classifica (telefono). */
function BoardSheet({ board, title = true }: { board: Board; title?: boolean }) {
  return (
    <section className="tg-parch px-3 py-3">
      {title && <p className="tg-title mb-1 text-2xl leading-tight">{board.title}</p>}
      <BoardTable board={board} />
    </section>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const fake = p.stage === "play" && elapsed < view.fakeMs;
  const submit = () => !!picked && p.canSubmit && send({ optionId: picked });

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <BoardSheet board={reveal.board} />
        <Panel className="flex flex-col gap-2">
          <p className="text-lg font-extrabold leading-snug">{reveal.prompt}</p>
          <ChoiceList options={reveal.options} picked={sent && picked ? [picked] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.solutionId] }} />
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  if (fake) {
    return (
      <PlayerFrame view={view} p={p}>
        <Panel tone="lime" className="tg-pop flex flex-col items-center gap-2 py-6 text-center">
          <Icon name="crown" className="h-14 w-14 text-(--tg-gold)" />
          <p className="tg-title text-5xl">È finita?</p>
          <p className="max-w-xs text-base font-semibold text-(--tg-cream)/80">Guardate la TV: è uscita la «{view.board.title.toLowerCase()}».</p>
          <p className="tg-num text-5xl text-(--tg-gold)" aria-live="polite">
            {secsTo(view.fakeMs, elapsed)}
          </p>
        </Panel>
        <BoardSheet board={view.board} title={false} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!picked} pending={pending} error={error} onSubmit={submit} label="Invia" hint="Prova bonus: giusta +100 e rapidità, sbagliata non toglie nulla" />}
    >
      {view.twist && (
        <div className="tg-pop tg-stripes-red rounded-2xl border-2 border-(--tg-red-hi) px-4 py-3">
          <p className="tg-display text-4xl text-(--tg-red-hi)">Falso finale!</p>
          <p className="mt-1 text-base font-bold leading-snug">{view.twist}</p>
        </div>
      )}
      <BoardSheet board={view.board} />
      {view.prompt && view.options && (
        <Panel className="tg-rise flex flex-col gap-3">
          <p className="text-xl font-extrabold leading-snug">{view.prompt}</p>
          <ChoiceList options={view.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} />
        </Panel>
      )}
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const fake = p.stage === "play" && elapsed < view.fakeMs;
  const done = p.stage === "reveal" && reveal;

  if (fake) {
    return (
      <TvFrame view={view} p={p} hideTimer subtitle="Signore e signori, i risultati definitivi…">
        <style>{FX}</style>
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {COINS.map((c, i) => (
            <span key={i} className="tg5-coin" style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, ["--dx" as string]: c.dx, ["--sz" as string]: c.size }}>
              <span style={{ animationDelay: c.flip }} />
            </span>
          ))}
        </div>
        <div className="mx-auto flex h-full w-[62%] flex-col items-center justify-center gap-[1.2cqw]">
          <p className="tg-title tg-pop flex items-center gap-[1cqw] text-center text-[4.4cqw] leading-none text-(--tg-gold-hi) drop-shadow-[0_0.3cqw_0.6cqw_rgba(0,0,0,.8)]">
            <Icon name="crown" className="h-[4cqw] w-[4cqw] shrink-0" /> {view.board.title}
          </p>
          <div className="tg-parch w-full px-[1.4cqw] py-[1cqw]">
            <BoardTable board={view.board} tv />
          </div>
        </div>
      </TvFrame>
    );
  }

  return (
    <TvFrame view={view} p={p} subtitle={done ? "Prova bonus: la soluzione" : "FALSO FINALE: parte la prova bonus annunciata dal regolamento"}>
      <style>{FX}</style>
      <div className="grid h-full grid-cols-[1fr_1.1fr] gap-[1.4cqw]">
        <div className={clsx("tg-parch flex min-h-0 flex-col gap-[0.5cqw] self-start px-[1.4cqw] py-[1cqw]", !done && "tg5-glitch")}>
          <p className="tg-title text-[2.4cqw] leading-none">{view.board.title} (?)</p>
          <BoardTable board={view.board} tv />
        </div>
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          {!done && view.twist && (
            <TvPanel tone="red" className="tg-pop tg-stripes-red p-[1.2cqw]">
              <p className="tg-display text-[3.4cqw] leading-none text-(--tg-red-hi)">Falso finale!</p>
              <p className="mt-[0.4cqw] text-[1.45cqw] font-bold leading-snug">{view.twist}</p>
            </TvPanel>
          )}
          {(done ? reveal.prompt : view.prompt) && (
            <TvPanel className="tg-rise flex flex-col gap-[0.8cqw]">
              <p className="text-[1.9cqw] font-extrabold leading-tight">{done ? reveal.prompt : view.prompt}</p>
              <div className="grid grid-cols-2 gap-[0.6cqw]">
                {(done ? reveal.options : (view.options ?? [])).map((o, i) => (
                  <TvOption key={o.id} index={i} text={o.text} size="sm" state={done ? (o.id === reveal.solutionId ? "right" : "dim") : "idle"} />
                ))}
              </div>
            </TvPanel>
          )}
          {done && <TvExplain text={reveal.explain} />}
        </div>
      </div>
    </TvFrame>
  );
}

export const falsoFinaleUi = defineUi(Player, Tv);
