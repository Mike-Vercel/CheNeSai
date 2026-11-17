"use client";

import { clsx } from "clsx";
import { useCallback, useMemo, useRef, useState } from "react";
import { ExitButton } from "@/features/game/components/ExitButton";
import { LoadingSplash } from "@/features/game/components/LoadingSplash";
import { ApiError } from "@/lib/realtime/api-client";
import { POINTS } from "@/lib/tig/rules";
import type { PlayerView, TigAction, TigPublicState } from "@/lib/tig/types";
import { arenaPhase } from "../arena-map";
import { MECHANIC_UIS } from "../games/index";
import type { GameStage as UiStage } from "../games/ui-contract";
import { Countdown, CrewFlag, Doubloon, EnergyBar, Leaderboard, LEVEL_NAME, Logo, PausedBanner, SkullMark, StatusPill, Toast, useSecondsLeft, WaxSeal } from "../ui";
import { newKey, tigAct, useTig } from "../use-tig";
import { TigArena, TigMascot } from "../visuals";

/**
 * TELEFONO / PC DEL GIOCATORE: scheda della squadra (mascotte, livello, Energia Caos, saldo, posizione), voto della
 * mascotte in lobby, la prova in corso con la schermata della meccanica (`MECHANIC_UIS[code].Player`), poteri
 * (scudo, Bottone del Caos), puntata finale. Pulsanti grandi, niente superfluo durante le prove; tastiera sul PC.
 * Tutto è autorevole sul server: qui solo scelte e visualizzazione. Riconnessione automatica (snapshot completo).
 */
export function PlayerApp({ eventId }: { eventId: string }) {
  const { state, view, status, error, applyView, now, refresh } = useTig({
    kind: "event",
    eventId,
    as: "player",
  });
  const [toast, setToast] = useState<{
    msg: string;
    tone: "info" | "error" | "ok";
  } | null>(null);
  const keys = useRef(new Map<string, string>());
  const keyFor = (k: string) => {
    if (!keys.current.has(k)) keys.current.set(k, newKey());
    return keys.current.get(k)!;
  };
  const act = useCallback(
    async (a: TigAction, okMsg?: string): Promise<{ ok: boolean; reason?: string }> => {
      try {
        const r = await tigAct(eventId, a);
        applyView(r);
        if (okMsg) setToast({ msg: okMsg, tone: "ok" });
        return { ok: true };
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : "Connessione assente";
        setToast({ msg, tone: "error" });
        void refresh();
        return { ok: false, reason: msg };
      }
    },
    [eventId, applyView, refresh],
  );
  const clearToast = useCallback(() => setToast(null), []);

  if (error && !state) {
    const lost = error.code === "NOT_MEMBER" || error.code === "KICKED";
    return (
      <main className="tig-arena !fixed grid place-items-center p-6 text-center">
        <div className="relative flex max-w-sm flex-col items-center gap-5">
          <Logo size="md" />
          <p className="text-xl font-extrabold">{error.message}</p>
          {lost ? (
            <a href="/tavoli-in-guerra/entra" className="tig-btn w-full">
              Entra con il codice del tavolo
            </a>
          ) : (
            <p className="text-[#f6ead2]/70">Riprovo…</p>
          )}
        </div>
      </main>
    );
  }
  if (!state || !view || view.role !== "player") return <LoadingSplash game="tig" label="Ti porto al tuo tavolo…" />;
  return <PlayerScreen state={state} view={view} now={now} act={act} keyFor={keyFor} status={status} toast={toast} clearToast={clearToast} />;
}

