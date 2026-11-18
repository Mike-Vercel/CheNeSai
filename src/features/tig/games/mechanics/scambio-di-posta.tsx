"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { PostaReveal, PostaSubmission, PostaView } from "@/lib/tig/games/mechanics/scambio-di-posta";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { Doubloon } from "../kit/ornaments";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";
import { appliedTransfers, PhoneChip, Step, TvChip, tvCompact, TvLabel, tvLongPrompt, tvPromptSize, TvWhy } from "./m2/kit";

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
          className={clsx("tg-num flex h-16 flex-col items-center justify-center rounded-xl border-2 text-3xl leading-none transition-transform active:scale-95", value === s ? "tg-picked border-(--tg-gold) text-(--tg-gold-hi) shadow-[0_0_24px_-10px_rgba(242,177,52,.8)]" : "border-(--tg-cream)/12 bg-(--tg-cream)/[0.04] text-(--tg-cream)/85")}
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
                  Posta giocata: <span className="tg-num text-2xl text-(--tg-gold-hi)">{d.stake}</span> ·{" "}
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
  const compact = tvCompact(p.teams);
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Si gioca la posta più bassa · giusta batte sbagliata · tra giuste vince la più rapida" : `Coppie: accordatevi sulla posta (max ${Math.max(...view.stakes)}). Giusta +${view.base}, il duello vale la posta.`}>
      <div className="grid h-full grid-cols-[1.25fr_1fr] gap-[1.6cqw]">
        <TvPanel className={clsx("flex min-h-0 flex-col", compact ? "gap-[0.7cqw] py-[1.3cqw]" : "gap-[1cqw]")}>
          <TvLabel className="text-(--tg-cream)/75">La domanda · uguale per tutti</TvLabel>
          <p className={clsx("font-extrabold leading-tight", tvPromptSize(view.prompt, compact))}>{view.prompt}</p>
          <div className="grid grid-cols-2 gap-[0.7cqw]">
            {view.options.map((o, i) => (
              <TvOption key={o.id} size={compact || tvLongPrompt(view.prompt) ? "sm" : "md"} index={i} text={o.text} state={done ? (o.id === reveal.solutionId ? "right" : "dim") : "idle"} />
            ))}
          </div>
          {done && <TvWhy text={reveal.explain} compact={compact} className="mt-auto" />}
        </TvPanel>
        <TvPanel className={clsx("flex min-h-0 flex-col overflow-hidden", compact ? "gap-[0.45cqw] py-[1.2cqw]" : "gap-[0.6cqw]")}>
          <TvLabel className="text-(--tg-gold)" icon={<Icon name="handshake" className="h-[1.6cqw] w-[1.6cqw]" />}>
            Coppie e poste
          </TvLabel>
          <div className="grid min-h-0 grid-cols-1 content-start gap-[0.45cqw]">
            {view.pairs.map((g, i) => {
              const d = duels.find((x) => x.a === g[0].teamId || x.b === g[0].teamId);
              const tr = d?.winner ? applied.find((a) => a.from === d.winner) : undefined;
              const winNo = d?.winner ? p.teams.find((t) => t.teamId === d.winner)?.tableNo : null;
              return (
                <div key={g[0].teamId} className={clsx("tg-rise flex items-center gap-[0.6cqw] rounded-[0.8cqw] bg-(--tg-cream)/[0.06] px-[0.7cqw]", compact ? "py-[0.3cqw]" : "py-[0.45cqw]")} style={{ animationDelay: `${i * 70}ms` }}>
                  <TvChip teams={p.teams} id={g[0].teamId} size={compact ? 2.5 : 2.9} />
                  {g[1] ? (
                    <>
                      <Icon name="swap" className="h-[1.5cqw] w-[1.5cqw] shrink-0 rotate-90 text-(--tg-gold)" />
                      <TvChip teams={p.teams} id={g[1].teamId} size={compact ? 2.5 : 2.9} />
                    </>
                  ) : (
                    <span className="text-[1.1cqw] font-extrabold uppercase tracking-wide text-(--tg-cream)/75">contro il banco</span>
                  )}
                  <span className="ml-auto flex items-center gap-[0.5cqw]">
                    {d ? (
                      <>
                        <Doubloon className={clsx(compact ? "h-[2.2cqw] w-[2.2cqw] text-[1cqw]" : "h-[2.6cqw] w-[2.6cqw] text-[1.15cqw]", d.stake === 0 && "opacity-45 grayscale")} label={`Posta ${d.stake}`}>
                          {d.stake}
                        </Doubloon>
                        <span className={clsx("tg-num text-right", compact ? "text-[1.2cqw]" : "text-[1.4cqw]")}>
                          {d.stake === 0 ? (
                            <span className="text-(--tg-cream)/55">nessuno scambio</span>
                          ) : d.winner ? (
                            <span className="text-(--tg-gold-hi)">{d.b === null ? "il banco paga" : tr && tr.points !== d.stake ? tr.reason : `al ${winNo}`}</span>
                          ) : (
                            <span className="text-(--tg-cream)/60">pareggio</span>
                          )}
                        </span>
                      </>
                    ) : (
                      <span className={clsx("tg-num text-(--tg-cream)/55", compact ? "text-[1.15cqw]" : "text-[1.3cqw]")}>posta segreta</span>
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
