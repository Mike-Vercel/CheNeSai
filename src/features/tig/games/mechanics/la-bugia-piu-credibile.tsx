"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { BugiaMemberView, BugiaReveal, BugiaSubmission, BugiaView, PublicBugiaCase } from "@/lib/tig/games/mechanics/la-bugia-piu-credibile";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { FactList, RingTv } from "./m4/kit";

type P = PlayerGameProps<BugiaView, BugiaMemberView, BugiaSubmission, BugiaReveal>;
type T = TvGameProps<BugiaView, BugiaReveal>;

type ChipState = "idle" | "picked" | "real" | "fake" | "right" | "wrong" | "missed";

function Chip({ text, state, onClick, disabled, tag }: { text: string; state: ChipState; onClick?: () => void; disabled?: boolean; tag?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      aria-pressed={onClick ? state === "picked" || state === "fake" : undefined}
      className={clsx(
        "flex min-h-11 items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-left text-[15px] font-bold leading-tight transition-transform active:scale-[0.98]",
        state === "idle" && "border-(--tg-cream)/12 bg-(--tg-cream)/[0.04]",
        state === "picked" && "tg-picked border-(--tg-gold)",
        state === "real" && "border-(--tg-gold)/60 bg-(--tg-gold)/10",
        state === "fake" && "border-(--tg-red-hi) bg-(--tg-red) text-white",
        state === "right" && "border-(--tg-gold) bg-(--tg-gold) text-(--tg-ink)",
        state === "wrong" && "tg-stripes-red border-(--tg-red-hi)",
        state === "missed" && "border-dashed border-(--tg-gold) text-(--tg-cream)",
      )}
    >
      <span>{text}</span>
      {tag && <span className="tg-display rounded bg-black/25 px-1 text-xs">{tag}</span>}
    </button>
  );
}

function CaseHead({ c }: { c: PublicBugiaCase }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="tg-display text-2xl">{c.title}</p>
      <p className="text-base font-extrabold leading-snug">{c.question}</p>
    </div>
  );
}