/** Schermata del giocatore a partire da stato e vista (esportata anche per il banco di prova /preview/tig/schermate). */
export function PlayerScreen({
  state,
  view,
  now,
  act,
  keyFor,
  status,
  toast,
  clearToast,
}: {
  state: TigPublicState;
  view: PlayerView;
  now: () => number;
  act: (a: TigAction, ok?: string) => Promise<{ ok: boolean; reason?: string }>;
  keyFor: (k: string) => string;
  status: "connecting" | "live" | "reconnecting" | "offline";
  toast: { msg: string; tone: "info" | "error" | "ok" } | null;
  clearToast: () => void;
}) {
  const st = state.state;
  const paused = st === "PAUSED";
  const effective = paused ? state.pausedFrom : st;
  const t = view.team;
  const inGame = effective === "GAME_ACTIVE" && !!state.game && !!view.game;
  const closed = state.status === "closed" || st === "CANCELLED";
  const phase = arenaPhase(state);
  return (
    <div className="fixed inset-0 overflow-hidden">
      <TigArena phase={phase} teams={[]} mancheNo={null} title={null} spotlight={null} hosts={[]} now={now} quality="2d" className="opacity-70" />
      <StatusPill status={status} />
      <div className="tig-scroll absolute inset-0 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-3 px-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(.6rem+env(safe-area-inset-top))] lg:max-w-6xl lg:px-6 lg:pt-4">
          <header className="flex items-center gap-2">
            <CrewFlag color={t.color} n={t.tableNo} className="h-9 w-12 shrink-0 drop-shadow-[0_2px_3px_rgba(0,0,0,.6)]" />
            <span className="sr-only">Tavolo {t.tableNo}</span>
            <span className="min-w-0 flex-1 truncate text-lg font-extrabold drop-shadow-[0_1px_2px_rgba(0,0,0,.8)]">{t.name}</span>
            {state.manche && <span className="tig-chip shrink-0 !text-[#ffd56b]">M{state.manche.no}</span>}
            <ExitButton to="/tavoli-in-guerra" size="sm" armedLabel="Esci? (resti in squadra)" className="border border-[#c9a24a]/50" />
          </header>
          {/* telefono: una colonna; PC: scheda squadra, poteri e classifica a sinistra, la prova a destra */}
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(20rem,25rem)_1fr] lg:items-start lg:gap-5">
            <aside className="flex flex-col gap-3 lg:sticky lg:top-4">
              <TeamCard view={view} compact={inGame && !paused} hideRank={state.hideScores || !effective || ["DRAFT", "LOBBY_OPEN", "LOBBY_LOCKED"].includes(effective)} />
              {!closed && !paused && (
                <div className="hidden lg:block">
                  <PowersBar state={state} view={view} act={act} keyFor={keyFor} />
                </div>
              )}
              {!closed && !state.hideScores && state.teams.length > 0 && effective !== "LEADERBOARD" && effective && !["DRAFT", "LOBBY_OPEN", "LOBBY_LOCKED"].includes(effective) && (
                <section className="tig-panel hidden rounded-2xl p-3 lg:block">
                  <p className="tig-label mb-2">Classifica</p>
                  <Leaderboard teams={state.teams} highlight={view.team.teamId} max={8} />
                </section>
              )}
            </aside>
            <div className="flex min-w-0 flex-col gap-3">
              {paused && <PausedBanner />}
              {closed && <ClosedCard state={state} />}
              {!closed && !paused && effective && ["DRAFT", "LOBBY_OPEN", "LOBBY_LOCKED"].includes(effective) && <LobbyCard state={state} view={view} act={act} />}
              {!closed && (effective === "INTRO" || effective === "ROUND_INTRO") && <MancheCard state={state} now={now} paused={paused} />}
              {!closed && inGame && <GameCard state={state} view={view} now={now} act={act} keyFor={keyFor} paused={paused} />}
              {!closed && effective === "GAME_RESULTS" && state.game && view.game && <ResultCard state={state} view={view} now={now} />}
              {!closed && effective === "LEADERBOARD" && <StandingsCard state={state} view={view} />}
              {!closed && effective === "BREAK" && <BreakCard state={state} now={now} paused={paused} />}
              {!closed && (effective === "FINAL" || effective === "AWARDS" || st === "COMPLETED") && <FinalCard state={state} view={view} />}
              {!closed && !paused && (
                <div className="lg:hidden">
                  <PowersBar state={state} view={view} act={act} keyFor={keyFor} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDone={clearToast} />
    </div>
  );
}

function TeamCard({ view, compact, hideRank }: { view: PlayerView; compact: boolean; hideRank: boolean }) {
  const t = view.team;
  return (
    <section className={clsx("tig-panel relative flex items-center gap-3 overflow-hidden rounded-2xl", compact ? "px-3 py-2" : "p-3")} aria-label="La tua squadra">
      {/* il colore della ciurma come una fascia di bandiera in alto */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ background: `linear-gradient(90deg, ${t.color}, ${t.color} 70%, transparent)` }} />
      <TigMascot slot={t.mascotSlot} level={t.level} color={t.color} action="idle" quality="2d" className={clsx("shrink-0", compact ? "w-14 [&>span]:hidden" : "w-24")} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <span className="tig-display text-[2.4rem] tabular-nums leading-none text-[#ffd56b]">{t.score.toLocaleString("it-IT")}</span>
          <span className="text-xs font-black uppercase tracking-widest text-[#f6ead2]/65">punti</span>
          <span className="flex-1" />
          {!hideRank && t.rank && (
            <span className="tig-display text-2xl text-[#ffd56b]">
              {t.rank}°<span className="ml-1 text-xs text-[#f6ead2]/60">posto</span>
            </span>
          )}
        </div>
        {!compact && (
          <p className="mt-0.5 text-xs font-black uppercase tracking-[0.16em] text-[#f6ead2]/70">
            Mascotte {LEVEL_NAME[t.level]} · {t.wins} sfide vinte
            {t.shieldActive ? " · 🛡️ scudo" : ""}
          </p>
        )}
        <EnergyBar progress={t.chaosProgress} level={t.level} energy={t.energy} next={t.nextThreshold} compact={compact} className="mt-1.5" />
      </div>
    </section>
  );
}

