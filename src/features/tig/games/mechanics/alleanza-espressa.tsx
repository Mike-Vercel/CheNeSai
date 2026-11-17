"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { AlleanzaGrid, AlleanzaMemberView, AlleanzaReveal, AlleanzaSubmission, AlleanzaView } from "@/lib/tig/games/mechanics/alleanza-espressa";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { DigitPad } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { TableChip, teamMap, TvExplainCompact } from "./_m3-kit";

type P = PlayerGameProps<AlleanzaView, AlleanzaMemberView, AlleanzaSubmission, AlleanzaReveal>;
type T = TvGameProps<AlleanzaView, AlleanzaReveal>;

/** La griglia di cifre (metà di chi ha la griglia). */
function GridTable({ grid }: { grid: AlleanzaGrid }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-center" aria-label="Griglia di cifre">
        <thead>
          <tr>
            <th />
            {grid.cols.map((c) => (
              <th key={c} scope="col" className="px-1 pb-1 text-[11px] font-extrabold uppercase leading-tight text-[#9aa4b2]">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((r, i) => (
            <tr key={r}>
              <th scope="row" className="pr-2 text-left text-xs font-extrabold uppercase leading-tight text-[#9aa4b2]">
                {r}
              </th>
              {grid.cells[i].map((d, j) => (
                <td key={j} className="p-0.5">
                  <span className="tg-num grid h-11 place-items-center rounded-lg border border-white/12 bg-white/[0.05] text-3xl">{d}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function roleText(mv: AlleanzaMemberView | null): string {
  if (!mv) return "Metà in arrivo…";
  const who = mv.partners.map((x) => `tavolo ${x.tableNo}`).join(" e ");
  if (mv.role === "solo") return "Nessun alleato in gara: avete tutte e due le metà.";
  if (mv.role === "griglia") return `Voi avete la GRIGLIA. Le coordinate le ha il ${who}: andate a parlarvi.`;
  return `Voi avete le COORDINATE. La griglia ce l'ha il ${who}: leggetegliele e fatevi dire le cifre.`;
}

function Player(p: P) {
  const { view, reveal, memberView: mv } = p;
  const [digits, setDigits] = useState("");
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = digits.length === view.length;
  const submit = () => ready && p.canSubmit && send({ digits });

  const halves = (
    <>
      {mv?.grid && (
        <Panel className="flex flex-col gap-2">
          <Eyebrow>La vostra metà · la griglia</Eyebrow>
          <GridTable grid={mv.grid} />
          {mv.transform && <p className="rounded-lg bg-[#ffc24a]/15 px-3 py-2 text-sm font-extrabold text-[#ffc24a]">{mv.transform}</p>}
        </Panel>
      )}
      {mv?.clues && (
        <Panel className="flex flex-col gap-2">
          <Eyebrow>La vostra metà · le coordinate, in ordine</Eyebrow>
          {mv.clues.map((c, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl bg-white/[0.05] px-3 py-2">
              <span className="tg-num grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#c6ff3d] text-xl text-[#0b0d12]" aria-label={`Cifra ${i + 1}`}>
                {i + 1}
              </span>
              <p className="text-base font-bold leading-snug">{c}</p>
            </div>
          ))}
        </Panel>
      )}
    </>
  );

  if (p.stage === "reveal" && reveal) {
    const g = reveal.summary?.groups.find((x) => x.teamIds.includes(p.myTeam.teamId));
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {g && (
          <Panel tone={g.ok ? "lime" : "red"} className="flex flex-col gap-2">
            <Eyebrow>Il codice della vostra alleanza</Eyebrow>
            <DigitPad value={g.entries[p.myTeam.teamId] ?? (sent ? digits : g.digits)} length={view.length} onChange={() => {}} disabled reveal={g.digits} />
            <p className="text-base font-bold">{g.ok ? "Tutti giusti: alleanza riuscita." : "Basta un codice sbagliato o mancante e l'alleanza salta."}</p>
          </Panel>
        )}
        {halves}
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Prova il codice" hint="Il codice è lo stesso per tutta l'alleanza: lo inviano tutti i tavoli" />}
    >
      <Panel tone="lime" className="flex items-start gap-3">
        <Icon name="handshake" className="mt-0.5 h-8 w-8 shrink-0 text-[#c6ff3d]" />
        <div>
          <p className="tg-display text-2xl leading-none">{view.lockName}</p>
          <p className="mt-1 text-base font-bold leading-snug">{roleText(mv)}</p>
        </div>
      </Panel>
      {halves}
      <Panel className="flex flex-col gap-2">
        <Eyebrow>Il codice ({view.length} cifre)</Eyebrow>
        <DigitPad value={digits} length={view.length} onChange={(v) => editable && setDigits(v)} disabled={!editable} onEnter={submit} />
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const teams = teamMap(p.teams);
  const results = new Map((done ? (reveal.summary?.groups ?? []) : []).map((g) => [g.teamIds.join("|"), g]));
  const cols = view.groups.length > 4 ? "grid-cols-3" : view.groups.length > 1 ? "grid-cols-2" : "grid-cols-1";
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Le alleanze e i loro codici" : "Un tavolo ha la griglia, l'alleato le coordinate. Alzatevi e parlatevi: o vincete insieme, o niente."}>
      <div className="flex h-full flex-col gap-[1.2cqw]">
        <TvPanel className="tg-rise flex items-center gap-[1.2cqw]">
          <Icon name="handshake" className="h-[4cqw] w-[4cqw] shrink-0 text-[#c6ff3d]" />
          <p className="tg-display text-[3.2cqw] leading-none">{view.lockName}</p>
          <p className="ml-auto text-[1.4cqw] font-bold text-white/70">Codice di {view.length} cifre</p>
        </TvPanel>
        <div className={clsx("grid min-h-0 flex-1 content-start gap-[1cqw]", cols)}>
          {view.groups.map((g, i) => {
            const r = results.get(g.teamIds.join("|"));
            return (
              <TvPanel key={g.teamIds.join("|")} tone={r ? (r.ok ? "lime" : "red") : undefined} className="tg-rise flex flex-col items-center gap-[0.7cqw] !p-[1.2cqw]">
                <div className="flex items-center gap-[0.6cqw]">
                  {g.teamIds.map((id, k) => {
                    const t = teams.get(id);
                    return (
                      <span key={id} className="flex items-center gap-[0.6cqw]">
                        {k > 0 && <Icon name="swap" className="h-[1.8cqw] w-[1.8cqw] rotate-90 text-white/60" />}
                        <span className="flex flex-col items-center gap-[0.2cqw]">
                          <TableChip tableNo={g.tableNos[k]} color={t?.color} tv className="!h-[3.4cqw] !min-w-[3.4cqw] !text-[2.2cqw]" />
                          <span className={clsx("text-[0.85cqw] font-extrabold uppercase", t?.submitted ? "text-[#c6ff3d]" : "text-white/45")}>{t?.submitted ? "inviato" : k === 1 ? "coordinate" : g.teamIds.length === 1 ? "da solo" : "griglia"}</span>
                        </span>
                      </span>
                    );
                  })}
                </div>
                {r ? (
                  <>
                    <p className="tg-num text-[3cqw] leading-none tracking-[0.2em]">{r.digits}</p>
                    <p className={clsx("tg-display text-[1.6cqw]", r.ok ? "text-[#c6ff3d]" : "text-[#ff8c97]")}>{r.ok ? "Alleanza riuscita" : "Alleanza saltata"}</p>
                  </>
                ) : (
                  <p className="text-[1.2cqw] font-bold text-white/60" style={{ animationDelay: `${i * 60}ms` }}>
                    Alleanza {i + 1}
                  </p>
                )}
              </TvPanel>
            );
          })}
        </div>
        {done && <TvExplainCompact text={reveal.explain} />}
      </div>
    </TvFrame>
  );
}

export const alleanzaEspressaUi = defineUi(Player, Tv);
