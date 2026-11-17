"use client";

import { clsx } from "clsx";
import { useEffect, useMemo, useState, type RefObject } from "react";
import { LoadingSplash } from "@/features/game/components/LoadingSplash";
import { getSoundEngine } from "@/features/media/audio-engine";
import type { LobbyTable, PublicTeam, TigPublicState } from "@/lib/tig/types";
import { arenaHostsFor, arenaPhase, arenaTeams, arenaTitle } from "../arena-map";
import { MECHANIC_UIS } from "../games/index";
import type { GameStage as UiStage } from "../games/ui-contract";
import { Countdown, Leaderboard, Logo, PausedBanner, QrCode, useSecondsLeft } from "../ui";
import { useTick, useTig } from "../use-tig";
import { useTigMusic } from "../music";
import { getTigVoice, useSpeech, useTigShowAudio } from "../voice";
import { awardsRevealAt, detectVisualQuality, TigArena } from "../visuals";

/**
 * TV DEL LOCALE (chiave dello schermo, nessun account): l'arena 3D a tutto schermo e sopra l'HUD dello show.
 * Regola di regia: ogni fase ha UN padrone del centro dello schermo, mai due testi sovrapposti.
 *  - L'ARENA (schermo LED, torri, presentatori, podio) racconta: apertura, titolo della manche e della prova,
 *    ALLARME CAOS e duelli, evoluzioni, classifica, pausa, TUTTO O NIENTE!, podio della premiazione.
 *    L'HUD aggiunge solo quello che il LED non dice (piano della serata, regola, cronometro), in basso.
 *  - L'HUD (QR dei tavoli, schermata del minigioco, reveal, classifica buia) prende il centro e il LED passa
 *    in modalità d'ambiente (luce senza testo).
 * Voce e sottotitoli dei presentatori (sempre i sottotitoli). `live`: vista per la diretta, senza QR né codici.
 */
export function TvApp({ displayKey, live }: { displayKey: string; live: boolean }) {
  const { state, lobby, error, now } = useTig({ kind: "tv", displayKey, live });
  useTigShowAudio(state, { voiced: true, source: { key: displayKey } });
  useTigMusic(state, true);
  const speech = useSpeech();
  const [quality] = useState(detectVisualQuality);
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => getSoundEngine().subscribe((s) => setUnlocked(s.unlocked)), []);

  if (error && !state) {
    return (
      <main className="tig-arena !fixed grid place-items-center p-8 text-center">
        <div className="relative flex flex-col items-center gap-5">
          <Logo size="xl" />
          <p className="text-3xl font-bold">{error.code === "NOT_FOUND" ? "Schermo non valido: riaprilo dalla regia." : "Connessione assente: riprovo…"}</p>
        </div>
      </main>
    );
  }
  if (!state) return <LoadingSplash game="tig" label="Accendo l'arena…" />;
  return <TvShow state={state} lobby={lobby} live={live} now={now} quality={quality} speech={speech} unlocked={unlocked} />;
}

