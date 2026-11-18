"use client";

import "./m1/m1.css";
import { clsx } from "clsx";
import { useState } from "react";
import type { NonEReveal, NonESubmission, NonEView } from "@/lib/tig/games/mechanics/non-e-quello-che-sembra";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { Doubloon, WaxSeal } from "../kit/ornaments";
import { canEdit, Eyebrow, Explain, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { ArtSvg, framed } from "./m1/art";

type P = PlayerGameProps<NonEView, null, NonESubmission, NonEReveal>;
type T = TvGameProps<NonEView, NonEReveal>;

/** La descrizione esatta: un foglio di pergamena con l'inchiostro scuro (il testo da leggere bene). */
function Description({ text, tv = false }: { text: string; tv?: boolean }) {
  return (
    <div className={clsx("tg-parch flex items-start", tv ? "gap-[1cqw] px-[1.6cqw] py-[1cqw]" : "gap-3 p-3.5")}>
      <Icon name="eye" className={clsx("shrink-0 text-(--tg-burnt-ink)", tv ? "mt-[0.2cqw] h-[2.4cqw] w-[2.4cqw]" : "mt-0.5 h-6 w-6")} />
      <div>
        <p className={clsx("font-extrabold uppercase tracking-[0.18em] text-(--tg-burnt-ink)", tv ? "text-[0.95cqw]" : "text-[11px]")}>La descrizione esatta</p>
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
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-3 lg:items-start">
          {view.images.map((img, i) => {
            const r = byId.get(img.id)!;
            const right = img.id === reveal.imageId;
            return (
              <Panel key={img.id} tone={right ? "lime" : undefined} className={clsx("flex flex-col gap-2.5 p-2.5", !right && "opacity-85")}>
                <div className={clsx("tg1-frame", right && "tg1-frame-gold")}>
                  <div className="tg1-pic relative">
                    <ArtSvg art={img.art} label={img.alt} className="block w-full" />
                    <Doubloon className="absolute left-2 top-2 h-9 w-9 text-lg">{i + 1}</Doubloon>
                    {right && <WaxSeal mark="check" tone="gold" className="absolute right-1.5 top-1.5 h-10 w-10" />}
                    {sent && picked === img.id && !right && <span className="tg-display absolute right-2 top-2 rounded-md bg-(--tg-night)/85 px-2 py-0.5 text-sm text-(--tg-cream)">La vostra</span>}
                  </div>
                </div>
                {right ? (
                  <p className="flex items-start gap-2 px-1 text-base font-extrabold leading-snug text-(--tg-gold-hi)">
                    <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>
                      Rispetta tutta la descrizione
                      {sent && picked === img.id && <span className="text-sm font-bold text-(--tg-cream)/75"> · la vostra</span>}
                    </span>
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
        </div>
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
      <Eyebrow className="px-1 text-(--tg-teal-hi)">{view.scene}</Eyebrow>
      <Description text={view.description} />
      <div role="radiogroup" aria-label="Immagini" className="flex flex-col gap-3 lg:grid lg:grid-cols-3">
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
              className={clsx("tg1-frame block w-full text-left transition-transform active:scale-[0.99]", on && "tg1-frame-gold")}
            >
              <span className="tg1-pic relative">
                <ArtSvg art={img.art} label={img.alt} className="block w-full" />
                <Doubloon className="absolute left-2 top-2 h-10 w-10 text-xl">{i + 1}</Doubloon>
                {on && <WaxSeal mark="check" tone="gold" className="absolute right-1.5 top-1.5 h-11 w-11" />}
              </span>
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
                {/* contenitore «a misura»: il quadro 4:3 con la cornice si adatta alla cella (larghezza E altezza), anche con 12 tavoli */}
                <div className="relative min-h-0 flex-1" style={{ containerType: "size" }}>
                  <div
                    className={clsx("tg1-frame absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2", right && "tg1-frame-gold tg-pop")}
                    style={framed(4 / 3, 2.6)}
                  >
                    <div className="tg1-pic relative h-full w-full">
                      <ArtSvg art={img.art} label={img.alt} className="block h-full w-full" />
                      <Doubloon className="absolute left-[2.6cqw] top-[2.6cqw] h-[11cqw] w-[11cqw] text-[6cqw]">{i + 1}</Doubloon>
                      {right && <WaxSeal mark="check" tone="gold" className="absolute right-[2cqw] top-[2cqw] h-[13cqw] w-[13cqw]" />}
                    </div>
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
                {done && right && (
                  <figcaption className="flex items-center gap-[0.4cqw] text-[1.25cqw] font-extrabold text-(--tg-gold-hi)">
                    <Icon name="check" className="h-[1.4cqw] w-[1.4cqw]" /> Rispetta tutto
                  </figcaption>
                )}
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
