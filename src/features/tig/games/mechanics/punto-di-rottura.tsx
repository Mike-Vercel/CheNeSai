"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { RotturaLeaf, RotturaReveal, RotturaSubmission, RotturaTop, RotturaView } from "@/lib/tig/games/mechanics/punto-di-rottura";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { canEdit, Explain, Eyebrow, MyOutcome, OptionButton, Panel, PlayerFrame, SubmitBar, TvFrame, useSubmit } from "../kit/ui";
import { ParchNote, TvWhy } from "./m5-kit";

type P = PlayerGameProps<RotturaView, null, RotturaSubmission, RotturaReveal>;
type T = TvGameProps<RotturaView, RotturaReveal>;
type Res = RotturaView["resources"][number];

/** «25 €», «120 min», «3 giorni». */
const amount = (n: number, r: Res) => `${n.toLocaleString("it-IT")} ${r.unit}`;

/** Nodi scelti lungo il percorso (fino a dove esiste). */
function nodesOf(tree: RotturaTop[], path: readonly string[]): RotturaLeaf[] {
  const a = tree.find((x) => x.id === path[0]);
  if (!a) return [];
  const b = a.next.find((x) => x.id === path[1]);
  if (!b) return [a];
  const c = b.next.find((x) => x.id === path[2]);
  return c ? [a, b, c] : [a, b];
}

function totals(nodes: RotturaLeaf[], resources: Res[]) {
  return {
    use: Object.fromEntries(resources.map((r) => [r.id, nodes.reduce((s, n) => s + (n.use[r.id] ?? 0), 0)])) as Record<string, number>,
    gain: nodes.reduce((s, n) => s + n.gain, 0),
  };
}

/** Barre delle risorse usate rispetto al limite (rosse oltre il limite). */
function Meters({ resources, use, goal, gain }: { resources: Res[]; use: Record<string, number>; goal: RotturaView["goal"]; gain: number }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {resources.map((r) => {
        const v = use[r.id] ?? 0;
        const over = v > r.limit;
        return (
          <div key={r.id} className={clsx("rounded-xl border px-3 py-2", over ? "tg-stripes-red border-(--tg-red-hi)" : "border-(--tg-cream)/12 bg-(--tg-cream)/[0.04]")}>
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-(--tg-mute)">{r.label}</p>
            <p className={clsx("tg-num text-xl leading-tight", over ? "text-(--tg-red-hi)" : "text-(--tg-cream)")}>
              {v.toLocaleString("it-IT")}
              <span className="text-sm text-(--tg-cream)/55"> / {amount(r.limit, r)}</span>
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-(--tg-cream)/10">
              <div className={clsx("h-full rounded-full", over ? "bg-(--tg-red)" : "bg-(--tg-gold)")} style={{ width: `${Math.min(100, (v / r.limit) * 100)}%` }} />
            </div>
          </div>
        );
      })}
      <div className="rounded-xl border border-(--tg-teal)/40 bg-(--tg-teal)/10 px-3 py-2">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-(--tg-teal-pale)">{goal.label}</p>
        <p className="tg-num text-xl leading-tight text-(--tg-teal-hi)">
          {gain} <span className="text-sm">{goal.unit}</span>
        </p>
      </div>
    </div>
  );
}