function Player(p: P) {
  const { view, reveal, memberView: mv } = p;
  const [guess, setGuess] = useState<(string | null)[]>([null, null, null]);
  const [lie, setLie] = useState<string[] | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const real = mv?.tellsTo?.real ?? null;
  const lieRow = lie ?? real;
  const changed = real && lie ? lie.findIndex((id, i) => id !== real[i]) : -1;
  const needLie = !!mv?.tellsTo;
  const ready = guess.every(Boolean) && (!needLie || changed >= 0);
  const submit = () => {
    if (!ready || !p.canSubmit) return;
    send(needLie && lie ? { lie, guess: guess as string[] } : { guess: guess as string[] });
  };
  const falsify = (part: number, id: string) => {
    if (!real || !editable) return;
    setLie(real.map((r, i) => (i === part ? id : r)));
  };

  if (!mv) {
    return (
      <PlayerFrame view={view} p={p}>
        <Panel>
          <p className="font-bold">Il vostro caso sta arrivando…</p>
        </Panel>
      </PlayerFrame>
    );
  }

  if (p.stage === "reveal" && reveal) {
    const links = reveal.summary?.links ?? [];
    const out = links.find((l) => l.from === p.myTeam.teamId);
    const inc = links.find((l) => l.to === p.myTeam.teamId);
    const mine = reveal.cases.find((c) => c.id === mv.myCase.id);
    const table = new Map(view.seats.map((s) => [s.teamId, s.tableNo]));
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-1.5 text-base font-bold">
          {out && (
            <p>
              La vostra bugia al tavolo {table.get(out.to)}: {out.part === null ? "non valida" : <>«{out.fake}» · <span className={out.believed ? "text-(--tg-gold)" : "text-(--tg-cream)/70"}>{out.believed ? "creduta, +40" : out.believed === false ? "scartata" : "nessuna risposta"}</span></>}
            </p>
          )}
          {inc && inc.part !== null && (
            <p>
              Il tavolo {table.get(inc.from)} vi ha teso una bugia: «{inc.fake}» · <span className={inc.believed ? "text-(--tg-red-hi)" : "text-(--tg-gold)"}>{inc.believed ? "ci siete cascati" : "l'avete scansata"}</span>
            </p>
          )}
        </Panel>
        {mine && (
          <Panel className="flex flex-col gap-3">
            <CaseHead c={mine} />
            {mine.parts.map((part, j) => (
              <div key={part.id} className="flex flex-col gap-1.5">
                <Eyebrow>{part.label}</Eyebrow>
                <div className="flex flex-wrap gap-1.5">
                  {part.options.map((o) => {
                    const isReal = o.id === mine.real[j];
                    const picked = sent && guess[j] === o.id;
                    return <Chip key={o.id} text={o.text} state={isReal ? (picked || !sent ? "right" : "missed") : picked ? "wrong" : "idle"} />;
                  })}
                </div>
              </div>
            ))}
            <p className="text-sm font-semibold text-(--tg-cream)/80">{mine.why}</p>
          </Panel>
        )}
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Sigilla le mosse" hint={needLie && changed < 0 ? "Componete la bugia: cambiate un solo pezzo" : !guess.every(Boolean) ? "Scegliete i tre pezzi del vostro caso" : undefined} />}
    >
      {mv.tellsTo && lieRow && (
        <Panel tone="red" className="flex flex-col gap-3">
          <Eyebrow className="flex items-center gap-2 text-(--tg-red-hi)">
            <Icon name="eye" className="h-4 w-4" /> 1 · La bugia per il tavolo {mv.tellsTo.tableNo}: voi conoscete la verità
          </Eyebrow>
          <CaseHead c={mv.tellsTo.case} />
          <p className="text-sm font-semibold text-(--tg-cream)/75">Cambiate UN pezzo con il falso più credibile: se il tavolo {mv.tellsTo.tableNo} sceglie proprio quello, +{view.payoff.creduta} a voi.</p>
          {mv.tellsTo.case.parts.map((part, j) => (
            <div key={part.id} className="flex flex-col gap-1.5">
              <Eyebrow>{part.label}</Eyebrow>
              <div className="flex flex-wrap gap-1.5">
                {part.options.map((o) => {
                  const isReal = o.id === real![j];
                  const isFake = changed === j && lieRow[j] === o.id;
                  return <Chip key={o.id} text={o.text} state={isFake ? "fake" : isReal ? "real" : "idle"} tag={isReal ? "vero" : isFake ? "falso" : undefined} disabled={!editable} onClick={isReal ? () => setLie(null) : () => falsify(j, o.id)} />;
                })}
              </div>
            </div>
          ))}
        </Panel>
      )}
      <Panel className="flex flex-col gap-3">
        <Eyebrow>{mv.tellsTo ? "2 · " : ""}Il vostro caso{mv.hearsFrom ? ` · il tavolo ${mv.hearsFrom.tableNo} vi ha preparato una bugia` : ""}</Eyebrow>
        <CaseHead c={mv.myCase} />
        <FactList facts={mv.myCase.facts} title="Fatti" />
        {mv.myCase.parts.map((part, j) => (
          <div key={part.id} className="flex flex-col gap-1.5" role="radiogroup" aria-label={part.label}>
            <Eyebrow>{part.label}</Eyebrow>
            <div className="flex flex-wrap gap-1.5">
              {part.options.map((o) => (
                <Chip key={o.id} text={o.text} state={guess[j] === o.id ? "picked" : "idle"} disabled={!editable} onClick={() => setGuess((g) => g.map((x, i) => (i === j ? o.id : x)))} />
              ))}
            </div>
          </div>
        ))}
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const team = new Map(p.teams.map((x) => [x.teamId, x]));
  const links = new Map((done ? (reveal.summary?.links ?? []) : []).map((l) => [l.from, l]));
  const many = p.teams.length > 7;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Le verità dei tre casi e le bugie che hanno funzionato" : "Ogni tavolo ricostruisce il suo caso e compone una bugia per il tavolo successivo."}>
      <div className="grid h-full grid-cols-[1.4fr_1fr] gap-[1.4cqw]">
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          {done ? (
            <>
              <div className="grid min-h-0 flex-1 grid-cols-3 gap-[0.9cqw]">
                {reveal.cases.map((c) => (
                  <TvPanel key={c.id} className={clsx("flex min-h-0 flex-col p-[1.1cqw]", many ? "gap-[0.35cqw]" : "gap-[0.5cqw]")}>
                    <p className="tg-display text-[1.6cqw] leading-none">{c.title}</p>
                    {c.parts.map((part, j) => (
                      <p key={part.id} className={clsx("font-bold leading-snug", many ? "text-[1.3cqw]" : "text-[1.4cqw]")}>
                        <span className="text-(--tg-cream)/60">{part.label}: </span>
                        <span className="text-(--tg-gold)">{part.options.find((o) => o.id === c.real[j])?.text}</span>
                      </p>
                    ))}
                    {/* con 12 tavoli (striscia su due righe) il «perché» del caso scende di corpo e non viene tagliato */}
                    <p className={clsx("mt-auto border-t border-(--tg-brass)/30 pt-[0.5cqw] font-semibold leading-snug text-(--tg-cream)/85", many ? "text-[1.1cqw]" : "text-[1.2cqw]")}>{c.why}</p>
                  </TvPanel>
                ))}
              </div>
              <TvExplain text={reveal.explain} className="shrink-0 py-[0.8cqw]" />
            </>
          ) : (
            <TvPanel className="flex flex-col gap-[1.2cqw] p-[2cqw]">
              <p className="tg-display text-[2.6cqw]">Verità o bugia, un pezzo alla volta</p>
              <ol className="flex flex-col gap-[0.9cqw] text-[1.6cqw] font-bold leading-snug">
                <li className="flex gap-[0.8cqw]">
                  <span className="tg-num text-(--tg-gold)">1</span> Ogni tavolo ha un caso: chi, dove, quando… tre pezzi, tre opzioni ciascuno.
                </li>
                <li className="flex gap-[0.8cqw]">
                  <span className="tg-num text-(--tg-gold)">2</span> Ricostruite la verità dai fatti: {view.payoff.pezzo} punti a pezzo, {view.payoff.tutto} se sono giusti tutti e tre.
                </li>
                <li className="flex gap-[0.8cqw]">
                  <span className="tg-num text-(--tg-red-hi)">3</span> Conoscete la verità del caso del tavolo dopo: cambiatene un pezzo. Se ci cascano, +{view.payoff.creduta} a voi.
                </li>
              </ol>
              <p className="text-[1.25cqw] font-semibold text-(--tg-cream)/65">Niente testo libero: le bugie si compongono solo con le opzioni del gioco, sui casi inventati.</p>
            </TvPanel>
          )}
        </div>
        <TvPanel className="flex min-h-0 items-center justify-center p-[1cqw]">
          <RingTv
            seats={view.seats}
            colorOf={(id) => team.get(id)?.color}
            arrow={(from) => {
              const l = links.get(from);
              if (!l) return null;
              if (l.part === null) return { color: "color-mix(in srgb, var(--tg-cream) 62%, transparent)", text: "NESSUNA", dashed: true };
              return l.believed ? { color: "var(--tg-red-hi)", text: "CREDUTA" } : { color: "var(--tg-gold)", text: "SCARTATA", dashed: true };
            }}
            label="Chi prepara la bugia per chi"
          />
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const laBugiaPiuCredibileUi = defineUi(Player, Tv);
