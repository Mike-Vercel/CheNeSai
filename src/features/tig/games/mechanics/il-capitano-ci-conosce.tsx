"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { CapitanoMemberView, CapitanoReveal, CapitanoSubmission, CapitanoView } from "@/lib/tig/games/mechanics/il-capitano-ci-conosce";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";
import { PromptCard, TableChip, teamMap, TvWaiting } from "./_m3-kit";

type P = PlayerGameProps<CapitanoView, CapitanoMemberView, CapitanoSubmission, CapitanoReveal>;
type T = TvGameProps<CapitanoView, CapitanoReveal>;

function Player(p: P) {
  const { view, reveal, memberView } = p;
  const captain = memberView?.role === "capitano";
  const options = memberView?.options ?? view.options;
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const submit = () => picked && p.canSubmit && send(captain ? { guess: picked } : { optionId: picked });
  const textOf = (id: string) => view.options.find((o) => o.id === id)?.text ?? id;

  if (p.stage === "reveal" && reveal) {
    const mine = reveal.summary?.teams.find((x) => x.teamId === p.myTeam.teamId);
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {mine && (
          <Panel className="flex flex-col gap-3">
            <div>
              <Eyebrow className="flex items-center gap-1.5">
                <Icon name="crown" className="h-4 w-4 text-[#ffc24a]" /> Il capitano aveva detto
              </Eyebrow>
              <p className="text-xl font-extrabold">{mine.guess ? textOf(mine.guess) : "Nessuna previsione"}</p>
            </div>
            <div>
              <Eyebrow className="flex items-center gap-1.5">
                <Icon name="users" className="h-4 w-4 text-[#c6ff3d]" /> Il tavolo ha scelto
              </Eyebrow>
              <p className="text-xl font-extrabold">{mine.top.length ? mine.top.map(textOf).join(" / ") : "Nessun voto"}</p>
              {mine.top.length > 1 && <p className="text-sm font-bold text-[#ffc24a]">Parità: vale la regola dei 60 punti</p>}
            </div>
            {mine.guess && mine.voters > 0 && (
              <p className="text-base font-bold text-white/80">
                <span className="tg-num text-3xl text-[#c6ff3d]">{Math.round(mine.share * 100)}%</span> dei compagni ha scelto come il capitano ({mine.voters} {mine.voters === 1 ? "voto" : "voti"})
              </p>
            )}
          </Panel>
        )}
        <Explain text={reveal.explain} title="Il tavolo" />
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
          ready={!!picked}
          pending={pending}
          error={error}
          onSubmit={submit}
          label={captain ? "Blocca la previsione" : "Invia il mio voto"}
          hint={captain ? "Indovini la risposta più votata dai compagni (tu non voti)" : "Segreto: niente suggerimenti al capitano. L'ordine cambia su ogni telefono."}
        />
      }
    >
      {captain ? (
        <Panel tone="lime" className="flex items-center gap-3">
          <Icon name="crown" className="h-9 w-9 shrink-0 text-[#ffc24a]" />
          <p className="text-base font-extrabold leading-snug">Sei il capitano: indovina cosa sceglierà la maggioranza dei tuoi compagni{memberView && memberView.voters > 0 ? ` (${memberView.voters} ${memberView.voters === 1 ? "voto" : "voti"})` : ""}.</p>
        </Panel>
      ) : (
        <Panel className="flex items-center gap-3">
          <Icon name="eye" className="h-8 w-8 shrink-0 text-[#c6ff3d]" />
          <p className="text-base font-extrabold leading-snug">Voto segreto: rispondi per te. Il capitano deve indovinare la scelta più votata.</p>
        </Panel>
      )}
      <PromptCard>{view.prompt}</PromptCard>
      <ChoiceList options={options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} big label={captain ? "La tua previsione" : "Il tuo voto"} />
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const teams = teamMap(p.teams);
  const textOf = (id: string) => view.options.find((o) => o.id === id)?.text ?? id;
  const rows = done ? (reveal.summary?.teams ?? []).slice().sort((a, b) => b.points - a.points || (teams.get(a.teamId)?.tableNo ?? 0) - (teams.get(b.teamId)?.tableNo ?? 0)) : [];
  const many = rows.length > 8;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Il capitano conosce il suo tavolo? Ecco tavolo per tavolo" : "Il capitano prevede, i compagni votano in segreto. Vietato suggerire!"}>
      <div className="grid h-full grid-cols-[1fr_1.25fr] gap-[1.6cqw]">
        <TvPanel className="flex flex-col gap-[0.8cqw]">
          <p className="text-[2.4cqw] font-extrabold leading-tight">{view.prompt}</p>
          {view.options.map((o, i) => (
            <TvOption key={o.id} index={i} text={o.text} size={view.options.length > 3 ? "sm" : "md"} />
          ))}
        </TvPanel>
        {done ? (
          <div className="flex min-h-0 flex-col gap-[1cqw]">
            <TvPanel className={clsx("grid min-h-0 content-start gap-x-[1.2cqw] gap-y-[0.5cqw] overflow-hidden", many ? "grid-cols-2" : "grid-cols-1")}>
              {rows.map((r, i) => {
                const t = teams.get(r.teamId);
                const ok = r.points >= 100;
                const tie = r.points === 60;
                return (
                  <div key={r.teamId} className="tg-rise flex items-center gap-[0.7cqw]" style={{ animationDelay: `${i * 70}ms` }}>
                    <TableChip tableNo={t?.tableNo ?? "?"} color={t?.color} tv />
                    <div className="min-w-0 flex-1">
                      <p className={clsx("truncate font-extrabold leading-tight", many ? "text-[1.05cqw]" : "text-[1.35cqw]")}>
                        <Icon name="crown" className="mr-[0.3cqw] inline h-[1.1cqw] w-[1.1cqw] text-[#ffc24a]" />
                        {r.guess ? textOf(r.guess) : "nessuna previsione"}
                      </p>
                      <p className={clsx("truncate font-bold text-white/65", many ? "text-[0.9cqw]" : "text-[1.1cqw]")}>Tavolo: {r.top.length ? r.top.map(textOf).join(" / ") : "nessun voto"}</p>
                    </div>
                    <span className={clsx("tg-display shrink-0 rounded-[0.4cqw] px-[0.6cqw] py-[0.2cqw]", many ? "text-[1.1cqw]" : "text-[1.4cqw]", ok ? "bg-[#c6ff3d] text-[#0b0d12]" : tie ? "bg-[#ffc24a] text-[#0b0d12]" : "bg-white/10 text-white/70")}>
                      {ok ? "Vi conosce" : tie ? "Parità" : r.members < 2 ? "Da solo" : "Mancato"}
                    </span>
                  </div>
                );
              })}
            </TvPanel>
            <TvExplain text={reveal.explain} />
          </div>
        ) : (
          <TvPanel>
            <TvWaiting icon="crown" title="Silenzio al tavolo">
              Il capitano non vota: indovina la risposta più votata dai compagni. Giusta 100, in caso di parità 60 se è tra le pari.
            </TvWaiting>
          </TvPanel>
        )}
      </div>
    </TvFrame>
  );
}

export const ilCapitanoCiConosceUi = defineUi(Player, Tv);
