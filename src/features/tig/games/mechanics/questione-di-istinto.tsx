"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { IstintoReveal, IstintoSubmission, IstintoView } from "@/lib/tig/games/mechanics/questione-di-istinto";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { TvExplainCompact } from "./_m3-kit";

type P = PlayerGameProps<IstintoView, null, IstintoSubmission, IstintoReveal>;
type T = TvGameProps<IstintoView, IstintoReveal>;

/** Colore fisso per stile (sempre accompagnato dal nome: il colore non è mai l'unico segnale). */
const STYLE_TONES = ["var(--tg-sky)", "var(--tg-teal-hi)", "var(--tg-violet)"] as const;

function StyleChip({ name, index, tv = false }: { name: string; index: number; tv?: boolean }) {
  return (
    <span className={clsx("tg-display inline-flex shrink-0 items-center rounded leading-none text-(--tg-ink)", tv ? "px-[0.5cqw] py-[0.25cqw] text-[1.1cqw]" : "px-1.5 py-0.5 text-sm")} style={{ background: STYLE_TONES[index % 3] }}>
      {name}
    </span>
  );
}

function StylesLegend({ styles, tv = false }: { styles: IstintoView["styles"]; tv?: boolean }) {
  return (
    <div className={clsx("flex flex-wrap items-center", tv ? "gap-[0.8cqw]" : "gap-2")}>
      {styles.map((s, i) => (
        <span key={s.id} className={clsx("tg-display rounded-lg border-2", tv ? "px-[1cqw] py-[0.4cqw] text-[2.2cqw]" : "px-2.5 py-1 text-xl")} style={{ borderColor: STYLE_TONES[i % 3], color: STYLE_TONES[i % 3] }}>
          {s.name}
        </span>
      ))}
    </div>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [picks, setPicks] = useState<Record<string, string>>({});
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const done = view.situations.filter((s) => picks[s.id]).length;
  const ready = done === view.situations.length;
  const current = view.situations.findIndex((s) => !picks[s.id]);
  const submit = () => ready && p.canSubmit && send({ picks });

  if (p.stage === "reveal" && reveal) {
    const mine = reveal.summary?.picks[p.myTeam.teamId] ?? (sent ? picks : {});
    const styleIndex = new Map(reveal.styles.map((s, i) => [s.id, i]));
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {view.situations.map((v) => ({ ...v, styleOf: reveal.situations.find((r) => r.id === v.id)?.styleOf ?? {} })).map((s) => {
          const counts = reveal.summary?.perSituation[s.id] ?? {};
          const total = Object.values(counts).reduce((x, n) => x + n, 0);
          return (
            <Panel key={s.id} className="flex flex-col gap-2">
              <p className="text-base font-extrabold leading-snug">{s.prompt}</p>
              {s.options.map((o) => {
                const st = s.styleOf[o.id];
                const i = styleIndex.get(st) ?? 0;
                const on = mine[s.id] === o.id;
                return (
                  <div key={o.id} className={clsx("flex items-center gap-2 rounded-xl border-2 px-3 py-2", on ? "border-(--tg-gold) bg-(--tg-gold)/10" : "border-(--tg-cream)/10")}>
                    <StyleChip name={reveal.styles[i].name} index={i} />
                    <span className="min-w-0 flex-1 text-sm font-bold leading-snug">{o.text}</span>
                    {on && <Icon name="check" className="h-5 w-5 shrink-0 text-(--tg-gold)" />}
                    {total > 0 && <span className="tg-num shrink-0 text-lg text-(--tg-cream)/70">{Math.round(((counts[o.id] ?? 0) * 100) / total)}%</span>}
                  </div>
                );
              })}
            </Panel>
          );
        })}
        <Explain text={reveal.explain} title="Gli stili" />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label={`Invia ${done}/${view.situations.length}`} hint={ready ? undefined : "Una reazione per ogni situazione"} />}
    >
      <Panel className="flex flex-col gap-2">
        <Eyebrow>Gli stili nascosti</Eyebrow>
        <StylesLegend styles={view.styles} />
        <p className="text-sm font-semibold text-(--tg-cream)/80">Ogni reazione appartiene a uno stile. Restate sempre nello stesso: 3 su 3 = 100, 2 su 3 = 50.</p>
      </Panel>
      {view.situations.map((s, i) => (
        <Panel key={s.id} className={clsx("flex flex-col gap-2", i === current && editable && "outline outline-2 outline-(--tg-gold)/50")}>
          <Eyebrow className={clsx(picks[s.id] && "text-(--tg-gold)")}>Situazione {i + 1}</Eyebrow>
          <p className="text-lg font-extrabold leading-snug">{s.prompt}</p>
          <ChoiceList
            options={s.options}
            picked={picks[s.id] ? [picks[s.id]] : []}
            onToggle={(id) => editable && setPicks((x) => ({ ...x, [s.id]: id }))}
            disabled={!editable}
            keys={i === (current < 0 ? view.situations.length - 1 : current)}
            onConfirm={ready ? submit : null}
            label={`Situazione ${i + 1}`}
          />
        </Panel>
      ))}
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const s = done ? reveal.summary : null;
  const styleIndex = new Map(view.styles.map((x, i) => [x.id, i]));
  const top = s ? view.styles.slice().sort((a, b) => (s.styleTotals[b.id] ?? 0) - (s.styleTotals[a.id] ?? 0))[0] : null;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Ecco lo stile di ogni reazione" : "Un voto per tavolo. Ogni reazione ha uno stile nascosto: restate coerenti."}>
      <div className="flex h-full flex-col gap-[1.2cqw]">
        <TvPanel className="tg-rise flex items-center justify-between gap-[1.2cqw]">
          <div className="flex items-center gap-[1cqw]">
            <p className="text-[1.2cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-cream)/60">Tre stili</p>
            <StylesLegend styles={view.styles} tv />
          </div>
          {s && top ? (
            <p className="tg-pop text-[1.6cqw] font-extrabold">
              Coerenti: <span className="tg-num text-[2.4cqw] text-(--tg-gold)">{s.coherent}</span>/{s.tables} · il locale è soprattutto «{top.name}» ({s.stylePercent[top.id] ?? 0}%)
            </p>
          ) : (
            <p className="text-[1.5cqw] font-bold text-(--tg-cream)/75">3 su 3 = 100 · 2 su 3 = 50</p>
          )}
        </TvPanel>
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-[1.2cqw]">
          {view.situations.map((x) => ({ ...x, styleOf: (done ? reveal.situations.find((r) => r.id === x.id)?.styleOf : null) ?? ({} as Record<string, string>) })).map((sit, k) => {
            const counts = s?.perSituation[sit.id] ?? {};
            const total = Object.values(counts).reduce((x, n) => x + n, 0);
            return (
              <TvPanel key={sit.id} className="tg-rise flex min-h-0 flex-col gap-[0.7cqw]">
                <p className="text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-gold)">Situazione {k + 1}</p>
                <p className="text-[1.75cqw] font-extrabold leading-tight">{sit.prompt}</p>
                {sit.options.map((o, i) => {
                  const st = sit.styleOf[o.id];
                  const si = st ? (styleIndex.get(st) ?? 0) : -1;
                  return (
                    <div key={o.id} className="flex items-start gap-[0.6cqw] rounded-[0.8cqw] border-[0.15cqw] border-(--tg-cream)/12 bg-(--tg-cream)/[0.04] px-[0.8cqw] py-[0.6cqw]">
                      <span className="tg-num grid h-[2cqw] w-[2cqw] shrink-0 place-items-center rounded-[0.4cqw] bg-(--tg-cream)/10 text-[1.2cqw]">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[1.35cqw] font-bold leading-snug">{o.text}</p>
                        {si >= 0 && (
                          <div className="mt-[0.3cqw] flex items-center gap-[0.5cqw]">
                            <StyleChip name={view.styles[si].name} index={si} tv />
                            {total > 0 && <span className="tg-num text-[1.3cqw] text-(--tg-cream)/80">{Math.round(((counts[o.id] ?? 0) * 100) / total)}%</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </TvPanel>
            );
          })}
        </div>
        {done && <TvExplainCompact text={reveal.explain} title="Gli stili" />}
      </div>
    </TvFrame>
  );
}

export const questioneDiIstintoUi = defineUi(Player, Tv);
