"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { ArchivioDoc, ArchivioReveal, ArchivioSubmission, ArchivioView } from "@/lib/tig/games/mechanics/archivio-manomesso";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, useSubmit } from "../kit/ui";
import { DocCard } from "./m4/docs";

type P = PlayerGameProps<ArchivioView, null, ArchivioSubmission, ArchivioReveal>;
type T = TvGameProps<ArchivioView, ArchivioReveal>;

type RowState = "idle" | "picked" | "tampered" | "witness" | "missed";

function FieldRow({ f, state, dark, tv = false, onPick, disabled }: { f: ArchivioDoc["fields"][number]; state: RowState; dark: boolean; tv?: boolean; onPick?: () => void; disabled?: boolean }) {
  const cls = clsx(
    "flex w-full items-baseline justify-between text-left transition-[background-color,border-color] duration-150",
    tv ? "gap-[0.8cqw] rounded-[0.5cqw] border-[0.14cqw] px-[0.7cqw] py-[0.55cqw]" : "min-h-11 gap-3 rounded-lg border-2 px-2.5 py-1.5",
    state === "idle" && (dark ? "border-(--tg-cream)/10" : "border-black/10"),
    state === "picked" && "border-(--tg-night) bg-(--tg-gold) text-(--tg-ink) shadow-[0_0_0_3px_var(--tg-gold)]",
    state === "tampered" && "border-(--tg-red-hi) bg-(--tg-red) text-white",
    state === "missed" && "border-(--tg-red-hi) border-dashed bg-(--tg-red)/80 text-(--tg-cream)",
    state === "witness" && "border-(--tg-gold-deep) bg-(--tg-gold)/40",
  );
  const body = (
    <>
      <span className={clsx("shrink-0 font-extrabold uppercase opacity-70", tv ? "text-[0.95cqw] tracking-[0.12em]" : "text-[11px] tracking-[0.12em]")}>{f.label}</span>
      <span className={clsx("min-w-0 text-right font-mono font-bold leading-tight", tv ? "text-[1.55cqw]" : "text-base")}>
        {f.text}
        {state === "tampered" || state === "missed" ? <Icon name="x" className={clsx("ml-1 inline", tv ? "h-[1.1cqw] w-[1.1cqw]" : "h-4 w-4")} /> : null}
        {state === "witness" ? <Icon name="check" className={clsx("ml-1 inline", tv ? "h-[1.1cqw] w-[1.1cqw]" : "h-4 w-4")} /> : null}
      </span>
    </>
  );
  if (!onPick) return <div className={cls}>{body}</div>;
  return (
    <button type="button" onClick={onPick} disabled={disabled} aria-pressed={state === "picked"} aria-label={`${f.label}: ${f.text}`} className={clsx(cls, "active:scale-[0.99]")}>
      {body}
    </button>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const submit = () => picked && p.canSubmit && send({ fieldId: picked });
  const done = p.stage === "reveal" && reveal;
  const label = (() => {
    for (const d of view.docs) for (const f of d.fields) if (f.id === picked) return `${f.label}: ${f.text}`;
    return null;
  })();

  const rowState = (id: string): RowState => {
    if (done) {
      if (id === reveal.fieldId) return "tampered";
      if (reveal.witnesses.includes(id)) return "witness";
      if (sent && id === picked) return "missed";
      return "idle";
    }
    return id === picked ? "picked" : "idle";
  };

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={done ? undefined : <SubmitBar canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!picked} pending={pending} error={error} onSubmit={submit} label="È questo il ritocco" hint={label ? `Scelto: ${label}` : "Toccate il campo che contraddice gli altri documenti"} />}
    >
      {done && <MyOutcome outcome={p.myOutcome} />}
      <Panel className="flex flex-col gap-1">
        <Eyebrow>{view.caseTitle}</Eyebrow>
        <p className="text-base font-semibold leading-snug text-(--tg-cream)/90">{view.story}</p>
      </Panel>
      <div className="flex flex-col gap-4">
        {view.docs.map((d, i) => (
          <DocCard key={d.id} kind={d.kind} title={d.title} icon={d.icon} iconLabel={d.iconLabel} index={i}>
            <div className="mt-1 flex flex-col gap-1.5" role="group" aria-label={d.title}>
              {d.fields.map((f) => (
                <FieldRow key={f.id} f={f} dark={d.kind === "messaggio"} state={rowState(f.id)} onPick={done ? undefined : () => setPicked(f.id)} disabled={!editable} />
              ))}
            </div>
          </DocCard>
        ))}
      </div>
      {done && <Explain text={reveal.explain} />}
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const n = view.docs.length;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Il campo ritoccato e i documenti che lo smentiscono" : view.story}>
      <div className="flex h-full flex-col gap-[1.2cqw]">
        <div className={clsx("grid min-h-0 flex-1 items-start gap-[1.2cqw]", n === 4 ? "grid-cols-4" : "grid-cols-3")}>
          {view.docs.map((d, i) => (
            <div key={d.id} className="tg-rise min-h-0" style={{ animationDelay: `${i * 80}ms` }}>
              <DocCard kind={d.kind} title={d.title} icon={d.icon} iconLabel={d.iconLabel} index={i} tv>
                <div className="mt-[0.3cqw] flex flex-col gap-[0.35cqw]">
                  {d.fields.map((f) => (
                    <FieldRow key={f.id} f={f} dark={d.kind === "messaggio"} tv state={done ? (f.id === reveal.fieldId ? "tampered" : reveal.witnesses.includes(f.id) ? "witness" : "idle") : "idle"} />
                  ))}
                </div>
              </DocCard>
            </div>
          ))}
        </div>
        {done && <TvExplain text={reveal.explain} className="shrink-0 py-[1cqw]" />}
      </div>
    </TvFrame>
  );
}

export const archivioManomessoUi = defineUi(Player, Tv);