function TvShow({
  state,
  lobby,
  live,
  now,
  quality,
  speech,
  unlocked,
}: {
  state: TigPublicState;
  lobby: LobbyTable[] | null;
  live: boolean;
  now: () => number;
  quality: ReturnType<typeof detectVisualQuality>;
  speech: ReturnType<typeof useSpeech>;
  unlocked: boolean;
}) {
  const phase = arenaPhase(state);
  const { title, subtitle } = arenaTitle(state);
  const paused = state.state === "PAUSED";
  const st = paused ? state.pausedFrom : state.state;
  const teams = useMemo(() => arenaTeams(state), [state]);
  const mouth = getTigVoice().mouth as RefObject<number>;
  const lobbyPhase = phase === "lobby";
  // in lobby la TV mostra i QR: niente presentatori sopra le schede dei tavoli
  const hosts = lobbyPhase && !live ? [] : arenaHostsFor(state, speech.who, speech.audible ? mouth : undefined);
  const closed = state.status === "closed" && state.state !== "COMPLETED";
  const lobbyState = st === "DRAFT" || st === "LOBBY_OPEN" || st === "LOBBY_LOCKED";
  // chi ha il centro dello schermo (vedi in cima): qui l'HUD, altrimenti l'arena
  const hudCenter =
    closed ||
    paused ||
    (st === "GAME_ACTIVE" && state.game?.stage !== "rule") ||
    (st === "GAME_RESULTS" && state.spotlight?.kind !== "evolve") ||
    (st === "LEADERBOARD" && state.hideScores);
  const qrLobby = lobbyState && state.accessMode === "qr" && !live && !!lobby;
  const led = lobbyState
    ? { title: "TAVOLI IN GUERRA!", subtitle: st === "DRAFT" ? "La lobby apre tra poco" : qrLobby ? "Scansiona il QR del tuo tavolo" : "Chiedi allo staff il codice della squadra" }
    : st === "GAME_ACTIVE" && state.game?.kind === "regular"
      ? { title, subtitle: state.manche ? `Prova ${state.game.slotNo} di ${state.manche.gamesTotal}` : `Prova ${state.game.slotNo}` }
      : { title, subtitle };
  // inizio della fase sull'orologio del server: podio 3D e classifica finale dell'HUD si svelano insieme
  const phaseStartedAt = state.state === "COMPLETED" ? 0 : !paused && state.timer?.startedAt ? Date.parse(state.timer.startedAt) : null;
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#06070c]">
      <TigArena
        phase={phase}
        teams={(lobbyPhase && !live) || state.hideScores ? [] : teams}
        mancheNo={hudCenter ? null : (state.manche?.no ?? null)}
        title={hudCenter ? null : led.title}
        subtitle={hudCenter ? null : led.subtitle}
        spotlight={state.spotlight}
        hosts={hosts}
        now={now}
        quality={quality}
        ledwall={hudCenter ? "ambient" : "auto"}
        phaseStartedAt={phaseStartedAt}
        // premiazione: la classifica finale dell'HUD sta a sinistra, il podio si inquadra nel resto dello schermo
        safeArea={phase === "awards" ? { left: 0.42, top: 0.08, right: 0.02, bottom: 0.1 } : { left: 0, top: 0, right: 0, bottom: 0 }}
        className="absolute inset-0"
      />
      {/* il testo dello schermo LED è disegnato nella scena: lo stesso testo per i lettori di schermo */}
      {!hudCenter && (led.title || led.subtitle) && (
        <p className="sr-only" aria-live="polite">
          {[led.title, led.subtitle].filter(Boolean).join(" · ")}
        </p>
      )}
      <div className="absolute inset-0 flex flex-col">
        <TopStrip state={state} live={live} />
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-[3vmin] pb-[17vmin]">
          {closed ? (
            <div className="tig-panel flex flex-col items-center gap-3 rounded-3xl px-[6vmin] py-[4vmin] text-center" role="alert">
              <Logo size="lg" />
              <p className="tig-display text-[7vmin]">Serata chiusa</p>
            </div>
          ) : paused ? (
            <PausedBanner big />
          ) : lobbyState ? (
            <LobbyHud state={state} lobby={lobby} live={live} />
          ) : st === "INTRO" ? (
            <IntroHud state={state} now={now} />
          ) : st === "ROUND_INTRO" ? (
            <MancheHud state={state} now={now} />
          ) : st === "GAME_ACTIVE" ? (
            <GameHud state={state} now={now} />
          ) : st === "GAME_RESULTS" ? (
            <ResultsHud state={state} now={now} />
          ) : st === "LEADERBOARD" ? (
            <LeaderboardHud state={state} />
          ) : st === "BREAK" ? (
            <BreakHud state={state} now={now} />
          ) : st === "FINAL" ? (
            <FinalHud />
          ) : st === "AWARDS" || state.state === "COMPLETED" ? (
            <AwardsHud state={state} now={now} />
          ) : null}
        </div>
      </div>
      <Captions speech={speech} />
      {!unlocked && (
        <button type="button" className="tig-chip tig-pulse absolute right-[2vmin] top-[9vmin] z-30 !border-[#ffb020]/70 !px-4 !py-2 !text-base" onClick={() => void getSoundEngine().unlock()}>
          🔊 Tocca per attivare voce e musica
        </button>
      )}
    </div>
  );
}

