"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { TortoData, TortoReveal, TortoSubmission, TortoView } from "@/lib/tig/games/mechanics/il-pub-ha-torto";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { SkullMark } from "../kit/ornaments";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";
import { DuoToggle, LIT, nTavoli, Step, TvExplainCompact, TvStamp } from "./_m3-kit";

type P = PlayerGameProps<TortoView, null, TortoSubmission, TortoReveal>;
type T = TvGameProps<TortoView, TortoReveal>;

/**
 * Il dato fittizio disegnato in codice: grafico a barre, tabella o scontrino. Tutti i numeri sono scritti
 * (le barre aiutano, non sostituiscono il testo) e c'è una descrizione per i lettori di schermo.
 */
function DataCard({ data, tv = false, compact = false }: { data: TortoData; tv?: boolean; compact?: boolean }) {
  const max = Math.max(1, ...data.rows.map((r) => r.bar ?? 0));
  const alt = `${data.caption}: ${data.rows.map((r) => `${r.label} ${r.shown}`).join("; ")}${data.footnote ? `. ${data.footnote}` : ""}`;
  // in TV al reveal (`compact`) tutto scende un po' di corpo: sotto c'è il «perché» anche con 12 tavoli
  const c = tv && compact;
  return (
    <figure role="img" aria-label={alt} className={clsx("flex flex-col", tv ? (c ? "gap-[0.4cqw]" : "gap-[0.7cqw]") : "gap-2")}>
      <figcaption className={clsx("font-extrabold uppercase tracking-[0.14em] text-(--tg-cream)/70", tv ? (c ? "text-[0.95cqw]" : "text-[1.1cqw]") : "text-[11px]")}>{data.caption}</figcaption>
      {data.kind === "barre" && (
        <div className={clsx("flex flex-col", tv ? (c ? "gap-[0.3cqw]" : "gap-[0.5cqw]") : "gap-1.5")} aria-hidden>
          {data.rows.map((r) => (
            <div key={r.label} className={clsx("grid items-center", tv ? "grid-cols-[11cqw_1fr] gap-[0.8cqw]" : "grid-cols-[5.5rem_1fr] gap-2")}>
              <span className={clsx("truncate font-bold", tv ? (c ? "text-[1.15cqw]" : "text-[1.35cqw]") : "text-sm")}>{r.label}</span>
              <div className="flex items-center gap-2">
                <div className={clsx("rounded-r-md bg-gradient-to-r from-(--tg-deep) to-(--tg-teal)", tv ? (c ? "h-[1.4cqw]" : "h-[2cqw]") : "h-5")} style={{ width: `${((r.bar ?? 0) / max) * 78}%` }} />
                <span className={clsx("tg-num shrink-0", tv ? (c ? "text-[1.35cqw]" : "text-[1.6cqw]") : "text-base")}>{r.shown}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {data.kind === "tabella" && (
        <table className="w-full border-collapse" aria-hidden>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.label} className="border-b border-(--tg-brass)/25 last:border-0">
                <td className={clsx("font-bold", tv ? (c ? "py-[0.3cqw] text-[1.2cqw]" : "py-[0.5cqw] text-[1.45cqw]") : "py-1.5 text-sm")}>{r.label}</td>
                <td className={clsx("tg-num text-right", tv ? (c ? "py-[0.3cqw] text-[1.4cqw]" : "py-[0.5cqw] text-[1.7cqw]") : "py-1.5 text-lg")}>{r.shown}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data.kind === "scontrino" && (
        <div className={clsx("mx-auto w-full bg-[#f4f1e8] font-mono text-[#1b1b1b] shadow-[0_8px_30px_rgba(0,0,0,0.5)]", tv ? (c ? "max-w-[30cqw] px-[1.2cqw] py-[0.7cqw]" : "max-w-[34cqw] px-[1.4cqw] py-[1.1cqw]") : "max-w-sm px-4 py-3")} style={{ clipPath: "polygon(0 0,100% 0,100% 96%,96% 100%,92% 96%,88% 100%,84% 96%,80% 100%,76% 96%,72% 100%,68% 96%,64% 100%,60% 96%,56% 100%,52% 96%,48% 100%,44% 96%,40% 100%,36% 96%,32% 100%,28% 96%,24% 100%,20% 96%,16% 100%,12% 96%,8% 100%,4% 96%,0 100%)" }} aria-hidden>
          <p className={clsx("mb-1 text-center font-bold tracking-widest", tv ? (c ? "text-[0.9cqw]" : "text-[1.1cqw]") : "text-xs")}>* * * SCONTRINO * * *</p>
          {data.rows.map((r) => (
            <p key={r.label} className={clsx("flex items-baseline gap-1", tv ? (c ? "text-[1.15cqw]" : "text-[1.35cqw]") : "text-sm")}>
              <span className="min-w-0 truncate">{r.label}</span>
              <span className="flex-1 border-b border-dotted border-black/40" />
              <span className="shrink-0 font-bold">{r.shown}</span>
            </p>
          ))}
          {!c && <p className={clsx("mt-1 text-center tracking-widest opacity-60", tv ? "text-[1cqw]" : "text-[10px]")}>GRAZIE E ARRIVEDERCI</p>}
        </div>
      )}
      {data.footnote && <p className={clsx("font-semibold italic text-(--tg-cream)/85", tv ? (c ? "text-[1.05cqw]" : "text-[1.25cqw]") : "text-sm")}>{data.footnote}</p>}
    </figure>
  );
}

/** «2 tavoli su 3 hanno sbagliato · verdetto indovinato da 1 tavolo» (singolare e zero compresi). */
function verdictSub(s: NonNullable<TortoReveal["summary"]>) {
  const guessed = s.majorityWrong ? s.predictedWrong : s.tables - s.predictedWrong;
  const errors = s.wrong === 0 ? `Nessun tavolo su ${s.tables} ha sbagliato` : `${nTavoli(s.wrong)} su ${s.tables} ${s.wrong === 1 ? "ha" : "hanno"} sbagliato`;
  return `${errors} · verdetto indovinato da ${guessed === 0 ? "nessuno" : nTavoli(guessed)}`;
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
            <p className="text-base font-bold">{verdictSub(s)}</p>
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
        <p className="tg-title text-[1.9rem] text-(--tg-gold-hi)">{view.caseTitle}</p>
        <DataCard data={view.data} />
      </Panel>
      <Step n={1} title="La vostra risposta" done={!!answer}>
        <p className="text-lg font-extrabold leading-snug">{view.question}</p>
        <ChoiceList options={view.options} picked={answer ? [answer] : []} onToggle={(id) => editable && setAnswer(id)} disabled={!editable} keys={!answer || pubWrong !== null} onConfirm={ready ? submit : null} label="La vostra risposta" />
      </Step>
      <Step n={2} title="La maggioranza dei tavoli sbaglierà?" done={pubWrong !== null}>
        <DuoToggle
          label="La maggioranza dei tavoli sbaglierà?"
          value={pubWrong}
          onChange={(v) => editable && setPubWrong(v)}
          disabled={!editable}
          options={[
            { id: "si", title: "Sì, ha torto", tone: "red", icon: "x" },
            { id: "no", title: "No, ha ragione", tone: "gold", icon: "check" },
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
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <TvPanel className={clsx("flex min-h-0 flex-col !py-[1.1cqw]", s ? "gap-[0.4cqw]" : "gap-[0.6cqw]")}>
            <p className={clsx("tg-title text-(--tg-gold-hi)", s ? "text-[2.1cqw]" : "text-[2.6cqw]")}>{view.caseTitle}</p>
            <DataCard data={view.data} tv compact={!!s} />
          </TvPanel>
          {/* al reveal il «perché» sta sotto il dato; il verdetto va a destra, sotto le risposte */}
          {s && <TvExplainCompact text={reveal!.explain} className="flex-1" />}
        </div>
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <TvPanel className="flex min-h-0 flex-col gap-[0.6cqw] !py-[1.2cqw]">
            <p className="text-[2cqw] font-extrabold leading-tight">{view.question}</p>
            {s
              ? view.options.map((o) => {
                  const right = o.id === reveal!.solutionId;
                  return (
                    <div key={o.id} className={clsx("relative overflow-hidden rounded-[0.8cqw] border-[0.15cqw] px-[1cqw] py-[0.6cqw]", right ? LIT : "border-(--tg-cream)/12 bg-(--tg-night-2)/70")}>
                      <div className={clsx("absolute inset-y-0 left-0", right ? "bg-(--tg-gold-deep)/70" : "bg-(--tg-cream)/10")} style={{ width: `${s.percent[o.id] ?? 0}%` }} aria-hidden />
                      <div className="relative flex items-center gap-[0.8cqw]">
                        {right && <Icon name="check" className="h-[1.8cqw] w-[1.8cqw] shrink-0 text-(--tg-gold-hi)" />}
                        <span className={clsx("min-w-0 flex-1 text-[1.6cqw] font-extrabold leading-tight", right && "text-(--tg-gold-pale)")}>{o.text}</span>
                        <span className={clsx("tg-num shrink-0 text-[2cqw]", right && "text-(--tg-gold-hi)")}>{s.percent[o.id] ?? 0}%</span>
                        <span className="w-[3.6cqw] shrink-0 text-right text-[0.95cqw] font-bold text-(--tg-cream)/70">{s.counts[o.id] ?? 0} tav.</span>
                      </div>
                    </div>
                  );
                })
              : view.options.map((o, i) => <TvOption key={o.id} index={i} text={o.text} size="sm" />)}
          </TvPanel>
          {s && (
            <TvStamp size="sm" tone={s.majorityWrong ? "red" : "lime"} sub={verdictSub(s)}>
              {s.majorityWrong ? "Il pub ha torto!" : "Il pub ha ragione"}
            </TvStamp>
          )}
          {!s && (
            <TvPanel tone="red" className="flex flex-1 items-center justify-center gap-[1.4cqw]">
              <SkullMark className="h-[6cqw] w-[6cqw] text-(--tg-cream)" />
              <p className="tg-title text-[3.6cqw] leading-[1.05] text-(--tg-red-hi)">
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
