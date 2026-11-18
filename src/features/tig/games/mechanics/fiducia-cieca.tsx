"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { FiduciaReveal, FiduciaSubmission, FiduciaView } from "@/lib/tig/games/mechanics/fiducia-cieca";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { PactToggle, RingTv } from "./m4/kit";

type P = PlayerGameProps<FiduciaView, null, FiduciaSubmission, FiduciaReveal>;
type T = TvGameProps<FiduciaView, FiduciaReveal>;

function Statements({ items, tv = false, lies }: { items: { by: string; text: string }[]; tv?: boolean; lies?: boolean[] }) {
  return (
    <ul className={clsx("flex flex-col", tv ? "gap-[0.6cqw]" : "gap-2")}>
      {items.map((s, i) => {
        const lie = lies?.[i];
        return (
          <li
            key={i}
            className={clsx(
              "flex items-baseline border-2",
              tv ? "gap-[0.9cqw] rounded-[0.9cqw] px-[1cqw] py-[0.6cqw]" : "gap-3 rounded-xl px-3 py-2",
              lie === undefined ? "border-(--tg-cream)/10 bg-(--tg-cream)/[0.04]" : lie ? "tg-stripes-red border-(--tg-red-hi)" : "border-(--tg-gold)/50 bg-(--tg-gold-dark)/45",
            )}
          >
            <span className={clsx("tg-display shrink-0", tv ? "w-[7cqw] text-[1.9cqw]" : "w-20 text-xl")}>{s.by}</span>
            <span className={clsx("min-w-0 flex-1 font-semibold leading-snug", tv ? "text-[1.5cqw]" : "text-base")}>«{s.text}»</span>
            {lie !== undefined && <span className={clsx("tg-display shrink-0", lie ? "text-(--tg-red-hi)" : "text-(--tg-gold)", tv ? "text-[1.4cqw]" : "text-base")}>{lie ? "Mente" : "Vero"}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const me = view.seats.find((s) => s.teamId === p.myTeam.teamId);
  const table = new Map(view.seats.map((s) => [s.teamId, s.tableNo]));
  const hears = me?.hearsFrom ? table.get(me.hearsFrom) : null;
  const tells = me?.tellsTo ? table.get(me.tellsTo) : null;
  const [mode, setMode] = useState<"fido" | "soli" | null>(hears ? null : "soli");
  const [answer, setAnswer] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = mode === "fido" || (mode === "soli" && !!answer);
  const submit = () => ready && p.canSubmit && send(mode === "fido" ? { trust: true } : { trust: false, answer: answer ?? undefined });
  const name = new Map(view.people.map((o) => [o.id, o.text]));

  if (p.stage === "reveal" && reveal) {
    const links = new Map((reveal.summary?.links ?? []).map((l) => [l.teamId, l]));
    const mine = links.get(p.myTeam.teamId);
    const next = me?.tellsTo ? links.get(me.tellsTo) : undefined;
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-1.5 text-base font-bold">
          {mine?.trusted ? (
            <p>
              Vi siete fidati del tavolo {hears}: è arrivato <b className={mine.correct ? "text-(--tg-gold)" : "text-(--tg-red-hi)"}>{mine.finalId ? name.get(mine.finalId) : "nessuna risposta"}</b>
              {mine.sourceId && mine.sourceId !== me?.hearsFrom ? ` (risolto dal tavolo ${table.get(mine.sourceId)})` : ""}.
            </p>
          ) : mine ? (
            <p>Avete risolto da soli.</p>
          ) : null}
          {tells && <p>Il tavolo {tells} {next?.trusted ? "si è fidato di voi" : next ? "non si è fidato" : "non ha risposto"}.</p>}
        </Panel>
        <Statements items={reveal.statements} lies={reveal.statements.map((s) => s.lie)} />
        <ChoiceList options={view.people} picked={sent && answer && mode === "soli" ? [answer] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.solutionId] }} />
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label={mode === "fido" ? "Ci fidiamo" : "Questa è la risposta"} hint={!mode ? "Fidarsi o risolvere da soli?" : mode === "soli" && !answer ? "Scegliete il colpevole" : undefined} />}
    >
      <Panel className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Eyebrow>{view.puzzleTitle}</Eyebrow>
            <p className="mt-1 text-base font-extrabold leading-snug">{view.act}</p>
          </div>
          <span className="tg-display shrink-0 rounded-lg bg-(--tg-red) px-2 py-1 text-lg">
            {view.liars === 1 ? "1 mente" : `${view.liars} mentono`}
          </span>
        </div>
        <Statements items={view.statements} />
      </Panel>
      {hears ? (
        <Panel className="flex flex-col gap-3">
          <Eyebrow className="flex items-center gap-2">
            <Icon name="handshake" className="h-4 w-4" /> Il tavolo {hears} vi passa la sua risposta, ma non la vedrete
          </Eyebrow>
          <PactToggle
            label="Fiducia"
            value={mode}
            onChange={setMode}
            disabled={!editable}
            options={[
              { id: "fido", title: "Ci fidiamo", sub: `Giusta: +${view.payoff.fiducia}`, tone: "gold", icon: "handshake" },
              { id: "soli", title: "Da soli", sub: `Giusta: +${view.payoff.soli}`, tone: "cream", icon: "eye" },
            ]}
          />
        </Panel>
      ) : null}
      {mode === "soli" && <ChoiceList label="Il colpevole" options={view.people} picked={answer ? [answer] : []} onToggle={(id) => editable && setAnswer(id)} disabled={!editable} onConfirm={submit} />}
      {tells && (
        <p className="px-1 text-sm font-semibold text-(--tg-cream)/75">
          {mode === "fido"
            ? `Fidandovi, al tavolo ${tells} passate la risposta che arriva a voi.`
            : `La vostra risposta andrà al tavolo ${tells}: se si fida ed è giusta, +${view.payoff.suggerito} anche a voi.`}
        </p>
      )}
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const team = new Map(p.teams.map((x) => [x.teamId, x]));
  const links = new Map((done ? (reveal.summary?.links ?? []) : []).map((l) => [l.teamId, l]));
  const tellsTo = new Map(view.seats.map((s) => [s.teamId, s.tellsTo]));
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Chi si è fidato, e di chi" : "Ogni risposta diventa il suggerimento per il tavolo dopo: fidarsi al buio o risolvere da soli?"}>
      <div className="grid h-full grid-cols-[1.25fr_1fr] gap-[1.6cqw]">
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <TvPanel className="flex flex-col gap-[0.8cqw]">
            <div className="flex items-start justify-between gap-[1cqw]">
              <div>
                <p className="tg-display text-[2.3cqw]">{view.puzzleTitle}</p>
                <p className="text-[1.45cqw] font-bold leading-snug text-(--tg-cream)/85">{view.act}</p>
              </div>
              <span className="tg-display shrink-0 rounded-[0.6cqw] bg-(--tg-red) px-[0.8cqw] py-[0.3cqw] text-[1.6cqw]">{view.liars === 1 ? "1 mente" : `${view.liars} mentono`}</span>
            </div>
            <Statements items={done ? reveal.statements : view.statements} lies={done ? reveal.statements.map((s) => s.lie) : undefined} tv />
            {done && (
              <p className="tg-display text-[2.2cqw] text-(--tg-gold)">
                Colpevole: {reveal.people.find((o) => o.id === reveal.solutionId)?.text}
              </p>
            )}
          </TvPanel>
        </div>
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <TvPanel className="flex min-h-0 flex-1 items-center justify-center p-[1cqw]">
            <RingTv
              seats={view.seats}
              colorOf={(id) => team.get(id)?.color}
              arrow={(from) => {
                const to = tellsTo.get(from);
                const l = to ? links.get(to) : undefined;
                if (!l) return null;
                if (!l.trusted) return { color: "color-mix(in srgb, var(--tg-cream) 62%, transparent)", text: "DA SOLI", dashed: true };
                return { color: l.correct ? "var(--tg-gold)" : "var(--tg-red-hi)", text: l.correct ? "FIDUCIA OK" : "FIDUCIA KO" };
              }}
              label="Giro dei suggerimenti: ogni tavolo passa la risposta al successivo"
            />
          </TvPanel>
          {done ? (
            <TvExplain text={reveal.explain} className="shrink-0 py-[0.9cqw]" />
          ) : (
          <TvPanel className="grid shrink-0 grid-cols-3 gap-[0.6cqw] py-[0.9cqw] text-center">
            <div>
              <p className="tg-num text-[2.6cqw] leading-none text-(--tg-cream)">{view.payoff.soli}</p>
              <p className="text-[1cqw] font-extrabold uppercase tracking-wide text-(--tg-cream)/70">da soli, giusta</p>
            </div>
            <div>
              <p className="tg-num text-[2.6cqw] leading-none text-(--tg-gold)">{view.payoff.fiducia}</p>
              <p className="text-[1cqw] font-extrabold uppercase tracking-wide text-(--tg-cream)/70">fiducia, giusta</p>
            </div>
            <div>
              <p className="tg-num text-[2.6cqw] leading-none text-(--tg-gold)">+{view.payoff.suggerito}</p>
              <p className="text-[1cqw] font-extrabold uppercase tracking-wide text-(--tg-cream)/70">{"a chi l'ha suggerita"}</p>
            </div>
          </TvPanel>
          )}
        </div>
      </div>
    </TvFrame>
  );
}

export const fiduciaCiecaUi = defineUi(Player, Tv);
