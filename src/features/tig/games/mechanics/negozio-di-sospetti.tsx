"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { NegozioMemberView, NegozioReveal, NegozioSubmission, NegozioView } from "@/lib/tig/games/mechanics/negozio-di-sospetti";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { Doubloon } from "../kit/ornaments";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { SealedOffer, splitProfile, SuspectButton, TableTag, TvSuspect, useCrossed, usePurchases, type SuspectState } from "./m4/kit";

type P = PlayerGameProps<NegozioView, NegozioMemberView, NegozioSubmission, NegozioReveal>;
type T = TvGameProps<NegozioView, NegozioReveal>;

function Player(p: P) {
  const { view, reveal, memberView: mv } = p;
  const [picked, setPicked] = useState<string | null>(null);
  const { crossed, toggle } = useCrossed();
  const { items, buy } = usePurchases(`tig-m4-negozio:${view.instance}:${p.myTeam.teamId}`);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const spent = view.shop.filter((s) => items.includes(s.id)).reduce((t, s) => t + s.price, 0);
  const worth = Math.max(0, view.prize - spent);
  const submit = () => picked && p.canSubmit && send({ optionId: picked, bought: view.shop.filter((s) => items.includes(s.id)).map((s) => s.id) });
  useAnswerKeys({ enabled: editable, count: view.suspects.length, onPick: (i) => setPicked(view.suspects[i].id), onConfirm: submit });
  const proofText = (id: string) => mv?.proofs?.find((x) => x.id === id)?.text ?? null;

  if (p.stage === "reveal" && reveal) {
    const name = new Map(reveal.suspects.map((s) => [s.id, splitProfile(s.text)[0]]));
    const cheap = reveal.cheapest.ids.map((id) => reveal.proofs.find((x) => x.id === id)?.name).join(" + ");
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-2">
          <Eyebrow>Le tre prove</Eyebrow>
          {reveal.proofs.map((x) => (
            <div key={x.id} className={clsx("rounded-xl border-2 px-3 py-2", reveal.cheapest.ids.includes(x.id) ? "border-(--tg-teal)" : "border-(--tg-cream)/12")}>
              <p className="flex justify-between gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-(--tg-teal-hi)">
                <span>{x.name}</span>
                <span className="tg-num text-base">{x.price}</span>
              </p>
              <p className="font-bold leading-snug">{x.text}</p>
              <p className="text-xs font-extrabold uppercase text-(--tg-cream)/50">Scagiona: {x.clears.map((id) => name.get(id)).join(", ")}</p>
            </div>
          ))}
          <p className="text-sm font-bold text-(--tg-cream)/80">
            Spesa minima per essere sicuri: <b className="text-(--tg-teal-hi)">{reveal.cheapest.cost} punti</b> ({cheap}).
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
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!picked} pending={pending} error={error} onSubmit={submit} label={`Rispondi per ${worth}`} hint={spent ? `Avete speso ${spent}: la giusta vale ${worth}` : "Senza acquisti la giusta vale 100"} />}
    >
      <Panel className="flex flex-col gap-1.5">
        <Eyebrow>{view.caseTitle}</Eyebrow>
        <p className="text-lg font-extrabold leading-snug">{view.question}</p>
        <p className="text-sm font-semibold leading-snug text-(--tg-cream)/80">{view.intro}</p>
      </Panel>
      <section className="flex flex-col gap-2" aria-label="Il negozio delle prove">
        <p className="flex items-center justify-between px-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-(--tg-teal-hi)">
          <span className="flex items-center gap-1.5">
            <Icon name="coins" className="h-4 w-4" /> Il negozio
          </span>
          <span>
            Spesa <span className="tg-num text-lg">{spent}</span>
          </span>
        </p>
        {view.shop.map((s) => (
          <SealedOffer
            key={s.id}
            title={s.name}
            price={s.price}
            bought={items.includes(s.id)}
            canBuy={!!mv?.buyer && editable && !!proofText(s.id)}
            onBuy={() => buy(s.id)}
            lockedNote={mv?.buyer ? "Prova chiusa." : "Compra solo il telefono del capitano: fatevi leggere le prove comprate."}
          >
            {proofText(s.id)}
          </SealedOffer>
        ))}
      </section>
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
  const proofs = done ? reveal.proofs : null;
  const spent = done ? (reveal.summary?.spent ?? []) : [];
  const many = p.teams.length > 7;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Le prove, e quanto bastava spendere" : view.question}>
      <div className="grid h-full grid-cols-[1.15fr_1fr] gap-[1.6cqw]">
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <TvPanel className={clsx("shrink-0", done ? "py-[0.7cqw]" : "py-[1cqw]")}>
            <p className={clsx("tg-display", done ? "text-[1.8cqw]" : "text-[2.1cqw]")}>{view.caseTitle}</p>
            {!done && <p className="mt-[0.3cqw] text-[1.35cqw] font-semibold leading-snug text-(--tg-cream)/85">{view.intro}</p>}
          </TvPanel>
          <div className="flex min-h-0 flex-col gap-[0.7cqw]">
            {view.shop.map((s, i) => {
              const r = proofs?.find((x) => x.id === s.id);
              const best = done && reveal.cheapest.ids.includes(s.id);
              return (
                <div
                  key={s.id}
                  className={clsx(
                    "tg-rise flex shrink-0 items-center gap-[1cqw] rounded-[1cqw] border-[0.18cqw] px-[1.2cqw]",
                    r ? "py-[0.5cqw]" : "py-[0.7cqw]",
                    r ? (best ? "border-(--tg-teal) bg-(--tg-teal)/12" : "border-(--tg-cream)/14 bg-(--tg-cream)/[0.04]") : "border-dashed border-(--tg-teal)/60 bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--tg-teal)_7%,transparent)_0_1cqw,transparent_1cqw_2cqw)]",
                  )}
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  {/* il prezzo è un doblone */}
                  <Doubloon label={`costa ${s.price} punti`} className={r ? "h-[3.6cqw] w-[3.6cqw] text-[1.5cqw]" : "h-[4.6cqw] w-[4.6cqw] text-[1.9cqw]"}>
                    {s.price}
                  </Doubloon>
                  <div className="min-w-0 flex-1">
                    <p className={clsx("tg-display text-(--tg-teal-hi)", r ? "text-[1.5cqw]" : "text-[1.7cqw]")}>{s.name}</p>
                    {r ? <p className="text-[1.2cqw] font-bold leading-snug">{r.text}</p> : <p className="flex items-center gap-[0.4cqw] text-[1.15cqw] font-bold text-(--tg-cream)/60"><Icon name="lock" className="h-[1.2cqw] w-[1.2cqw]" /> sigillata · costa {s.price} punti potenziali</p>}
                  </div>
                </div>
              );
            })}
          </div>
          {done ? (
            <TvPanel className="flex shrink-0 flex-col gap-[0.5cqw] py-[0.8cqw] text-[1.3cqw] font-bold">
              <p className="text-(--tg-teal-hi)">
                Spesa minima per essere sicuri: <span className="tg-num text-[1.6cqw]">{reveal.cheapest.cost}</span>
              </p>
              {spent.length > 0 && spent.length <= 6 ? (
                <p className="flex flex-wrap items-center gap-x-[1cqw] gap-y-[0.4cqw]">
                  <span className="text-(--tg-cream)/65">Spesa dei tavoli:</span>
                  {spent.map((x) => (
                    <span key={x.teamId} className="flex items-center gap-[0.4cqw]">
                      <TableTag tv no={team.get(x.teamId)?.tableNo ?? "?"} color={team.get(x.teamId)?.color} />
                      <span className="tg-num text-[1.5cqw]">{x.cost}</span>
                    </span>
                  ))}
                </p>
              ) : spent.length > 6 ? (
                <p className="text-(--tg-cream)/80">Spesa media dei tavoli: {Math.round(spent.reduce((t, x) => t + x.cost, 0) / spent.length)}</p>
              ) : null}
            </TvPanel>
          ) : (
            <p className="text-center text-[1.2cqw] font-bold text-(--tg-cream)/70">Giusta: 100 meno la spesa · sbagliata: 0 · mai in negativo</p>
          )}
        </div>
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          {/* al reveal con molti tavoli (striscia su due righe) i sospettati scagionati stanno su due colonne: spazio al «perché» */}
          <TvPanel className={clsx("grid shrink-0 content-start", done && many ? "grid-cols-2 gap-[0.5cqw] p-[1.2cqw]" : "grid-cols-1 gap-[0.6cqw]")}>
            {view.suspects.map((s, i) => {
              const right = done && s.id === reveal.solutionId;
              return <TvSuspect key={s.id} option={s} index={i} compact={!!done} state={done ? (right ? "right" : "cleared") : "idle"} className={right && many ? "order-first col-span-2" : undefined} />;
            })}
          </TvPanel>
          {done && <TvExplain text={reveal.explain} className="py-[0.9cqw]" />}
        </div>
      </div>
    </TvFrame>
  );
}

export const negozioDiSospettiUi = defineUi(Player, Tv);