function LobbyCard({ state, view, act }: { state: TigPublicState; view: PlayerView; act: (a: TigAction, ok?: string) => Promise<{ ok: boolean }> }) {
  const t = view.team;
  const [name, setName] = useState(t.name);
  const [renaming, setRenaming] = useState(false);
  return (
    <>
      <section className="tg-parch p-4">
        <p className="tig-label">{state.venue}</p>
        <h2 className="tig-title text-[2.2rem] text-[#1b1410]">{state.state === "DRAFT" ? "La lobby apre a breve" : "In attesa del via"}</h2>
        <p className={clsx("mt-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-extrabold", t.approved ? "border-[#0b6e66]/45 bg-[#1fb5a8]/15 text-[#0a4c46]" : "border-[#a06a14]/45 bg-[#f2b134]/20 text-[#5c3a0c]")}>
          {t.approved && <WaxSeal mark="check" className="h-8 w-8 shrink-0" />}
          {t.approved ? "Squadra convalidata dallo staff ✓ Il nome è sulla TV." : "In attesa della convalida dello staff: per ora la TV mostra «TAVOLO " + t.tableNo + "»."}
        </p>
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Telefoni al tavolo">
          {t.members.map((m) => (
            <li key={m.memberId} className={clsx("tig-chip", m.isMe && "!border-[#a06a14] !bg-[#f2b134]/30")}>
              <span className={clsx("h-2 w-2 rounded-full", m.online ? "bg-[#0b8a7f]" : "bg-[#8a5a2b]/45")} />
              {m.nickname}
              {m.isCaptain && <span title="Capitano">©</span>}
            </li>
          ))}
        </ul>
        {view.me.isCaptain && !t.approved && (
          <div className="mt-3">
            {renaming ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act({ action: "captain_rename", name }, "Nome aggiornato").then((r) => r.ok && setRenaming(false));
                }}
              >
                <input className="tig-input !min-h-12 flex-1" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} aria-label="Nome della squadra" />
                <button type="submit" className="tig-btn !min-h-12 !px-4 !text-lg">
                  OK
                </button>
              </form>
            ) : (
              <button type="button" className="text-sm font-bold text-[#4a3420] underline" onClick={() => setRenaming(true)}>
                Cambia il nome della squadra (sei il capitano)
              </button>
            )}
          </div>
        )}
      </section>
      <MascotVote view={view} act={act} />
    </>
  );
}

