"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { Option } from "@/lib/tig/games/components/choice";
import type { ParolaReveal, ParolaSubmission, ParolaView } from "@/lib/tig/games/mechanics/parola-che-gira";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { Step, ThemeBanner, TvExplainCompact } from "./_m3-kit";

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
        // mai troncare né spezzare: nel quiz contano tutte le lettere (le parole lunghe scendono di corpo)
        const long = w.text.length > 11;
        const mid = w.text.length > 8;
        const wordCls = clsx(
          "min-w-0 whitespace-nowrap font-extrabold leading-tight",
          tv ? (long ? "text-[1.5cqw]" : mid ? "text-[1.8cqw]" : "text-[2.05cqw]") : long ? "text-[13px]" : "text-base",
          rule && "line-through decoration-(--tg-red-hi) decoration-2 opacity-60",
          survivor && "text-(--tg-ink)",
        );
        const index = <span className={clsx("tg-num shrink-0 rounded text-center", tv ? "w-[1.6cqw] text-[1.2cqw]" : "w-4 text-sm", survivor ? "text-(--tg-ink)/60" : "text-(--tg-cream)/50")}>{i + 1}</span>;
        const tags = reveal ? (
          // al reveal le etichette vanno su una riga loro: la parola resta intera
          <span className={clsx("flex items-center", tv ? "gap-[0.5cqw] pl-[2.1cqw]" : "gap-1.5 pl-5")}>
            {rule !== undefined ? (
              <span className={clsx("tg-num rounded bg-(--tg-red) text-white", tv ? "px-[0.4cqw] text-[1cqw]" : "px-1 text-[11px]")}>R{rule}</span>
            ) : (
              <span className={clsx("tg-display rounded bg-(--tg-ink) text-(--tg-gold-hi)", tv ? "px-[0.4cqw] text-[1cqw]" : "px-1 text-[11px]")}>Sopravvive</span>
            )}
            {n !== undefined && n > 0 && (
              <span className={clsx("font-extrabold", tv ? "text-[1cqw]" : "text-[11px]", survivor ? "text-(--tg-ink)/75" : n === 1 ? "text-(--tg-teal-hi)" : "text-(--tg-cream)/65")}>{n === 1 ? "unica" : `${n} tav.`}</span>
            )}
          </span>
        ) : null;
        const body = reveal ? (
          <>
            <span className={clsx("flex w-full items-center", tv ? "gap-[0.5cqw]" : "gap-1")}>
              {index}
              <span className={wordCls}>{w.text}</span>
            </span>
            {tags}
            <span className="sr-only">{survivor ? " · sopravvive" : rule ? ` · tolta dalla regola ${rule}` : ""}</span>
          </>
        ) : (
          <>
            {index}
            <span className={clsx(wordCls, "flex-1")}>{w.text}</span>
            {on && <Icon name="check" className="h-5 w-5 shrink-0 text-(--tg-gold)" />}
            <span className="sr-only">{on ? " · scelta" : ""}</span>
          </>
        );
        const cls = clsx(
          "flex border-2 text-left transition-[transform,background-color,border-color] duration-200",
          reveal ? (tv ? "flex-col gap-[0.25cqw]" : "flex-col gap-0.5") : "items-center gap-2",
          tv ? "rounded-[0.8cqw] px-[0.8cqw] py-[0.6cqw]" : "min-h-12 rounded-xl px-2.5 py-2",
          survivor ? "tg-shine border-(--tg-gold-hi) bg-(--tg-gold)" : on ? "tg-picked border-(--tg-gold)" : "border-(--tg-cream)/12 bg-(--tg-cream)/[0.04]",
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
        <li key={i} className={clsx("flex items-start font-bold leading-snug", tv ? "gap-[0.8cqw] text-[1.5cqw]" : "gap-2 text-[15px]")}>
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
      <ThemeBanner eyebrow="Il tema" title={view.theme} size="sm" />
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
      <div className="mx-auto flex h-full max-w-[90cqw] flex-col gap-[1cqw]">
        <ThemeBanner tv size="sm" eyebrow="Il tema" title={view.theme} aside="Solo parole della lista" className="tg-rise" />
        <TvPanel className="!py-[1.1cqw]">
          <WordGrid words={view.words} label="Le parole" reveal={done ? reveal : null} counts={s?.proposals ?? null} tv />
        </TvPanel>
        <div className={clsx("grid min-h-0 flex-1 gap-[1.2cqw]", done ? "grid-cols-[1.05fr_1fr]" : "grid-cols-1")}>
          <TvPanel className="flex min-h-0 flex-col justify-center gap-[0.5cqw] !py-[1.1cqw]">
            <p className="text-[1cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-red-hi)">Le tre eliminazioni, in ordine</p>
            <Rules rules={view.rules} tv />
          </TvPanel>
          {done && <TvExplainCompact text={reveal.explain} />}
        </div>
      </div>
    </TvFrame>
  );
}

export const parolaCheGiraUi = defineUi(Player, Tv);
