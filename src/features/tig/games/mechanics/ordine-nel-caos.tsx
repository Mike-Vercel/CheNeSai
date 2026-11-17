"use client";

import { useState } from "react";
import type { OrdineReveal, OrdineSubmission, OrdineView } from "@/lib/tig/games/mechanics/ordine-nel-caos";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ReorderList } from "../kit/inputs";
import { canEdit, Explain, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";

type P = PlayerGameProps<OrdineView, null, OrdineSubmission, OrdineReveal>;
type T = TvGameProps<OrdineView, OrdineReveal>;

function Player(p: P) {
  const { view, reveal } = p;
  const [order, setOrder] = useState<string[]>(() => view.items.map((i) => i.id));
  const [touched, setTouched] = useState(false);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {sent && (
          <Panel className="flex flex-col gap-2">
            <p className="tg-display text-2xl">Il vostro ordine</p>
            <ReorderList items={view.items} order={order} onChange={() => {}} disabled reveal={reveal.items.map((i) => i.id)} />
          </Panel>
        )}
        <Panel tone="lime" className="flex flex-col gap-2">
          <p className="tg-display text-2xl text-(--tg-gold)">Ordine giusto</p>
          <ol className="flex flex-col gap-1.5">
            {reveal.items.map((it, i) => (
              <li key={it.id} className="flex gap-2 text-base font-bold">
                <span className="tg-num text-xl text-(--tg-gold)">{i + 1}</span> {it.text}
              </li>
            ))}
          </ol>
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
          canSubmit={p.canSubmit}
          submitted={p.submitted}
          stage={p.stage}
          ready
          pending={pending}
          error={error}
          onSubmit={() => send({ order })}
          label="Invia l'ordine"
          hint={touched ? undefined : "Usate le frecce per spostare: in cima il primo momento"}
        />
      }
    >
      <Panel className="py-3">
        <p className="tg-display text-3xl">{view.prompt}</p>
      </Panel>
      <ReorderList
        items={view.items}
        order={order}
        disabled={!editable}
        onChange={(o) => {
          setOrder(o);
          setTouched(true);
        }}
      />
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const list = done ? reveal.items : view.items;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "L'unico ordine possibile" : view.prompt}>
      <div className="flex h-full flex-col gap-[1.4cqw]">
        <div className="grid flex-1 grid-cols-4 items-center gap-[1.2cqw]">
          {list.map((it, i) => (
            <TvPanel key={`${done ? "r" : "v"}-${it.id}`} tone={done ? "lime" : undefined} className="tg-rise relative flex flex-col gap-[1cqw] overflow-visible!">
              <span className={`tg-num grid h-[4cqw] w-[4cqw] place-items-center rounded-[0.8cqw] text-[2.4cqw] ${done ? "bg-(--tg-gold) text-(--tg-ink)" : "bg-(--tg-cream)/10 text-(--tg-cream)/60"}`} style={{ animationDelay: `${i * 140}ms` }}>
                {done ? i + 1 : String.fromCharCode(65 + i)}
              </span>
              <p className="text-[1.9cqw] font-extrabold leading-snug">{it.text}</p>
              {done && i < list.length - 1 && <Icon name="arrow" className="absolute -right-[1.3cqw] top-1/2 z-10 h-[2.4cqw] w-[2.4cqw] -translate-y-1/2 text-(--tg-gold)" />}
            </TvPanel>
          ))}
        </div>
        {done && <TvExplain text={reveal.explain} />}
      </div>
    </TvFrame>
  );
}

export const ordineNelCaosUi = defineUi(Player, Tv);
