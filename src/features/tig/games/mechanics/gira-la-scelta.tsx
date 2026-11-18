"use client";

import { clsx } from "clsx";
import { useState, type ReactNode } from "react";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { GiraCard, GiraReveal, GiraSubmission, GiraView } from "@/lib/tig/games/mechanics/gira-la-scelta";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { Doubloon } from "../kit/ornaments";
import { canEdit, elapsedOf, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvPanel, useClock, useSubmit } from "../kit/ui";
import { ThemeBanner, TvExplainCompact } from "./_m3-kit";

type P = PlayerGameProps<GiraView, null, GiraSubmission, GiraReveal>;
type T = TvGameProps<GiraView, GiraReveal>;

const CARD_TONES = ["var(--tg-sky)", "var(--tg-teal-hi)", "var(--tg-violet)"] as const;

/** Carta di un rischio (dorso con titolo e cosa si rischia). */
function RiskCard({ card, index, on, onPick, disabled, tv = false, teaser = true, children }: { card: GiraCard; index: number; on?: boolean; onPick?: () => void; disabled?: boolean; tv?: boolean; teaser?: boolean; children?: ReactNode }) {
  const tone = CARD_TONES[index % 3];
  const body = (
    <>
      {/* il doblone col numero della carta (tasti 1–3) */}
      <Doubloon className={clsx(tv ? "h-[3.2cqw] w-[3.2cqw] text-[1.8cqw]" : "h-10 w-10 text-xl")}>{index + 1}</Doubloon>
      <span className="min-w-0 flex-1">
        <span className={clsx("tg-title block", tv ? "text-[2.6cqw]" : "text-[1.75rem]")} style={{ color: tone }}>
          {card.title}
        </span>
        {teaser && <span className={clsx("mt-0.5 block font-semibold leading-snug text-(--tg-cream)/85", tv ? "text-[1.3cqw]" : "text-sm")}>{card.teaser}</span>}
        {children}
      </span>
      {on && <Icon name="check" className={clsx("shrink-0 text-(--tg-gold)", tv ? "h-[2.4cqw] w-[2.4cqw]" : "h-6 w-6")} />}
      <span className="sr-only">{on ? " · scelta" : ""}</span>
    </>
  );
  const cls = clsx("flex w-full items-start gap-3 border-2 text-left transition-[transform,border-color] duration-200", tv ? "rounded-[1.2cqw] p-[1.1cqw]" : "rounded-2xl p-3", on ? "tg-picked" : "bg-(--tg-night-2)/75");
  const border = on ? tone : "rgba(201,162,74,0.35)";
  return onPick ? (
    <button type="button" role="radio" aria-checked={!!on} disabled={disabled} onClick={onPick} className={clsx(cls, "active:scale-[0.98]")} style={{ borderColor: border }}>
      {body}
    </button>
  ) : (
    <div className={cls} style={{ borderColor: border }}>
      {body}
    </div>
  );
}

const tablesN = (n: number) => `${n} ${n === 1 ? "tavolo" : "tavoli"}`;
const rightN = (n: number) => `${n} ${n === 1 ? "giusto" : "giusti"}`;