function MascotVote({ view, act }: { view: PlayerView; act: (a: TigAction, ok?: string) => Promise<{ ok: boolean }> }) {
  const m = view.mascot;
  const t = view.team;
  if (!m.open) {
    return (
      <section className="tig-panel flex items-center gap-3 rounded-2xl p-4">
        <TigMascot slot={t.mascotSlot} level={t.level} color={t.color} action="cheer" quality="2d" className="w-24 shrink-0" />
        <div>
          <p className="tig-label">La vostra mascotte</p>
          <p className="tig-title text-[2.1rem]">Mascotte {t.mascotSlot}</p>
          <p className="text-sm font-bold text-[#f6ead2]/75">Scelta dal voto del tavolo. Evolve con l’Energia Caos.</p>
        </div>
      </section>
    );
  }
  const taken = new Set(m.taken);
  return (
    <section className="tg-parch p-4" aria-label="Voto della mascotte">
      <p className="tig-label">Votate la mascotte del tavolo</p>
      <h2 className="tig-title text-[2.2rem] text-[#1b1410]">Scegli la tua</h2>
      <p className="text-sm font-bold text-[#4a3420]">{m.unique ? "Ogni mascotte va a un solo tavolo: chi conferma prima, la prende." : "Le mascotte possono ripetersi tra i tavoli."} Le 12 mascotte 3D arrivano presto.</p>
      <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((slot) => {
          const votes = m.tally[String(slot)] ?? 0;
          const mine = m.myVote === slot;
          const gone = taken.has(slot);
          return (
            <button
              key={slot}
              type="button"
              disabled={gone}
              onClick={() => void act({ action: "vote_mascot", slot })}
              aria-pressed={mine}
              aria-label={`Mascotte ${slot}${gone ? ", già presa" : ""}${votes ? `, ${votes} voti` : ""}`}
              className={clsx("relative flex flex-col items-center rounded-xl border-2 p-1 transition active:scale-95", mine ? "border-[#a06a14] bg-[#f2b134]/30 shadow-[0_0_0_2px_rgba(242,177,52,.45)]" : "border-[#8a5a2b]/35 bg-[#0b1f2a]/85", gone && "opacity-30")}
            >
              <TigMascot slot={slot} level={1} color={t.color} action="idle" quality="2d" className="w-full [&>span]:hidden" />
              {votes > 0 && <span className="absolute right-1 top-1 grid h-6 min-w-6 place-items-center rounded-full border border-[#5c120e] bg-[radial-gradient(circle_at_35%_30%,#ea6a5f,#c8312b_55%,#7e1a14)] px-1 text-[12px] font-black text-[#fff4e6] shadow-[0_2px_3px_rgba(0,0,0,.4)]">{votes}</span>}
            </button>
          );
        })}
      </div>
      {m.canConfirm ? (
        <button type="button" className="tig-btn tig-btn-red mt-3 w-full" disabled={!Object.keys(m.tally).length} onClick={() => void act({ action: "confirm_mascot" }, "Mascotte confermata!")}>
          CONFERMA LA PIÙ VOTATA
        </button>
      ) : (
        <p className="mt-3 text-center text-sm font-bold text-[#4a3420]">La conferma il capitano (o arriva da sola al via).</p>
      )}
    </section>
  );
}

function MancheCard({ state, now, paused }: { state: TigPublicState; now: () => number; paused: boolean }) {
  return (
    <section className="tg-parch tig-pop flex flex-col items-center gap-3 p-5 text-center">
      {state.state === "INTRO" || state.pausedFrom === "INTRO" ? (
        <>
          <p className="tig-label">Si comincia</p>
          <p className="tig-title text-[2.8rem] text-[#1b1410]">Guardate la TV!</p>
        </>
      ) : (
        <>
          <p className="tig-label">Manche {state.manche?.no} di 5</p>
          <p className="tig-display text-[clamp(2.2rem,10vw,3.4rem)] font-black text-[#7e1a14]">{state.manche?.title}</p>
          <p className="font-bold text-[#2b1d12]">{state.manche?.tagline}</p>
        </>
      )}
      <Countdown deadlineAt={state.timer?.deadlineAt ?? null} totalMs={state.timer?.totalMs ?? null} now={now} size="md" paused={paused} />
    </section>
  );
}

