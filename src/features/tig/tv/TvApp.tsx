"use client";

import { clsx } from "clsx";
import { useEffect, useMemo, useState, type RefObject } from "react";
import { LoadingSplash } from "@/features/game/components/LoadingSplash";
import { getSoundEngine } from "@/features/media/audio-engine";
import type { LobbyTable, PublicTeam, TigPublicState } from "@/lib/tig/types";
import { arenaHostsFor, arenaPhase, arenaTeams, arenaTitle } from "../arena-map";
import { MECHANIC_UIS } from "../games/index";
import type { GameStage as UiStage } from "../games/ui-contract";
import { Countdown, Leaderboard, LEVEL_NAME, Logo, PausedBanner, QrCode, useSecondsLeft } from "../ui";
import { useTick, useTig } from "../use-tig";
import { getTigVoice, useSpeech, useTigShowAudio } from "../voice";
import { detectVisualQuality, TigArena, TigMascot } from "../visuals";

/**
 * TV DEL LOCALE (chiave dello schermo, nessun account): l'arena a tutto schermo e sopra l'HUD dello show —
 * lobby con i QR dei tavoli, apertura, intro delle manche, prova (`MECHANIC_UIS[code].Tv`), reveal, classifica
 * animata (posizioni condivise), ALLARME CAOS, duelli, evoluzioni, pausa, finale, premiazione dal fondo alla vetta.
 * Voce e sottotitoli dei presentatori (sempre i sottotitoli). `live`: vista per la diretta, senza QR né codici.
 */
export function TvApp({ displayKey, live }: { displayKey: string; live: boolean }) {
  const { state, lobby, error, now } = useTig({ kind: "tv", displayKey, live });
  useTigShowAudio(state, { voiced: true, source: { key: displayKey } });
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

function TvShow({ state, lobby, live, now, quality, speech, unlocked }: { state: TigPublicState; lobby: LobbyTable[] | null; live: boolean; now: () => number; quality: ReturnType<typeof detectVisualQuality>; speech: ReturnType<typeof useSpeech>; unlocked: boolean }) {
  const phase = arenaPhase(state);
  const { title, subtitle } = arenaTitle(state);
  const paused = state.state === "PAUSED";
  const st = paused ? state.pausedFrom : state.state;
  const teams = useMemo(() => arenaTeams(state), [state]);
  const mouth = getTigVoice().mouth as RefObject<number>;
  const hosts = arenaHostsFor(state, speech.who, speech.audible ? mouth : undefined);
  // l'HUD della prova si prende il centro: il ledwall resta vuoto e le postazioni scendono in basso
  const hudOwnsTitle = st === "GAME_ACTIVE" || st === "GAME_RESULTS" || st === "LEADERBOARD" || st === "AWARDS" || st === "COMPLETED" || st === "FINAL" || (st && ["LOBBY_OPEN", "LOBBY_LOCKED", "DRAFT"].includes(st) && !live);
  const closed = state.status === "closed" && state.state !== "COMPLETED";
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#06070c]">
      <TigArena phase={phase} teams={teams} mancheNo={state.manche?.no ?? null} title={hudOwnsTitle ? null : title} subtitle={hudOwnsTitle ? null : subtitle} spotlight={state.spotlight} hosts={hosts} now={now} quality={quality} safeArea={{ left: 0, top: 0, right: 0, bottom: 0.0 }} />
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
          ) : st === "DRAFT" || st === "LOBBY_OPEN" || st === "LOBBY_LOCKED" ? (
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
            <FinalHud state={state} />
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
      {state.manche && (
        <span className="tig-chip !border-[#ffb020]/50 !text-[1.6vmin] !text-[#ffd15c]">
          MANCHE {state.manche.no} · {state.manche.title}
          {state.manche.gameIndex > 0 ? ` · PROVA ${Math.min(state.manche.gameIndex, state.manche.gamesTotal)}/${state.manche.gamesTotal}` : ""}
        </span>
      )}
      <span className="flex-1" />
      {!live && (state.state === "LOBBY_OPEN" || state.lateJoin) && <span className="tig-chip !text-[1.5vmin]">Ingresso aperto</span>}
    </div>
  );
}

