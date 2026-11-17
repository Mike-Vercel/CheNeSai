"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { PrevedibiliReveal, PrevedibiliSubmission, PrevedibiliView } from "@/lib/tig/games/mechanics/quanto-siete-prevedibili";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { BigToggle } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { PercentPicker, PromptCard, Step, TableChip, teamMap, TvStamp } from "./_m3-kit";

type P = PlayerGameProps<PrevedibiliView, null, PrevedibiliSubmission, PrevedibiliReveal>;
type T = TvGameProps<PrevedibiliView, PrevedibiliReveal>;

interface Marker {
  key: string;
  percent: number;
  tableNo: number | string;
  color?: string;
}

/** Righello 0–100% con il risultato reale e le previsioni dei tavoli (impilate se vicine). */
function Ruler({ actual, markers, tv = false }: { actual: number | null; markers: Marker[]; tv?: boolean }) {
  // impila le tessere vicine su più righe (ognuna larga ~4 punti)
  const gap = tv ? 3.2 : 9;
  const rows: number[] = [];
  const placed = markers
    .slice()
    .sort((a, b) => a.percent - b.percent)
    .map((m) => {
      let row = rows.findIndex((last) => m.percent - last >= gap);
      if (row < 0) {
        rows.push(m.percent);
        row = rows.length - 1;
      } else rows[row] = m.percent;
      return { ...m, row };
    });
  const rowH = tv ? 2.8 : 2.1; // cqw o rem
  const unit = tv ? "cqw" : "rem";
  return (
    <div className="relative" style={{ paddingTop: `${Math.max(1, rows.length) * rowH + (tv ? 0.6 : 0.4)}${unit}` }}>
      {placed.map((m) => (
        <div key={m.key} className="tg-pop absolute -translate-x-1/2" style={{ left: `${m.percent}%`, top: `${m.row * rowH}${unit}` }}>
          <TableChip tableNo={m.tableNo} color={m.color} tv={tv} className={tv ? "" : "!h-7 !min-w-7 !text-base"} />
        </div>
      ))}
      <div className={clsx("relative rounded-full bg-white/10", tv ? "h-[1.6cqw]" : "h-4")}>
        {actual !== null && <div className="absolute inset-y-0 left-0 rounded-full bg-[#c6ff3d]/35 transition-[width] duration-1000" style={{ width: `${actual}%` }} />}
        {actual !== null && (
          <div className="absolute -translate-x-1/2" style={{ left: `${actual}%`, top: tv ? "-0.8cqw" : "-0.5rem" }}>
            <div className={clsx("rounded-full bg-[#c6ff3d] shadow-[0_0_24px_rgba(198,255,61,0.8)]", tv ? "h-[3.2cqw] w-[0.5cqw]" : "h-8 w-1.5")} />
          </div>
        )}
      </div>
      <div className={clsx("mt-1 flex justify-between font-bold text-white/55", tv ? "text-[1.1cqw]" : "text-xs")}>
        {[0, 25, 50, 75, 100].map((n) => (
          <span key={n}>{n}%</span>
        ))}
      </div>
    </div>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [yes, setYes] = useState<"si" | "no" | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = yes !== null && percent !== null;
  const submit = () => ready && p.canSubmit && send({ yes: yes === "si", percent: percent! });
  useAnswerKeys({ enabled: editable && yes === null, count: 2, onPick: (i) => setYes(i === 0 ? "si" : "no") });

  if (p.stage === "reveal" && reveal) {
    const s = reveal.summary;
    const mine = s?.guesses.find((g) => g.teamId === p.myTeam.teamId)?.percent ?? (sent ? percent : null);
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {s && (
          <Panel className="flex flex-col gap-3">
            <Eyebrow>Il locale · {s.tables} tavoli</Eyebrow>
            <p className="text-lg font-extrabold leading-snug">
              Ha detto «{reveal.yesLabel}» il <span className="tg-num text-5xl text-[#c6ff3d]">{s.actual}%</span>
            </p>
            <Ruler actual={s.actual} markers={mine !== null ? [{ key: "me", percent: mine, tableNo: p.myTeam.tableNo, color: "#eef2f6" }] : []} />
            {mine !== null && (
              <p className="text-sm font-bold text-white/75">
                La vostra previsione (tavolo {p.myTeam.tableNo}): {mine}% · scarto {Math.abs(mine - s.actual)} punti
              </p>
            )}
          </Panel>
        )}
        <Explain text={reveal.explain} title="Il locale" />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Vota e prevedi" hint={yes === null ? "Prima il voto del tavolo" : percent === null ? "Poi la percentuale di sì nel locale" : undefined} />}
    >
      <PromptCard eyebrow="La proposta">{view.proposal}</PromptCard>
      <Step n={1} title="Il voto del vostro tavolo" done={yes !== null}>
        <BigToggle
          label="Il voto del vostro tavolo"
          value={yes}
          onChange={(v) => editable && setYes(v)}
          disabled={!editable}
          options={[
            { id: "si", title: view.yesLabel, tone: "lime", icon: "check" },
            { id: "no", title: view.noLabel, tone: "red", icon: "x" },
          ]}
        />
      </Step>
      <Step n={2} title={`Quanti tavoli diranno «${view.yesLabel}»?`} done={percent !== null}>
        <PercentPicker value={percent} onChange={(v) => editable && setPercent(v)} disabled={!editable} label="Percentuale di tavoli" onEnter={submit} />
      </Step>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const s = done ? reveal.summary : null;
  const teams = teamMap(p.teams);
  const markers: Marker[] = (s?.guesses ?? []).map((g) => ({ key: g.teamId, percent: g.percent, tableNo: teams.get(g.teamId)?.tableNo ?? "?", color: teams.get(g.teamId)?.color }));
  const best = s?.guesses.filter((g) => g.diff === s.guesses[0]?.diff) ?? [];
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Ecco quanto è prevedibile questo locale" : "Un voto per tavolo, poi la previsione: che percentuale di tavoli dirà sì?"}>
      <div className="mx-auto flex h-full max-w-[86cqw] flex-col gap-[1.4cqw]">
        <TvPanel className="tg-rise">
          <p className="mb-[0.4cqw] text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-[#c6ff3d]">La proposta</p>
          <p className="text-[2.7cqw] font-extrabold leading-tight">{view.proposal}</p>
        </TvPanel>
        {s ? (
          <div className="grid min-h-0 flex-1 grid-cols-[1.5fr_1fr] gap-[1.4cqw]">
            <TvPanel className="flex flex-col justify-center gap-[1.2cqw]">
              <TvStamp sub={`${s.yes} tavoli su ${s.tables} hanno detto «${view.yesLabel}»`}>{s.actual}% sì</TvStamp>
              <Ruler actual={s.actual} markers={markers} tv />
              {best.length > 0 && (
                <p className="text-center text-[1.5cqw] font-extrabold">
                  Più vicini: {best.map((g) => `tavolo ${teams.get(g.teamId)?.tableNo ?? "?"}`).join(", ")} · scarto {best[0].diff}
                </p>
              )}
            </TvPanel>
            <TvExplain text={reveal!.explain} className="self-start" />
          </div>
        ) : (
          <div className="grid flex-1 grid-cols-2 gap-[1.4cqw]">
            {[view.yesLabel, view.noLabel].map((l, i) => (
              <TvPanel key={l} tone={i === 0 ? "lime" : "red"} className="flex flex-col items-center justify-center gap-[0.6cqw]">
                <p className="tg-display text-[4.6cqw]">{l}</p>
                <p className="tg-num text-[6cqw] text-white/25">?%</p>
              </TvPanel>
            ))}
          </div>
        )}
      </div>
    </TvFrame>
  );
}

export const quantoSietePrevedibiliUi = defineUi(Player, Tv);