function GameCard({
  state,
  view,
  now,
  act,
  keyFor,
  paused,
}: {
  state: TigPublicState;
  view: PlayerView;
  now: () => number;
  act: (a: TigAction, ok?: string) => Promise<{ ok: boolean; reason?: string }>;
  keyFor: (k: string) => string;
  paused: boolean;
}) {
  const g = state.game!;
  const pv = view.game!;
  const ui = MECHANIC_UIS[g.code];
  const myRef = useMemo(
    () => ({
      teamId: view.team.teamId,
      tableNo: view.team.tableNo,
      members: view.team.members.map((m) => m.memberId),
      captainId: view.team.members.find((m) => m.isCaptain)?.memberId ?? null,
    }),
    [view.team],
  );
  const submit = useCallback(
    async (payload: unknown) =>
      act({
        action: "submit",
        gameId: g.id,
        payload,
        idempotencyKey: keyFor(`submit:${g.id}`),
      }),
    [act, g.id, keyFor],
  );
  const caos = g.kind === "caos";
  if (!pv.participant) {
    const names = g.participants.map((id) => state.teams.find((t) => t.teamId === id)).filter(Boolean);
    return (
      <section className={clsx("tig-panel tig-pop flex flex-col items-center gap-2 rounded-2xl p-5 text-center", caos && "!border-[#e0483f]/80")}>
        {caos && <SkullMark className="tig-strobe h-14 w-14 text-[#f6ead2]" />}
        <p className={clsx(caos ? "tig-display tig-strobe text-4xl font-black text-[#ff8a7a]" : g.kind === "tiebreak" ? "tig-display text-4xl" : "tig-title text-[2.6rem]")}>{caos ? "ALLARME CAOS!" : g.kind === "tiebreak" ? "SPAREGGIO" : g.title}</p>
        <p className="text-lg font-bold">{names.map((t) => `T${t!.tableNo}`).join(" contro ")}: guardate la TV, tocca a loro.</p>
        <Countdown deadlineAt={g.stage === "rule" ? g.startsAt : g.deadlineAt} totalMs={g.stage === "rule" ? null : g.timerMs} now={now} size="sm" paused={paused} />
      </section>
    );
  }
  if (g.stage === "rule") {
    // la regola della prova: un foglio di pergamena (ALLARME CAOS! in rosso, col teschio)
    return (
      <section className={clsx("tg-parch tig-pop flex flex-col items-center gap-3 p-5 text-center", caos && "shadow-[inset_0_0_0_2px_rgba(200,49,43,.7),inset_0_0_30px_rgba(200,49,43,.35),0_18px_40px_-18px_rgba(0,0,0,.85)]")}>
        {caos && (
          <p className="tig-display tig-strobe flex items-center gap-2 text-5xl font-black text-[#9c231e]">
            <SkullMark className="h-12 w-12 shrink-0 text-[#f6ead2]" />
            ALLARME CAOS!
          </p>
        )}
        <p className="tig-label">{caos ? "Duello · 45 secondi · +50 a chi vince" : g.kind === "tiebreak" ? "Spareggio · 45 secondi" : `Prova ${g.slotNo} · manche ${g.mancheNo}`}</p>
        <p className="tig-title text-[clamp(2.4rem,11vw,3.4rem)] text-[#1b1410]">{g.title}</p>
        <p className="text-lg font-bold text-[#2b1d12]">{g.rule}</p>
        <p className="text-sm font-black uppercase tracking-widest text-[#6e4116]">Si parte tra</p>
        <Countdown deadlineAt={g.startsAt} totalMs={null} now={now} size="md" paused={paused} />
        {pv.bet.allowed && <BetPanel view={view} gameId={g.id} act={act} keyFor={keyFor} />}
      </section>
    );
  }
  const stage: UiStage = g.stage === "reveal" ? "reveal" : g.stage === "locked" || paused ? "locked" : "play";
  // la schermata del minigioco ha già titolo e timer (alcune prove, come TEMPO FANTASMA, non devono mostrare il tempo)
  return (
    <section className="flex flex-col gap-3" aria-label={g.title}>
      {caos && <p className="tig-chip self-center !border-[#e0483f]/80 !text-[#ffb3a7]">⚡ Duello del Caos · +50 a chi vince</p>}
      {pv.bet.allowed && <BetPanel view={view} gameId={g.id} act={act} keyFor={keyFor} />}
      {pv.bet.amount !== null && <p className="rounded-xl border border-[#f2b134]/50 bg-[#f2b134]/12 px-3 py-2 text-center text-sm font-extrabold text-[#ffd56b]">Puntata del tavolo: {pv.bet.amount} punti</p>}
      {ui ? (
        <div className="tig-game-slot -mx-3 sm:mx-0">
        <ui.Player
          view={g.view}
          memberView={pv.memberView}
          stage={stage}
          deadlineAt={Date.parse(g.deadlineAt)}
          now={now}
          canSubmit={pv.canSubmit}
          submitted={pv.submitted}
          submit={submit}
          myTeam={myRef}
          reveal={null}
          myOutcome={null}
        />
        </div>
      ) : (
        <p className="tig-panel rounded-2xl p-4 text-center font-bold text-[#f6ead2]/80">Questo minigioco si gioca guardando la TV.</p>
      )}
    </section>
  );
}

