"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { PostaReveal, PostaSubmission, PostaView } from "@/lib/tig/games/mechanics/scambio-di-posta";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";
import { appliedTransfers, PhoneChip, Step, TvChip } from "./m2/kit";

type P = PlayerGameProps<PostaView, null, PostaSubmission, PostaReveal>;
type T = TvGameProps<PostaView, PostaReveal>;

function StakePicker({ stakes, value, onChange, disabled }: { stakes: readonly number[]; value: number | null; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Posta proposta">
      {stakes.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          disabled={disabled}
          onClick={() => onChange(s)}
          className={clsx("tg-num flex h-16 flex-col items-center justify-center rounded-xl border-2 text-3xl leading-none transition-transform active:scale-95", value === s ? "tg-picked border-(--tg-teal) text-(--tg-teal-hi)" : "border-(--tg-cream)/12 bg-(--tg-cream)/[0.04] text-(--tg-cream)/85")}
        >
          {s}
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-(--tg-cream)/60">{s === 0 ? "niente" : "punti"}</span>
        </button>
      ))}
    </div>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const group = view.pairs.find((g) => g.some((t) => t.teamId === p.myTeam.teamId)) ?? [];
  const rival = group.find((t) => t.teamId !== p.myTeam.teamId) ?? null;
  const [stake, setStake] = useState<number | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = stake !== null && !!picked;
  const submit = () => ready && p.canSubmit && send({ stake: stake!, optionId: picked! });

  if (p.stage === "reveal" && reveal) {
    const d = reveal.summary?.duels.find((x) => x.a === p.myTeam.teamId || x.b === p.myTeam.teamId);
    const mineFirst = d?.a === p.myTeam.teamId;
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {d && (
          <Panel className="flex flex-col gap-2">
            <Eyebrow>La posta</Eyebrow>
            {d.b === null ? (
              <p className="text-lg font-extrabold leading-snug">Contro il banco, posta {d.stake}: {d.winner ? <span className="text-(--tg-gold)">il banco paga</span> : <span className="text-(--tg-cream)/70">il banco non paga</span>}.</p>
            ) : (
              <>
                <p className="flex flex-wrap items-center gap-2 text-base font-bold text-(--tg-cream)/80">
                  Voi {String((mineFirst ? d.stakeA : d.stakeB) ?? "–")} · tavolo {rival && <PhoneChip tableNo={rival.tableNo} />} {String((mineFirst ? d.stakeB : d.stakeA) ?? "–")}
                </p>
                <p className="text-lg font-extrabold leading-snug">
                  Posta giocata: <span className="tg-num text-2xl text-(--tg-teal-hi)">{d.stake}</span> ·{" "}
                  {d.stake === 0 ? <span className="text-(--tg-cream)/70">nessuno scambio</span> : d.winner === p.myTeam.teamId ? <span className="text-(--tg-gold)">la prendete voi</span> : d.winner ? <span className="text-(--tg-red-hi)">va a loro</span> : <span className="text-(--tg-cream)/70">pareggio</span>}
                </p>
              </>
            )}
          </Panel>
        )}
        <Panel className="flex flex-col gap-2">
          <p className="text-lg font-extrabold leading-snug">{reveal.prompt}</p>
          <ChoiceList options={view.options} picked={sent && picked ? [picked] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.solutionId] }} />
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label={stake === null ? "Invia" : `Posta ${stake} · invia`} hint={stake === null ? "Prima la posta: vale la più bassa delle due" : !picked ? "Poi la risposta: nel duello conta la velocità" : undefined} />}
    >
      <Panel tone="lime" className="flex items-center gap-3">
        <Icon name="handshake" className="h-9 w-9 shrink-0 text-(--tg-gold)" />
        {rival ? (
          <p className="flex flex-wrap items-center gap-2 text-lg font-extrabold leading-snug">
            Abbinati al tavolo <PhoneChip tableNo={rival.tableNo} tone="lime" />: accordatevi a voce!
          </p>
        ) : (
          <p className="text-base font-extrabold leading-snug">Siete in più: giocate contro il banco. Paga la posta se siete giusti entro il tempo mediano del locale.</p>
        )}
      </Panel>
      <Step n={1} title="La posta" icon="coins" done={stake !== null}>
        <StakePicker stakes={view.stakes} value={stake} onChange={setStake} disabled={!editable} />
        <p className="text-sm font-semibold text-(--tg-cream)/70">Si gioca la posta più bassa tra le due proposte. Zero: nessuno scambio. Risposta giusta: +{view.base} comunque.</p>
      </Step>
      <Step n={2} title="La domanda (uguale per tutti)" done={!!picked}>
        <p className="text-lg font-extrabold leading-snug">{view.prompt}</p>
        <ChoiceList options={view.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} />
      </Step>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const duels = done ? (reveal.summary?.duels ?? []) : [];
  const applied = appliedTransfers(p.outcome);
  const many = view.pairs.length > 6;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Si gioca la posta più bassa · giusta batte sbagliata · tra giuste vince la più rapida" : `Coppie: accordatevi sulla posta (max ${Math.max(...view.stakes)}). Giusta +${view.base}, il duello vale la posta.`}>
      <div className="grid h-full grid-cols-[1.25fr_1fr] gap-[1.6cqw]">
        <TvPanel className="flex min-h-0 flex-col gap-[1cqw]">
          <p className="text-[2.3cqw] font-extrabold leading-tight">{view.prompt}</p>
          <div className="grid grid-cols-2 gap-[0.7cqw]">
            {view.options.map((o, i) => (
              <TvOption key={o.id} index={i} text={o.text} state={done ? (o.id === reveal.solutionId ? "right" : "dim") : "idle"} />
            ))}
          </div>
          {done && <TvExplain text={reveal.explain} className="mt-auto" />}
        </TvPanel>
        <TvPanel className="flex min-h-0 flex-col gap-[0.6cqw] overflow-hidden">
          <p className="flex items-center gap-[0.6cqw] text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-teal-hi)">
            <Icon name="handshake" className="h-[1.6cqw] w-[1.6cqw]" /> Coppie e poste
          </p>
          <div className={clsx("grid min-h-0 gap-[0.45cqw]", many ? "grid-cols-2" : "grid-cols-1")}>
            {view.pairs.map((g, i) => {
              const d = duels.find((x) => x.a === g[0].teamId || x.b === g[0].teamId);
              const tr = d?.winner ? applied.find((a) => a.from === d.winner) : undefined;
              return (
                <div key={g[0].teamId} className="tg-rise flex items-center gap-[0.6cqw] rounded-[0.8cqw] bg-(--tg-cream)/[0.05] px-[0.7cqw] py-[0.4cqw]" style={{ animationDelay: `${i * 70}ms` }}>
                  <TvChip teams={p.teams} id={g[0].teamId} size={many ? 2.2 : 2.6} />
                  {g[1] ? (
                    <>
                      <Icon name="swap" className="h-[1.5cqw] w-[1.5cqw] rotate-90 text-(--tg-teal-hi)" />
                      <TvChip teams={p.teams} id={g[1].teamId} size={many ? 2.2 : 2.6} />
                    </>
                  ) : (
                    <span className="text-[1.15cqw] font-extrabold uppercase text-(--tg-cream)/70">contro il banco</span>
                  )}
                  <span className={clsx("ml-auto text-right font-extrabold", many ? "text-[1.05cqw]" : "text-[1.3cqw]")}>
                    {d ? (
                      d.stake === 0 ? (
                        <span className="text-(--tg-cream)/55">posta 0</span>
                      ) : d.winner ? (
                        <span className="text-(--tg-gold)">
                          {d.b === null ? "il banco paga" : `vince il ${p.teams.find((t) => t.teamId === d.winner)?.tableNo}`} · {tr && tr.points !== d.stake ? tr.reason : d.stake}
                        </span>
                      ) : (
                        <span className="text-(--tg-cream)/60">posta {d.stake} · pareggio</span>
                      )
                    ) : (
                      <span className="text-(--tg-cream)/45">posta segreta</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const scambioDiPostaUi = defineUi(Player, Tv);
