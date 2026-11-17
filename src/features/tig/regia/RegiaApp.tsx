"use client";

import { clsx } from "clsx";
import { useCallback, useState } from "react";
import { ExitButton } from "@/features/game/components/ExitButton";
import { LoadingSplash } from "@/features/game/components/LoadingSplash";
import { ApiError } from "@/lib/realtime/api-client";
import { isLobby, isTerminal, STATE_LABEL, teamColor } from "@/lib/tig/rules";
import type { RegiaTable, RegiaView, TigAction, TigPublicState } from "@/lib/tig/types";
import { Countdown, CrewFlag, Leaderboard, Logo, StatusPill, Toast, WaxSeal } from "../ui";
import { tigAct, useTig } from "../use-tig";

/**
 * REGIA dell'organizzatore: apertura/blocco della lobby e ingressi tardivi, convalida dei tavoli, roster (capitano,
 * esclusioni, mascotte), via, pausa/ripresa, avanti (skip) e annullamento della prova (rollback) con motivo e
 * audit, durate dei segmenti, dispositivi online, TV, risultati ed esportazione CSV, fine serata.
 * Funziona da PC (consigliato) e da telefono.
 */
export function RegiaApp({ eventId }: { eventId: string }) {
  const { state, view, status, error, applyView, now, refresh } = useTig({ kind: "event", eventId, as: "regia" });
  const [toast, setToast] = useState<{ msg: string; tone: "info" | "error" | "ok" } | null>(null);
  const [busy, setBusy] = useState(false);
  const act = useCallback(
    async (a: TigAction, okMsg?: string) => {
      setBusy(true);
      try {
        const r = await tigAct(eventId, a, "regia");
        applyView(r);
        if (okMsg) setToast({ msg: okMsg, tone: "ok" });
        return true;
      } catch (e) {
        setToast({ msg: e instanceof ApiError ? e.message : "Connessione assente", tone: "error" });
        void refresh();
        return false;
      } finally {
        setBusy(false);
      }
    },
    [eventId, applyView, refresh],
  );
  const clearToast = useCallback(() => setToast(null), []);
  if (error && !state) {
    return (
      <main className="tig-arena !fixed grid place-items-center p-6 text-center">
        <div className="relative flex flex-col items-center gap-4">
          <Logo size="md" />
          <p className="text-xl font-extrabold">{error.message}</p>
          <a href="/taverna-dei-pirati" className="tig-btn">
            Torna al menu
          </a>
        </div>
      </main>
    );
  }
  if (!state || !view || view.role !== "organizer") return <LoadingSplash game="tig" label="Accendo la regia…" />;
  return <RegiaScreen state={state} view={view} now={now} act={act} busy={busy} eventId={eventId} status={status} toast={toast} clearToast={clearToast} />;
}

/** La plancia della regia a partire da stato e vista (esportata anche per il banco di prova /preview/tig/schermate). */
export function RegiaScreen({
  state,
  view,
  now,
  act,
  busy,
  eventId,
  status,
  toast,
  clearToast,
}: {
  state: TigPublicState;
  view: RegiaView;
  now: () => number;
  act: (a: TigAction, ok?: string) => Promise<boolean>;
  busy: boolean;
  eventId: string;
  status: "connecting" | "live" | "reconnecting" | "offline";
  toast: { msg: string; tone: "info" | "error" | "ok" } | null;
  clearToast: () => void;
}) {
  return (
    <div className="min-h-dvh">
      <StatusPill status={status} />
      <RegiaHeader state={state} view={view} />
      <main className="mx-auto grid w-full max-w-[96rem] gap-4 px-3 pb-16 pt-3 lg:grid-cols-[minmax(22rem,30rem)_1fr] lg:px-6">
        <div className="flex flex-col gap-4">
          <Controls state={state} view={view} now={now} act={act} busy={busy} eventId={eventId} />
          <Devices state={state} view={view} />
        </div>
        <Tabs state={state} view={view} act={act} eventId={eventId} />
      </main>
      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDone={clearToast} />
    </div>
  );
}

