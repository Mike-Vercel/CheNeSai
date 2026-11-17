"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { ContrattaccoReveal, ContrattaccoSubmission, ContrattaccoView, Rivincita } from "@/lib/tig/games/mechanics/contrattacco";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { BigToggle, ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";
import { PhoneChip, Step, TvChip } from "./m2/kit";

type P = PlayerGameProps<ContrattaccoView, null, ContrattaccoSubmission, ContrattaccoReveal>;
type T = TvGameProps<ContrattaccoView, ContrattaccoReveal>;

function Player(p: P) {
  const { view, reveal } = p;
  const myAttack = view.ring.find((l) => l.from.teamId === p.myTeam.teamId);
  const attacker = view.ring.find((l) => l.to.teamId === p.myTeam.teamId);
  const [colpo, setColpo] = useState<string | null>(null);
  const [riv, setRiv] = useState<Rivincita | null>(null);
  const [risposta, setRisposta] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = !!colpo && !!riv && !!risposta;
  const submit = () => ready && p.canSubmit && send({ colpo: colpo!, rivincita: riv!, risposta: risposta! });
  const chooseRiv = (r: Rivincita) => {
    if (r !== riv) setRisposta(null);
    setRiv(r);
  };

  if (p.stage === "reveal" && reveal) {
    const links = reveal.summary?.links ?? [];
    const out = links.find((l) => l.from === p.myTeam.teamId);
    const inn = links.find((l) => l.to === p.myTeam.teamId);
    const q = riv === "piena" ? reveal.piena : reveal.sicura;
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-2">
          <Eyebrow>Attacco e rivincita</Eyebrow>
          {out && myAttack ? (
            <p className="flex flex-wrap items-center gap-2 text-base font-extrabold">
              Il vostro colpo sul tavolo <PhoneChip tableNo={myAttack.to.tableNo} tone="red" /> {out.hit ? <span className="text-(--tg-gold)">a segno (fino a {view.steal})</span> : <span className="text-(--tg-cream)/60">a vuoto</span>}
            </p>
          ) : (
            <p className="text-base font-extrabold text-(--tg-cream)/70">Nessun bersaglio per voi.</p>
          )}
          {inn && attacker && (
            <p className="flex flex-wrap items-center gap-2 text-base font-extrabold">
              Il colpo del tavolo <PhoneChip tableNo={attacker.from.tableNo} /> {inn.hit ? <span className="text-(--tg-red-hi)">vi ha preso</span> : <span className="text-(--tg-gold)">è andato a vuoto</span>}
            </p>
          )}
        </Panel>
        <Panel className="flex flex-col gap-2">
          <Eyebrow>Il colpo</Eyebrow>
          <p className="text-base font-extrabold leading-snug">{reveal.colpo.prompt}</p>
          <ChoiceList options={view.colpo.options} picked={sent && colpo ? [colpo] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.colpo.solutionId] }} />
        </Panel>
        <Panel className="flex flex-col gap-2">
          <Eyebrow>Rivincita {riv && sent ? riv : ""}</Eyebrow>
          <p className="text-base font-extrabold leading-snug">{q.prompt}</p>
          <ChoiceList options={(riv === "piena" ? view.piena : view.sicura).options} picked={sent && risposta ? [risposta] : []} onToggle={() => {}} keys={false} reveal={{ solution: [q.solutionId] }} />
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  const q = riv === "piena" ? view.piena : riv === "sicura" ? view.sicura : null;
  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Colpo e rivincita" hint={!colpo ? "Prima il colpo" : !riv ? "Scegliete la rivincita" : !risposta ? "Rispondete alla rivincita" : undefined} />}
    >
      <Panel tone="red" className="flex flex-col gap-2">
        {myAttack ? (
          <p className="flex flex-wrap items-center gap-2 text-base font-extrabold">
            <Icon name="sword" className="h-5 w-5 text-(--tg-red-hi)" /> Attaccate il tavolo <PhoneChip tableNo={myAttack.to.tableNo} tone="red" />
          </p>
        ) : (
          <p className="text-base font-extrabold">Siete soli: niente attacchi, solo la rivincita.</p>
        )}
        {attacker && (
          <p className="flex flex-wrap items-center gap-2 text-base font-extrabold">
            <Icon name="shield" className="h-5 w-5 text-(--tg-gold)" /> Vi attacca il tavolo <PhoneChip tableNo={attacker.from.tableNo} />
          </p>
        )}
      </Panel>
      <Step n={1} title={`Il colpo (giusto = −${view.steal} a loro)`} icon="sword" done={!!colpo}>
        <p className="text-lg font-extrabold leading-snug">{view.colpo.prompt}</p>
        <ChoiceList options={view.colpo.options} picked={colpo ? [colpo] : []} onToggle={(id) => editable && setColpo(id)} disabled={!editable} keys={!colpo} label="Il colpo" />
      </Step>
      <Step n={2} title="La rivincita: quanto rischiate?" icon="flame" done={!!riv}>
        <BigToggle<Rivincita>
          label="Rivincita"
          value={riv}
          onChange={chooseRiv}
          disabled={!editable}
          options={[
            { id: "sicura", title: `Sicura +${view.bonus.sicura}`, sub: "Domanda facile", tone: "lime", icon: "shield" },
            { id: "piena", title: `Piena +${view.bonus.piena}`, sub: "Domanda difficile", tone: "red", icon: "flame" },
          ]}
        />
      </Step>
      <Step n={3} title={q ? `Rivincita ${riv}` : "La domanda della rivincita"} done={!!risposta} className={clsx(!q && "opacity-60")}>
        {q ? (
          <>
            <p key={riv} className="tg-rise text-lg font-extrabold leading-snug">
              {q.prompt}
            </p>
            <ChoiceList key={`l-${riv}`} options={q.options} picked={risposta ? [risposta] : []} onToggle={(id) => editable && setRisposta(id)} disabled={!editable} keys={!!colpo} onConfirm={submit} label="Rivincita" />
          </>
        ) : (
          <p className="flex items-center gap-2 text-base font-bold text-(--tg-cream)/60">
            <Icon name="lock" className="h-5 w-5" /> Compare quando scegliete sicura o piena.
          </p>
        )}
      </Step>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const links = done ? (reveal.summary?.links ?? []) : [];
  const many = view.ring.length > 8;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Colpo a segno: −20 al bersaglio · la rivincita è un bonus, mai un altro attacco" : `Ognuno colpisce il tavolo dopo di lui nel giro. Rivincita: sicura +${view.bonus.sicura} o piena +${view.bonus.piena}`}>
      <div className="grid h-full grid-cols-[1.4fr_1fr] gap-[1.6cqw]">
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <TvPanel className="flex flex-col gap-[0.7cqw]">
            <p className="flex items-center gap-[0.6cqw] text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-red-hi)">
              <Icon name="sword" className="h-[1.5cqw] w-[1.5cqw]" /> Il colpo · giusto = −{view.steal} al bersaglio
            </p>
            <p className="text-[2cqw] font-extrabold leading-tight">{view.colpo.prompt}</p>
            <div className="grid grid-cols-4 gap-[0.6cqw]">
              {view.colpo.options.map((o, i) => (
                <TvOption key={o.id} size="sm" index={i} text={o.text} state={done ? (o.id === reveal.colpo.solutionId ? "right" : "dim") : "idle"} />
              ))}
            </div>
          </TvPanel>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-[1cqw]">
            {(["sicura", "piena"] as const).map((k) => {
              const q = view[k];
              const sol = done ? reveal[k].solutionId : null;
              return (
                <TvPanel key={k} tone={k === "piena" ? "red" : "lime"} className="flex min-h-0 flex-col gap-[0.5cqw]">
                  <p className="flex items-center justify-between text-[1.1cqw] font-extrabold uppercase tracking-[0.2em]">
                    <span>Rivincita {k}</span>
                    <span className={clsx("tg-num text-[2cqw]", k === "piena" ? "text-(--tg-red-hi)" : "text-(--tg-gold)")}>+{view.bonus[k]}</span>
                  </p>
                  <p className="text-[1.4cqw] font-extrabold leading-tight">{q.prompt}</p>
                  <div className={clsx("grid gap-[0.4cqw]", k === "sicura" ? "grid-cols-1" : "grid-cols-2")}>
                    {q.options.map((o, i) => (
                      <TvOption key={o.id} size="sm" index={i} text={o.text} state={sol ? (o.id === sol ? "right" : "dim") : "idle"} />
                    ))}
                  </div>
                </TvPanel>
              );
            })}
          </div>
        </div>
        <TvPanel className="flex min-h-0 flex-col gap-[0.6cqw] overflow-hidden">
          <p className="text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-teal-hi)">Il giro degli attacchi</p>
          {done ? (
            <>
              <div className={clsx("grid min-h-0 gap-[0.35cqw] overflow-hidden", many ? "grid-cols-2" : "grid-cols-1")}>
                {links.map((l, i) => (
                  <div key={l.from} className="tg-rise flex items-center gap-[0.5cqw] rounded-[0.7cqw] bg-(--tg-cream)/[0.05] px-[0.6cqw] py-[0.3cqw]" style={{ animationDelay: `${i * 60}ms` }}>
                    <TvChip teams={p.teams} id={l.from} size={many ? 1.9 : 2.4} />
                    <Icon name="sword" className={clsx("h-[1.4cqw] w-[1.4cqw]", l.hit ? "text-(--tg-red-hi)" : "text-(--tg-cream)/35")} />
                    <TvChip teams={p.teams} id={l.to} size={many ? 1.9 : 2.4} />
                    <span className={clsx("ml-auto text-right font-extrabold leading-tight", many ? "text-[0.95cqw]" : "text-[1.2cqw]")}>
                      <span className={l.hit ? "text-(--tg-red-hi)" : "text-(--tg-cream)/50"}>{l.hit ? `−${view.steal}` : "a vuoto"}</span>
                      <span className="text-(--tg-cream)/40"> · </span>
                      <span className={l.revengeOk ? "text-(--tg-gold)" : "text-(--tg-cream)/50"}>{l.revenge ? (l.revengeOk ? `rivincita +${view.bonus[l.revenge]}` : `${l.revenge} fallita`) : "nessuna rivincita"}</span>
                    </span>
                  </div>
                ))}
              </div>
              <TvExplain text={reveal.explain} className="mt-auto" />
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-[0.5cqw]">
              {view.ring.map((l, i) => (
                <span key={l.from.teamId} className="tg-rise flex items-center gap-[0.5cqw]" style={{ animationDelay: `${i * 50}ms` }}>
                  <TvChip teams={p.teams} id={l.from.teamId} size={view.ring.length > 12 ? 2.3 : 3} />
                  <Icon name="arrow" className="h-[1.4cqw] w-[1.4cqw] text-(--tg-red-hi)" />
                </span>
              ))}
              {view.ring[0] && <TvChip teams={p.teams} id={view.ring[0].from.teamId} size={view.ring.length > 12 ? 2.3 : 3} />}
              {view.ring.length === 0 && <p className="text-[1.6cqw] font-bold text-(--tg-cream)/60">Un tavolo solo: niente attacchi.</p>}
            </div>
          )}
          {!done && (
            <div className="mt-auto flex flex-col gap-[0.6cqw]">
              <p className="flex items-center gap-[0.6cqw] text-[1.5cqw] font-extrabold">
                <Icon name="sword" className="h-[1.8cqw] w-[1.8cqw] text-(--tg-red-hi)" /> Colpo giusto: {view.steal} punti passano a chi colpisce
              </p>
              <p className="flex items-center gap-[0.6cqw] text-[1.5cqw] font-extrabold">
                <Icon name="shield" className="h-[1.8cqw] w-[1.8cqw] text-(--tg-gold)" /> La rivincita è un bonus: nessuna catena di attacchi
              </p>
            </div>
          )}
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const contrattaccoUi = defineUi(Player, Tv);
