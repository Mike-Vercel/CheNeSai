"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { NonEReveal, NonESubmission, NonEView } from "@/lib/tig/games/mechanics/non-e-quello-che-sembra";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { canEdit, Eyebrow, Explain, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { ArtSvg } from "./m1/art";

type P = PlayerGameProps<NonEView, null, NonESubmission, NonEReveal>;
type T = TvGameProps<NonEView, NonEReveal>;

function Description({ text, tv = false }: { text: string; tv?: boolean }) {
  return (
    <div className={clsx("tg-glass tg-glass-lime flex items-start", tv ? "gap-[1cqw] rounded-[1.2cqw] px-[1.6cqw] py-[1cqw]" : "gap-3 rounded-2xl p-3")}>
      <Icon name="eye" className={clsx("shrink-0 text-(--tg-gold)", tv ? "mt-[0.2cqw] h-[2.4cqw] w-[2.4cqw]" : "mt-0.5 h-6 w-6")} />
      <div>
        <p className={clsx("font-extrabold uppercase tracking-[0.18em] text-(--tg-gold)", tv ? "text-[0.95cqw]" : "text-[11px]")}>La descrizione esatta</p>
        <p className={clsx("font-extrabold leading-snug", tv ? "text-[2cqw]" : "text-lg")}>{text}</p>
      </div>
    </div>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const submit = () => picked && p.canSubmit && send({ imageId: picked });
  useAnswerKeys({ enabled: editable && !reveal, count: view.images.length, onPick: (i) => setPicked(view.images[i].id), onConfirm: submit });

  if (p.stage === "reveal" && reveal) {
    const byId = new Map(reveal.images.map((x) => [x.id, x]));
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Description text={reveal.description} />
        {view.images.map((img, i) => {
          const r = byId.get(img.id)!;
          const right = img.id === reveal.imageId;
          return (
            <Panel key={img.id} tone={right ? "lime" : undefined} className={clsx("flex flex-col gap-2 p-2", !right && "opacity-80")}>
              <div className="relative">
                <ArtSvg art={img.art} label={img.alt} className="block w-full rounded-xl" />
                <span className={clsx("tg-num absolute left-2 top-2 grid h-9 w-9 place-items-center rounded-lg text-xl", right ? "bg-(--tg-gold) text-(--tg-ink)" : "bg-(--tg-night)/80 text-(--tg-cream)")}>{i + 1}</span>
                {sent && picked === img.id && <span className="tg-display absolute right-2 top-2 rounded-md bg-(--tg-night)/85 px-2 py-0.5 text-sm text-(--tg-cream)">La vostra</span>}
              </div>
              {right ? (
                <p className="flex items-center gap-2 px-1 text-base font-extrabold text-(--tg-gold)">
                  <Icon name="check" className="h-5 w-5" /> Rispetta tutta la descrizione
                </p>
              ) : (
                <ul className="flex flex-col gap-1 px-1">
                  {r.broken.map((j) => (
                    <li key={j} className="flex items-start gap-2 text-sm font-bold text-(--tg-red-hi)">
                      <Icon name="x" className="mt-0.5 h-4 w-4 shrink-0" /> Non vale: «{reveal.parts[j]}»
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          );
        })}
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={
        <SubmitBar
          kbd="Invio"
          canSubmit={p.canSubmit}
          submitted={p.submitted}
          stage={p.stage}
          ready={!!picked}
          pending={pending}
          error={error}
          onSubmit={submit}
          label={picked ? `È la n. ${view.images.findIndex((x) => x.id === picked) + 1}` : "Scegliete l'immagine"}
          hint={picked ? undefined : "Controllate ogni pezzo della descrizione (dal PC: tasti 1–3)"}
        />
      }
    >
      <Eyebrow className="px-1 text-(--tg-gold)">{view.scene}</Eyebrow>
      <Description text={view.description} />
      <div role="radiogroup" aria-label="Immagini" className="flex flex-col gap-3">
        {view.images.map((img, i) => {
          const on = picked === img.id;
          return (
            <button
              key={img.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`Immagine ${i + 1}: ${img.alt}`}
              disabled={!editable}
              onClick={() => editable && setPicked(img.id)}
              className={clsx("relative overflow-hidden rounded-2xl border-[3px] transition-transform active:scale-[0.99]", on ? "border-(--tg-gold) shadow-[0_0_30px_-6px_color-mix(in_srgb,var(--tg-gold)_70%,transparent)]" : "border-(--tg-cream)/12")}
            >
              <ArtSvg art={img.art} label={img.alt} className="block w-full" />
              <span className={clsx("tg-num absolute left-2 top-2 grid h-10 w-10 place-items-center rounded-lg text-2xl", on ? "bg-(--tg-gold) text-(--tg-ink)" : "bg-(--tg-night)/80 text-(--tg-cream)")}>{i + 1}</span>
              {on && <Icon name="check" className="absolute right-2 top-2 h-9 w-9 rounded-full bg-(--tg-gold) p-1.5 text-(--tg-ink)" />}
            </button>
          );
        })}
      </div>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const byId = done ? new Map(reveal.images.map((x) => [x.id, x])) : null;
  return (
    <TvFrame view={view} p={p} subtitle={`«${view.scene}»: una sola immagine rispetta la descrizione.`}>
      <div className="flex h-full flex-col gap-[1.2cqw]">
        <Description text={view.description} tv />
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-[1.4cqw]">
          {view.images.map((img, i) => {
            const right = done && img.id === reveal.imageId;
            const r = byId?.get(img.id);
            return (
              <figure key={img.id} className={clsx("tg-rise flex min-h-0 flex-col gap-[0.6cqw]", done && !right && "opacity-70")} style={{ animationDelay: `${i * 120}ms` }}>
                {/* contenitore «a misura»: l'immagine 4:3 si adatta alla cella (larghezza E altezza), anche con 12 tavoli sotto */}
                <div className="relative min-h-0 flex-1" style={{ containerType: "size" }}>
                  <div
                    className={clsx("absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[4cqw] border-[0.8cqw]", right ? "tg-pop border-(--tg-gold) shadow-[0_0_50px_-10px_color-mix(in_srgb,var(--tg-gold)_80%,transparent)]" : "border-(--tg-cream)/12")}
                    style={{ width: "min(100cqw, 133.33cqh)", height: "min(75cqw, 100cqh)" }}
                  >
                    <ArtSvg art={img.art} label={img.alt} className="block h-full w-full" />
                    <span className={clsx("tg-num absolute left-[2.6cqw] top-[2.6cqw] grid h-[11cqw] w-[11cqw] place-items-center rounded-[2.4cqw] text-[7cqw]", right ? "bg-(--tg-gold) text-(--tg-ink)" : "bg-(--tg-night)/85 text-(--tg-cream)")}>{i + 1}</span>
                    {right && <Icon name="check" className="absolute right-[2.6cqw] top-[2.6cqw] h-[11cqw] w-[11cqw] rounded-full bg-(--tg-gold) p-[1.6cqw] text-(--tg-ink)" />}
                  </div>
                </div>
                {done && r && !right && (
                  <figcaption className="flex flex-col gap-[0.3cqw]">
                    {r.broken.map((j) => (
                      <span key={j} className="flex items-start gap-[0.4cqw] text-[1.25cqw] font-extrabold leading-tight text-(--tg-red-hi)">
                        <Icon name="x" className="mt-[0.15cqw] h-[1.3cqw] w-[1.3cqw] shrink-0" /> {reveal.parts[j]}: no
                      </span>
                    ))}
                  </figcaption>
                )}
                {done && right && <figcaption className="text-[1.25cqw] font-extrabold text-(--tg-gold)">Rispetta tutto</figcaption>}
              </figure>
            );
          })}
        </div>
        {done && <TvExplain text={reveal.explain} />}
        {!done && (
          <TvPanel className="mx-auto px-[2cqw] py-[0.8cqw]">
            <p className="text-[1.5cqw] font-extrabold">Dal telefono: toccate l&apos;immagine giusta. Prima rispondete, più vale (fino a +20).</p>
          </TvPanel>
        )}
      </div>
    </TvFrame>
  );
}

export const nonEQuelloCheSembraUi = defineUi(Player, Tv);