function Costs({ node, resources, goal }: { node: RotturaLeaf; resources: Res[]; goal: RotturaView["goal"] }) {
  return (
    <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
      {resources.map((r) => (
        <span key={r.id} className="tg-num text-sm leading-none text-(--tg-cream)/75">
          {node.use[r.id] ? `−${amount(node.use[r.id], r)}` : `0 ${r.unit}`}
        </span>
      ))}
      <span className="tg-num text-sm leading-none text-(--tg-teal-hi)">
        +{node.gain} {goal.unit}
      </span>
    </span>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [path, setPath] = useState<string[]>([]);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const chosen = nodesOf(view.tree, path);
  const step = Math.min(chosen.length, 2);
  const options: RotturaLeaf[] = chosen.length === 0 ? view.tree : chosen.length === 1 ? (chosen[0] as RotturaTop).next : (chosen[1] as RotturaTop["next"][number]).next;
  const tot = totals(chosen, view.resources);
  const done = chosen.length === 3;
  const submit = () => done && p.canSubmit && send({ path });
  const pick = (id: string) => {
    if (!editable) return;
    setPath((old) => [...old.slice(0, step), id]);
  };
  useAnswerKeys({ enabled: editable && p.stage === "play", count: options.length, onPick: (i) => pick(options[i].id), onConfirm: done ? submit : null });

  if (p.stage === "reveal" && reveal) {
    const best = nodesOf(reveal.tree, reveal.best.path);
    const mine = sent ? chosen : [];
    const mineTot = totals(mine, reveal.resources);
    const mineOk = mine.length === 3 && reveal.resources.every((r) => mineTot.use[r.id] <= r.limit);
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel tone="lime" className="flex flex-col gap-2">
          <Eyebrow className="text-(--tg-gold)">Il percorso migliore</Eyebrow>
          {best.map((n, i) => (
            <p key={n.id} className="text-base font-extrabold leading-snug">
              {i + 1}. {n.text}
            </p>
          ))}
          <Meters resources={reveal.resources} use={reveal.best.totals} goal={reveal.goal} gain={reveal.best.gain} />
        </Panel>
        {mine.length === 3 && (
          <Panel tone={mineOk ? undefined : "red"} className="flex flex-col gap-2">
            <Eyebrow>Il vostro percorso {mineOk ? "" : "· si è rotto"}</Eyebrow>
            {mine.map((n, i) => (
              <p key={n.id} className="text-sm font-bold leading-snug text-(--tg-cream)/85">
                {i + 1}. {n.text}
              </p>
            ))}
            <Meters resources={reveal.resources} use={mineTot.use} goal={reveal.goal} gain={mineTot.gain} />
          </Panel>
        )}
        <p className="px-1 text-sm font-bold text-(--tg-cream)/65">
          Percorsi validi: {reveal.validCount} su {reveal.totalPaths}.
        </p>
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
          ready={done}
          pending={pending}
          error={error}
          onSubmit={submit}
          label="Conferma il percorso"
          hint={done ? (view.resources.some((r) => tot.use[r.id] > r.limit) ? "Attenzione: così sforate un limite (0 punti)" : `Valido: +${view.validPoints}; se è il migliore +${view.optimalPoints}`) : "Tre scelte: potete tornare indietro finché non confermate"}
        />
      }
    >
      <ParchNote kicker={view.heading}>{view.intro}</ParchNote>
      <Meters resources={view.resources} use={tot.use} goal={view.goal} gain={tot.gain} />
      <div className="flex flex-wrap items-center gap-2" aria-label="Percorso scelto">
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            type="button"
            disabled={!editable || i > chosen.length}
            onClick={() => setPath((old) => old.slice(0, i))}
            className={clsx("flex min-w-0 max-w-full items-center gap-1 rounded-lg border px-2 py-1 text-sm font-bold", chosen[i] ? "border-(--tg-gold)/50 bg-(--tg-gold)/10" : i === step ? "border-(--tg-cream)/40" : "border-(--tg-cream)/10 text-(--tg-cream)/45")}
            aria-label={chosen[i] ? `Cambia la scelta ${i + 1}: ${chosen[i].text}` : `Scelta ${i + 1}`}
          >
            <span className="tg-num">{i + 1}</span>
            <span className="truncate">{chosen[i]?.text ?? "…"}</span>
            {chosen[i] && editable && <Icon name="back" className="h-4 w-4 shrink-0 opacity-60" />}
          </button>
        ))}
      </div>
      {!done && (
        <Panel className="tg-rise flex flex-col gap-2" key={step}>
          <Eyebrow className="text-(--tg-teal-hi)">
            Scelta {step + 1} di 3 · {view.steps[step]}
          </Eyebrow>
          {options.map((o, i) => (
            <OptionButton key={o.id} index={i} text={o.text} state="idle" onClick={() => pick(o.id)} disabled={!editable}>
              <Costs node={o} resources={view.resources} goal={view.goal} />
            </OptionButton>
          ))}
        </Panel>
      )}
    </PlayerFrame>
  );
}

/**
 * Contatore grande della TV. Con `used` mostra «usato / limite» e la barra; senza, solo il limite (o un testo).
 */