function RegiaHeader({ state, view }: { state: TigPublicState; view: RegiaView }) {
  const tv = `/taverna-dei-pirati/tv/${encodeURIComponent(view.displayKey)}`;
  return (
    <header className="sticky top-0 z-30 border-b-2 border-[#c9a24a]/45 bg-[repeating-linear-gradient(90deg,rgba(0,0,0,.1)_0_2px,transparent_2px_16px),linear-gradient(180deg,rgba(43,28,16,.96),rgba(26,16,9,.94))] shadow-[0_8px_24px_-12px_rgba(0,0,0,.9)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-[96rem] flex-wrap items-center gap-3 px-3 py-2 lg:px-6">
        <Logo size="sm" className="[&_.tig-logo]:!text-[1.6rem]" />
        <div className="min-w-0">
          <p className="tig-label">Regia</p>
          <p className="truncate text-lg font-extrabold">{state.venue}</p>
        </div>
        <span className={clsx("tig-chip", state.state === "PAUSED" ? "!border-[#f2b134] !text-[#ffd56b]" : isTerminal(state.state) ? "opacity-70" : "!border-[#1fb5a8] !text-[#b5f0e8]")}>{STATE_LABEL[state.state]}</span>
        {state.manche && (
          <span className="tig-chip">
            M{state.manche.no} · prova {state.manche.gameIndex}/{state.manche.gamesTotal}
          </span>
        )}
        <span className="flex-1" />
        <a href={tv} target="_blank" rel="noopener" className="tig-btn !min-h-11 !px-4 !text-lg">
          📺 APRI LA TV
        </a>
        <a href={`${tv}?live=1`} target="_blank" rel="noopener" className="tig-btn tig-btn-ghost !min-h-11 !px-3 !text-base" title="Vista per la diretta: senza QR né codici">
          TV live
        </a>
        <ExitButton to="/taverna-dei-pirati" size="sm" armedLabel="Esci? (la serata resta aperta)" />
      </div>
    </header>
  );
}

