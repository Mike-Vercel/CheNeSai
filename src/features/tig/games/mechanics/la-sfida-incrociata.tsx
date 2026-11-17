"use client";

import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { isTypingTarget } from "@/features/shared/keyboard";
import { isMirrored, mirrorGrid, type IncrociataReveal, type IncrociataSubmission, type IncrociataView } from "@/lib/tig/games/mechanics/la-sfida-incrociata";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { GRID_SYMBOLS, GridSymbol, PhoneChip, TvChip } from "./m2/kit";

type P = PlayerGameProps<IncrociataView, null, IncrociataSubmission, IncrociataReveal>;
type T = TvGameProps<IncrociataView, IncrociataReveal>;

const SYMS = ["1", "2", "3", "4"];

/** Griglia 4×4: indizi fissi, caselle da riempire, riquadri 2×2 marcati. */
function Board({
  givens,
  values,
  selected,
  onSelect,
  solution,
  tv = false,
  label,
}: {
  givens: string;
  values: string;
  selected?: number | null;
  onSelect?: (i: number) => void;
  /** al reveal: soluzione (stesso orientamento) per colorare giuste/sbagliate */
  solution?: string | null;
  tv?: boolean;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className={clsx("grid grid-cols-2 rounded-2xl border-2 border-(--tg-cream)/25 bg-(--tg-night)/70", tv ? "gap-[0.6cqw] p-[0.45cqw]" : "gap-2.5 p-1.5")}>
      {[0, 1, 2, 3].map((b) => (
        <div key={b} className={clsx("grid grid-cols-2", tv ? "gap-[0.3cqw]" : "gap-1")}>
          {[0, 1, 2, 3].map((k) => {
            const r = 2 * Math.floor(b / 2) + Math.floor(k / 2);
            const c = 2 * (b % 2) + (k % 2);
            const i = r * 4 + c;
            const given = givens[i] !== "0";
            const shown = given ? givens[i] : tv && solution ? solution[i] : values[i];
            const wrong = !!solution && !given && !tv && values[i] !== "0" && values[i] !== solution[i];
            const missing = !!solution && !given && !tv && values[i] === "0";
            return (
              <button
                key={i}
                type="button"
                disabled={!onSelect || given}
                onClick={() => onSelect?.(i)}
                aria-label={`Riga ${r + 1}, colonna ${c + 1}: ${shown !== "0" ? GRID_SYMBOLS[shown]?.name : "vuota"}${given ? " (data)" : ""}`}
                aria-pressed={onSelect ? selected === i : undefined}
                className={clsx(
                  "relative grid aspect-square place-items-center border-2 transition-colors",
                  tv ? "rounded-[0.6cqw]" : "rounded-xl",
                  given ? "border-(--tg-cream)/10 bg-(--tg-cream)/[0.13]" : "border-(--tg-cream)/12 bg-(--tg-cream)/[0.03]",
                  selected === i && "tg-picked border-(--tg-gold)",
                  wrong && "tg-stripes-red border-(--tg-red-hi)",
                  missing && "border-dashed border-(--tg-teal)/60",
                  solution && tv && !given && "tg-pop border-(--tg-gold)/60 bg-(--tg-gold)/10",
                )}
                style={solution && tv && !given ? { animationDelay: `${i * 40}ms` } : undefined}
              >
                {shown !== "0" ? <GridSymbol v={shown} className={tv ? "h-[70%] w-[70%]" : "h-[68%] w-[68%]"} /> : null}
                {missing && solution && <GridSymbol v={solution[i]} className="absolute h-[45%] w-[45%] opacity-50" />}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const mirrored = isMirrored(view.pairs, p.myTeam.teamId);
  const givens = mirrored ? mirrorGrid(view.givens) : view.givens;
  const [values, setValues] = useState("0".repeat(16));
  const [sel, setSel] = useState<number | null>(() => {
    const i = givens.indexOf("0");
    return i >= 0 ? i : null;
  });
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const merged = givens.split("").map((g, i) => (g !== "0" ? g : values[i])).join("");
  const ready = !merged.includes("0");
  const submit = () => ready && p.canSubmit && send({ cells: merged });
  const pair = view.pairs.find((x) => x.a.teamId === p.myTeam.teamId || x.b?.teamId === p.myTeam.teamId);
  const rival = pair ? (pair.a.teamId === p.myTeam.teamId ? pair.b : pair.a) : null;

  const setAt = (i: number, v: string) => {
    if (!editable || givens[i] !== "0") return;
    setValues((old) => old.slice(0, i) + v + old.slice(i + 1));
  };
  const blanks = givens.split("").map((g, i) => (g === "0" ? i : -1)).filter((i) => i >= 0);
  const advance = (from: number) => {
    const next = blanks.find((i) => i > from && merged[i] === "0") ?? blanks.find((i) => merged[i] === "0" && i !== from);
    if (next !== undefined) setSel(next);
  };
  const put = (v: string) => {
    if (sel === null) return;
    setAt(sel, v);
    if (v !== "0") advance(sel);
  };

  // tastiera (PC): frecce per muoversi, 1–4 per i simboli, Canc/Backspace per cancellare, Invio per inviare
  const ref = useRef({ put, sel, submit });
  useEffect(() => {
    ref.current = { put, sel, submit };
  });
  useEffect(() => {
    if (!editable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || isTypingTarget(e.target)) return;
      const { put: doPut, sel: s, submit: doSubmit } = ref.current;
      const m = /^(?:Digit|Numpad)([1-4])$/.exec(e.code) ?? (/^[1-4]$/.test(e.key) ? [e.key, e.key] : null);
      if (m) {
        e.preventDefault();
        doPut(m[1]);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        doPut("0");
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const cur = s ?? 0;
        const d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" ? -4 : 4;
        setSel(Math.max(0, Math.min(15, cur + d)));
      } else if (e.key === "Enter" && !(e.target as HTMLElement)?.closest?.("button")) {
        e.preventDefault();
        doSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editable]);

  const rivalBanner = rival ? (
    <p className="flex flex-wrap items-center gap-2 text-base font-extrabold">
      Contro il tavolo <PhoneChip tableNo={rival.tableNo} tone="red" /> che ha la stessa griglia {mirrored ? "dritta" : "allo specchio"}
    </p>
  ) : (
    <p className="text-base font-extrabold">Siete in più: sfidate il tempo mediano del locale.</p>
  );

  if (p.stage === "reveal" && reveal) {
    const d = reveal.summary?.duels.find((x) => x.a === p.myTeam.teamId || x.b === p.myTeam.teamId);
    const sol = mirrored ? mirrorGrid(reveal.grid) : reveal.grid;
    const mySec = reveal.summary?.times[p.myTeam.teamId];
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-2">
          <Eyebrow>Il duello</Eyebrow>
          {rivalBanner}
          <p className="text-base font-bold text-(--tg-cream)/80">
            {mySec !== undefined ? `Griglia valida in ${mySec} s` : "Griglia non valida"}
            {reveal.summary?.medianMs != null ? ` · tempo mediano del locale ${Math.round(reveal.summary.medianMs / 1000)} s` : ""}
            {d ? (d.winner === p.myTeam.teamId ? " · duello vinto" : d.winner ? " · duello perso" : " · nessun vincitore") : ""}
          </p>
        </Panel>
        <Panel className="flex flex-col gap-3">
          <Eyebrow>La soluzione {mirrored ? "(la vostra, speculare)" : ""}</Eyebrow>
          <div className="mx-auto w-full max-w-[340px]">
            <Board givens={givens} values={sent ? values : "0".repeat(16)} solution={sol} label="Soluzione con le vostre caselle" />
          </div>
          <p className="text-sm font-semibold text-(--tg-cream)/65">Caselle a righe: sbagliate. Tratteggiate: lasciate vuote (in trasparenza il simbolo giusto).</p>
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Griglia fatta!" hint={!ready ? `Mancano ${merged.split("").filter((x) => x === "0").length} caselle` : undefined} />}
    >
      <Panel tone="red" className="flex items-center gap-3">
        <Icon name="swap" className="h-8 w-8 shrink-0 text-(--tg-red-hi)" />
        {rivalBanner}
      </Panel>
      <Panel className="flex flex-col gap-3">
        <Eyebrow>{view.theme} · ogni simbolo una volta per riga, colonna e riquadro</Eyebrow>
        <div className="mx-auto w-full max-w-[340px]">
          <Board givens={givens} values={values} selected={editable ? sel : null} onSelect={editable ? setSel : undefined} label="La vostra griglia" />
        </div>
        {editable && (
          <div className="grid grid-cols-5 gap-2" role="group" aria-label="Simboli">
            {SYMS.map((v) => (
              <button key={v} type="button" onClick={() => put(v)} className="flex h-16 flex-col items-center justify-center rounded-xl border-2 border-(--tg-cream)/12 bg-(--tg-cream)/[0.05] transition-transform active:scale-95" aria-label={`Metti ${GRID_SYMBOLS[v].name}`}>
                <GridSymbol v={v} className="h-8 w-8" />
                <span className="hidden text-[10px] font-extrabold text-(--tg-cream)/50 lg:block">{v}</span>
              </button>
            ))}
            <button type="button" onClick={() => put("0")} className="grid h-16 place-items-center rounded-xl border-2 border-(--tg-cream)/12 bg-(--tg-cream)/[0.05] transition-transform active:scale-95" aria-label="Cancella la casella">
              <Icon name="back" className="h-7 w-7" />
            </button>
          </div>
        )}
        <p className="hidden text-center text-xs font-semibold text-(--tg-mute) lg:block">Tastiera: frecce per muoversi, 1–4 per i simboli, Canc per cancellare, Invio per inviare.</p>
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const s = done ? reveal.summary : null;
  const many = view.pairs.length > 6;
  const sec = (id: string) => (s?.times[id] !== undefined ? `${s.times[id]} s` : "non valida");
  return (
    <TvFrame view={view} p={p} subtitle={done ? `Tempo mediano delle griglie valide: ${s?.medianMs != null ? Math.round(s.medianMs / 1000) + " s" : "nessuna griglia valida"}` : `${view.theme} · coppie con griglie speculari: valida +${view.points.valid}, più rapidi del rivale +${view.points.duel}`}>
      <div className="grid h-full grid-cols-[1.35fr_1fr] gap-[1.6cqw]">
        <TvPanel className="flex min-h-0 flex-col gap-[1cqw]">
          <div className="grid grid-cols-2 gap-[1.6cqw]">
            {[false, true].map((m) => (
              <div key={String(m)} className="flex flex-col items-center gap-[0.6cqw]">
                <p className="text-[1.2cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-cream)/75">{m ? "Griglia B · speculare" : "Griglia A"}</p>
                <div className="w-[21cqw]">
                  <Board givens={m ? mirrorGrid(view.givens) : view.givens} values={"0".repeat(16)} solution={done ? (m ? mirrorGrid(reveal.grid) : reveal.grid) : null} tv label={m ? "Griglia speculare" : "Griglia"} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-[1.6cqw]">
            {SYMS.map((v) => (
              <span key={v} className="flex items-center gap-[0.4cqw] text-[1.2cqw] font-extrabold capitalize text-(--tg-cream)/80">
                <GridSymbol v={v} className="h-[2.2cqw] w-[2.2cqw]" /> {GRID_SYMBOLS[v].name}
              </span>
            ))}
          </div>
          {done && <TvExplain text={reveal.explain} className="mt-auto" />}
        </TvPanel>
        <TvPanel className="flex min-h-0 flex-col gap-[0.6cqw] overflow-hidden">
          <p className="flex items-center gap-[0.6cqw] text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-red-hi)">
            <Icon name="swap" className="h-[1.6cqw] w-[1.6cqw]" /> Sfide incrociate
          </p>
          <div className={clsx("grid min-h-0 gap-[0.45cqw]", many ? "grid-cols-2" : "grid-cols-1")}>
            {view.pairs.map((pr, i) => {
              const d = s?.duels.find((x) => x.a === pr.a.teamId);
              return (
                <div key={pr.a.teamId} className="tg-rise flex items-center gap-[0.6cqw] rounded-[0.8cqw] bg-(--tg-cream)/[0.05] px-[0.7cqw] py-[0.45cqw]" style={{ animationDelay: `${i * 70}ms` }}>
                  <TvChip teams={p.teams} id={pr.a.teamId} size={many ? 2.2 : 2.6} />
                  {pr.b ? (
                    <>
                      <Icon name="swap" className="h-[1.5cqw] w-[1.5cqw] rotate-90 text-(--tg-red-hi)" />
                      <TvChip teams={p.teams} id={pr.b.teamId} size={many ? 2.2 : 2.6} />
                    </>
                  ) : (
                    <span className="text-[1.1cqw] font-extrabold uppercase text-(--tg-cream)/70">contro il tempo mediano</span>
                  )}
                  <span className={clsx("ml-auto text-right font-extrabold leading-tight", many ? "text-[1cqw]" : "text-[1.25cqw]")}>
                    {done ? (
                      <>
                        <span className="text-(--tg-cream)/70">
                          {sec(pr.a.teamId)}
                          {pr.b ? ` · ${sec(pr.b.teamId)}` : ""}
                        </span>
                        <br />
                        {d?.winner ? <span className="text-(--tg-gold)">vince il {p.teams.find((t) => t.teamId === d.winner)?.tableNo} +{view.points.duel}</span> : <span className="text-(--tg-cream)/55">nessun vincitore</span>}
                      </>
                    ) : (
                      <span className="text-(--tg-cream)/45">{pr.b ? "A contro B" : "griglia A"}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const laSfidaIncrociataUi = defineUi(Player, Tv);
