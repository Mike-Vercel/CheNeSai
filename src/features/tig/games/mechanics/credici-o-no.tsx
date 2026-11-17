"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { CrediciMemberView, CrediciReveal, CrediciSubmission, CrediciView, PublicCase } from "@/lib/tig/games/mechanics/credici-o-no";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { BigToggle, ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, OptionButton, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";

type P = PlayerGameProps<CrediciView, CrediciMemberView, CrediciSubmission, CrediciReveal>;
type T = TvGameProps<CrediciView, CrediciReveal>;

function CaseBox({ c }: { c: PublicCase }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="tg-display text-2xl">{c.title}</p>
      <ul className="flex flex-col gap-1">
        {c.facts.map((f, i) => (
          <li key={i} className="flex gap-2 text-sm font-semibold leading-snug text-(--tg-cream)/85">
            <span className="text-(--tg-sky)">—</span> {f}
          </li>
        ))}
      </ul>
      <p className="text-lg font-extrabold leading-snug">{c.question}</p>
    </div>
  );
}

function Player(p: P) {
  const { view, reveal, memberView: mv } = p;
  const [tip, setTip] = useState<string | null>(null);
  const [trust, setTrust] = useState<"fido" | "soli" | null>(mv?.hearsFrom ? null : "soli");
  const [answer, setAnswer] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const needTip = !!mv?.tellsTo;
  const ready = (!needTip || !!tip) && !!trust && (trust === "fido" || !!answer);
  const submit = () => {
    if (!ready || !p.canSubmit || !mv) return;
    send({ tip: tip ?? mv.myCase.options[0].id, trust: trust === "fido", answer: trust === "soli" ? (answer ?? undefined) : undefined });
  };

  if (p.stage === "reveal" && reveal) {
    const links = reveal.summary?.links ?? [];
    const out = links.find((l) => l.from === p.myTeam.teamId);
    const inc = links.find((l) => l.to === p.myTeam.teamId);
    const table = new Map(view.links.map((l) => [l.teamId, l.tableNo]));
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-2 text-base font-bold">
          {out && (
            <p>
              Voi al tavolo {table.get(out.to)}: <span className={out.honest ? "text-(--tg-gold)" : "text-(--tg-red-hi)"}>{out.honest ? "verità" : "bluff"}</span> · {out.trusted === null ? "non ha risposto" : out.trusted ? "si è fidato" : "non si è fidato"}
            </p>
          )}
          {inc && (
            <p>
              Il tavolo {table.get(inc.from)} a voi: <span className={inc.honest ? "text-(--tg-gold)" : "text-(--tg-red-hi)"}>{inc.honest === null ? "nessun suggerimento" : inc.honest ? "verità" : "bluff"}</span>
            </p>
          )}
        </Panel>
        {reveal.cases
          .filter((c) => c.id === mv?.myCase.id)
          .map((c) => (
            <Panel key={c.id} className="flex flex-col gap-2">
              <CaseBox c={c} />
              <ChoiceList options={c.options} picked={sent && answer ? [answer] : []} onToggle={() => {}} keys={false} reveal={{ solution: [c.solutionId] }} />
              <p className="text-sm font-semibold text-(--tg-cream)/80">{c.why}</p>
            </Panel>
          ))}
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  if (!mv) {
    return (
      <PlayerFrame view={view} p={p}>
        <Panel>
          <p className="font-bold">Il vostro dossier sta arrivando…</p>
        </Panel>
      </PlayerFrame>
    );
  }

  const truth = mv.tellsTo?.truthId;
  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Sigilla le mosse" hint={needTip && !tip ? "Scegliete cosa suggerire" : !trust ? "Fidarsi o no?" : trust === "soli" && !answer ? "Rispondete al vostro caso" : undefined} />}
    >
      {mv.tellsTo && (
        <Panel tone="red" className="flex flex-col gap-3">
          <Eyebrow className="flex items-center gap-2 text-(--tg-red-hi)">
            <Icon name="eye" className="h-4 w-4" /> 1 · Al tavolo {mv.tellsTo.tableNo}: voi conoscete la soluzione
          </Eyebrow>
          <p className="text-base font-extrabold leading-snug">{mv.tellsTo.case.question}</p>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Suggerimento da mandare">
            {mv.tellsTo.case.options.map((o) => (
              <OptionButton key={o.id} text={o.text} state={tip === o.id ? "picked" : "idle"} disabled={!editable} onClick={() => setTip(o.id)}>
                {o.id === truth && (
                  <span className="tg-display shrink-0 rounded-md bg-(--tg-gold) px-2 py-0.5 text-sm text-(--tg-ink)">La verità</span>
                )}
              </OptionButton>
            ))}
          </div>
          {tip && (
            <p className={clsx("tg-display text-2xl", tip === truth ? "text-(--tg-gold)" : "text-(--tg-red-hi)")}>{tip === truth ? "Mandate la verità" : "State bluffando"}</p>
          )}
        </Panel>
      )}
      {mv.hearsFrom && (
        <Panel className="flex flex-col gap-3">
          <Eyebrow>2 · Il tavolo {mv.hearsFrom.tableNo} vi manda un suggerimento (lo vedrete solo alla fine)</Eyebrow>
          <BigToggle
            label="Fiducia"
            value={trust}
            onChange={setTrust}
            disabled={!editable}
            options={[
              { id: "fido", title: "Ci fidiamo", sub: "Usiamo la loro risposta, qualunque sia", tone: "lime", icon: "handshake" },
              { id: "soli", title: "Da soli", sub: "Risolviamo noi; se bluffano, li smascheriamo", tone: "red", icon: "eye" },
            ]}
          />
        </Panel>
      )}
      <Panel className={clsx("flex flex-col gap-3", trust === "fido" && "opacity-60")}>
        <Eyebrow>{mv.hearsFrom ? "3 · " : ""}Il vostro caso</Eyebrow>
        <CaseBox c={mv.myCase} />
        {trust !== "fido" && <ChoiceList options={mv.myCase.options} picked={answer ? [answer] : []} onToggle={(id) => editable && setAnswer(id)} disabled={!editable} keys={false} />}
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const team = new Map(p.teams.map((x) => [x.teamId, x]));
  const n = view.links.length;
  const result = new Map((done ? (reveal.summary?.links ?? []) : []).map((l) => [l.from, l]));
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Chi ha detto il vero, chi ha bluffato, chi si è fidato" : "Ogni tavolo suggerisce al successivo: verità o bluff. E decide se fidarsi del precedente."}>
      <div className="grid h-full grid-cols-[1fr_1fr] gap-[1.6cqw]">
        <TvPanel className="relative flex items-center justify-center">
          <svg viewBox="0 0 400 400" className="h-full max-h-[34cqw] w-full" aria-label="Giro dei suggerimenti">
            {view.links.map((l, i) => {
              const a = (i / n) * Math.PI * 2 - Math.PI / 2;
              const b = (((i + 1) % n) / n) * Math.PI * 2 - Math.PI / 2;
              const r = 150;
              const [x1, y1, x2, y2] = [200 + r * Math.cos(a), 200 + r * Math.sin(a), 200 + r * Math.cos(b), 200 + r * Math.sin(b)];
              const res = result.get(l.teamId);
              const col = !res ? "color-mix(in srgb, var(--tg-cream) 35%, transparent)" : res.honest ? "var(--tg-gold)" : "var(--tg-red-hi)";
              if (n < 2) return null;
              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2;
              const len = Math.hypot(mx - 200, my - 200) || 1;
              const push = n === 2 ? (i === 0 ? -34 : 34) : 44;
              const lx = n === 2 ? 200 : mx + ((mx - 200) / len) * push;
              const ly = n === 2 ? 200 + push : my + ((my - 200) / len) * push;
              return (
                <g key={l.teamId}>
                  <line x1={x1 + (x2 - x1) * 0.18} y1={y1 + (y2 - y1) * 0.18} x2={x1 + (x2 - x1) * 0.8} y2={y1 + (y2 - y1) * 0.8} stroke={col} strokeWidth={5} strokeDasharray={res && !res.honest ? "10 7" : undefined} markerEnd="url(#tg-arrow)" />
                  {res && (
                    <text x={lx} y={ly} fill={col} fontSize={15} fontWeight={800} textAnchor="middle" style={{ fontFamily: "var(--tg-display)" }}>
                      {res.honest ? "VERO" : "BLUFF"}
                      {res.trusted ? " · FIDUCIA" : res.trusted === false ? " · SOSPETTO" : ""}
                    </text>
                  )}
                </g>
              );
            })}
            <defs>
              <marker id="tg-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="var(--tg-cream)" />
              </marker>
            </defs>
            {view.links.map((l, i) => {
              const a = (i / n) * Math.PI * 2 - Math.PI / 2;
              const x = 200 + 150 * Math.cos(a);
              const y = 200 + 150 * Math.sin(a);
              return (
                <g key={`c-${l.teamId}`}>
                  <circle cx={x} cy={y} r={26} fill={team.get(l.teamId)?.color ?? "var(--tg-cream)"} stroke="var(--tg-ink)" strokeWidth={4} />
                  <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fontSize={26} fontWeight={900} fill="var(--tg-ink)" style={{ fontFamily: "var(--tg-display)" }}>
                    {l.tableNo}
                  </text>
                </g>
              );
            })}
          </svg>
        </TvPanel>
        <div className="flex min-h-0 flex-col gap-[1.2cqw]">
          <TvPanel className="grid grid-cols-2 gap-[0.8cqw] text-[1.35cqw] font-bold leading-snug">
            <p className="col-span-2 text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-gold)">Punti per ogni coppia</p>
            <p>
              <b className="text-(--tg-gold)">Vero + fiducia</b>: chi riceve +{view.payoff.alleanza.receiver}, chi suggerisce +{view.payoff.alleanza.teller}
            </p>
            <p>
              <b className="text-(--tg-red-hi)">Bluff + fiducia</b>: chi suggerisce +{view.payoff.bluffRiuscito.teller}
            </p>
            <p>
              <b className="text-(--tg-gold)">Vero + sospetto</b>: chi suggerisce +{view.payoff.onesti.teller}; chi riceve +{view.payoff.daSoli.receiver} se risolve
            </p>
            <p>
              <b className="text-(--tg-red-hi)">Bluff + sospetto</b>: chi riceve +{view.payoff.smascherato.receiver} (+{view.payoff.daSoli.receiver} se risolve)
            </p>
            <p className="col-span-2 text-(--tg-cream)/60">Tetto: {view.cap} a tavolo. Bugie solo sui casi inventati.</p>
          </TvPanel>
          {done && <TvExplain text={reveal.explain} />}
        </div>
      </div>
    </TvFrame>
  );
}

export const crediciONoUi = defineUi(Player, Tv);
