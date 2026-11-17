"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { type DuelloReveal, type DuelloRow, type DuelloSubmission, type DuelloView } from "@/lib/tig/games/mechanics/duello-silenzioso";
import { secLabel } from "@/lib/tig/games/mechanics/m5-shared";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { DigitPad } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { silentTeams, teamMap, TvTeamTag } from "./m5-kit";

type P = PlayerGameProps<DuelloView, null, DuelloSubmission, DuelloReveal>;
type T = TvGameProps<DuelloView, DuelloReveal>;

/** Una riga dell'enigma: cifre del tentativo e indizio. Al reveal le cifre si colorano rispetto alla soluzione. */
function Row({ row, pin, tv = false }: { row: DuelloRow; pin?: string; tv?: boolean }) {
  return (
    <div className={clsx("flex items-center", tv ? "gap-[1.2cqw]" : "gap-3")}>
      <div className={clsx("flex", tv ? "gap-[0.4cqw]" : "gap-1.5")} aria-label={`Tentativo ${row.guess.split("").join(" ")}`}>
        {row.guess.split("").map((d, i) => {
          const spot = pin ? pin[i] === d : false;
          const near = pin ? !spot && pin.includes(d) : false;
          return (
            <span
              key={i}
              className={clsx(
                "tg-num grid place-items-center border-2",
                tv ? "h-[3.1cqw] w-[2.5cqw] rounded-[0.5cqw] text-[2.1cqw]" : "h-11 w-9 rounded-lg text-[1.7rem]",
                spot ? "border-[#c6ff3d] bg-[#c6ff3d] text-[#0b0d12]" : near ? "border-dashed border-[#ffc24a] text-[#ffc24a]" : pin ? "border-white/10 text-white/35" : "border-white/20 bg-white/[0.04]",
              )}
            >
              {d}
            </span>
          );
        })}
      </div>
      <div className={clsx("flex flex-col", tv ? "gap-[0.2cqw]" : "gap-0.5")}>
        <span className={clsx("flex items-center font-extrabold", tv ? "gap-[0.4cqw] text-[1.45cqw]" : "gap-1.5 text-base")}>
          <span className={clsx("inline-block rounded-full bg-[#c6ff3d]", tv ? "h-[1cqw] w-[1cqw]" : "h-3 w-3")} aria-hidden />
          {row.spot} al posto giusto
        </span>
        <span className={clsx("flex items-center font-extrabold text-white/80", tv ? "gap-[0.4cqw] text-[1.45cqw]" : "gap-1.5 text-base")}>
          <span className={clsx("inline-block rounded-full border-2 border-[#ffc24a]", tv ? "h-[1cqw] w-[1cqw]" : "h-3 w-3")} aria-hidden />
          {row.near} fuori posto
        </span>
      </div>
    </div>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [pin, setPin] = useState("");
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = pin.length === view.digits && new Set(pin).size === view.digits;
  const submit = () => ready && p.canSubmit && send({ pin });
  const group = view.groups.find((g) => g.some((t) => t.teamId === p.myTeam.teamId)) ?? [];
  const rivals = group.filter((t) => t.teamId !== p.myTeam.teamId);
  const rivalText = rivals.length ? `Rival${rivals.length > 1 ? "i" : "e"}: tavol${rivals.length > 1 ? "i" : "o"} ${rivals.map((r) => r.tableNo).join(" e ")}` : "Nessun rivale: contro il tempo";

  if (p.stage === "reveal" && reveal) {
    const g = reveal.summary?.groups.find((x) => x.teams.includes(p.myTeam.teamId));
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel tone="lime" className="flex flex-col items-center gap-2 py-4">
          <Eyebrow>La combinazione</Eyebrow>
          <p className="tg-num text-6xl leading-none tracking-[0.25em] text-[#c6ff3d]">{reveal.pin}</p>
          {sent && pin !== reveal.pin && <p className="tg-num text-xl text-white/60 line-through">{pin}</p>}
        </Panel>
        {g && g.teams.length > 1 && (
          <Panel className="flex flex-col gap-1">
            <Eyebrow>Il vostro duello</Eyebrow>
            {g.teams.map((id) => {
              const t = group.find((x) => x.teamId === id);
              return (
                <p key={id} className="flex items-center justify-between text-base font-bold">
                  <span>
                    Tavolo {t?.tableNo ?? "?"}
                    {id === p.myTeam.teamId ? " (voi)" : ""}
                    {g.winners.includes(id) ? (g.tie ? " · pari" : " · vince") : ""}
                  </span>
                  <span className="tg-num text-lg text-white/75">{g.times[id] === null ? "nessuna risposta" : `${g.right[id] ? "giusta" : "sbagliata"} · ${secLabel(g.times[id] ?? 0)}`}</span>
                </p>
              );
            })}
          </Panel>
        )}
        <Panel className="flex flex-col gap-3">
          {reveal.rows.map((r) => (
            <Row key={r.guess} row={r} pin={reveal.pin} />
          ))}
        </Panel>
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
          ready={ready}
          pending={pending}
          error={error}
          onSubmit={submit}
          label="Blocca la combinazione"
          hint={pin.length === view.digits && !ready ? "Le cifre sono tutte diverse" : "Primo giusto +100; entro 3 secondi dal rivale, pari: +60 a testa"}
        />
      }
    >
      <Panel className="flex items-center gap-3 py-3">
        <Icon name="sword" className="h-8 w-8 shrink-0 text-[#ff3b4e]" />
        <div className="min-w-0">
          <Eyebrow>{rivalText}</Eyebrow>
          <p className="text-sm font-bold text-white/75">In silenzio: non saprete se ha già finito.</p>
        </div>
      </Panel>
      <Panel className="flex flex-col gap-3">
        <div>
          <Eyebrow className="text-[#ffc24a]">{view.heading}</Eyebrow>
          <p className="mt-1 text-[15px] font-semibold leading-snug text-white/85">{view.story}</p>
          <p className="mt-1 text-sm font-bold text-white/65">{view.digits} cifre, tutte diverse.</p>
        </div>
        {view.rows.map((r) => (
          <Row key={r.guess} row={r} />
        ))}
      </Panel>
      <Panel>
        <DigitPad value={pin} length={view.digits} onChange={(v) => editable && setPin(v)} disabled={!editable} onEnter={submit} />
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const map = teamMap(p.teams);
  const groups = done && reveal.summary ? reveal.summary.groups : null;
  const frameP = done ? p : { ...p, teams: silentTeams(p.teams) };
  return (
    <TvFrame view={view} p={frameP} subtitle={done ? `${view.heading} · la combinazione era ${reveal.pin}` : `${view.heading} · ${view.digits} cifre tutte diverse · nessuno sa se il rivale ha finito`}>
      <div className="grid h-full grid-cols-[1.25fr_1fr] gap-[1.4cqw]">
        <TvPanel className="tg-rise flex min-h-0 flex-col gap-[1cqw]">
          {done ? (
            <div className="flex items-center gap-[1.2cqw]">
              <p className="text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-[#c6ff3d]">Combinazione</p>
              <p className="tg-num tg-pop text-[5cqw] leading-none tracking-[0.25em] text-[#c6ff3d]">{reveal.pin}</p>
            </div>
          ) : (
            <p className="text-[1.5cqw] font-semibold leading-snug text-white/90">{view.story}</p>
          )}
          <div className="flex flex-col gap-[0.6cqw]">
            {view.rows.map((r) => (
              <Row key={r.guess} row={r} pin={done ? reveal.pin : undefined} tv />
            ))}
          </div>
        </TvPanel>
        <TvPanel className="flex min-h-0 flex-col gap-[0.7cqw]">
          <p className="text-[1.05cqw] font-extrabold uppercase tracking-[0.2em] text-[#ffc24a]">{done ? "Esito dei duelli" : "Duelli in corso"}</p>
          <div className={clsx("grid content-start gap-[0.6cqw]", view.groups.length > 3 ? "grid-cols-2" : "grid-cols-1")}>
            {view.groups.map((g, i) => {
              const r = groups?.[i];
              return (
                <div key={g.map((t) => t.teamId).join("-")} className="tg-rise flex flex-col gap-[0.3cqw] rounded-[0.8cqw] border border-white/10 bg-white/[0.05] px-[0.8cqw] py-[0.5cqw]" style={{ animationDelay: `${i * 60}ms` }}>
                  {g.map((t) => {
                    const won = !!r?.winners.includes(t.teamId);
                    return (
                      <div key={t.teamId} className="flex min-w-0 items-center gap-[0.5cqw]">
                        <TvTeamTag team={map.get(t.teamId)} className="min-w-0 flex-1" />
                        {r ? (
                          <span className={clsx("tg-num shrink-0 text-[1.2cqw]", won ? "text-[#c6ff3d]" : "text-white/50")}>
                            {r.times[t.teamId] === null ? "—" : `${r.right[t.teamId] ? "" : "× "}${secLabel(r.times[t.teamId] ?? 0)}`}
                            {won ? (r.tie ? " · pari" : " · vince") : ""}
                          </span>
                        ) : (
                          <Icon name="dots" className="h-[1.4cqw] w-[1.4cqw] shrink-0 text-white/40" />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          {done ? (
            <p className="mt-auto text-[1.2cqw] font-semibold leading-snug text-white/85">{reveal.explain}</p>
          ) : (
            <p className="mt-auto text-[1.15cqw] font-bold leading-snug text-white/65">Pallino pieno: cifra giusta al posto giusto. Pallino vuoto: cifra giusta ma fuori posto.</p>
          )}
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const duelloSilenziosoUi = defineUi(Player, Tv);
