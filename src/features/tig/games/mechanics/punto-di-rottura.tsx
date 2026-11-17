"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { RotturaLeaf, RotturaReveal, RotturaSubmission, RotturaTop, RotturaView } from "@/lib/tig/games/mechanics/punto-di-rottura";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { canEdit, Explain, Eyebrow, MyOutcome, OptionButton, Panel, PlayerFrame, SubmitBar, TvFrame, TvPanel, useSubmit } from "../kit/ui";

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
          <div key={r.id} className={clsx("rounded-xl border px-3 py-2", over ? "tg-stripes-red border-[#ff3b4e]" : "border-white/12 bg-white/[0.04]")}>
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#9aa4b2]">{r.label}</p>
            <p className={clsx("tg-num text-xl leading-tight", over ? "text-[#ff8c97]" : "text-white")}>
              {v.toLocaleString("it-IT")}
              <span className="text-sm text-white/55"> / {amount(r.limit, r)}</span>
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className={clsx("h-full rounded-full", over ? "bg-[#ff3b4e]" : "bg-[#c6ff3d]")} style={{ width: `${Math.min(100, (v / r.limit) * 100)}%` }} />
            </div>
          </div>
        );
      })}
      <div className="rounded-xl border border-[#ffc24a]/40 bg-[#ffc24a]/10 px-3 py-2">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#ffd68a]">{goal.label}</p>
        <p className="tg-num text-xl leading-tight text-[#ffc24a]">
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
        <span key={r.id} className="tg-num text-sm leading-none text-white/75">
          {node.use[r.id] ? `−${amount(node.use[r.id], r)}` : `0 ${r.unit}`}
        </span>
      ))}
      <span className="tg-num text-sm leading-none text-[#ffc24a]">
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
          <Eyebrow className="text-[#c6ff3d]">Il percorso migliore</Eyebrow>
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
              <p key={n.id} className="text-sm font-bold leading-snug text-white/85">
                {i + 1}. {n.text}
              </p>
            ))}
            <Meters resources={reveal.resources} use={mineTot.use} goal={reveal.goal} gain={mineTot.gain} />
          </Panel>
        )}
        <p className="px-1 text-sm font-bold text-white/65">
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
      <Panel className="py-3">
        <Eyebrow>{view.title}</Eyebrow>
        <p className="mt-1 text-base font-semibold leading-snug text-white/90">{view.intro}</p>
      </Panel>
      <Meters resources={view.resources} use={tot.use} goal={view.goal} gain={tot.gain} />
      <div className="flex flex-wrap items-center gap-2" aria-label="Percorso scelto">
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            type="button"
            disabled={!editable || i > chosen.length}
            onClick={() => setPath((old) => old.slice(0, i))}
            className={clsx("flex min-w-0 max-w-full items-center gap-1 rounded-lg border px-2 py-1 text-sm font-bold", chosen[i] ? "border-[#c6ff3d]/50 bg-[#c6ff3d]/10" : i === step ? "border-white/40" : "border-white/10 text-white/45")}
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
          <Eyebrow className="text-[#ffc24a]">
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

