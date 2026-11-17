"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { TortoData, TortoReveal, TortoSubmission, TortoView } from "@/lib/tig/games/mechanics/il-pub-ha-torto";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { VoteBars } from "../kit/bars";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { BigToggle, ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";
import { Step, TvExplainCompact, TvStamp } from "./_m3-kit";

type P = PlayerGameProps<TortoView, null, TortoSubmission, TortoReveal>;
type T = TvGameProps<TortoView, TortoReveal>;

/**
 * Il dato fittizio disegnato in codice: grafico a barre, tabella o scontrino. Tutti i numeri sono scritti
 * (le barre aiutano, non sostituiscono il testo) e c'è una descrizione per i lettori di schermo.
 */
function DataCard({ data, tv = false }: { data: TortoData; tv?: boolean }) {
  const max = Math.max(1, ...data.rows.map((r) => r.bar ?? 0));
  const alt = `${data.caption}: ${data.rows.map((r) => `${r.label} ${r.shown}`).join("; ")}${data.footnote ? `. ${data.footnote}` : ""}`;
  return (
    <figure role="img" aria-label={alt} className={clsx("flex flex-col", tv ? "gap-[0.7cqw]" : "gap-2")}>
      <figcaption className={clsx("font-extrabold uppercase tracking-[0.14em] text-white/65", tv ? "text-[1.1cqw]" : "text-[11px]")}>{data.caption}</figcaption>
      {data.kind === "barre" && (
        <div className={clsx("flex flex-col", tv ? "gap-[0.5cqw]" : "gap-1.5")} aria-hidden>
          {data.rows.map((r) => (
            <div key={r.label} className={clsx("grid items-center", tv ? "grid-cols-[11cqw_1fr] gap-[0.8cqw]" : "grid-cols-[5.5rem_1fr] gap-2")}>
              <span className={clsx("truncate font-bold", tv ? "text-[1.35cqw]" : "text-sm")}>{r.label}</span>
              <div className="flex items-center gap-2">
                <div className={clsx("rounded-r-md bg-[#6fe7ff]/80", tv ? "h-[2cqw]" : "h-5")} style={{ width: `${((r.bar ?? 0) / max) * 78}%` }} />
                <span className={clsx("tg-num shrink-0", tv ? "text-[1.6cqw]" : "text-base")}>{r.shown}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {data.kind === "tabella" && (
        <table className="w-full border-collapse" aria-hidden>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.label} className="border-b border-white/10 last:border-0">
                <td className={clsx("font-bold", tv ? "py-[0.5cqw] text-[1.45cqw]" : "py-1.5 text-sm")}>{r.label}</td>
                <td className={clsx("tg-num text-right", tv ? "py-[0.5cqw] text-[1.7cqw]" : "py-1.5 text-lg")}>{r.shown}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data.kind === "scontrino" && (
        <div className={clsx("mx-auto w-full bg-[#f4f1e8] font-mono text-[#1b1b1b] shadow-[0_8px_30px_rgba(0,0,0,0.5)]", tv ? "max-w-[34cqw] px-[1.4cqw] py-[1.1cqw]" : "max-w-sm px-4 py-3")} style={{ clipPath: "polygon(0 0,100% 0,100% 96%,96% 100%,92% 96%,88% 100%,84% 96%,80% 100%,76% 96%,72% 100%,68% 96%,64% 100%,60% 96%,56% 100%,52% 96%,48% 100%,44% 96%,40% 100%,36% 96%,32% 100%,28% 96%,24% 100%,20% 96%,16% 100%,12% 96%,8% 100%,4% 96%,0 100%)" }} aria-hidden>
          <p className={clsx("mb-1 text-center font-bold tracking-widest", tv ? "text-[1.1cqw]" : "text-xs")}>* * * SCONTRINO * * *</p>
          {data.rows.map((r) => (
            <p key={r.label} className={clsx("flex items-baseline gap-1", tv ? "text-[1.35cqw]" : "text-sm")}>
              <span className="min-w-0 truncate">{r.label}</span>
              <span className="flex-1 border-b border-dotted border-black/40" />
              <span className="shrink-0 font-bold">{r.shown}</span>
            </p>
          ))}
          <p className={clsx("mt-1 text-center tracking-widest opacity-60", tv ? "text-[1cqw]" : "text-[10px]")}>GRAZIE E ARRIVEDERCI</p>
        </div>
      )}
      {data.footnote && <p className={clsx("font-semibold italic text-white/80", tv ? "text-[1.25cqw]" : "text-sm")}>{data.footnote}</p>}
    </figure>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [answer, setAnswer] = useState<string | null>(null);
  const [pubWrong, setPubWrong] = useState<"si" | "no" | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = !!answer && pubWrong !== null;
  const submit = () => ready && p.canSubmit && send({ optionId: answer!, pubWrong: pubWrong === "si" });

  if (p.stage === "reveal" && reveal) {
    const s = reveal.summary;
    const mine = s?.picks[p.myTeam.teamId]?.optionId ?? (sent ? answer : null);
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {s && (
          <Panel tone={s.majorityWrong ? "red" : "lime"} className="text-center">
            <p className="tg-display text-4xl">{s.majorityWrong ? "Il pub ha torto!" : "Il pub ha ragione"}</p>
            <p className="text-base font-bold">
              {s.wrong} tavoli su {s.tables} hanno sbagliato · {s.predictedWrong} lo avevano previsto
            </p>
          </Panel>
        )}
        <Panel className="flex flex-col gap-2">
          <Eyebrow>{reveal.question}</Eyebrow>
          <ChoiceList options={view.options} picked={mine ? [mine] : []} onToggle={() => {}} reveal={{ solution: [reveal.solutionId] }} keys={false} />
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Rispondi e prevedi" hint={!answer ? "Prima la risposta al dato" : pubWrong === null ? "Poi: la maggioranza sbaglierà?" : undefined} />}
    >
      <Panel className="flex flex-col gap-2">
        <p className="tg-display text-3xl">{view.caseTitle}</p>
        <DataCard data={view.data} />
      </Panel>
      <Step n={1} title="La vostra risposta" done={!!answer}>
        <p className="text-lg font-extrabold leading-snug">{view.question}</p>
        <ChoiceList options={view.options} picked={answer ? [answer] : []} onToggle={(id) => editable && setAnswer(id)} disabled={!editable} keys={!answer || pubWrong !== null} onConfirm={ready ? submit : null} label="La vostra risposta" />
      </Step>
      <Step n={2} title="La maggioranza dei tavoli sbaglierà?" done={pubWrong !== null}>
        <BigToggle
          label="La maggioranza dei tavoli sbaglierà?"
          value={pubWrong}
          onChange={(v) => editable && setPubWrong(v)}
          disabled={!editable}
          options={[
            { id: "si", title: "Sì, ha torto", tone: "red", icon: "x" },
            { id: "no", title: "No, ha ragione", tone: "lime", icon: "check" },
          ]}
        />
      </Step>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const s = done ? reveal.summary : null;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Il dato, la risposta giusta e il verdetto sul pub" : "Risposta giusta +60. Indovinate se la maggioranza dei tavoli sbaglierà: +40."}>
      <div className="grid h-full grid-cols-[1.05fr_1fr] gap-[1.6cqw]">
        <TvPanel className="flex min-h-0 flex-col gap-[0.8cqw]">
          <p className="tg-display text-[3cqw] text-[#c6ff3d]">{view.caseTitle}</p>
          <DataCard data={view.data} tv />
        </TvPanel>
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <TvPanel className="flex flex-col gap-[0.7cqw]">
            <p className="text-[2.1cqw] font-extrabold leading-tight">{view.question}</p>
            {s ? (
              <VoteBars options={view.options} percent={s.percent} counts={s.counts} winners={[reveal!.solutionId]} tv />
            ) : (
              view.options.map((o, i) => <TvOption key={o.id} index={i} text={o.text} size="sm" />)
            )}
          </TvPanel>
          {s ? (
            <>
              <TvStamp size="sm" tone={s.majorityWrong ? "red" : "lime"} sub={`${s.wrong} tavoli su ${s.tables} hanno sbagliato · ${s.predictedWrong} avevano previsto il torto`}>
                {s.majorityWrong ? "Il pub ha torto!" : "Il pub ha ragione"}
              </TvStamp>
              <TvExplainCompact text={reveal!.explain} className="flex-1" />
            </>
          ) : (
            <TvPanel className="flex flex-1 items-center justify-center gap-[1.2cqw]">
              <Icon name="users" className="h-[5cqw] w-[5cqw] text-[#ff3b4e]" />
              <p className="tg-display text-[3.2cqw] leading-none">
                Il pub
                <br />
                avrà torto?
              </p>
            </TvPanel>
          )}
        </div>
      </div>
    </TvFrame>
  );
}

export const ilPubHaTortoUi = defineUi(Player, Tv);