function BetPanel({ view, gameId, act, keyFor }: { view: PlayerView; gameId: string; act: (a: TigAction, ok?: string) => Promise<{ ok: boolean }>; keyFor: (k: string) => string }) {
  const cap = view.game?.bet.cap ?? 0;
  const [amount, setAmount] = useState(Math.min(50, cap));
  return (
    <div className="w-full rounded-xl border-2 border-[#a06a14]/60 bg-[#f2b134]/15 p-3 text-left shadow-[inset_0_0_0_1px_rgba(255,240,200,.35)]">
      <p className="tig-label">Puntata finale (irrevocabile)</p>
      <p className="text-sm font-bold text-[#2b1d12]">
        Massimo {cap} punti: il 25% del saldo, mai oltre {POINTS.betMaxAbs}. Risposta giusta = li vinci, sbagliata = li perdi.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <input type="range" min={0} max={cap} step={5} value={Math.min(amount, cap)} onChange={(e) => setAmount(Number(e.target.value))} className="h-8 flex-1 accent-[#a06a14]" aria-label="Punti da puntare" />
        <output className="tig-display w-16 text-right text-3xl font-black tabular-nums text-[#1b1410]">{Math.min(amount, cap)}</output>
      </div>
      <button
        type="button"
        className="tig-btn mt-2 w-full"
        onClick={() =>
          void act(
            {
              action: "bet",
              gameId,
              amount: Math.min(amount, cap),
              idempotencyKey: keyFor(`bet:${gameId}`),
            },
            "Puntata registrata",
          )
        }
      >
        PUNTA {Math.min(amount, cap)}
      </button>
    </div>
  );
}