function Player(p: P) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const unveiled = elapsed >= view.choiceMs && view.cards.every((c) => !!c.question);
  const [cardId, setCardId] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const { send, pending, error } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const card = view.cards.find((c) => c.id === cardId) ?? null;
  // la carta si sceglie prima che si sveli la prova; dopo resta quella
  const canPickCard = editable && (!unveiled || !cardId);
  const ready = !!card && !!answer;
  const submit = () => ready && p.canSubmit && send({ cardId: cardId!, optionId: answer! });
  const left = Math.max(0, Math.ceil((view.choiceMs - elapsed) / 1000));
  useAnswerKeys({ enabled: canPickCard && !cardId, count: 3, onPick: (i) => setCardId(view.cards[i].id) });

  if (p.stage === "reveal" && reveal) {
    const s = reveal.summary;
    const mine = s?.picks[p.myTeam.teamId];
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {reveal.cards.map((c, i) => (
          <Panel key={c.id} tone={mine?.cardId === c.id ? "lime" : undefined} className="flex flex-col gap-1.5">
            <p className="tg-title text-[1.75rem]" style={{ color: CARD_TONES[i % 3] }}>
              {c.title}
              {mine?.cardId === c.id && <span className="tg-display ml-2 align-middle text-xs text-(--tg-gold-hi)">la vostra carta</span>}
            </p>
            {s && (
              <p className="flex flex-wrap items-center gap-x-2 text-xs font-extrabold uppercase text-(--tg-cream)/75">
                <span>
                  {tablesN(s.cardCounts[c.id] ?? 0)} · {rightN(s.right[c.id] ?? 0)}
                </span>
                {s.minority.includes(c.id) && <span className="rounded bg-(--tg-teal) px-1.5 py-0.5 text-(--tg-ink)">Strada meno battuta +20</span>}
              </p>
            )}
            <p className="text-sm font-bold text-(--tg-cream)/80">{c.question}</p>
            <p className="flex items-center gap-1.5 text-base font-extrabold text-(--tg-gold)">
              <Icon name="check" className="h-4 w-4" /> {c.options?.find((o) => o.id === c.solutionId)?.text}
            </p>
          </Panel>
        ))}
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Affronta il rischio" hint={!cardId ? "Prima la carta (tasti 1–3)" : !unveiled ? `La prova si svela tra ${left} s` : !answer ? "Ora la risposta" : undefined} />}
    >
      <ThemeBanner eyebrow="L'evento" title={view.event} size="sm" />
      <p className="px-1 text-base font-semibold leading-snug text-(--tg-cream)/90">{view.story}</p>
      {canPickCard ? (
        <Panel className="flex flex-col gap-2">
          <Eyebrow className="flex items-center gap-2">
            <Icon name="clock" className="h-4 w-4" /> {unveiled ? "Scegliete subito il vostro rischio" : `Scegliete il rischio · la prova si svela tra ${left} s`}
          </Eyebrow>
          <div role="radiogroup" aria-label="I tre rischi" className="flex flex-col gap-2">
            {view.cards.map((c, i) => (
              <RiskCard key={c.id} card={c} index={i} on={cardId === c.id} onPick={() => setCardId(c.id)} disabled={!canPickCard} />
            ))}
          </div>
          <p className="text-xs font-semibold text-(--tg-mute)">Tutte le carte valgono uguale: giusta 80. Chi risponde giusto sulla carta scelta da meno tavoli prende +20.</p>
        </Panel>
      ) : (
        card && <RiskCard card={card} index={view.cards.indexOf(card)} on />
      )}
      {card && unveiled && card.question && card.options && (
        <Panel tone="lime" className="flex flex-col gap-2">
          <Eyebrow className="text-(--tg-gold)">La prova di «{card.title}»</Eyebrow>
          <p className="text-lg font-extrabold leading-snug">{card.question}</p>
          <ChoiceList options={card.options} picked={answer ? [answer] : []} onToggle={(id) => editable && setAnswer(id)} disabled={!editable} onConfirm={ready ? submit : null} label="La vostra risposta" />
        </Panel>
      )}
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const done = p.stage === "reveal" && reveal;
  const s = done ? reveal.summary : null;
  // il conto alla rovescia della scelta solo a prova in corso (mai a risposte chiuse)
  const choosing = p.stage === "play" && elapsed < view.choiceMs;
  const left = Math.max(0, Math.ceil((view.choiceMs - elapsed) / 1000));
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Le tre prove e le scelte del locale" : choosing ? "Scegliete il rischio prima che si sveli la prova. Tutte le carte valgono uguale." : "Le prove sono sui telefoni: ogni tavolo affronta la sua carta."}>
      <div className="flex h-full flex-col gap-[1cqw]">
        <div className={clsx("tg-parch tg-rise flex items-center gap-[1.4cqw]", done ? "px-[1.6cqw] py-[0.7cqw]" : "px-[1.8cqw] py-[1cqw]")}>
          <div className="min-w-0 flex-1">
            <p className="text-[0.95cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-burnt-ink)">L&apos;evento</p>
            <p className={clsx("tg-title text-(--tg-ink)", done ? "text-[2.4cqw]" : "text-[3cqw]")}>{view.event}</p>
            {!done && <p className="mt-[0.2cqw] text-[1.45cqw] font-semibold leading-snug text-(--tg-ink)/85">{view.story}</p>}
          </div>
          {choosing && (
            <div className="flex shrink-0 flex-col items-center rounded-[1cqw] bg-(--tg-ink) px-[1.2cqw] py-[0.6cqw]">
              <p className="text-[0.95cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-cream)/70">Si svela tra</p>
              <p className="tg-num tg-pulse text-[4.4cqw] leading-none text-(--tg-gold-hi)">{left}</p>
            </div>
          )}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-[1.2cqw]">
          {(done ? reveal.cards : view.cards).map((c, i) => {
            const r = done ? (c as GiraReveal["cards"][number]) : null;
            return (
              <div key={c.id} className="tg-rise flex min-h-0 flex-col gap-[0.6cqw]" style={{ animationDelay: `${i * 90}ms` }}>
                {s && (
                  // al reveal le scelte del locale stanno sopra la carta (sempre visibili anche con 12 tavoli)
                  <div className="flex items-center justify-between gap-[0.6cqw] px-[0.4cqw]">
                    <span className="text-[1.25cqw] font-extrabold">
                      <span className="tg-num text-[2cqw]">{s.cardCounts[c.id] ?? 0}</span> {(s.cardCounts[c.id] ?? 0) === 1 ? "tavolo" : "tavoli"} · <span className="tg-num text-[2cqw] text-(--tg-gold-hi)">{s.right[c.id] ?? 0}</span> {(s.right[c.id] ?? 0) === 1 ? "giusto" : "giusti"}
                    </span>
                    {s.minority.includes(c.id) && <span className="tg-display rounded bg-(--tg-teal) px-[0.5cqw] py-[0.15cqw] text-[1.1cqw] text-(--tg-ink)">Meno battuta +20</span>}
                  </div>
                )}
                <RiskCard card={c} index={i} tv teaser={!r}>
                  {r && (
                    <span className="mt-[0.5cqw] block">
                      <span className="block text-[1.25cqw] font-bold leading-snug text-(--tg-cream)/90">{r.question}</span>
                      <span className="mt-[0.4cqw] flex items-center gap-[0.4cqw] text-[1.45cqw] font-extrabold text-(--tg-gold-hi)">
                        <Icon name="check" className="h-[1.6cqw] w-[1.6cqw]" />
                        {r.options?.find((o) => o.id === r.solutionId)?.text}
                      </span>
                    </span>
                  )}
                </RiskCard>
                {!s && !choosing && (
                  <TvPanel className="flex items-center justify-center gap-[0.6cqw] !p-[1cqw]">
                    <Icon name="eye" className="h-[2cqw] w-[2cqw] text-(--tg-teal-hi)" />
                    <span className="text-[1.3cqw] font-bold text-(--tg-cream)/80">Prova svelata sui telefoni</span>
                  </TvPanel>
                )}
              </div>
            );
          })}
        </div>
        {done && <TvExplainCompact text={reveal.explain} />}
      </div>
    </TvFrame>
  );
}

export const giraLaSceltaUi = defineUi(Player, Tv);