function TvNode({ node, resources, goal, state, small = false, total }: { node: RotturaLeaf; resources: Res[]; goal: RotturaView["goal"]; state: "idle" | "best" | "dim" | "broken"; small?: boolean; total?: { gain: number; ok: boolean } }) {
  return (
    <div
      className={clsx(
        "flex min-w-0 items-center gap-[0.6cqw] rounded-[0.7cqw] border-[0.14cqw] px-[0.7cqw]",
        small ? "py-[0.14cqw]" : "py-[0.45cqw]",
        state === "best" && "tg-shine border-[#c6ff3d] bg-[#c6ff3d] text-[#0b0d12]",
        state === "idle" && "border-white/14 bg-white/[0.05]",
        state === "dim" && "border-white/8 bg-white/[0.03] opacity-60",
        state === "broken" && "tg-stripes-red border-[#ff3b4e]/60 opacity-80",
      )}
    >
      <span className={clsx("min-w-0 flex-1 truncate font-extrabold", small ? "text-[1cqw]" : "text-[1.3cqw]")}>{node.text}</span>
      <span className={clsx("tg-num shrink-0 text-right leading-none", small ? "text-[0.9cqw]" : "text-[1.05cqw]", state === "best" ? "text-[#0b0d12]" : "text-white/70")}>
        {resources.map((r) => `${node.use[r.id] ?? 0}${r.unit === "€" ? "€" : ` ${r.unit}`}`).join(" · ")}
        <span className={clsx("ml-[0.4cqw]", state === "best" ? "" : "text-[#ffc24a]")}>
          +{node.gain}
          {total ? "" : ` ${goal.unit}`}
        </span>
      </span>
      {total && (
        <span className={clsx("tg-num shrink-0 rounded-[0.4cqw] px-[0.4cqw] text-[1.05cqw]", total.ok ? (state === "best" ? "bg-[#0b0d12] text-[#c6ff3d]" : "bg-white/10") : "bg-[#ff3b4e] text-white")}>{total.ok ? `= ${total.gain}` : "rotto"}</span>
      )}
    </div>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const best = done ? reveal.best.path : null;
  const res = view.resources;
  const limits = res.map((r) => `${r.label} ${amount(r.limit, r)}`).join(" · ");
  const st = (ids: string[]): "idle" | "best" | "dim" => (best ? (ids.every((id, i) => best[i] === id) ? "best" : "dim") : "idle");
  return (
    <TvFrame view={view} p={p} subtitle={`${view.title} · limiti: ${limits} · massimo ${view.goal.label.toLowerCase()}`}>
      <div className="grid h-full grid-rows-[minmax(0,1fr)_auto] gap-[1cqw]">
        <TvPanel className="grid min-h-0 grid-cols-[0.9fr_1fr_1.35fr] grid-rows-[auto_repeat(3,minmax(0,1fr))] gap-x-[1cqw] gap-y-[0.4cqw] p-[1cqw]">
          {[0, 1, 2].map((col) => (
            <p key={col} className="text-[1cqw] font-extrabold uppercase tracking-[0.18em] text-[#ffc24a]">
              {col + 1} · {view.steps[col]}
            </p>
          ))}
          {view.tree.map((a) => (
            <div key={a.id} className="col-span-3 grid min-h-0 grid-cols-[0.9fr_1fr_1.35fr] items-center gap-[1cqw] border-t border-white/8 pt-[0.4cqw]">
              <TvNode node={a} resources={res} goal={view.goal} state={st([a.id])} />
              <div className="flex flex-col gap-[0.4cqw]">
                {a.next.map((b) => (
                  <TvNode key={b.id} node={b} resources={res} goal={view.goal} state={st([a.id, b.id])} small />
                ))}
              </div>
              <div className="flex flex-col gap-[0.22cqw]">
                {a.next.flatMap((b) =>
                  b.next.map((c) => {
                    const t = totals([a, b, c], res);
                    const ok = res.every((r) => t.use[r.id] <= r.limit);
                    const s = st([a.id, b.id, c.id]);
                    return <TvNode key={`${b.id}-${c.id}`} node={c} resources={res} goal={view.goal} state={done && !ok ? "broken" : s} small total={done ? { gain: t.gain, ok } : undefined} />;
                  }),
                )}
              </div>
            </div>
          ))}
        </TvPanel>
        {done ? (
          <TvPanel className="tg-rise p-[1cqw]">
            <p className="text-[1.3cqw] font-semibold leading-snug text-white/90">
              <span className="mr-[0.6cqw] text-[1cqw] font-extrabold uppercase tracking-[0.2em] text-[#c6ff3d]">Perché</span>
              {reveal.explain}
            </p>
          </TvPanel>
        ) : (
          <p className="flex items-center justify-center gap-[0.6cqw] text-[1.3cqw] font-bold text-white/75">
            <Icon name="flame" className="h-[1.6cqw] w-[1.6cqw] text-[#ff3b4e]" /> Chi sfora un limite si rompe: 0 punti. Percorso valido +{view.validPoints}, il migliore +{view.optimalPoints}.
          </p>
        )}
      </div>
    </TvFrame>
  );
}

export const puntoDiRotturaUi = defineUi(Player, Tv);