function TopStrip({ state, live }: { state: TigPublicState; live: boolean }) {
  return (
    <div className="relative z-20 flex items-center gap-[1.5vmin] px-[2vmin] pt-[1.6vmin]">
      <Logo size="sm" className="[&_.tig-logo]:!text-[3.2vmin]" />
      <span className="tig-chip !text-[1.6vmin]">{state.venue}</span>
      {state.manche && !["FINAL", "AWARDS", "COMPLETED"].includes(state.state) && (
        <span className="tig-chip !border-[#ffb020]/50 !text-[1.6vmin] !text-[#ffd15c]">
          MANCHE {state.manche.no} · {state.manche.title}
          {state.manche.gameIndex > 0 ? ` · PROVA ${Math.min(state.manche.gameIndex, state.manche.gamesTotal)}/${state.manche.gamesTotal}` : ""}
        </span>
      )}
      {state.game && state.state === "GAME_ACTIVE" && state.game.kind !== "regular" && (
        <span className="tig-chip tig-pulse !border-[#ff2d3d]/70 !text-[1.7vmin] !text-[#ffb3ba]">{state.game.kind === "caos" ? "⚡ DUELLO DEL CAOS · +50 A CHI VINCE" : "⚖ SPAREGGIO · 45 SECONDI"}</span>
      )}
      <span className="flex-1" />
      {!live && (state.state === "LOBBY_OPEN" || state.lateJoin) && <span className="tig-chip !text-[1.5vmin]">Ingresso aperto</span>}
    </div>
  );
}

function Captions({ speech }: { speech: ReturnType<typeof useSpeech> }) {
  if (!speech.caption) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[1.5vmin] z-30 flex justify-center px-[4vmin]" aria-live="polite">
      <p className="tig-rise max-w-[86vw] rounded-2xl bg-black/80 px-[2.4vmin] py-[1.2vmin] text-center text-[clamp(1rem,2.9vmin,2.4rem)] font-bold leading-snug shadow-2xl ring-1 ring-white/10">
        <span className="mr-2 font-black uppercase tracking-wider text-[#ffb020]">{speech.name}:</span>
        {speech.caption}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------
function LobbyHud({ state, lobby, live }: { state: TigPublicState; lobby: LobbyTable[] | null; live: boolean }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const qr = state.accessMode === "qr" && !live && lobby;
  // il titolo e l'istruzione sono sullo schermo LED: qui solo i QR, in basso, al massimo due righe
  const n = lobby?.length ?? 0;
  const cols = n <= 6 ? Math.max(3, n) : n <= 12 ? 6 : Math.ceil(n / 2); // fino a 24 tavoli: al massimo 2 righe
  const qrSize = n <= 6 ? "max-w-[19vmin]" : n <= 12 ? "max-w-[13vmin]" : "max-w-[9vmin]";
  return (
    <div className="flex h-full w-full flex-col items-center justify-end gap-[2vmin]">
      {qr && (
        <div className="grid w-[min(94vw,170vmin)] gap-[1.4vmin]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {lobby!.map((t) => (
            <div key={t.tableNo} className={clsx("tig-panel flex flex-col items-center gap-[0.6vmin] rounded-2xl p-[1vmin]", t.approved && "tig-panel-hot")}>
              <div className="flex w-full items-center justify-between">
                <span className="tig-display text-[3vmin]">TAVOLO {t.tableNo}</span>
                <span className="font-mono text-[1.7vmin] font-bold tracking-[0.2em] text-white/70">{t.code}</span>
              </div>
              <QrCode text={`${origin}/tavoli-in-guerra/t/${t.token}`} className={clsx("w-full", qrSize)} label={`QR del tavolo ${t.tableNo}`} />
              <span className="w-full truncate text-center text-[1.8vmin] font-extrabold text-white/85">{t.teamName ?? (t.members ? "In attesa di convalida" : "Libero")}</span>
            </div>
          ))}
        </div>
      )}
      {!qr && <TeamsWall teams={state.teams} pending={state.pendingTeams} />}
      {!live && (
        <p className="text-[2vmin] font-bold text-white/60">
          Oppure: <span className="font-black text-white">{origin.replace(/^https?:\/\//, "")}/tavoli-in-guerra/entra</span> · {state.teams.length} tavoli convalidati
          {state.pendingTeams ? ` · ${state.pendingTeams} in attesa` : ""}
        </p>
      )}
    </div>
  );
}

