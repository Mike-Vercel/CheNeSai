"use client";

import { clsx } from "clsx";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { MECHANIC_EXTRAS, MECHANICS } from "@/lib/tig/games";
import type { AcceptedSubmission, CatalogEntry, MemberCtx, PhaseCtx, ScoreOutput, TeamRef } from "@/lib/tig/games/contract";
import { MECHANIC_UIS } from "@/features/tig/games";
import type { GameStage } from "@/features/tig/games/ui-contract";
import { teamColor } from "@/lib/tig/rules";
import "@/features/tig/games/kit/tig-games.css";

export type PreviewSurface = "all" | "phone" | "pc" | "tv";

interface Initial {
  code: string | null;
  variant: number;
  stage: GameStage;
  surface: PreviewSurface;
  elapsedSec: number;
  freeze: boolean;
  captain: boolean;
  sent: boolean;
}

/** Tre tavoli finti di dimensioni diverse (2, 4 e 3 telefoni): il «mio» è il primo. Colori veri dei tavoli. */
const TEAMS: (TeamRef & { name: string; color: string })[] = [
  { teamId: "t-a", tableNo: 3, members: ["a1", "a2"], captainId: "a1", name: "I Ritardatari", color: teamColor(3) },
  { teamId: "t-b", tableNo: 7, members: ["b1", "b2", "b3", "b4"], captainId: "b1", name: "Divano Club", color: teamColor(7) },
  { teamId: "t-c", tableNo: 11, members: ["c1", "c2", "c3"], captainId: "c1", name: "Gruppo Calcetto", color: teamColor(11) },
];
const ME = TEAMS[0];
const MY_MEMBER = "a1";

const MANCHE = ["", "Chi parte male...", "Fregali tutti!", "Il pub decide!", "Il grande inganno", "Tutto o niente!"];