function TvMeter({ label, used = null, limit, unit, text, goal = false }: { label: string; used?: number | null; limit?: number; unit?: string; text?: string; goal?: boolean }) {
  const over = limit !== undefined && used !== null && used > limit;
  const big = used ?? limit;
  return (
    <div className={clsx("tg-glass flex flex-col justify-center gap-[0.4cqw] rounded-[1.2cqw] px-[1.2cqw] py-[0.9cqw]", goal && "border-(--tg-teal)/50")}>
      <p className={clsx("text-[1.05cqw] font-extrabold uppercase tracking-[0.2em]", goal ? "text-(--tg-teal-hi)" : "text-(--tg-cream)/65")}>{label}</p>
      {text ? (
        <p className={clsx("text-[1.9cqw] font-extrabold leading-tight", goal ? "text-(--tg-teal-hi)" : "text-(--tg-cream)")}>{text}</p>
      ) : (
        <p className={clsx("tg-num text-[3.2cqw] leading-none", goal ? "text-(--tg-teal-hi)" : over ? "text-(--tg-red-hi)" : "text-(--tg-cream)")}>
          {big?.toLocaleString("it-IT")}
          {used !== null && limit !== undefined && <span className="text-[1.8cqw] text-(--tg-cream)/55"> / {limit.toLocaleString("it-IT")}</span>}
          {unit && <span className="ml-[0.4cqw] text-[1.5cqw] text-(--tg-cream)/60">{unit}</span>}
        </p>
      )}
      {limit !== undefined && used !== null && (
        <div className="h-[0.5cqw] overflow-hidden rounded-full bg-(--tg-cream)/10">
          <div className={clsx("h-full rounded-full", over ? "bg-(--tg-red)" : "bg-(--tg-gold)")} style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

/**
 * Un'opzione grande sulla TV: testo e costi leggibili da lontano. Numero accanto al titolo e costi con il guadagno
 * sulla stessa riga: la casella resta bassa e ci sta anche quando sotto ci sono i 12 tavoli.
 */
function TvChoice({ node, resources, goal, best = false, n }: { node: RotturaLeaf; resources: Res[]; goal: RotturaView["goal"]; best?: boolean; n?: number }) {
  return (
    <div className={clsx("flex min-w-0 flex-1 flex-col gap-[0.7cqw] rounded-[1.2cqw] border-[0.18cqw] p-[1.1cqw]", best ? "tg-shine border-(--tg-gold) bg-(--tg-gold) text-(--tg-ink)" : "border-(--tg-cream)/14 bg-(--tg-cream)/[0.05]")}>
      <p className="flex items-baseline gap-[0.7cqw]">
        {n !== undefined && <span className={clsx("tg-num shrink-0 text-[1.5cqw]", best ? "text-(--tg-ink)/70" : "text-(--tg-gold)")}>{n}</span>}
        <span className="tg-display min-w-0 text-[2.3cqw] leading-[0.95]">{node.text}</span>
      </p>
      <p className="tg-num mt-auto flex flex-wrap items-baseline justify-between gap-x-[1cqw] leading-tight">
        <span className={clsx("text-[1.45cqw]", best ? "text-(--tg-ink)" : "text-(--tg-cream)/80")}>{resources.map((r) => amount(node.use[r.id] ?? 0, r)).join(" · ")}</span>
        <span className={clsx("text-[1.6cqw]", best ? "text-(--tg-ink)" : "text-(--tg-teal-hi)")}>
          +{node.gain} {goal.unit}
        </span>
      </p>
    </div>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const res = view.resources;

  if (done) {
    const best = nodesOf(reveal.tree, reveal.best.path);
    return (
      <TvFrame view={view} p={p} subtitle={`${view.heading} · il percorso migliore possibile`}>
        <div className="grid h-full grid-rows-[minmax(0,1fr)_auto_auto] gap-[1cqw]">
          <div className="flex min-h-0 items-stretch gap-[0.6cqw]">
            {best.map((n, i) => (
              <div key={n.id} className="tg-rise flex min-w-0 flex-1 items-stretch gap-[0.6cqw]" style={{ animationDelay: `${i * 220}ms` }}>
                <div className="flex min-w-0 flex-1 flex-col gap-[0.4cqw]">
                  <p className="text-[1cqw] font-extrabold uppercase tracking-[0.18em] text-(--tg-teal-hi)">
                    {i + 1} · {reveal.steps[i]}
                  </p>
                  <TvChoice node={n} resources={reveal.resources} goal={reveal.goal} best />
                </div>
                {i < best.length - 1 && <Icon name="arrow" className="h-[2.4cqw] w-[2.4cqw] shrink-0 self-center text-(--tg-gold)" />}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-[1cqw]">
            {reveal.resources.map((r) => (
              <TvMeter key={r.id} label={r.label} used={reveal.best.totals[r.id] ?? 0} limit={r.limit} unit={r.unit} />
            ))}
            <TvMeter label={reveal.goal.label} used={reveal.best.gain} unit={reveal.goal.unit} goal />
          </div>
          <TvWhy text={reveal.explain} />
        </div>
      </TvFrame>
    );
  }

  return (
    <TvFrame view={view} p={p} subtitle={`${view.heading} · tre scelte a catena: la prima decide le opzioni dopo`}>
      <div className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-[1cqw]">
        <div className="grid grid-cols-3 gap-[1cqw]">
          {res.map((r) => (
            <TvMeter key={r.id} label={`${r.label} massimo`} limit={r.limit} unit={r.unit} />
          ))}
          <TvMeter label="Obiettivo" text={`Più ${view.goal.label.toLowerCase()} possibile`} goal />
        </div>
        <div className="tg-parch px-[1.4cqw] py-[0.8cqw]">
          <p className="text-[1.4cqw] font-semibold leading-snug">{view.intro}</p>
        </div>
        <div className="flex min-h-0 flex-col gap-[0.6cqw]">
          <p className="text-[1.15cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-teal-hi)">1 · {view.steps[0]}</p>
          <div className="flex min-h-0 flex-1 gap-[1cqw]">
            {view.tree.map((a, i) => (
              <TvChoice key={a.id} node={a} resources={res} goal={view.goal} n={i + 1} />
            ))}
          </div>
        </div>
        <p className="flex items-center justify-center gap-[0.6cqw] text-[1.35cqw] font-bold text-(--tg-cream)/80">
          <Icon name="flame" className="h-[1.7cqw] w-[1.7cqw] shrink-0 text-(--tg-red-hi)" />
          Poi «{view.steps[1]}» e «{view.steps[2]}»: le opzioni cambiano con la prima scelta (sul telefono). Chi sfora si rompe: 0. Valido +{view.validPoints}, il migliore +{view.optimalPoints}.
        </p>
      </div>
    </TvFrame>
  );
}

export const puntoDiRotturaUi = defineUi(Player, Tv);
