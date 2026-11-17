"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { DoppioReveal, DoppioSubmission, DoppioView, ProvaKind } from "@/lib/tig/games/mechanics/doppio-gioco";
import type { Option } from "@/lib/tig/games/components/choice";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { BigToggle, ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";
import { RING_MAX, RingTv } from "./m4/kit";

type P = PlayerGameProps<DoppioView, null, DoppioSubmission, DoppioReveal>;
type T = TvGameProps<DoppioView, DoppioReveal>;

const LABEL: Record<ProvaKind, string> = { sicura: "Prova sicura", rischiosa: "Prova rischiosa" };

function score(view: DoppioView, k: ProvaKind): string {
  const p = view.payoff[k];
  return `giusta +${p.giusta} · sbagliata ${p.sbagliata < 0 ? `−${-p.sbagliata}` : p.sbagliata}`;
}

function Player(p: P) {
  const { view, reveal } = p;
  const me = view.seats.find((s) => s.teamId === p.myTeam.teamId);
  const table = new Map(view.seats.map((s) => [s.teamId, s.tableNo]));
  const tells = me?.tellsTo ? table.get(me.tellsTo) : null;
  const hears = me?.hearsFrom ? table.get(me.hearsFrom) : null;
  const [give, setGive] = useState<ProvaKind | null>(null);
  const [ans, setAns] = useState<Record<ProvaKind, string | null>>({ sicura: null, rischiosa: null });
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = !!give && !!ans.sicura && !!ans.rischiosa;
  const submit = () => ready && p.canSubmit && send({ give: give!, sicura: ans.sicura!, rischiosa: ans.rischiosa! });

  if (p.stage === "reveal" && reveal) {
    const links = reveal.summary?.links ?? [];
    const inc = links.find((l) => l.to === p.myTeam.teamId);
    const out = links.find((l) => l.from === p.myTeam.teamId);
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-1.5 text-base font-bold">
          {inc && (
            <p>
              Il tavolo {table.get(inc.from)} vi ha dato la <b className={inc.give === "rischiosa" ? "text-[#ff8c97]" : "text-[#c6ff3d]"}>{LABEL[inc.give].toLowerCase()}</b>.
            </p>
          )}
          {out && (
            <p>
              Al tavolo {table.get(out.to)} avete dato la {LABEL[out.give].toLowerCase()}: {out.ok === null ? "non ha risposto" : out.ok ? "l'ha risolta" : "ha sbagliato"}.
            </p>
          )}
        </Panel>
        {(["sicura", "rischiosa"] as const).map((k) => (
          <Panel key={k} tone={inc?.give === k ? (k === "rischiosa" ? "red" : "lime") : undefined} className="flex flex-col gap-2">
            <Eyebrow>
              {LABEL[k]} · {score(view, k)}
              {inc?.give === k ? " · quella che valeva per voi" : ""}
            </Eyebrow>
            <p className="text-base font-bold leading-snug">{reveal[k].prompt}</p>
            <ChoiceList options={view[k].options} picked={sent && ans[k] ? [ans[k]!] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal[k].solutionId] }} />
            <p className="text-sm font-semibold text-white/80">{reveal[k].why}</p>
          </Panel>
        ))}
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  const block = (k: ProvaKind, n: number, opts: Option[]) => (
    <Panel key={k} className="flex flex-col gap-2">
      <Eyebrow className={k === "rischiosa" ? "text-[#ff8c97]" : "text-[#c6ff3d]"}>
        {n} · {LABEL[k]} · {score(view, k)}
      </Eyebrow>
      <p className="text-base font-bold leading-snug">{view[k].prompt}</p>
      <ChoiceList label={LABEL[k]} options={opts} picked={ans[k] ? [ans[k]!] : []} onToggle={(id) => editable && setAns((a) => ({ ...a, [k]: id }))} disabled={!editable} keys={false} />
    </Panel>
  );

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Sigilla le mosse" hint={!give ? "Scegliete la prova per l'altro tavolo" : !ans.sicura || !ans.rischiosa ? "Rispondete a tutte e due le prove" : undefined} />}
    >
      <Panel tone="red" className="flex flex-col gap-3">
        <Eyebrow className="flex items-center gap-2 text-[#ff8c97]">
          <Icon name="sword" className="h-4 w-4" /> 1 · {tells ? `Quale prova vale per il tavolo ${tells}?` : "Quale prova vale per voi?"}
        </Eyebrow>
        <BigToggle
          label="Prova da assegnare"
          value={give}
          onChange={setGive}
          disabled={!editable}
          options={[
            { id: "sicura", title: "Sicura", sub: `+${view.payoff.scelta.pulito} a voi, comunque vada`, tone: "lime" },
            { id: "rischiosa", title: "Rischiosa", sub: `+${view.payoff.scelta.trappola} a voi se sbagliano`, tone: "red" },
          ]}
        />
      </Panel>
      <p className="px-1 text-sm font-semibold text-white/75">{hears ? `Il tavolo ${hears} ha scelto in segreto quale prova vale per voi: rispondete a tutte e due.` : "Rispondete a tutte e due le prove."}</p>
      {block("sicura", 2, view.sicura.options)}
      {block("rischiosa", 3, view.rischiosa.options)}
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const team = new Map(p.teams.map((x) => [x.teamId, x]));
  const links = new Map((done ? (reveal.summary?.links ?? []) : []).map((l) => [l.from, l]));
  const many = view.seats.length > RING_MAX;
  const card = (k: ProvaKind) => (
    <TvPanel key={k} tone={k === "rischiosa" ? "red" : "lime"} className="flex min-h-0 flex-col gap-[0.6cqw]">
      <div className="flex flex-col gap-[0.3cqw]">
        <span className={clsx("tg-display whitespace-nowrap text-[2.1cqw] leading-none", k === "rischiosa" ? "text-[#ff8c97]" : "text-[#c6ff3d]")}>{LABEL[k]}</span>
        <span className="self-start rounded-[0.4cqw] bg-white/10 px-[0.6cqw] py-[0.15cqw] text-[1.05cqw] font-extrabold uppercase tracking-wide text-white/85">{score(view, k)}</span>
      </div>
      <p className="text-[1.35cqw] font-bold leading-snug">{view[k].prompt}</p>
      <div className="mt-auto grid grid-cols-1 gap-[0.4cqw]">
        {view[k].options.map((o, i) =>
          // al reveal resta solo la risposta giusta (spazio per la spiegazione anche con 12 tavoli in basso)
          done && o.id !== reveal[k].solutionId ? null : <TvOption key={o.id} index={i} text={o.text} size="sm" state={done ? "right" : "idle"} />,
        )}
      </div>
      {done && <p className="text-[1.1cqw] font-semibold leading-snug text-white/85">{reveal[k].why}</p>}
    </TvPanel>
  );
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Chi ha dato quale prova, e com'è andata" : `${view.setTitle} · ogni tavolo sceglie in segreto la prova che vale per il successivo: sicura o rischiosa.`}>
      <div className="flex h-full flex-col gap-[1cqw]">
        <div className={clsx("grid min-h-0 flex-1 gap-[1.2cqw]", many ? "grid-cols-3" : "grid-cols-[1fr_1fr_0.8fr]")}>
          {card("sicura")}
          {card("rischiosa")}
          <TvPanel className="flex min-h-0 flex-col items-center justify-center gap-[0.6cqw] p-[0.8cqw]">
            <div className="min-h-0 w-full flex-1">
              <RingTv
                seats={view.seats}
                colorOf={(id) => team.get(id)?.color}
                arrow={(from) => {
                  const l = links.get(from);
                  if (!l) return null;
                  const col = l.ok === null ? "rgba(238,242,246,0.45)" : l.ok ? "#c6ff3d" : "#ff3b4e";
                  // etichette corte: con 12 tavoli l'elenco ha poco spazio per riga
                  return { color: col, text: l.give === "rischiosa" ? "RISCHIO" : "SICURA", dashed: l.give === "sicura" };
                }}
                label="Chi sceglie la prova per chi"
              />
            </div>
            <p className="text-center text-[1.05cqw] font-bold leading-snug text-white/75">
              Chi sceglie: sicura +{view.payoff.scelta.pulito} · rischiosa +{view.payoff.scelta.trappola} se l&apos;altro sbaglia
            </p>
          </TvPanel>
        </div>
        {done && <TvExplain text={reveal.explain} className="shrink-0 py-[0.8cqw]" />}
      </div>
    </TvFrame>
  );
}

export const doppioGiocoUi = defineUi(Player, Tv);
