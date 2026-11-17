"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { MercatoMemberView, MercatoReveal, MercatoSubmission, MercatoView } from "@/lib/tig/games/mechanics/il-mercato-finale";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";
import { BalanceCard } from "./m5-kit";

type P = PlayerGameProps<MercatoView, MercatoMemberView, MercatoSubmission, MercatoReveal>;
type T = TvGameProps<MercatoView, MercatoReveal>;

/** L'acquisto resta anche se il telefono ricarica la pagina (stessa prova, stesso tavolo). */
function storedBuy(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function Player(p: P) {
  const { view, reveal, memberView: mv } = p;
  // stessa prova e stesso tavolo (non la scadenza: con la pausa della regia cambia)
  const key = `tig-mercato:${view.number}:${p.myTeam.teamId}:${view.heading}:${view.prompt.length}`;
  const [buy, setBuy] = useState<string | null>(() => storedBuy(key));
  const [arming, setArming] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const maxSpend = mv?.maxSpend ?? view.maxPrice;
  const bought = view.hints.find((h) => h.id === buy) ?? null;
  const submit = () => !!picked && p.canSubmit && send({ buy, optionId: picked });
  const purchase = (id: string) => {
    if (!editable || buy) return;
    if (arming !== id) {
      setArming(id);
      return;
    }
    setBuy(id);
    setArming(null);
    try {
      window.sessionStorage.setItem(key, id);
    } catch {
      // senza memoria del browser l'acquisto vale lo stesso: viaggia con l'invio
    }
  };

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-2">
          <p className="text-lg font-extrabold leading-snug">{reveal.prompt}</p>
          <ChoiceList options={reveal.options} picked={sent && picked ? [picked] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.solutionId] }} />
        </Panel>
        <Panel className="flex flex-col gap-2">
          <Eyebrow>Il banco, svelato</Eyebrow>
          {reveal.hints.map((h) => (
            <p key={h.id} className={clsx("rounded-xl border px-3 py-2 text-sm font-semibold leading-snug", h.id === buy ? "border-[#c6ff3d]/60 bg-[#c6ff3d]/10" : "border-white/10")}>
              <b className="tg-num mr-1 text-[#ffc24a]">{h.price}</b> {h.label}: <span className="text-white/80">{h.text}</span>
            </p>
          ))}
        </Panel>
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
          label={bought ? `Rispondi · −${bought.price}` : "Rispondi"}
          hint={`Giusta +${view.prize}${bought ? ` − ${bought.price} = +${view.prize - bought.price}` : ""}; sbagliata ${bought ? `−${bought.price}` : "0"}`}
        />
      }
    >
      <Panel className="flex flex-col gap-1">
        <Eyebrow className="text-[#ffc24a]">{view.heading}</Eyebrow>
        <p className="text-lg font-extrabold leading-snug">{view.prompt}</p>
      </Panel>
      <BalanceCard balance={mv?.balance ?? null} note={`Spesa massima: ${maxSpend} (un solo acquisto, mai oltre il 25% del saldo)`} />
      <Panel className="flex flex-col gap-2">
        <Eyebrow className="text-[#ffc24a]">Il banco · un indizio solo</Eyebrow>
        {view.hints.map((h) => {
          const mine = buy === h.id;
          const tooDear = h.price > maxSpend;
          const off = !editable || (!!buy && !mine) || tooDear;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => purchase(h.id)}
              disabled={off}
              aria-pressed={mine}
              className={clsx(
                "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition-transform active:scale-[0.985]",
                mine ? "tg-picked border-[#c6ff3d]" : arming === h.id ? "border-[#ffc24a] bg-[#ffc24a]/10" : "border-white/12 bg-white/[0.04]",
                off && !mine && "opacity-45",
              )}
            >
              <span className="tg-num grid h-11 w-14 shrink-0 place-items-center rounded-lg bg-[#ffc24a] text-2xl text-[#0b0d12]">{h.price}</span>
              <span className="min-w-0 flex-1 text-base font-bold leading-snug">{h.label}</span>
              <span className="shrink-0 text-xs font-extrabold uppercase tracking-wide text-white/70">{mine ? "Comprato" : tooDear ? "Troppo caro" : arming === h.id ? "Tocca ancora: definitivo" : buy ? "" : "Compra"}</span>
            </button>
          );
        })}
      </Panel>
      {bought && (
        <Panel tone="lime" className="tg-pop flex items-start gap-3">
          <Icon name="eye" className="mt-0.5 h-7 w-7 shrink-0 text-[#c6ff3d]" />
          <div>
            <Eyebrow className="text-[#c6ff3d]">Il vostro indizio</Eyebrow>
            <p className="text-base font-bold leading-snug">{bought.text}</p>
          </div>
        </Panel>
      )}
      <Panel className="flex flex-col gap-3">
        <Eyebrow>La vostra risposta</Eyebrow>
        <ChoiceList options={view.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} />
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const buys = done ? (reveal.summary?.buys ?? []) : [];
  return (
    <TvFrame view={view} p={p} subtitle={done ? `${view.heading} · la risposta e gli indizi` : `${view.heading} · un indizio al massimo, costa da subito`}>
      <div className="grid h-full grid-cols-[1.5fr_1fr] gap-[1.4cqw]">
        <div className="flex min-h-0 flex-col gap-[1.1cqw]">
          <TvPanel className="tg-rise flex flex-col gap-[1cqw]">
            <p className="text-[2.2cqw] font-extrabold leading-tight">{done ? reveal.prompt : view.prompt}</p>
            <div className="grid grid-cols-2 gap-[0.7cqw]">
              {(done ? reveal.options : view.options).map((o, i) => (
                <TvOption key={o.id} index={i} text={o.text} size="sm" state={done ? (o.id === reveal.solutionId ? "right" : "dim") : "idle"} />
              ))}
            </div>
          </TvPanel>
          {done && <TvExplain text={reveal.explain} />}
        </div>
        <TvPanel className="flex min-h-0 flex-col gap-[0.8cqw]">
          <p className="flex items-center gap-[0.6cqw] text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-[#ffc24a]">
            <Icon name="coins" className="h-[1.8cqw] w-[1.8cqw]" /> Il banco
          </p>
          {(done ? reveal.hints : view.hints).map((h) => {
            const n = buys.filter((b) => b.hintId === h.id).length;
            return (
              <div key={h.id} className="tg-rise flex flex-col gap-[0.4cqw] rounded-[1cqw] border border-white/12 bg-white/[0.05] p-[0.9cqw]">
                <div className="flex items-center gap-[0.8cqw]">
                  <span className="tg-num grid h-[3.4cqw] w-[4.4cqw] shrink-0 place-items-center rounded-[0.6cqw] bg-[#ffc24a] text-[2.2cqw] text-[#0b0d12]">{h.price}</span>
                  <p className="min-w-0 flex-1 text-[1.45cqw] font-extrabold leading-tight">{h.label}</p>
                  {done && <span className="tg-num shrink-0 text-[1.3cqw] text-white/70">{n} tavol{n === 1 ? "o" : "i"}</span>}
                </div>
                {done && <p className="text-[1.2cqw] font-semibold leading-snug text-white/85">{h.text}</p>}
              </div>
            );
          })}
          {!done && <p className="mt-auto text-[1.2cqw] font-bold leading-snug text-white/65">Il testo dell&apos;indizio lo vede solo chi lo compra. Giusta +{view.prize} meno la spesa; sbagliata, la spesa è persa.</p>}
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const ilMercatoFinaleUi = defineUi(Player, Tv);
