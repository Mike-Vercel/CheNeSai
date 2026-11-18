"use client";

import { useState } from "react";
import type { CompraMemberView, CompraReveal, CompraSubmission, CompraView } from "@/lib/tig/games/mechanics/compra-un-indizio";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Doubloon, WaxSeal } from "../kit/ornaments";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { ClueList, SealedOffer, splitProfile, SuspectButton, TableTag, TvSuspect, useCrossed, usePurchases, type SuspectState } from "./m4/kit";

type P = PlayerGameProps<CompraView, CompraMemberView, CompraSubmission, CompraReveal>;
type T = TvGameProps<CompraView, CompraReveal>;

function Player(p: P) {
  const { view, reveal, memberView: mv } = p;
  const [picked, setPicked] = useState<string | null>(null);
  const { crossed, toggle } = useCrossed();
  const { items, buy } = usePurchases(`tig-m4-compra:${view.instance}:${p.myTeam.teamId}`);
  const bought = items.includes("extra");
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const worth = 100 - (bought ? view.price : 0);
  const submit = () => picked && p.canSubmit && send({ optionId: picked, bought });
  useAnswerKeys({ enabled: editable, count: view.suspects.length, onPick: (i) => setPicked(view.suspects[i].id), onConfirm: submit });

  if (p.stage === "reveal" && reveal) {
    const name = new Map(reveal.suspects.map((s) => [s.id, splitProfile(s.text)[0]]));
    const n = reveal.summary?.bought.length ?? 0;
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-3">
          <ClueList clues={reveal.clues.map((c) => c.text)} extra={(i) => (reveal.clues[i].clears.length ? <span className="block text-xs font-extrabold uppercase text-(--tg-cream)/50">Scagiona: {reveal.clues[i].clears.map((id) => name.get(id)).join(", ")}</span> : null)} />
          <div className="rounded-xl border-2 border-(--tg-teal) bg-(--tg-teal)/10 px-3 py-2">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-(--tg-teal-hi)">Il dettaglio in vendita</p>
            <p className="font-bold leading-snug">{reveal.extra.text}</p>
          </div>
          <p className="text-sm font-bold text-(--tg-cream)/75">
            {reveal.freeSolvable ? "Bastavano gli indizi gratuiti: comprarlo era una spesa evitabile." : "Senza il dettaglio restavano due sospettati: era testa o croce."} {`L'hanno comprato ${n} tavol${n === 1 ? "o" : "i"}.`}
          </p>
        </Panel>
        <div className="flex flex-col gap-2">
          {view.suspects.map((s, i) => (
            <SuspectButton key={s.id} option={s} index={i} state={s.id === reveal.solutionId ? "right" : sent && s.id === picked ? "wrong" : "cleared"} />
          ))}
        </div>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!picked} pending={pending} error={error} onSubmit={submit} label={`Rispondi per ${worth}`} hint={bought ? `Dettaglio comprato: la giusta vale ${worth}` : "Senza comprare la giusta vale 100"} />}
    >
      <Panel className="flex flex-col gap-3">
        <div>
          <Eyebrow>{view.caseTitle}</Eyebrow>
          <p className="mt-1 text-lg font-extrabold leading-snug">{view.question}</p>
        </div>
        <ClueList clues={view.clues} />
      </Panel>
      <SealedOffer
        title="Dettaglio supplementare"
        price={view.price}
        bought={bought}
        canBuy={!!mv?.buyer && editable && !!mv.extra}
        onBuy={() => buy("extra")}
        lockedNote={mv?.buyer ? "Prova chiusa." : "Lo compra solo il telefono del capitano: se lo comprate, fatevelo leggere ad alta voce."}
      >
        {mv?.extra}
      </SealedOffer>
      <div role="group" aria-label="Sospettati" className="flex flex-col gap-2">
        {view.suspects.map((s, i) => {
          const state: SuspectState = picked === s.id ? "picked" : crossed.includes(s.id) ? "crossed" : "idle";
          return <SuspectButton key={s.id} option={s} index={i} state={state} disabled={!editable} onPick={() => setPicked(s.id)} onCross={() => toggle(s.id)} />;
        })}
      </div>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const team = new Map(p.teams.map((x) => [x.teamId, x]));
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Il dettaglio in vendita e la soluzione" : view.question}>
      <div className="grid h-full grid-cols-[1.1fr_1fr] gap-[1.6cqw]">
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <TvPanel className="flex flex-col gap-[0.8cqw]">
            <p className="tg-display text-[2.2cqw]">{view.caseTitle}</p>
            <ClueList clues={view.clues} tv />
          </TvPanel>
          {done ? (
            <div className="tg-pop rounded-[1.2cqw] border-[0.2cqw] border-(--tg-teal) bg-(--tg-teal)/12 px-[1.4cqw] py-[1cqw]">
              <p className="text-[1cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-teal-hi)">Il dettaglio in vendita · −{view.price}</p>
              <p className="mt-[0.3cqw] text-[1.6cqw] font-bold leading-snug">{reveal.extra.text}</p>
              <p className="mt-[0.6cqw] flex flex-wrap items-center gap-[0.5cqw] text-[1.2cqw] font-bold text-(--tg-cream)/80">
                {reveal.summary?.bought.length && reveal.summary.bought.length > 6 ? (
                  `Comprato da ${reveal.summary.bought.length} tavoli su ${p.teams.length}`
                ) : reveal.summary?.bought.length ? (
                  <>
                    Comprato da: {reveal.summary.bought.map((id) => <TableTag key={id} tv no={team.get(id)?.tableNo ?? "?"} color={team.get(id)?.color} />)}
                  </>
                ) : (
                  "Nessun tavolo l'ha comprato."
                )}
                <span className="text-(--tg-cream)/60">{reveal.freeSolvable ? " · bastavano gli indizi gratuiti" : " · senza, restavano due sospettati"}</span>
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-[1.2cqw] rounded-[1.2cqw] border-[0.2cqw] border-dashed border-(--tg-teal)/70 bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--tg-teal)_8%,transparent)_0_1cqw,transparent_1cqw_2cqw)] px-[1.4cqw] py-[1.1cqw]">
              {/* busta sigillata con la ceralacca; il prezzo è un doblone */}
              <WaxSeal mark="anchor" className="h-[4.2cqw] w-[4.2cqw] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="tg-display text-[2.2cqw] text-(--tg-teal-hi)">In vendita: un dettaglio</p>
                <p className="text-[1.3cqw] font-bold text-(--tg-cream)/85">Costa {view.price} punti potenziali: la risposta giusta vale 80 invece di 100. Sbagliata: 0, mai punti in meno.</p>
              </div>
              <Doubloon label={`costa ${view.price} punti`} className="h-[4.4cqw] w-[4.4cqw] text-[1.7cqw]">
                {view.price}
              </Doubloon>
            </div>
          )}
        </div>
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <TvPanel className="grid grid-cols-1 content-start gap-[0.6cqw]">
            {view.suspects.map((s, i) => (
              <TvSuspect key={s.id} option={s} index={i} compact={!!done} state={done ? (s.id === reveal.solutionId ? "right" : "cleared") : "idle"} />
            ))}
          </TvPanel>
          {done && <TvExplain text={reveal.explain} className="py-[0.9cqw]" />}
        </div>
      </div>
    </TvFrame>
  );
}

export const compraUnIndizioUi = defineUi(Player, Tv);