function Captions({ speech }: { speech: ReturnType<typeof useSpeech> }) {
  if (!speech.caption) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[2vmin] z-30 flex justify-center px-[4vmin]" aria-live="polite">
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
  const cols = lobby ? Math.min(6, Math.max(3, Math.ceil(lobby.length / 2))) : 4;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[2.4vmin]">
      <div className="flex items-end gap-[3vmin]">
        <Logo size="xl" />
      </div>
      <p className="tig-display text-center text-[4.2vmin] text-[#ffd15c]">{state.state === "DRAFT" ? "La lobby apre tra poco" : qr ? "Scansiona il QR del tuo tavolo" : "Chiedi allo staff il codice della tua squadra"}</p>
      {qr && (
        <div className="grid w-[min(94vw,170vmin)] gap-[1.4vmin]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {lobby!.map((t) => (
            <div key={t.tableNo} className={clsx("tig-panel flex flex-col items-center gap-[0.6vmin] rounded-2xl p-[1vmin]", t.approved && "tig-panel-hot")}>
              <div className="flex w-full items-center justify-between">
                <span className="tig-display text-[3vmin]">TAVOLO {t.tableNo}</span>
                <span className="font-mono text-[1.7vmin] font-bold tracking-[0.2em] text-white/70">{t.code}</span>
              </div>
              <QrCode text={`${origin}/tavoli-in-guerra/t/${t.token}`} className="w-full max-w-[19vmin]" label={`QR del tavolo ${t.tableNo}`} />
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
    <div className="flex flex-col items-center gap-[3vmin]">
      <div className="tig-slam">
        <Logo size="xl" tagline />
      </div>
      <ol className="flex gap-[1.4vmin]">
        {state.plan.map((p) => (
          <li key={p.mancheNo} className="tig-panel tig-rise flex w-[24vmin] flex-col items-center rounded-2xl px-[1vmin] py-[1.4vmin] text-center" style={{ animationDelay: `${p.mancheNo * 0.15}s` }}>
            <span className="tig-display text-[5vmin] text-[#ffb020]">{p.mancheNo}</span>
            <span className="tig-display text-[2.2vmin] leading-tight">{p.title}</span>
            <span className="text-[1.6vmin] font-bold text-white/60">
              {p.games} prove · {p.minutes}′
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
    <div className="flex flex-col items-center gap-[2vmin] text-center">
      <p className="tig-display tig-rise text-[5vmin] text-white/70">MANCHE {m.no} DI 5</p>
      <p key={m.no} className="tig-led tig-slam text-[13vmin] leading-none">
        {m.title}
      </p>
      <p className="tig-rise max-w-[70vw] text-[3vmin] font-bold text-white/80" style={{ animationDelay: ".3s" }}>
        {m.tagline}
      </p>
      <p className="tig-chip !text-[2vmin]">{m.gamesTotal} prove</p>
      <Countdown deadlineAt={state.timer?.deadlineAt ?? null} totalMs={state.timer?.totalMs ?? null} now={now} size="md" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prova, risultati
// ---------------------------------------------------------------------------
function DuelBanner({ state, label }: { state: TigPublicState; label: string }) {
  const [a, b] = (state.game?.participants ?? []).map((id) => state.teams.find((t) => t.teamId === id));
  const side = (t: PublicTeam | undefined, delay: string) =>
    t ? (
      <div className="tig-rise flex flex-col items-center gap-[1vmin]" style={{ animationDelay: delay }}>
        <TigMascot slot={t.mascotSlot} level={t.mascotLevel} color={t.color} action="attack" quality="2d" className="w-[22vmin]" />
        <span className="tig-display text-[5vmin]">TAVOLO {t.tableNo}</span>
        <span className="max-w-[30vmin] truncate text-[2.4vmin] font-extrabold text-white/80">{t.name}</span>
      </div>
    ) : null;
  return (
    <div className="flex items-center gap-[4vmin]">
      {side(a, "0s")}
      <span className="tig-display tig-pulse text-[9vmin] text-[#ff2d3d] drop-shadow-[0_0_30px_rgba(255,45,61,.8)]">{label}</span>
      {side(b, ".2s")}
    </div>
  );
}

function GameHud({ state, now }: { state: TigPublicState; now: () => number }) {
  const g = state.game!;
  const ui = MECHANIC_UIS[g.code];
  const caos = g.kind === "caos";
  if (g.stage === "rule") {
    return (
      <div className="flex flex-col items-center gap-[2.4vmin] text-center">
        {caos ? (
          <>
            <p className="tig-display tig-strobe text-[13vmin] leading-none text-[#ff4d5c] drop-shadow-[0_0_40px_rgba(255,45,61,.9)]">ALLARME CAOS!</p>
            <div className="relative flex items-center justify-center">
              <DuelBanner state={state} label="VS" />
            </div>
            <p className="text-[3vmin] font-bold text-white/85">Duello identico di 45 secondi · chi vince prende +50</p>
          </>
        ) : (
          <>
            <p className="tig-chip !text-[2vmin]">{g.kind === "tiebreak" ? "SPAREGGIO · 45 SECONDI" : `PROVA ${g.slotNo} · MANCHE ${g.mancheNo}`}</p>
            <p className="tig-led tig-slam text-[11vmin] leading-none">{g.title}</p>
            <p className="tig-panel max-w-[72vw] rounded-3xl px-[3vmin] py-[1.6vmin] text-[3.4vmin] font-bold">{g.rule}</p>
            {g.betEnabled && <p className="text-[2.6vmin] font-extrabold text-[#ffd15c]">Puntata finale aperta: fino al 25% del saldo, mai oltre 250</p>}
          </>
        )}
        <Countdown deadlineAt={g.startsAt} totalMs={null} now={now} size="lg" />
      </div>
    );
  }
  const stage: UiStage = g.stage === "reveal" ? "reveal" : g.stage === "locked" ? "locked" : "play";
  const tvTeams = state.teams.filter((t) => g.participants.includes(t.teamId)).map((t) => ({ teamId: t.teamId, tableNo: t.tableNo, name: t.name, color: t.color, submitted: g.submittedTeamIds.includes(t.teamId) }));
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[2vmin]">
      <div className="flex w-full items-center justify-center gap-[3vmin]">
        <p className={clsx("tig-display text-[5vmin]", caos && "text-[#ff6b78]")}>{caos ? "DUELLO DEL CAOS" : g.title}</p>
        <Countdown deadlineAt={g.deadlineAt} totalMs={g.timerMs} now={now} size="lg" />
      </div>
      {ui ? <ui.Tv view={g.view} stage={stage} deadlineAt={Date.parse(g.deadlineAt)} now={now} teams={tvTeams} reveal={null} outcome={null} /> : <p className="text-[3vmin] font-bold">Guardate i telefoni!</p>}
      <SubmittedRow teams={tvTeams} />
    </div>
  );
}

function SubmittedRow({ teams }: { teams: { teamId: string; tableNo: number; color: string; submitted: boolean }[] }) {
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
  const tvTeams = state.teams.filter((t) => g.participants.includes(t.teamId)).map((t) => ({ teamId: t.teamId, tableNo: t.tableNo, name: t.name, color: t.color, submitted: g.submittedTeamIds.includes(t.teamId) }));
  const evolve = state.spotlight?.kind === "evolve" ? state.spotlight : null;
  if (evolve) {
    const t = state.teams.find((x) => x.teamId === evolve.teamIds[0]);
    if (t)
      return (
        <div className="flex flex-col items-center gap-[2vmin] text-center">
          <p className="tig-led tig-slam text-[12vmin]">EVOLUZIONE!</p>
          <TigMascot slot={t.mascotSlot} level={t.mascotLevel} color={t.color} action="evolve" quality="2d" className="w-[34vmin]" />
          <p className="tig-display text-[5vmin]">
            TAVOLO {t.tableNo} · {LEVEL_NAME[t.mascotLevel]}
          </p>
          <p className="text-[2.6vmin] font-bold text-white/70">L’Energia Caos fa evolvere la mascotte. I punti non c’entrano.</p>
        </div>
      );
  }
  const outs = (g.outcome?.outcomes ?? []).map((o) => ({ o, t: state.teams.find((x) => x.teamId === o.teamId) })).filter((x) => x.t);
  return (
    <div className="flex w-full flex-col items-center gap-[2vmin]">
      {g.kind !== "regular" && g.winnerTeamId ? (
        <p className="tig-led tig-slam text-[9vmin]">VINCE IL TAVOLO {state.teams.find((t) => t.teamId === g.winnerTeamId)?.tableNo}!</p>
      ) : (
        <p className="tig-display text-[5vmin] text-[#ffd15c]">{g.title} · RISULTATI</p>
      )}
      {ui && <ui.Tv view={g.view} stage="reveal" deadlineAt={Date.parse(g.deadlineAt)} now={now} teams={tvTeams} reveal={g.reveal} outcome={g.outcome} />}
      <div className="flex flex-wrap justify-center gap-[1vmin]">
        {outs.map(({ o, t }) => (
          <div key={o.teamId} className={clsx("tig-panel tig-rise flex items-center gap-[1vmin] rounded-xl px-[1.4vmin] py-[0.8vmin]", o.points > 0 && "tig-panel-hot")} style={{ boxShadow: `inset 0 -3px 0 ${t!.color}` }}>
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
  return (
    <div className="flex w-[min(80vw,120vmin)] flex-col gap-[1.6vmin]">
      <p className="tig-led text-center text-[8vmin]">CLASSIFICA</p>
      <Leaderboard teams={state.teams} size="lg" max={state.teams.length > 8 ? 8 : 12} highlight={state.teams.find((t) => t.rank === 1)?.teamId} />
      {state.caosWindow && <p className="tig-rise text-center text-[2.4vmin] font-extrabold text-[#ff8a95]">Finestra del Bottone del Caos aperta: chi osa?</p>}
    </div>
  );
}

function BreakHud({ state, now }: { state: TigPublicState; now: () => number }) {
  const left = useSecondsLeft(state.breakEndsAt, now);
  return (
    <div className="flex w-full items-center justify-center gap-[5vmin]">
      <div className="flex flex-col items-center gap-[1.6vmin] text-center">
        <p className="tig-led text-[14vmin] leading-none">PAUSA</p>
        {left !== null && (
          <p className="tig-display text-[10vmin] tabular-nums text-[#ffd15c]">
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
          </p>
        )}
        <p className="text-[2.8vmin] font-bold text-white/75">Ordini, respiro, strategia. Poi: IL GRANDE INGANNO.</p>
      </div>
      {!state.hideScores && state.teams.length > 0 && (
        <div className="w-[min(46vw,80vmin)]">
          <Leaderboard teams={state.teams} max={8} />
        </div>
      )}
    </div>
  );
}

function FinalHud({ state }: { state: TigPublicState }) {
  return (
    <div className="flex flex-col items-center gap-[2vmin] text-center">
      <p className="tig-led tig-slam text-[12vmin] leading-none">TUTTO O NIENTE!</p>
      <p className="text-[3.2vmin] font-bold text-white/80">Le prove sono finite. Tra pochi secondi la classifica, dall’ultimo al primo.</p>
      <div className="flex gap-[2vmin]">
        {state.teams.map((t) => (
          <TigMascot key={t.teamId} slot={t.mascotSlot} level={t.mascotLevel} color={t.color} action="idle" quality="2d" className="w-[12vmin] [&>span]:hidden" />
        ))}
      </div>
    </div>
  );
}

/** Premiazione: dal fondo alla vetta, un tavolo ogni 3,5 secondi; il vincitore per ultimo, con la sua mascotte. */
function AwardsHud({ state, now }: { state: TigPublicState; now: () => number }) {
  useTick(true, 500);
  const order = state.awards?.order ?? [];
  const started = Date.parse(state.timer?.startedAt ?? state.serverNow);
  const shown = state.state === "COMPLETED" ? order.length : Math.min(order.length, Math.floor((now() - started) / 3500) + 1);
  const byId = new Map(state.teams.map((t) => [t.teamId, t]));
  const revealed = order.slice(0, shown).map((id) => byId.get(id)).filter(Boolean) as PublicTeam[];
  const winnerShown = shown >= order.length && order.length > 0;
  const winner = winnerShown ? byId.get(order[order.length - 1]) : null;
  return (
    <div className="flex w-full items-center justify-center gap-[4vmin]">
      <div className="flex w-[min(52vw,90vmin)] flex-col-reverse gap-[1vmin]">
        {revealed.map((t) => (
          <div key={t.teamId} className={clsx("tig-panel tig-rise flex items-center gap-[1.4vmin] rounded-2xl px-[1.6vmin] py-[1vmin]", t.rank === 1 && "tig-panel-hot")} style={{ boxShadow: `inset 6px 0 0 ${t.color}` }}>
            <span className={clsx("tig-display w-[3ch] text-center text-[4.4vmin]", t.rank === 1 ? "text-[#ffd15c]" : "text-white/70")}>{t.rank}°</span>
            <span className="tig-display text-[2.6vmin] text-white/70">T{t.tableNo}</span>
            <span className="min-w-0 flex-1 truncate text-[3vmin] font-extrabold">{t.name}</span>
            <span className="tig-display text-[4vmin] tabular-nums">{(t.score ?? 0).toLocaleString("it-IT")}</span>
          </div>
        ))}
      </div>
      <div className="flex w-[34vmin] flex-col items-center gap-[1.4vmin] text-center">
        {winner ? (
          <>
            <p className="tig-led tig-slam text-[7vmin] leading-none">CAMPIONI!</p>
            <TigMascot slot={winner.mascotSlot} level={winner.mascotLevel} color={winner.color} action="win" quality="2d" className="w-[30vmin]" />
            <p className="tig-display text-[4.4vmin]">TAVOLO {winner.tableNo}</p>
            <p className="text-[2.8vmin] font-extrabold text-[#ffd15c]">{winner.name}</p>
          </>
        ) : (
          <p className="tig-led tig-pulse text-[7vmin]">E IL VINCITORE È…</p>
        )}
      </div>
    </div>
  );
}