function ResultCard({ state, view, now }: { state: TigPublicState; view: PlayerView; now: () => number }) {
  const g = state.game!;
  const pv = view.game!;
  const ui = MECHANIC_UIS[g.code];
  const out = pv.outcome;
  const won = g.kind !== "regular" && g.winnerTeamId === view.team.teamId;
  const myRef = {
    teamId: view.team.teamId,
    tableNo: view.team.tableNo,
    members: view.team.members.map((m) => m.memberId),
    captainId: null,
  };
  return (
    <section className="flex flex-col gap-3">
      {/* il reveal della meccanica mostra già l'esito della squadra: il riquadro serve solo ai duelli e senza schermata */}
      {pv.participant && (g.kind !== "regular" || !ui) ? (
        <div className={clsx("tig-panel tig-pop flex flex-col items-center rounded-2xl px-4 py-3 text-center", (out?.correct || won) && "tig-panel-hot")}>
          <p className="tig-label">{g.kind === "caos" ? "Duello del Caos" : "Il vostro esito"}</p>
          {(out?.points ?? 0) > 0 ? (
            <Doubloon className="my-1 h-20 min-w-20 px-2 text-[2.4rem]">+{out!.points}</Doubloon>
          ) : (
            <p className="tig-display text-5xl tabular-nums text-[#f6ead2]/85">{out?.points ?? 0}</p>
          )}
          <p className="font-bold text-[#f6ead2]/90">{won ? "Duello vinto!" : (out?.label ?? "Nessuna risposta")}</p>
          {out?.transfers?.map((tr, i) => (
            <p key={i} className="text-sm font-bold text-[#f6ead2]/70">
              {tr.reason} {tr.points ? `(${tr.points > 0 ? "+" : ""}${tr.points})` : ""}
            </p>
          ))}
        </div>
      ) : !pv.participant ? (
        <p className="tig-panel rounded-2xl p-4 text-center font-bold text-[#f6ead2]/80">Risultato del duello sulla TV.</p>
      ) : null}
      {ui && pv.participant && (
        <div className="tig-game-slot -mx-3 sm:mx-0">
        <ui.Player
          view={g.view}
          memberView={pv.memberView}
          stage="reveal"
          deadlineAt={Date.parse(g.deadlineAt)}
          now={now}
          canSubmit={false}
          submitted={pv.submitted}
          submit={async () => ({ ok: false })}
          myTeam={myRef}
          reveal={g.reveal}
          myOutcome={out}
        />
        </div>
      )}
      {state.spotlight?.kind === "evolve" && state.spotlight.teamIds.includes(view.team.teamId) && (
        <p className="tig-pop rounded-2xl border-2 border-[#f2b134] bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,213,107,.45),rgba(160,106,20,.2)_70%)] px-4 py-3 text-center text-xl font-extrabold text-[#fff1c9] shadow-[0_0_40px_-8px_rgba(242,177,52,.8)]">La vostra mascotte è evoluta: {LEVEL_NAME[view.team.level]}!</p>
      )}
    </section>
  );
}

function StandingsCard({ state, view }: { state: TigPublicState; view: PlayerView }) {
  return (
    <section className="tig-panel rounded-2xl p-4">
      <p className="tig-label">Classifica</p>
      {state.hideScores ? (
        <p className="mt-2 font-bold text-[#f6ead2]/85">Classifica buia: il saldo lo vedete solo voi. Si scopre tutto alla fine.</p>
      ) : (
        <Leaderboard teams={state.teams} highlight={view.team.teamId} max={8} className="mt-2" />
      )}
    </section>
  );
}

function BreakCard({ state, now, paused }: { state: TigPublicState; now: () => number; paused: boolean }) {
  const left = useSecondsLeft(state.breakEndsAt, now, !paused);
  return (
    <section className="tg-parch flex flex-col items-center gap-2 p-5 text-center">
      <p className="tig-display text-5xl font-black text-[#7e1a14]">PAUSA</p>
      <p className="font-bold text-[#2b1d12]">Ordini, bagno, strategia. Si riparte con IL GRANDE INGANNO.</p>
      {left !== null && (
        <p className="tig-display text-4xl font-black tabular-nums text-[#1b1410]">
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
        </p>
      )}
    </section>
  );
}

function FinalCard({ state, view }: { state: TigPublicState; view: PlayerView }) {
  const done = state.state === "AWARDS" || state.state === "COMPLETED";
  const winner = state.awards?.order.at(-1);
  const won = done && winner === view.team.teamId;
  return (
    <section className="tig-panel tig-panel-hot flex flex-col items-center gap-3 rounded-2xl p-5 text-center">
      {won && <Doubloon className="h-16 w-16 text-3xl">1</Doubloon>}
      <p className="tig-led text-[2.6rem] leading-none">{done ? (won ? "AVETE VINTO!" : "PREMIAZIONE") : "TUTTO O NIENTE!"}</p>
      {view.team.rank && (
        <p className="text-xl font-extrabold">
          Siete al {view.team.rank}° posto con {view.team.score.toLocaleString("it-IT")} punti
        </p>
      )}
      {done && <Leaderboard teams={state.teams} highlight={view.team.teamId} max={12} />}
      {state.state === "COMPLETED" && (
        <a href="/tavoli-in-guerra" className="tig-btn tig-btn-ghost w-full">
          Torna al menu
        </a>
      )}
    </section>
  );
}