export function GiochiPreview({ content, catalog, initial }: { content: Record<string, unknown[]>; catalog: CatalogEntry[]; initial: Initial }) {
  const [code, setCode] = useState(initial.code && MECHANICS.some((m) => m.code === initial.code) ? initial.code : MECHANICS[0].code);
  const [variant, setVariant] = useState(initial.variant);
  const [stage, setStage] = useState<GameStage>(initial.stage);
  const [captain, setCaptain] = useState(initial.captain);
  const [elapsedSec, setElapsedSec] = useState(initial.elapsedSec);
  const [run, setRun] = useState(0);
  const [mine, setMine] = useState<AcceptedSubmission<unknown>[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  const def = MECHANICS.find((m) => m.code === code)!;
  const extras = MECHANIC_EXTRAS[code];
  const ui = MECHANIC_UIS[code];
  const variants = content[code] ?? [];
  const vIndex = Math.min(variant, Math.max(0, variants.length - 1));
  const item = variants[vIndex];
  const durationMs = def.timerSec * 1000;

  // orologio: la prova parte al montaggio (o alla nuova corsa) spostata di `elapsedSec`
  const [startAt, setStartAt] = useState(() => Date.now() - initial.elapsedSec * 1000);
  const jump = (sec: number) => {
    setElapsedSec(sec);
    setStartAt(Date.now() - sec * 1000);
  };
  const now = useCallback(() => (initial.freeze ? startAt + elapsedSec * 1000 : Date.now()), [initial.freeze, startAt, elapsedSec]);
  const deadlineAt = startAt + durationMs;

  const ctx: PhaseCtx = useMemo(
    () => ({ gameInstanceId: `anteprima-${code}`, startsAt: startAt, deadlineAt, teams: TEAMS.map(({ name: _n, color: _c, ...t }) => t), participants: TEAMS.map((t) => t.teamId), seed: `anteprima:${code}:${vIndex}` }),
    [code, vIndex, startAt, deadlineAt],
  );

  const view = useMemo(() => (item ? def.publicView(item, ctx) : null), [def, item, ctx]);
  const memberView = useMemo(() => {
    const memberCtx: MemberCtx = { ...ctx, teamId: ME.teamId, memberId: MY_MEMBER, memberIndex: 0 };
    return item && def.memberView ? def.memberView(item, memberCtx) : null;
  }, [def, item, ctx]);

  // invii finti degli altri (e del mio tavolo se non ho inviato io)
  const demo = useMemo(() => (item ? extras.demoSubmissions(item, ctx, `demo:${code}:${vIndex}`) : []), [extras, item, ctx, code, vIndex]);
  const iSent = mine.length > 0 || initial.sent;
  const personal = def.input === "vote";
  const submissions = useMemo(() => {
    const others = demo.filter((s) => (personal ? s.memberId !== MY_MEMBER : s.teamId !== ME.teamId));
    const myDemo = demo.filter((s) => (personal ? s.memberId === MY_MEMBER : s.teamId === ME.teamId));
    return [...others, ...(mine.length ? mine : myDemo)];
  }, [demo, mine, personal]);

  const outcome: ScoreOutput | null = useMemo(() => (item ? def.score({ content: item, ctx, submissions }) : null), [def, item, ctx, submissions]);
  const reveal = useMemo(() => (item && outcome ? def.reveal(item, outcome) : null), [def, item, outcome]);
  const myOutcome = outcome?.outcomes.find((o) => o.teamId === ME.teamId) ?? null;

  const submit = useCallback(
    async (payload: unknown) => {
      const r = def.submissionSchema.safeParse(payload);
      if (!r.success) {
        setLastError(r.error.message);
        return { ok: false, reason: "Invio non valido" };
      }
      setLastError(null);
      setMine([{ teamId: ME.teamId, memberId: MY_MEMBER, elapsedMs: Math.max(0, Date.now() - startAt), payload: r.data }]);
      return { ok: true };
    },
    [def, startAt],
  );

  const reset = (next?: Partial<{ code: string; variant: number }>) => {
    if (next?.code) setCode(next.code);
    if (next?.variant !== undefined) setVariant(next.variant);
    setMine([]);
    setStage("play");
    jump(0);
    setRun((r) => r + 1);
  };

  if (!view || !ui || !item) return <p className="p-6">Nessun contenuto per {code}.</p>;

  const playerProps = {
    view,
    memberView,
    stage,
    deadlineAt,
    now,
    canSubmit: captain || personal,
    submitted: iSent && stage !== "reveal" ? true : iSent,
    submit,
    myTeam: ME,
    reveal: stage === "reveal" ? reveal : null,
    myOutcome: stage === "reveal" ? myOutcome : null,
  };
  const tvProps = {
    view,
    stage,
    deadlineAt,
    now,
    teams: TEAMS.map((t) => ({
      teamId: t.teamId,
      tableNo: t.tableNo,
      name: t.name,
      color: t.color,
      submitted: t.teamId === ME.teamId ? iSent : submissions.some((s) => s.teamId === t.teamId) && (stage !== "play" || elapsedSec * 1000 > durationMs * 0.3),
    })),
    reveal: stage === "reveal" ? reveal : null,
    outcome: stage === "reveal" ? outcome : null,
  };
  const { Player, Tv } = ui;
  const key = `${code}-${vIndex}-${run}`;

  if (initial.surface === "phone" || initial.surface === "pc") {
    return (
      <div className="min-h-dvh bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,color-mix(in_srgb,var(--tg-gold)_8%,transparent),transparent_70%)]">
        <Player key={key} {...playerProps} />
      </div>
    );
  }
  if (initial.surface === "tv") {
    return (
      <div className="tg-arena-fake relative h-dvh w-screen overflow-hidden">
        <Tv key={key} {...tvProps} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <h1 className="tg-display text-5xl">
          Taverna dei Pirati <span className="text-(--tg-gold)">minigiochi</span>
        </h1>
        <p className="text-sm font-semibold text-(--tg-cream)/60">
          {MECHANICS.length} meccaniche implementate su {catalog.length} · banco di prova con 3 tavoli finti (2, 4 e 3 telefoni) e score() vero
        </p>
      </header>

      <section className="tg-glass flex flex-col gap-4 rounded-2xl p-4">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Meccanica">
            <select value={code} onChange={(e) => reset({ code: e.target.value, variant: 0 })} className={selectCls}>
              {[1, 2, 3, 4, 5].map((m) => (
                <optgroup key={m} label={`Manche ${m} · ${MANCHE[m]}`}>
                  {MECHANICS.filter((x) => x.manche === m).map((x) => (
                    <option key={x.code} value={x.code}>
                      {String(x.number).padStart(2, "0")} · {x.title} ({x.input})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label={`Variante (${variants.length})`}>
            <select value={vIndex} onChange={(e) => reset({ variant: Number(e.target.value) })} className={selectCls}>
              {variants.map((v, i) => (
                <option key={i} value={i}>
                  {i + 1} · {(v as { id: string }).id}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fase">
            <div className="flex gap-1">
              {(["play", "locked", "reveal"] as GameStage[]).map((s) => (
                <Btn key={s} on={stage === s} onClick={() => setStage(s)}>
                  {s}
                </Btn>
              ))}
            </div>
          </Field>
          <Field label={`Tempo trascorso: ${elapsedSec}s / ${def.timerSec}s`}>
            <input type="range" min={0} max={def.timerSec} value={elapsedSec} onChange={(e) => jump(Number(e.target.value))} className="w-56 accent-(--tg-gold)" />
          </Field>
          <Field label="Telefono">
            <div className="flex gap-1">
              <Btn on={captain} onClick={() => setCaptain(true)}>
                capitano
              </Btn>
              <Btn on={!captain} onClick={() => setCaptain(false)}>
                membro
              </Btn>
            </div>
          </Field>
          <Btn onClick={() => reset()}>ricomincia</Btn>
        </div>
        <p className="text-sm font-semibold text-(--tg-cream)/70">
          <b className="text-(--tg-gold)">Regola:</b> {def.rule} <span className="text-(--tg-cream)/40">({def.rule.length}/140)</span> · timer {def.timerSec}s · ingresso {def.input} · un solo telefono: {def.oneDeviceOk ? "sì" : "no"}
          {extras.effect ? ` · effetto: ${extras.effect.note}` : ""}
        </p>
        {lastError && <pre className="overflow-auto rounded-lg bg-(--tg-red)/15 p-2 text-xs text-(--tg-red-hi)">{lastError}</pre>}
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <Surface title="Telefono · 390×844" w={390} h={844} scale={0.8}>
          <div className="h-full overflow-y-auto [&_.tg-player]:[zoom:1]">
            <Player key={`p-${key}`} {...playerProps} />
          </div>
        </Surface>
        <Surface title="PC · 1440×900" w={1440} h={900} scale={0.42}>
          <div className="h-full overflow-y-auto">
            <Player key={`pc-${key}`} {...playerProps} />
          </div>
        </Surface>
        <Surface title="TV · 1920×1080" w={1920} h={1080} scale={0.42} arena>
          <Tv key={`tv-${key}`} {...tvProps} />
        </Surface>
      </div>

      <section className="tg-glass rounded-2xl p-4">
        <h2 className="tg-display mb-3 text-3xl">Esito di score() {stage !== "reveal" && <span className="text-base text-(--tg-cream)/50">(calcolato ora; i tavoli lo vedono al reveal)</span>}</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-(--tg-cream)/50">
            <tr>
              <th className="py-1">Tavolo</th>
              <th>Punti</th>
              <th>Caos</th>
              <th>Esatto</th>
              <th>Precisione</th>
              <th>Esito</th>
              <th>Invio</th>
            </tr>
          </thead>
          <tbody>
            {outcome?.outcomes.map((o) => {
              const t = TEAMS.find((x) => x.teamId === o.teamId)!;
              const subs = submissions.filter((s) => s.teamId === o.teamId);
              return (
                <tr key={o.teamId} className="border-t border-(--tg-cream)/10 align-top">
                  <td className="py-1.5 font-bold">
                    {t.tableNo} · {t.name}
                    {t.teamId === ME.teamId ? " (voi)" : ""} · {t.members.length} tel.
                  </td>
                  <td className="tg-num text-lg">{o.points}</td>
                  <td>{o.chaos}</td>
                  <td>{o.correct === null ? "—" : o.correct ? "sì" : "no"}</td>
                  <td>{o.accuracy === null ? "—" : o.accuracy}</td>
                  <td>{o.label}</td>
                  <td className="max-w-[28rem]">
                    <code className="break-all text-[11px] text-(--tg-cream)/60">{subs.map((s) => `${s.memberId}@${(s.elapsedMs / 1000).toFixed(1)}s ${JSON.stringify(s.payload)}`).join(" | ")}</code>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="tg-glass rounded-2xl p-4">
        <h2 className="tg-display mb-3 text-3xl">Catalogo · {catalog.length} meccaniche</h2>
        <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
          {catalog.map((c) => (
            <button
              key={c.code}
              type="button"
              disabled={c.status !== "implementata"}
              onClick={() => reset({ code: c.code, variant: 0 })}
              className={clsx("flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm", c.status === "implementata" ? "border-(--tg-gold)/50 hover:bg-(--tg-gold)/10" : "border-(--tg-cream)/8 opacity-55")}
              title={`${c.description} · ${c.pointsRule}`}
            >
              <span className="tg-num w-7 text-(--tg-cream)/60">{String(c.number).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1 truncate font-bold">{c.title}</span>
              <span className={clsx("shrink-0 rounded px-1.5 text-[10px] font-extrabold uppercase", c.status === "implementata" ? "bg-(--tg-gold) text-(--tg-ink)" : "bg-(--tg-cream)/10 text-(--tg-cream)/60")}>
                {c.status === "implementata" ? "pronta" : "da fare"}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

const selectCls = "h-10 rounded-lg border border-(--tg-cream)/15 bg-(--tg-night-2) px-2 text-sm font-bold";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-(--tg-cream)/55">{label}</span>
      {children}
    </label>
  );
}

function Btn({ on = false, onClick, children }: { on?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={clsx("h-10 rounded-lg border px-3 text-sm font-extrabold uppercase tracking-wide", on ? "border-(--tg-gold) bg-(--tg-gold) text-(--tg-ink)" : "border-(--tg-cream)/15 bg-(--tg-night-2) hover:border-(--tg-gold)")}>
      {children}
    </button>
  );
}

/** Schermo in scala: il contenuto vive alla risoluzione vera (w×h) e viene rimpicciolito. */
function Surface({ title, w, h, scale, arena = false, children }: { title: string; w: number; h: number; scale: number; arena?: boolean; children: ReactNode }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-xs font-extrabold uppercase tracking-[0.16em] text-(--tg-cream)/55">{title}</figcaption>
      <div style={{ width: w * scale, height: h * scale }} className="overflow-hidden rounded-xl border border-(--tg-cream)/15">
        <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "0 0" }} className={clsx("relative", arena ? "tg-arena-fake" : "bg-(--tg-night)")}>
          {children}
        </div>
      </div>
    </figure>
  );
}
