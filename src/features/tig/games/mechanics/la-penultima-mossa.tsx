"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { PenultimaReveal, PenultimaSubmission, PenultimaView, ShieldSpot } from "@/lib/tig/games/mechanics/la-penultima-mossa";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { BigToggle, ChoiceList } from "../kit/inputs";
import { canEdit, elapsedOf, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvOption, TvPanel, useClock, useSubmit } from "../kit/ui";
import { secsTo, TvOutcomeGrid } from "./m5-kit";

type P = PlayerGameProps<PenultimaView, null, PenultimaSubmission, PenultimaReveal>;
type T = TvGameProps<PenultimaView, PenultimaReveal>;

const SPOT_LABEL: Record<ShieldSpot, string> = { penultima: "Penultima", ultima: "Ultima" };

function Player(p: P) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const [shield, setShield] = useState<ShieldSpot>("ultima");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const playing = p.stage === "play";
  const secondOpen = !playing || elapsed >= view.round2AtMs;
  const [r1, r2] = view.rounds;
  const done = view.rounds.every((r) => !!answers[r.id]) && secondOpen;
  const submit = () => done && p.canSubmit && send({ shield, answers });
  const set = (roundId: string) => (id: string) => editable && setAnswers((a) => ({ ...a, [roundId]: id }));

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {reveal.rounds.map((r) => (
          <Panel key={r.id} className="flex flex-col gap-2">
            <Eyebrow className="flex items-center gap-1.5">
              {SPOT_LABEL[r.spot]}
              {sent && shield === r.spot && (
                <span className="inline-flex items-center gap-1 text-[#c6ff3d]">
                  · <Icon name="shield" className="h-3.5 w-3.5" /> la vostra difesa
                </span>
              )}
            </Eyebrow>
            <p className="text-lg font-extrabold leading-snug">{r.prompt}</p>
            <ChoiceList options={r.options} picked={sent && answers[r.id] ? [answers[r.id]] : []} onToggle={() => {}} keys={false} reveal={{ solution: [r.solutionId] }} />
          </Panel>
        ))}
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
          label={`Invia (difesa sull'${shield === "ultima" ? "ultima" : "penultima"})`}
          hint={!secondOpen ? `L'ultima arriva tra ${secsTo(view.round2AtMs, elapsed)} s: lì la difesa si blocca` : !done ? "Rispondete a tutte e due" : undefined}
        />
      }
    >
      <Panel className="flex flex-col gap-2">
        <Eyebrow className="flex items-center gap-1.5 text-[#ffc24a]">
          <Icon name="shield" className="h-4 w-4" /> La vostra unica difesa {secondOpen ? "· bloccata" : ""}
        </Eyebrow>
        <BigToggle<ShieldSpot>
          label="Dove giocate la difesa"
          value={shield}
          onChange={setShield}
          disabled={!editable || secondOpen}
          options={[
            { id: "penultima", title: "Ora", sub: "Sulla penultima: se sbagliate, 0 invece di −30", tone: "lime", icon: "shield" },
            { id: "ultima", title: "Dopo", sub: "La tenete per l'ultima, che ancora non conoscete", tone: "red", icon: "lock" },
          ]}
        />
      </Panel>
      <Panel className="flex flex-col gap-2" tone={!secondOpen ? "lime" : undefined}>
        <Eyebrow>Penultima · giusta +{view.rightPoints}, sbagliata {view.wrongPoints}</Eyebrow>
        {r1.prompt && r1.options && (
          <>
            <p className="text-lg font-extrabold leading-snug">{r1.prompt}</p>
            <ChoiceList options={r1.options} picked={answers[r1.id] ? [answers[r1.id]] : []} onToggle={set(r1.id)} disabled={!editable} keys={!secondOpen} />
          </>
        )}
      </Panel>
      <Panel className={clsx("flex flex-col gap-2", secondOpen && "tg-rise")} tone={secondOpen ? "lime" : undefined}>
        <Eyebrow>Ultima · giusta +{view.rightPoints}, sbagliata {view.wrongPoints}</Eyebrow>
        {secondOpen && r2.prompt && r2.options ? (
          <>
            <p className="text-lg font-extrabold leading-snug">{r2.prompt}</p>
            <ChoiceList options={r2.options} picked={answers[r2.id] ? [answers[r2.id]] : []} onToggle={set(r2.id)} disabled={!editable} onConfirm={done ? submit : null} />
          </>
        ) : (
          <p className="flex items-center gap-2 py-3 text-base font-bold text-white/70">
            <Icon name="lock" className="h-5 w-5" /> Arriva tra <span className="tg-num text-2xl text-[#c6ff3d]">{secsTo(view.round2AtMs, elapsed)}</span> s
          </p>
        )}
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const done = p.stage === "reveal" && reveal;
  const secondOpen = p.stage !== "play" || elapsed >= view.round2AtMs;
  const shieldOf = new Map((done ? (reveal.summary?.shields ?? []) : []).map((s) => [s.teamId, s]));
  return (
    <TvFrame view={view} p={p} subtitle={done ? `${view.title} · dove avete giocato la difesa` : secondOpen ? `${view.title} · difese bloccate: si vedranno al reveal` : `${view.title} · la difesa si decide prima che arrivi l'ultima`}>
      <div className={clsx("grid h-full gap-[1.1cqw]", done ? "grid-rows-[minmax(0,1fr)_auto]" : "")}>
        <div className="grid min-h-0 grid-cols-2 gap-[1.2cqw]">
          {view.rounds.map((r, i) => {
            const rr = done ? reveal.rounds[i] : null;
            const open = i === 0 || secondOpen;
            return (
              <TvPanel key={r.id} tone={!done && open && (i === 1 || !secondOpen) ? "lime" : undefined} className={clsx("flex min-h-0 flex-col gap-[0.8cqw]", open && "tg-rise")}>
                <p className="tg-display text-[2.6cqw]">
                  {SPOT_LABEL[r.spot]} <span className="tg-num text-[1.6cqw] text-white/60">+{view.rightPoints} / {view.wrongPoints}</span>
                </p>
                {open && (rr ?? r).prompt ? (
                  <>
                    <p className="text-[1.8cqw] font-extrabold leading-tight">{(rr ?? r).prompt}</p>
                    <div className="mt-auto flex flex-col gap-[0.45cqw]">
                      {((rr ?? r).options ?? []).map((o, k) => (
                        <TvOption key={o.id} index={k} text={o.text} size="sm" state={rr ? (o.id === rr.solutionId ? "right" : "dim") : "idle"} />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-[0.6cqw] text-center">
                    <Icon name="lock" className="h-[5cqw] w-[5cqw] text-white/45" />
                    <p className="tg-display text-[2.6cqw] text-white/80">Arriva tra</p>
                    <p className="tg-num text-[5cqw] leading-none text-[#c6ff3d]">{secsTo(view.round2AtMs, elapsed)}</p>
                    <p className="max-w-[80%] text-[1.3cqw] font-bold text-white/65">Chi gioca la difesa adesso, sull&apos;ultima resta scoperto.</p>
                  </div>
                )}
              </TvPanel>
            );
          })}
        </div>
        {done && (
          <TvPanel className="flex flex-col gap-[0.6cqw] p-[1cqw]">
            <p className="text-[1.2cqw] font-semibold leading-snug text-white/85">
              <span className="mr-[0.6cqw] text-[1cqw] font-extrabold uppercase tracking-[0.2em] text-[#c6ff3d]">Perché</span>
              {reveal.explain}
            </p>
            <TvOutcomeGrid
              teams={p.teams}
              outcome={p.outcome}
              note={(id) => {
                const s = shieldOf.get(id);
                return s ? `Difesa sull'${s.shield === "ultima" ? "ultima" : "penultima"} · ${s.saved ? "vi ha salvato" : "non serviva"}` : "Nessuna risposta";
              }}
            />
          </TvPanel>
        )}
      </div>
    </TvFrame>
  );
}

export const laPenultimaMossaUi = defineUi(Player, Tv);