function TeamsWall({ teams, pending }: { teams: PublicTeam[]; pending: number }) {
  return (
    <div className="flex flex-col items-center gap-[1.6vmin]">
      <div className="flex max-w-[90vw] flex-wrap justify-center gap-[1.2vmin]">
        {teams.map((t) => (
          <div key={t.teamId} className="tig-panel tig-pop flex items-center gap-[1vmin] rounded-2xl px-[1.6vmin] py-[1vmin]" style={{ boxShadow: `inset 0 -4px 0 ${t.color}` }}>
            <span className="tig-display text-[2.6vmin] text-white/70">T{t.tableNo}</span>
            <span className="text-[2.6vmin] font-extrabold">{t.name}</span>
          </div>
        ))}
      </div>
      {pending > 0 && <p className="text-[2vmin] font-bold text-white/55">{pending} tavoli in attesa di convalida</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Apertura, manche
// ---------------------------------------------------------------------------
function IntroHud({ state, now }: { state: TigPublicState; now: () => number }) {
  return (
    // piano della serata e cronometro su una riga bassa: il centro resta al LED e ai presentatori
    <div className="flex h-full w-full items-end justify-center gap-[1.6vmin]">
      <ol className="flex gap-[1.2vmin]">
        {state.plan.map((p) => (
          <li key={p.mancheNo} className="tig-panel tig-rise flex w-[19vmin] items-center gap-[1vmin] rounded-2xl px-[1.2vmin] py-[0.9vmin] text-left" style={{ animationDelay: `${p.mancheNo * 0.15}s` }}>
            <span className="tig-display text-[4.2vmin] leading-none text-[#ffb020]">{p.mancheNo}</span>
            <span className="flex min-w-0 flex-col">
              <span className="tig-display truncate text-[2vmin] leading-tight">{p.title}</span>
              <span className="text-[1.5vmin] font-bold text-white/60">
                {p.games} prove · {p.minutes}′
              </span>
            </span>
          </li>
        ))}
      </ol>
      <Countdown deadlineAt={state.timer?.deadlineAt ?? null} totalMs={state.timer?.totalMs ?? null} now={now} size="md" />
    </div>
  );
}

function MancheHud({ state, now }: { state: TigPublicState; now: () => number }) {
  const m = state.manche!;
  return (
    <div className="flex h-full w-full items-end justify-center gap-[1.6vmin] text-center">
      <p className="tig-chip mb-[2vmin] !text-[2.2vmin]">
        Manche {m.no} di 5 · {m.gamesTotal} prove
      </p>
      <Countdown deadlineAt={state.timer?.deadlineAt ?? null} totalMs={state.timer?.totalMs ?? null} now={now} size="md" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prova, risultati
// ---------------------------------------------------------------------------
/** I due tavoli del duello (nomi a schermo, mai pronunciati): le torri e il VS li mostra l'arena. */
function DuelNames({ state }: { state: TigPublicState }) {
  const [a, b] = (state.game?.participants ?? []).map((id) => state.teams.find((t) => t.teamId === id));
  const side = (t: PublicTeam | undefined) =>
    t ? (
      <span className="tig-panel flex items-center gap-[1vmin] rounded-2xl px-[1.6vmin] py-[0.8vmin]" style={{ boxShadow: `inset 0 -4px 0 ${t.color}` }}>
        <span className="tig-display text-[3vmin]">T{t.tableNo}</span>
        <span className="max-w-[30vmin] truncate text-[2.4vmin] font-extrabold text-white/85">{t.name}</span>
      </span>
    ) : null;
  return (
    <div className="flex items-center gap-[2vmin]">
      {side(a)}
      <span className="tig-display text-[4vmin] text-[#ff2d3d]">VS</span>
      {side(b)}
    </div>
  );
}

function GameHud({ state, now }: { state: TigPublicState; now: () => number }) {
  const g = state.game!;
  const ui = MECHANIC_UIS[g.code];
  const caos = g.kind === "caos";
  if (g.stage === "rule") {
    // titolo sullo schermo LED (ALLARME CAOS! e il VS sulle torri dei due tavoli): qui regola e cronometro, in basso
    return (
      <div className="flex h-full w-full items-end justify-center gap-[2vmin] text-center">
        <div className="flex flex-col items-center gap-[1.4vmin]">
        {caos ? (
          <>
            <DuelNames state={state} />
            <p className="tig-panel rounded-3xl px-[3vmin] py-[1.4vmin] text-[3vmin] font-bold">Duello identico di 45 secondi · chi vince prende +50</p>
          </>
        ) : (
          <>
            {g.kind === "tiebreak" && <p className="tig-chip !text-[2vmin]">SPAREGGIO · 45 SECONDI</p>}
            <p className="tig-panel max-w-[72vw] rounded-3xl px-[3vmin] py-[1.6vmin] text-[3.4vmin] font-bold">{g.rule}</p>
            {g.betEnabled && <p className="text-[2.6vmin] font-extrabold text-[#ffd15c]">Puntata finale aperta: fino al 25% del saldo, mai oltre 250</p>}
          </>
        )}
        </div>
        <Countdown deadlineAt={g.startsAt} totalMs={null} now={now} size="lg" />
      </div>
    );
  }
  const stage: UiStage = g.stage === "reveal" ? "reveal" : g.stage === "locked" ? "locked" : "play";
  const tvTeams = state.teams
    .filter((t) => g.participants.includes(t.teamId))
    .map((t) => ({
      teamId: t.teamId,
      tableNo: t.tableNo,
      name: t.name,
      color: t.color,
      submitted: g.submittedTeamIds.includes(t.teamId),
    }));
  // la schermata del minigioco occupa tutto il palco (titolo, timer quando serve, invii dei tavoli): niente
  // cronometro del core sopra (TEMPO FANTASMA, per esempio, non deve mostrare il tempo)
  if (ui) return <GameStage>{<ui.Tv view={g.view} stage={stage} deadlineAt={Date.parse(g.deadlineAt)} now={now} teams={tvTeams} reveal={null} outcome={null} />}</GameStage>;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[2vmin]">
      <p className={clsx("tig-display text-[5vmin]", caos && "text-[#ff6b78]")}>{caos ? "DUELLO DEL CAOS" : g.title}</p>
      <p className="text-[3vmin] font-bold">Guardate i telefoni!</p>
      <SubmittedRow teams={tvTeams} />
    </div>
  );
}

/** Palco della schermata del minigioco: contenitore posizionato a tutta area tra la barra in alto e le postazioni. */
function GameStage({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-x-[1.5vmin] bottom-[16vmin] top-0 flex items-center justify-center [container-type:size]" data-tig-game-stage>
      {/* le schermate dei minigiochi sono pensate in 16:9 (unità cqw): il palco resta 16:9 dentro lo spazio libero */}
      <div className="tig-pop relative" style={{ width: "min(100cqw, 177.78cqh)", aspectRatio: "16 / 9" }}>
        {children}
      </div>
    </div>
  );
}

function SubmittedRow({
  teams,
}: {
  teams: {
    teamId: string;
    tableNo: number;
    color: string;
    submitted: boolean;
  }[];
}) {
  return (
    <div className="flex flex-wrap justify-center gap-[1vmin]">
      {teams.map((t) => (
        <span key={t.teamId} className={clsx("tig-chip !text-[1.9vmin] transition", t.submitted ? "!border-[#7cff4f]/70 !bg-[#7cff4f]/15" : "opacity-60")} style={{ borderColor: t.submitted ? undefined : t.color }}>
          T{t.tableNo} {t.submitted ? "✓" : "…"}
        </span>
      ))}
    </div>
  );
}

function ResultsHud({ state, now }: { state: TigPublicState; now: () => number }) {
  const g = state.game;
  if (!g) return null;
  const ui = MECHANIC_UIS[g.code];
  const tvTeams = state.teams
    .filter((t) => g.participants.includes(t.teamId))
    .map((t) => ({
      teamId: t.teamId,
      tableNo: t.tableNo,
      name: t.name,
      color: t.color,
      submitted: g.submittedTeamIds.includes(t.teamId),
    }));
  const evolve = state.spotlight?.kind === "evolve" ? state.spotlight : null;
  if (evolve) {
    const t = state.teams.find((x) => x.teamId === evolve.teamIds[0]);
    // il primo piano sulla mascotte e la scritta EVOLUZIONE! sono dell'arena: qui solo la spiegazione
    if (t)
      return (
        <div className="flex h-full w-full flex-col items-center justify-end text-center">
          <p className="tig-panel rounded-3xl px-[3vmin] py-[1.4vmin] text-[2.6vmin] font-bold text-white/85">L’Energia Caos fa evolvere la mascotte. I punti non c’entrano.</p>
        </div>
      );
  }
  const outs = (g.outcome?.outcomes ?? []).map((o) => ({ o, t: state.teams.find((x) => x.teamId === o.teamId) })).filter((x) => x.t);
  // il reveal della meccanica (soluzione, spiegazione, esiti per tavolo) a tutto palco; per i duelli si annuncia il vincitore
  if (ui && g.kind === "regular") return <GameStage>{<ui.Tv view={g.view} stage="reveal" deadlineAt={Date.parse(g.deadlineAt)} now={now} teams={tvTeams} reveal={g.reveal} outcome={g.outcome} />}</GameStage>;
  return (
    <div className="flex w-full flex-col items-center gap-[2vmin]">
      {g.kind !== "regular" && g.winnerTeamId ? (
        <p className="tig-led tig-slam text-[9vmin]">VINCE IL TAVOLO {state.teams.find((t) => t.teamId === g.winnerTeamId)?.tableNo}!</p>
      ) : (
        <p className="tig-display text-[5vmin] text-[#ffd15c]">{g.title} · RISULTATI</p>
      )}
      <div className="flex flex-wrap justify-center gap-[1vmin]">
        {outs.map(({ o, t }) => (
          <div
            key={o.teamId}
            className={clsx("tig-panel tig-rise flex items-center gap-[1vmin] rounded-xl px-[1.4vmin] py-[0.8vmin]", o.points > 0 && "tig-panel-hot")}
            style={{ boxShadow: `inset 0 -3px 0 ${t!.color}` }}
          >
            <span className="tig-display text-[2.4vmin] text-white/70">T{t!.tableNo}</span>
            <span className={clsx("tig-display text-[3vmin] tabular-nums", o.points > 0 ? "text-[#7cff4f]" : "text-white/60")}>{o.points > 0 ? `+${o.points}` : o.points}</span>
            <span className="text-[1.7vmin] font-bold text-white/70">{o.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaderboardHud({ state }: { state: TigPublicState }) {
  if (state.hideScores) {
    return (
      <div className="flex flex-col items-center gap-[2vmin] text-center">
        <p className="tig-led text-[11vmin]">CLASSIFICA BUIA</p>
        <p className="max-w-[60vw] text-[3vmin] font-bold text-white/75">Ogni tavolo vede solo il proprio saldo. Si scopre tutto alla premiazione.</p>
      </div>
    );
  }
  // la classifica è sullo schermo LED e sulle torri dell'arena (qui anche come lista per i lettori di schermo)
  return (
    <div className="flex h-full w-full flex-col items-center justify-end">
      <div className="sr-only">
        <Leaderboard teams={state.teams} max={state.teams.length} />
      </div>
      {state.caosWindow && <p className="tig-panel tig-rise rounded-2xl px-[2.4vmin] py-[1vmin] text-center text-[2.4vmin] font-extrabold text-[#ff8a95]">Finestra del Bottone del Caos aperta: chi osa?</p>}
    </div>
  );
}

function BreakHud({ state, now }: { state: TigPublicState; now: () => number }) {
  const left = useSecondsLeft(state.breakEndsAt, now);
  return (
    <div className="flex h-full w-full flex-col items-center justify-end gap-[1vmin] text-center">
      {left !== null && (
        <p className="tig-display text-[9vmin] leading-none tabular-nums text-[#ffd15c] drop-shadow-[0_4px_24px_rgba(0,0,0,.9)]">
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
        </p>
      )}
      <p className="tig-panel rounded-2xl px-[2.4vmin] py-[1vmin] text-[2.6vmin] font-bold text-white/85">Ordini, respiro, strategia. Poi: IL GRANDE INGANNO.</p>
    </div>
  );
}

function FinalHud() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-end text-center">
      <p className="tig-panel rounded-3xl px-[3vmin] py-[1.4vmin] text-[3vmin] font-bold text-white/85">Le prove sono finite. Tra pochi secondi la classifica, dall’ultimo al primo.</p>
    </div>
  );
}

/**
 * Premiazione: classifica finale a sinistra, dal fondo alla vetta, con lo STESSO calendario del podio 3D
 * (`awardsRevealAt`): prima i tavoli fuori dal podio, poi 3°, 2° e 1° nel momento in cui salgono sul podio dell'arena.
 */
function AwardsHud({ state, now }: { state: TigPublicState; now: () => number }) {
  useTick(true, 250);
  const order = state.awards?.order ?? [];
  const n = order.length;
  const started = Date.parse(state.timer?.startedAt ?? state.serverNow);
  const elapsed = now() - started;
  const done = state.state === "COMPLETED";
  const byId = new Map(state.teams.map((t) => [t.teamId, t]));
  // `order` va dall'ultimo al primo: il tavolo i è in posizione n - i dall'alto
  const revealed = order
    .filter((_, i) => done || elapsed >= awardsRevealAt(n - i, n))
    .map((id) => byId.get(id))
    .filter(Boolean) as PublicTeam[];
  const winner = n > 0 && revealed.length === n ? byId.get(order[n - 1]) : null;
  const compact = n > 8;
  return (
    <div className="flex h-full w-full items-center justify-start">
      <div className="flex w-[min(40vw,74vmin)] flex-col gap-[0.8vmin] rounded-3xl bg-[#06070c]/80 p-[1.8vmin] backdrop-blur-sm">
        <p className={clsx("tig-led leading-none", winner ? "tig-slam text-[7vmin]" : "text-[5vmin]")}>{winner ? "CAMPIONI!" : "CLASSIFICA FINALE"}</p>
        {winner && (
          <p className="tig-display truncate text-[3.4vmin] text-[#ffd15c]">
            TAVOLO {winner.tableNo} · {winner.name}
          </p>
        )}
        <div className="flex flex-col-reverse gap-[0.7vmin]">
          {revealed.slice(-12).map((t) => (
            <div
              key={t.teamId}
              className={clsx("tig-panel tig-rise flex items-center gap-[1.2vmin] rounded-2xl px-[1.4vmin]", compact ? "py-[0.4vmin]" : "py-[0.9vmin]", t.rank === 1 && "tig-panel-hot")}
              style={{ boxShadow: `inset 6px 0 0 ${t.color}` }}
            >
              <span className={clsx("tig-display w-[3ch] text-center", compact ? "text-[3vmin]" : "text-[4vmin]", t.rank === 1 ? "text-[#ffd15c]" : "text-white/70")}>{t.rank}°</span>
              <span className="tig-display text-[2.4vmin] text-white/70">T{t.tableNo}</span>
              <span className={clsx("min-w-0 flex-1 truncate font-extrabold", compact ? "text-[2.3vmin]" : "text-[2.8vmin]")}>{t.name}</span>
              <span className={clsx("tig-display tabular-nums", compact ? "text-[3vmin]" : "text-[3.6vmin]")}>{(t.score ?? 0).toLocaleString("it-IT")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