function ClosedCard({ state }: { state: TigPublicState }) {
  return (
    <section className="tg-parch flex flex-col items-center gap-3 p-5 text-center" role="alert">
      <p className="tig-title text-[2.6rem] text-[#1b1410]">Serata chiusa</p>
      <p className="font-bold text-[#2b1d12]">{state.closeReason === "abandoned" ? "La regia e la TV non si sono più collegate." : "Lo staff ha chiuso la serata."}</p>
      <a href="/tavoli-in-guerra" className="tig-btn w-full">
        Torna al menu
      </a>
    </section>
  );
}

/** Poteri: scudo (manche 2–4, uno per manche) e Bottone del Caos (una volta per serata, nelle finestre). */
function PowersBar({ state, view, act, keyFor }: { state: TigPublicState; view: PlayerView; act: (a: TigAction, ok?: string) => Promise<{ ok: boolean }>; keyFor: (k: string) => string }) {
  const [picking, setPicking] = useState(false);
  const m = state.manche?.no ?? 0;
  if (m < 2 || m > 4) return null;
  const caos = view.caos;
  return (
    <section className="tig-panel flex flex-col gap-3 rounded-2xl p-3" aria-label="Poteri">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={clsx("tig-btn !min-h-[3.75rem] !px-2 !text-lg", view.shield.active ? "tig-btn-ghost !border-[#1fb5a8] !text-[#b5f0e8] shadow-[0_0_24px_-6px_rgba(31,181,168,.7)]" : "tig-btn-ghost")}
          disabled={!view.shield.canActivate}
          onClick={() => void act({ action: "shield", idempotencyKey: keyFor(`shield:${m}`) }, "Scudo attivo fino a fine manche")}
          title={view.shield.reason ?? undefined}
        >
          🛡️ {view.shield.active ? "SCUDO ATTIVO" : "SCUDO"}
        </button>
        <button
          type="button"
          className={clsx("tig-btn tig-btn-caos !min-h-[3.75rem] !px-2 !text-lg", caos.available && "tig-pulse")}
          disabled={!caos.available}
          onClick={() => setPicking((p) => !p)}
          title={caos.reason ?? undefined}
        >
          <SkullMark className="h-7 w-7 shrink-0 text-[#f6ead2]" />
          {view.team.caosUsed ? "CAOS USATO" : "BOTTONE DEL CAOS"}
        </button>
      </div>
      {(caos.reason || view.shield.reason) && !picking && <p className="text-center text-xs font-bold text-[#f6ead2]/70">{caos.reason ?? view.shield.reason}</p>}
      {picking && caos.available && (
        <div className="tig-pop flex flex-col gap-2">
          <p className="tig-label text-center">Chi sfidate? Duello identico di 45 secondi, +50 a chi vince</p>
          <div className="grid grid-cols-2 gap-2">
            {caos.targets.map((t) => (
              <button
                key={t.teamId}
                type="button"
                disabled={!t.allowed}
                title={t.why ?? undefined}
                onClick={() => {
                  setPicking(false);
                  void act({
                    action: "caos",
                    targetTeamId: t.teamId,
                    idempotencyKey: keyFor(`caos:${t.teamId}`),
                  });
                }}
                className="flex flex-col items-start rounded-xl border-2 border-[#e0483f]/60 bg-[linear-gradient(180deg,rgba(126,26,20,.55),rgba(42,8,6,.8))] px-3 py-2 text-left disabled:opacity-35"
              >
                <span className="tig-display text-xl">TAVOLO {t.tableNo}</span>
                <span className="w-full truncate text-sm font-bold text-[#f6ead2]/85">{t.allowed ? t.name : t.why}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