function Panel({ title, kicker, children, className, right }: { title: string; kicker?: string; children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <section className={clsx("tig-panel rounded-2xl p-4", className)}>
      <div className="mb-3 flex items-end gap-2">
        <div className="min-w-0 flex-1">
          {kicker && <p className="tig-label">{kicker}</p>}
          <h2 className="tig-title text-[1.9rem] text-[#fff1c9]">{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Controls({ state, view, now, act, busy, eventId }: { state: TigPublicState; view: RegiaView; now: () => number; act: (a: TigAction, ok?: string) => Promise<boolean>; busy: boolean; eventId: string }) {
  const [skipReason, setSkipReason] = useState("");
  const [rbReason, setRbReason] = useState("");
  const [showRb, setShowRb] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const st = state.state;
  const approved = view.tables.filter((t) => t.team?.approved && t.team.status === "active").length;
  const game = view.games.find((g) => g.id === state.game?.id);
  const live = !isLobby(st) && !isTerminal(st);
  return (
    <Panel kicker="Ritmo della serata" title={STATE_LABEL[st]} right={state.timer?.deadlineAt && st !== "PAUSED" ? <Countdown deadlineAt={state.timer.deadlineAt} totalMs={state.timer.totalMs} now={now} size="sm" /> : null}>
      <div className="flex flex-col gap-2">
        {st === "DRAFT" && (
          <>
            <button type="button" className="tig-btn tig-btn-red w-full" disabled={busy} onClick={() => void act({ action: "open_lobby" }, "Lobby aperta: i tavoli possono entrare")}>
              APRI LA LOBBY
            </button>
            <a href={`/taverna-dei-pirati/regia/${eventId}/qr`} target="_blank" rel="noopener" className="tig-btn tig-btn-ghost w-full">
              🖨️ Foglio dei QR da stampare
            </a>
          </>
        )}
        {(st === "LOBBY_OPEN" || st === "LOBBY_LOCKED") && (
          <>
            <button type="button" className="tig-btn tig-btn-red w-full text-2xl" disabled={busy || approved < 2} onClick={() => void act({ action: "start" }, "Si parte!")}>
              ▶ INIZIA LA SERATA
            </button>
            <p className="text-center text-sm font-bold text-[#f6ead2]/75">{approved < 2 ? `Servono almeno 2 tavoli convalidati (ora ${approved})` : `${approved} tavoli convalidati: le mascotte non confermate si assegnano al via`}</p>
            {st === "LOBBY_OPEN" ? (
              <button type="button" className="tig-btn tig-btn-ghost w-full" disabled={busy} onClick={() => void act({ action: "lock_lobby" }, "Lobby bloccata")}>
                🔒 Blocca la lobby
              </button>
            ) : (
              <button type="button" className="tig-btn tig-btn-ghost w-full" disabled={busy} onClick={() => void act({ action: "unlock_lobby" }, "Lobby riaperta")}>
                🔓 Riapri la lobby
              </button>
            )}
            <a href={`/taverna-dei-pirati/regia/${eventId}/qr`} target="_blank" rel="noopener" className="tig-btn tig-btn-ghost w-full">
              🖨️ Foglio dei QR
            </a>
          </>
        )}
        {live && (
          <>
            {state.game && (
              <div className="tg-parch px-3 py-2">
                <p className="text-xs font-black uppercase tracking-widest text-[#6e4116]">{state.game.kind === "caos" ? "Duello del Caos" : state.game.kind === "tiebreak" ? "Spareggio" : `Prova ${state.game.slotNo} · manche ${state.game.mancheNo}`}</p>
                <p className="tig-title truncate text-[1.7rem] text-[#1b1410]">{state.game.title}</p>
                {game && (
                  <p className="text-sm font-bold text-[#4a3420]">
                    Invii: {game.submissions}/{game.expected} · {state.game.stage === "rule" ? "regola a schermo" : state.game.stage === "play" ? "si gioca" : state.game.stage === "reveal" ? "risultati" : "chiusa"}
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {st === "PAUSED" ? (
                <button type="button" className="tig-btn col-span-2 w-full" disabled={busy} onClick={() => void act({ action: "resume" }, "Si riprende")}>
                  ▶ RIPRENDI
                </button>
              ) : (
                <button type="button" className="tig-btn tig-btn-ghost w-full" disabled={busy} onClick={() => void act({ action: "pause", reason: "Pausa tecnica" }, "In pausa: il tempo è fermo")}>
                  ⏸ PAUSA
                </button>
              )}
              {st !== "PAUSED" && (
                <button type="button" className="tig-btn w-full" disabled={busy || !view.canSkip} onClick={() => void act({ action: "skip", reason: skipReason.trim() || undefined }).then((ok) => ok && setSkipReason(""))}>
                  AVANTI ⏭
                </button>
              )}
            </div>
            {st !== "PAUSED" && <input className="tig-input !min-h-11 !text-base" value={skipReason} onChange={(e) => setSkipReason(e.target.value)} placeholder="Motivo dell'avanti (facoltativo, finisce nel registro)" maxLength={200} />}
            {view.canRollback && st !== "PAUSED" && (
              <div className="rounded-xl border border-[#e0483f]/55 bg-[#2a0806]/55 p-2">
                {!showRb ? (
                  <button type="button" className="w-full text-left text-sm font-extrabold text-[#ffb3a7]" onClick={() => setShowRb(true)}>
                    ↩ Annulla e ripeti la prova (rollback)…
                  </button>
                ) : (
                  <form
                    className="flex flex-col gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act({ action: "rollback", reason: rbReason.trim() }, "Prova annullata: punti stornati, si ripete").then((ok) => {
                        if (ok) {
                          setRbReason("");
                          setShowRb(false);
                        }
                      });
                    }}
                  >
                    <p className="text-sm font-bold text-[#f6ead2]/85">Storna i punti della prova e la fa ripartire. Il motivo resta nel registro.</p>
                    <input className="tig-input !min-h-11 !text-base" value={rbReason} onChange={(e) => setRbReason(e.target.value)} placeholder="Motivo (obbligatorio)" maxLength={200} autoFocus />
                    <div className="flex gap-2">
                      <button type="button" className="tig-btn tig-btn-ghost flex-1 !min-h-11 !text-base" onClick={() => setShowRb(false)}>
                        Lascia stare
                      </button>
                      <button type="submit" className="tig-btn tig-btn-red flex-1 !min-h-11 !text-base" disabled={rbReason.trim().length < 3 || busy}>
                        ANNULLA PROVA
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </>
        )}
        {!isTerminal(st) && st !== "DRAFT" && (
          <label className="flex items-center justify-between gap-3 rounded-xl border border-[#c9a24a]/30 bg-black/30 px-3 py-2">
            <span>
              <span className="block font-extrabold">Ingressi tardivi</span>
              <span className="text-xs font-bold text-[#f6ead2]/70">Nuovi tavoli e telefoni anche a lobby chiusa</span>
            </span>
            <input type="checkbox" className="h-6 w-6 accent-[#f2b134]" checked={state.lateJoin} onChange={(e) => void act({ action: "late_join", open: e.target.checked }, e.target.checked ? "Ingressi tardivi aperti" : "Ingressi tardivi chiusi")} />
          </label>
        )}
        {live && st !== "FINAL" && st !== "AWARDS" && (
          <button type="button" className="tig-btn tig-btn-ghost w-full !text-base" disabled={busy} onClick={() => void act({ action: "end_event", reason: "Chiusura anticipata dalla regia" }, "Si va al finale")}>
            🏁 Vai al finale e alla premiazione
          </button>
        )}
        {st === "AWARDS" && (
          <button type="button" className="tig-btn w-full" disabled={busy} onClick={() => void act({ action: "end_event" }, "Serata conclusa")}>
            CONCLUDI LA SERATA
          </button>
        )}
        {!isTerminal(st) && (
          <div className="pt-1">
            {!showCancel ? (
              <button type="button" className="text-xs font-bold text-[#f6ead2]/60 underline" onClick={() => setShowCancel(true)}>
                Annulla la serata…
              </button>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act({ action: "cancel_event", reason: cancelReason.trim() }, "Serata annullata");
                }}
              >
                <input className="tig-input !min-h-11 flex-1 !text-base" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Motivo" maxLength={200} />
                <button type="submit" className="tig-btn tig-btn-red !min-h-11 !px-3 !text-base" disabled={cancelReason.trim().length < 3}>
                  ANNULLA
                </button>
              </form>
            )}
          </div>
        )}
        {isTerminal(st) && <p className="text-center font-bold text-[#f6ead2]/80">{st === "COMPLETED" ? "Serata conclusa: risultati ed esportazione nella scheda «Risultati»." : "Serata annullata."}</p>}
      </div>
    </Panel>
  );
}

function Devices({ state, view }: { state: TigPublicState; view: RegiaView }) {
  const phones = view.tables.reduce((s, t) => s + (t.team?.members.filter((m) => m.status === "active").length ?? 0), 0);
  const online = view.tables.reduce((s, t) => s + (t.team?.online ?? 0), 0);
  return (
    <Panel kicker="Dispositivi" title="Chi è collegato">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="TV" value={view.displayOnline ? "ON" : "OFF"} hot={view.displayOnline} />
        <Stat label="Telefoni online" value={`${online}/${phones}`} hot={online > 0} />
        <Stat label="Tavoli in gara" value={String(state.teams.length)} hot={state.teams.length >= 2} />
      </div>
      {!view.displayOnline && <p className="mt-2 text-sm font-bold text-[#ffd56b]">La TV non è collegata: apri «APRI LA TV» sul televisore del locale (o sul PC collegato).</p>}
    </Panel>
  );
}

/** targa d'ottone: turchese quando è tutto a posto */
function Stat({ label, value, hot }: { label: string; value: string; hot: boolean }) {
  return (
    <div className={clsx("rounded-xl border px-2 py-2 shadow-[inset_0_1px_0_rgba(255,228,160,.1)]", hot ? "border-[#1fb5a8]/70 bg-[#1fb5a8]/12" : "border-[#c9a24a]/30 bg-black/30")}>
      <p className={clsx("tig-display text-3xl tabular-nums", hot ? "text-[#b5f0e8]" : "text-[#f6ead2]")}>{value}</p>
      <p className="text-[11px] font-black uppercase tracking-widest text-[#f6ead2]/70">{label}</p>
    </div>
  );
}

type Tab = "tavoli" | "scaletta" | "registro" | "risultati";

function Tabs({ state, view, act, eventId }: { state: TigPublicState; view: RegiaView; act: (a: TigAction, ok?: string) => Promise<boolean>; eventId: string }) {
  const [tab, setTab] = useState<Tab>("tavoli");
  const tabs: [Tab, string][] = [
    ["tavoli", `Tavoli (${view.tables.filter((t) => t.team).length}/${view.tables.length})`],
    ["scaletta", "Scaletta"],
    ["registro", "Registro"],
    ["risultati", "Risultati"],
  ];
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl border border-[#c9a24a]/40 bg-[linear-gradient(180deg,rgba(43,28,16,.9),rgba(26,16,9,.9))] p-1">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={clsx("tig-display shrink-0 rounded-lg px-4 py-2 text-lg transition", tab === id ? "bg-[linear-gradient(180deg,#ffe597,#f2b134_55%,#cf8a17)] text-[#1b1410] shadow-[inset_0_1px_0_rgba(255,255,255,.6),0_2px_0_#7a4e10]" : "text-[#f6ead2]/80 hover:text-[#ffd56b]")}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "tavoli" && <Roster view={view} act={act} />}
      {tab === "scaletta" && <Schedule state={state} view={view} act={act} />}
      {tab === "registro" && <Log view={view} />}
      {tab === "risultati" && <Results state={state} eventId={eventId} />}
    </div>
  );
}

function Roster({ view, act }: { view: RegiaView; act: (a: TigAction, ok?: string) => Promise<boolean> }) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {view.tables.map((t) => (
        <TableCard key={t.tableId} t={t} act={act} pinMode={view.config.staffPin} />
      ))}
    </div>
  );
}

function TableCard({ t, act, pinMode }: { t: RegiaTable; act: (a: TigAction, ok?: string) => Promise<boolean>; pinMode: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(t.team?.name ?? "");
  const team = t.team;
  return (
    <article className={clsx("tig-panel rounded-2xl p-3", team?.approved && "tig-panel-hot", team?.status === "kicked" && "opacity-50")} aria-label={`Tavolo ${t.tableNo}`}>
      <div className="flex items-center gap-2">
        <CrewFlag color={teamColor(t.tableNo)} n={t.tableNo} className="h-11 w-14 shrink-0 drop-shadow-[0_2px_3px_rgba(0,0,0,.6)]" />
        <div className="min-w-0 flex-1">
          {team ? (
            editing ? (
              <form
                className="flex gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act({ action: "rename_team", teamId: team.teamId, name }, "Nome aggiornato").then((ok) => ok && setEditing(false));
                }}
              >
                <input className="tig-input !min-h-10 !text-base" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} aria-label="Nome della squadra" />
                <button type="submit" className="tig-btn !min-h-10 !px-3 !text-base">
                  OK
                </button>
              </form>
            ) : (
              <p className="truncate text-lg font-extrabold">{team.name}</p>
            )
          ) : (
            <p className="text-lg font-bold text-[#f6ead2]/55">Libero</p>
          )}
          <p className="text-xs font-bold text-[#f6ead2]/70">
            Codice <span className="font-mono tracking-widest text-[#f6ead2]">{t.code}</span>
            {pinMode && t.pin ? (
              <>
                {" "}
                · PIN <span className="font-mono tracking-widest text-[#ffd56b]">{t.pin}</span>
              </>
            ) : null}
            {team ? ` · ${team.score} pt · energia ${team.energy} · liv. ${team.level}` : ""}
          </p>
        </div>
        {team && team.status === "active" && (
          <span className={clsx("tig-chip shrink-0 !text-xs", team.approved ? "!border-[#1fb5a8] !text-[#b5f0e8]" : "!border-[#f2b134]/80 !text-[#ffd56b]")}>
            {team.approved && <WaxSeal mark="check" className="-my-1 -ml-1 h-5 w-5" />}
            {team.approved ? "CONVALIDATO" : "DA CONVALIDARE"}
          </span>
        )}
      </div>
      {team && team.status === "active" && (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" className={clsx("tig-btn !min-h-10 !px-3 !text-base", team.approved && "tig-btn-ghost")} onClick={() => void act({ action: "approve_team", teamId: team.teamId, approved: !team.approved }, team.approved ? "Convalida tolta" : `Tavolo ${t.tableNo} convalidato`)}>
              {team.approved ? "Togli convalida" : "✓ CONVALIDA"}
            </button>
            <button type="button" className="tig-btn tig-btn-ghost !min-h-10 !px-3 !text-sm" onClick={() => setEditing((v) => !v)}>
              Rinomina
            </button>
            <MascotPicker team={team} act={act} />
            <button type="button" className="tig-btn tig-btn-ghost !min-h-10 !px-3 !text-sm !text-[#ffb3a7]" onClick={() => window.confirm(`Escludere il tavolo ${t.tableNo}? I suoi telefoni escono dalla serata.`) && void act({ action: "kick_team", teamId: team.teamId, reason: "Escluso dalla regia" }, "Tavolo escluso")}>
              Escludi
            </button>
          </div>
          <ul className="mt-2 flex flex-col gap-1">
            {team.members
              .filter((m) => m.status === "active")
              .map((m) => (
                <li key={m.memberId} className="flex items-center gap-2 rounded-lg border border-[#c9a24a]/15 bg-black/30 px-2 py-1">
                  <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", m.online ? "bg-[#1fb5a8] shadow-[0_0_6px_#1fb5a8]" : "bg-[#f6ead2]/25")} title={m.online ? "online" : `visto ${new Date(m.lastSeenAt).toLocaleTimeString("it-IT")}`} />
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {m.nickname}
                    {m.isCaptain && <span className="ml-1 rounded bg-[#f2b134] px-1 text-[10px] font-black text-[#1b1410]">CAPITANO</span>}
                  </span>
                  {!m.isCaptain && (
                    <button type="button" className="text-xs font-bold text-[#f6ead2]/75 underline" onClick={() => void act({ action: "set_captain", memberId: m.memberId }, `${m.nickname} è il capitano`)}>
                      capitano
                    </button>
                  )}
                  <button type="button" className="text-xs font-bold text-[#ff8a7a] underline" onClick={() => void act({ action: "kick_member", memberId: m.memberId }, `${m.nickname} tolto`)}>
                    togli
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}
    </article>
  );
}

function MascotPicker({ team, act }: { team: NonNullable<RegiaTable["team"]>; act: (a: TigAction, ok?: string) => Promise<boolean> }) {
  return (
    <select
      className="tig-input !min-h-10 !w-auto !py-0 !text-sm"
      value={team.mascotSlot ?? ""}
      aria-label="Mascotte del tavolo"
      onChange={(e) => {
        const v = e.target.value;
        void act({ action: "assign_mascot", teamId: team.teamId, slot: v === "auto" ? null : Number(v) }, "Mascotte assegnata");
      }}
    >
      <option value="">{team.mascotSlot ? `Mascotte ${team.mascotSlot}` : "Mascotte: voto"}</option>
      <option value="auto">Assegna la più votata</option>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((s) => (
        <option key={s} value={s}>
          Mascotte {s}
        </option>
      ))}
    </select>
  );
}

function Schedule({ state, view, act }: { state: TigPublicState; view: RegiaView; act: (a: TigAction, ok?: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState<Record<string, number>>({});
  const total = view.segments.reduce((s, x) => s + (draft[x.key] ?? x.minutes), 0);
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Panel kicker={`Durata scelta ${view.config.durationMin}′ · totale attuale ${total}′`} title="Segmenti">
        <ul className="flex flex-col gap-1.5">
          {view.segments.map((s) => (
            <li key={s.key} className="flex items-center gap-2 rounded-lg border border-[#c9a24a]/15 bg-black/30 px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate font-bold">{s.label}</span>
              {s.games ? <span className="text-xs font-bold text-[#f6ead2]/65">{s.games} prove</span> : null}
              <input type="number" min={s.key === "break" ? 0 : 1} max={60} className="tig-input !min-h-9 !w-20 !px-2 !text-base" value={draft[s.key] ?? s.minutes} onChange={(e) => setDraft((d) => ({ ...d, [s.key]: Math.max(0, Math.min(60, Number(e.target.value) || 0)) }))} aria-label={`Minuti: ${s.label}`} />
              <span className="text-sm font-bold text-[#f6ead2]/65">′</span>
            </li>
          ))}
        </ul>
        <button type="button" className="tig-btn mt-3 w-full" disabled={!Object.keys(draft).length} onClick={() => void act({ action: "set_segments", segments: draft }, "Durate aggiornate").then((ok) => ok && setDraft({}))}>
          SALVA LE DURATE
        </button>
        <p className="mt-2 text-xs font-bold text-[#f6ead2]/65">Le manche usano il tempo come budget: una prova parte solo se ci sta. La pausa si allunga o accorcia anche mentre è in corso.</p>
      </Panel>
      <Panel kicker={`Catalogo: ${view.catalog.available} minigiochi con contenuti pronti`} title="Prove della serata">
        <ol className="flex flex-col gap-1">
          {view.games.length === 0 && <li className="text-sm font-bold text-[#f6ead2]/70">Le prove si scelgono al momento (senza doppioni, con difficoltà distribuita e tempo che resta).</li>}
          {view.games.map((g) => (
            <li key={g.id} className={clsx("flex items-center gap-2 rounded-lg border px-3 py-1.5", g.id === state.game?.id ? "border-[#f2b134]/60 bg-[#f2b134]/15" : "border-[#c9a24a]/15 bg-black/30", g.status === "voided" && "line-through opacity-50")}>
              <span className="tig-display w-10 text-[#ffd56b]/85">M{g.mancheNo}</span>
              <span className="min-w-0 flex-1 truncate font-bold">
                {g.kind === "caos" ? "⚡ " : g.kind === "tiebreak" ? "⚖ " : ""}
                {g.title}
              </span>
              <span className="text-xs font-bold text-[#f6ead2]/70">
                {g.submissions}/{g.expected}
              </span>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

function Log({ view }: { view: RegiaView }) {
  return (
    <Panel kicker="Ogni comando della regia resta qui (con motivo)" title="Registro">
      <ol className="flex flex-col gap-1">
        {view.log.map((l) => (
          <li key={l.id} className={clsx("flex gap-2 rounded-lg border px-3 py-1.5 text-sm", l.audit ? "border-[#f2b134]/40 bg-[#f2b134]/10" : "border-[#c9a24a]/15 bg-black/30")}>
            <span className="shrink-0 font-mono text-[#f6ead2]/65">{new Date(l.at).toLocaleTimeString("it-IT")}</span>
            <span className="min-w-0 flex-1">
              <span className="font-extrabold">{l.kind}</span>
              {l.fromState && l.toState ? (
                <span className="text-[#f6ead2]/70">
                  {" "}
                  · {l.fromState} → {l.toState}
                </span>
              ) : null}
              {l.reason ? <span className="text-[#ffd56b]"> · «{l.reason}»</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function Results({ state, eventId }: { state: TigPublicState; eventId: string }) {
  return (
    <Panel
      kicker="Classifica condivisa (parità: sfide vinte, precisione, spareggio)"
      title="Risultati"
      right={
        <div className="flex gap-2">
          <a className="tig-btn tig-btn-ghost !min-h-10 !px-3 !text-sm" href={`/api/tig/events/${eventId}/export`}>
            CSV classifica
          </a>
          <a className="tig-btn tig-btn-ghost !min-h-10 !px-3 !text-sm" href={`/api/tig/events/${eventId}/export?tipo=registro`}>
            CSV registro punti
          </a>
        </div>
      }
    >
      {state.teams.length ? <Leaderboard teams={state.teams} /> : <p className="font-bold text-[#f6ead2]/70">Nessun tavolo convalidato.</p>}
    </Panel>
  );
}
