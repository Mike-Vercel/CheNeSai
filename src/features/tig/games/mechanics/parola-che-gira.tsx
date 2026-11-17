"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { Option } from "@/lib/tig/games/components/choice";
import type { ParolaReveal, ParolaSubmission, ParolaView } from "@/lib/tig/games/mechanics/parola-che-gira";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { Step } from "./_m3-kit";

type P = PlayerGameProps<ParolaView, null, ParolaSubmission, ParolaReveal>;
type T = TvGameProps<ParolaView, ParolaReveal>;

/** Al reveal: in quale regola (1–3) è stata tolta ogni parola; la sopravvissuta non ha numero. */
function removedAt(reveal: ParolaReveal | null): Map<string, number> {
  const m = new Map<string, number>();
  reveal?.rules.forEach((r, i) => r.removes.forEach((id) => m.set(id, i + 1)));
  return m;
}

/** Griglia di parole della lista (selezione singola sul telefono, tabellone in TV). */
function WordGrid({
  words,
  picked,
  onPick,
  disabled,
  label,
  reveal,
  counts,
  tv = false,
}: {
  words: Option[];
  picked?: string | null;
  onPick?: (id: string) => void;
  disabled?: boolean;
  label: string;
  reveal?: ParolaReveal | null;
  counts?: Record<string, number> | null;
  tv?: boolean;
}) {
  const out = removedAt(reveal ?? null);
  return (
    <div role={onPick ? "radiogroup" : "list"} aria-label={label} className={clsx("grid", tv ? "grid-cols-4 gap-[0.8cqw]" : "grid-cols-2 gap-2")}>
      {words.map((w, i) => {
        const on = picked === w.id;
        const rule = out.get(w.id);
        const survivor = !!reveal && reveal.survivorId === w.id;
        const n = counts?.[w.id];
        const body = (
          <>
            <span className={clsx("tg-num shrink-0 rounded text-center", tv ? "w-[2cqw] text-[1.3cqw] text-(--tg-cream)/50" : "w-5 text-sm text-(--tg-cream)/50")}>{i + 1}</span>
            {/* mai troncare: nel quiz contano tutte le lettere */}
            <span
              className={clsx(
                "min-w-0 flex-1 break-all font-extrabold leading-tight",
                tv ? (w.text.length > 11 ? "text-[1.55cqw]" : w.text.length > 8 ? "text-[1.85cqw]" : "text-[2.1cqw]") : w.text.length > 11 ? "text-[13px]" : "text-base",
                rule && "line-through decoration-(--tg-red-hi) decoration-2 opacity-55",
                survivor && "text-(--tg-ink)",
              )}
            >
              {w.text}
            </span>
            {rule !== undefined && <span className={clsx("tg-num shrink-0 rounded bg-(--tg-red)/20 text-(--tg-red-hi)", tv ? "px-[0.4cqw] text-[1.1cqw]" : "px-1 text-xs")}>R{rule}</span>}
            {n !== undefined && n > 0 && (
              <span className={clsx("shrink-0 font-extrabold", tv ? "text-[1cqw]" : "text-[11px]", survivor ? "text-(--tg-ink)/70" : n === 1 ? "text-(--tg-teal-hi)" : "text-(--tg-cream)/60")}>{n === 1 ? "unica" : `${n} tav.`}</span>
            )}
            {on && !reveal && <Icon name="check" className="h-5 w-5 shrink-0 text-(--tg-gold)" />}
            <span className="sr-only">{survivor ? " · sopravvive" : rule ? ` · tolta dalla regola ${rule}` : on ? " · scelta" : ""}</span>
          </>
        );
        const cls = clsx(
          "flex items-center gap-2 border-2 text-left transition-[transform,background-color,border-color] duration-200",
          tv ? "rounded-[0.8cqw] px-[0.9cqw] py-[0.9cqw]" : "min-h-12 rounded-xl px-2.5 py-2",
          survivor ? "tg-shine border-(--tg-gold) bg-(--tg-gold)" : on ? "tg-picked border-(--tg-gold)" : "border-(--tg-cream)/12 bg-(--tg-cream)/[0.04]",
        );
        return onPick ? (
          <button key={w.id} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => onPick(w.id)} className={clsx(cls, "active:scale-[0.97]", disabled && !on && "opacity-60")}>
            {body}
          </button>
        ) : (
          <div key={w.id} role="listitem" className={cls} style={reveal ? { animationDelay: `${(rule ?? 4) * 250}ms` } : undefined}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

function Rules({ rules, tv = false }: { rules: string[]; tv?: boolean }) {
  return (
    <ol className={clsx("flex flex-col", tv ? "gap-[0.6cqw]" : "gap-1.5")}>
      {rules.map((r, i) => (
        <li key={i} className={clsx("flex items-start font-bold leading-snug", tv ? "gap-[0.8cqw] text-[1.6cqw]" : "gap-2 text-[15px]")}>
          <span className={clsx("tg-num grid shrink-0 place-items-center rounded bg-(--tg-red) text-white", tv ? "h-[2.2cqw] w-[2.6cqw] text-[1.3cqw]" : "h-6 w-7 text-sm")}>R{i + 1}</span>
          {r}
        </li>
      ))}
    </ol>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [word, setWord] = useState<string | null>(null);
  const [survivor, setSurvivor] = useState<string | null>(null);
  const { send, pending, error } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = !!word && !!survivor;
  const submit = () => ready && p.canSubmit && send({ word: word!, survivor: survivor! });
  useAnswerKeys({
    enabled: editable,
    count: view.words.length,
    onPick: (i) => (word ? setSurvivor(view.words[i].id) : setWord(view.words[i].id)),
    onConfirm: ready ? submit : null,
  });

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-2">
          <Eyebrow>Eliminazioni · proposte del locale</Eyebrow>
          <Rules rules={reveal.rules.map((r) => r.text)} />
          <WordGrid words={view.words} label="Parole dopo le eliminazioni" reveal={reveal} counts={reveal.summary?.proposals ?? null} />
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Invia parola e risposta" hint={!word ? "Prima la vostra parola (tasti 1–8)" : !survivor ? "Poi la sopravvissuta (tasti 1–8)" : undefined} />}
    >
      <Panel>
        <Eyebrow>Il tema</Eyebrow>
        <p className="tg-display text-3xl">{view.theme}</p>
      </Panel>
      <Step n={1} title="La vostra parola: una che nessun altro tavolo sceglie" done={!!word}>
        <WordGrid words={view.words} picked={word} onPick={(id) => editable && setWord(id)} disabled={!editable} label="La vostra parola" />
      </Step>
      <Step n={2} title="Quale parola sopravvive alle tre regole?" done={!!survivor}>
        <Rules rules={view.rules} />
        <WordGrid words={view.words} picked={survivor} onPick={(id) => editable && setSurvivor(id)} disabled={!editable} label="La parola che sopravvive" />
      </Step>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const s = done ? reveal.summary : null;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Le eliminazioni e le parole proposte dal locale" : "Una parola della lista che nessun altro sceglie (+30), poi la parola che sopravvive (+70)."}>
      <div className="mx-auto flex h-full max-w-[88cqw] flex-col gap-[1.2cqw]">
        <TvPanel className="tg-rise flex items-center justify-between gap-[1cqw]">
          <p className="tg-display text-[3.4cqw] text-(--tg-gold)">{view.theme}</p>
          <p className="text-[1.2cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-cream)/60">Solo parole della lista</p>
        </TvPanel>
        <TvPanel>
          <WordGrid words={view.words} label="Le parole" reveal={done ? reveal : null} counts={s?.proposals ?? null} tv />
        </TvPanel>
        <div className={clsx("grid min-h-0 flex-1 gap-[1.2cqw]", done ? "grid-cols-[1.1fr_1fr]" : "grid-cols-1")}>
          <TvPanel className="flex flex-col justify-center gap-[0.6cqw]">
            <p className="text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-red-hi)">Le tre eliminazioni, in ordine</p>
            <Rules rules={view.rules} tv />
          </TvPanel>
          {done && <TvExplain text={reveal.explain} />}
        </div>
      </div>
    </TvFrame>
  );
}

export const parolaCheGiraUi = defineUi(Player, Tv);
