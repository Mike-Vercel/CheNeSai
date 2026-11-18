"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { AlleanzaGrid, AlleanzaMemberView, AlleanzaReveal, AlleanzaSubmission, AlleanzaView } from "@/lib/tig/games/mechanics/alleanza-espressa";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { DigitPad } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { CrewTag, teamMap, ThemeBanner, TvExplainCompact } from "./_m3-kit";

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
              <th key={c} scope="col" className="px-1 pb-1 text-[11px] font-extrabold uppercase leading-tight text-(--tg-mute)">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((r, i) => (
            <tr key={r}>
              <th scope="row" className="pr-2 text-left text-xs font-extrabold uppercase leading-tight text-(--tg-mute)">
                {r}
              </th>
              {grid.cells[i].map((d, j) => (
                <td key={j} className="p-0.5">
                  <span className="tg-num grid h-11 place-items-center rounded-lg border border-(--tg-cream)/12 bg-(--tg-cream)/[0.05] text-3xl">{d}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** «il tavolo 7» oppure «i tavoli 7 e 11». */
function tablesText(nos: number[]): string {
  return nos.length === 1 ? `il tavolo ${nos[0]}` : `i tavoli ${nos.slice(0, -1).join(", ")} e ${nos[nos.length - 1]}`;
}

function roleText(mv: AlleanzaMemberView | null): string {
  if (!mv) return "Metà in arrivo…";
  if (mv.role === "solo" || !mv.partners.length) return "Nessun alleato in gara: avete tutte e due le metà.";
  if (mv.role === "griglia") {
    const coords = mv.partners.filter((x) => x.role === "coordinate").map((x) => x.tableNo);
    const twins = mv.partners.filter((x) => x.role === "griglia").map((x) => x.tableNo);
    return `Voi avete la griglia. Le coordinate le ha ${tablesText(coords)}: andate a parlarvi.${twins.length ? ` Anche ${tablesText(twins)} ha la griglia.` : ""}`;
  }
  const grids = mv.partners.filter((x) => x.role === "griglia").map((x) => x.tableNo);
  return `Voi avete le coordinate. La griglia ce l'${grids.length > 1 ? "hanno" : "ha"} ${tablesText(grids)}: leggetegliele e fatevi dire le cifre.`;
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
          {mv.transform && <p className="rounded-lg bg-(--tg-teal)/15 px-3 py-2 text-sm font-extrabold text-(--tg-teal-hi)">{mv.transform}</p>}
        </Panel>
      )}
      {mv?.clues && (
        <Panel className="flex flex-col gap-2">
          <Eyebrow>La vostra metà · le coordinate, in ordine</Eyebrow>
          {mv.clues.map((c, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl bg-(--tg-cream)/[0.05] px-3 py-2">
              <span className="tg-num grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-(--tg-gold) text-xl text-(--tg-ink)" aria-label={`Cifra ${i + 1}`}>
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
      <ThemeBanner eyebrow="Il codice apre" title={view.lockName} size="sm" />
      <Panel tone="lime" className="flex items-start gap-3">
        <Icon name="handshake" className="mt-0.5 h-8 w-8 shrink-0 text-(--tg-gold)" />
        <p className="text-base font-bold leading-snug">{roleText(mv)}</p>
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
      <div className="flex h-full flex-col gap-[1cqw]">
        <ThemeBanner tv size="sm" eyebrow="Il codice apre" title={view.lockName} aside={`Codice di ${view.length} cifre`} className="tg-rise" />
        <div className={clsx("grid min-h-0 flex-1 content-start gap-[0.9cqw]", cols)}>
          {view.groups.map((g, i) => {
            const r = results.get(g.teamIds.join("|"));
            return (
              <TvPanel key={g.teamIds.join("|")} tone={r ? (r.ok ? "lime" : "red") : undefined} className="tg-rise flex items-center gap-[1cqw] !px-[1.1cqw] !py-[0.8cqw]" >
                {/* le bandiere dell'alleanza, con chi ha la griglia e chi le coordinate */}
                <div className="flex shrink-0 items-center gap-[0.4cqw]">
                  {g.teamIds.map((id, k) => {
                    const t = teams.get(id);
                    return (
                      <span key={id} className="flex items-center gap-[0.4cqw]">
                        {k > 0 && <Icon name="handshake" className="h-[1.6cqw] w-[1.6cqw] text-(--tg-brass)" />}
                        <span className="flex flex-col items-center">
                          <CrewTag tableNo={g.tableNos[k]} color={t?.color} className="h-[3cqw]" />
                          <span className={clsx("text-[0.8cqw] font-extrabold uppercase leading-tight", t?.submitted && !r ? "text-(--tg-gold-hi)" : "text-(--tg-cream)/60")}>{t?.submitted && !r ? "inviato" : k === 1 ? "coordinate" : g.teamIds.length === 1 ? "da solo" : "griglia"}</span>
                        </span>
                      </span>
                    );
                  })}
                </div>
                <div className="min-w-0 flex-1 text-right" style={{ animationDelay: `${i * 60}ms` }}>
                  {r ? (
                    <>
                      <p className={clsx("tg-num text-[2.6cqw] leading-none tracking-[0.18em]", r.ok ? "text-(--tg-gold-hi)" : "text-(--tg-cream)")}>{r.digits}</p>
                      <p className={clsx("tg-display text-[1.2cqw]", r.ok ? "text-(--tg-gold-hi)" : "text-(--tg-red-hi)")}>{r.ok ? "Alleanza riuscita" : "Alleanza saltata"}</p>
                    </>
                  ) : (
                    <p className="tg-display text-[1.3cqw] text-(--tg-cream)/70">Alleanza {i + 1}</p>
                  )}
                </div>
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
