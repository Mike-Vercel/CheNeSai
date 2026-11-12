"use client";

import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { LoadingSplash } from "@/features/game/components/LoadingSplash";
import { getSoundEngine } from "@/features/media/audio-engine";
import { DIFFICULTY_LABEL, type PsycoPublicState } from "@/lib/psyco/types";
import { AudioPanel, Captions, usePsycoAudio } from "./audio";
import { CallNotice, CallsChip } from "./InvestigatorCall";
import { PsycoNarratorSlot } from "./NarratorSlot";
import { ScreenHostControls, useScreenHost } from "./ScreenHost";
import { usePsyco } from "./use-psyco";
import { BigTimer, CountdownOverlay, EventFlash, joinUrl, Lens, LinkBadge, PlayerList, Progress, PsycoLogo, QrCode, RoundResult } from "./ui";

/**
 * SCHERMO PUBBLICO (TV o PC): logo, codice, QR, giocatori, stato, timer, manche, risultati.
 * Non è un partecipante, non ha account e riceve SOLO lo stato pubblico: niente regola, proposte,
 * voti individuali o ruoli segreti (il server non glieli manda proprio). Qui suonano voce e musica.
 *
 * «Schermo + telefoni» da PC: se chi guarda è l'host (stesso account), compaiono anche i pochi comandi
 * che non rivelano nulla (avvia, via, pausa, ripresa, nuova manche). Il PC resta un non-partecipante:
 * nessun ruolo, nessuna regola, nemmeno se l'host gioca ed è lo PSYCO.
 */
export function DisplayApp({ displayKey }: { displayKey: string }) {
  const { state, status, error, now, refresh } = usePsyco({ source: { kind: "display", displayKey } });
  const host = useScreenHost(displayKey);
  usePsycoAudio(state, now, { voiced: true });
  const [audioOn, setAudioOn] = useState(false);
  useEffect(() => getSoundEngine().subscribe((s) => setAudioOn(s.unlocked)), []);

  if (error && !state) {
    return (
      <main className="grid min-h-dvh place-items-center p-8 text-center">
        <div className="flex flex-col items-center gap-6">
          <PsycoLogo size="xl" />
          <p className="text-2xl font-extrabold">{error.code === "NOT_FOUND" ? "Schermo non valido o partita eliminata." : error.message}</p>
          <a href="/tv?nuovo=1" className="psy-btn">
            Collega a un&apos;altra partita
          </a>
        </div>
      </main>
    );
  }
  if (!state) {
    return <LoadingSplash game="psyco" label="Accendo lo schermo…" />;
  }
  const url = joinUrl(state.code);
  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden p-[3vh_3vw]" data-testid="psyco-display">
      <LinkBadge status={status} />
      {state.phase === "PLAYING" && state.round && <CountdownOverlay timer={state.round.timer} now={now} />}
      <header className="flex items-start justify-between gap-[2vw]">
        <PsycoLogo size="sm" className="!text-[6vh]" />
        <div className="flex items-center gap-[1.5vw]">
          {state.round && state.phase !== "LOBBY" && <span className="psy-display text-[3.4vh] text-paper/85">MANCHE {state.round.no}</span>}
          <span className="psy-chip !text-[2.2vh]">👥 {state.activeCount}</span>
          <span className="psy-clock rounded-xl bg-white/8 px-[1vw] py-[0.6vh] text-[3.6vh] tracking-[0.2em]">{state.code}</span>
          {state.phase !== "LOBBY" && <QrCode text={url} className="h-[11vh] w-[11vh] !p-1" />}
          {host && state.phase === "PLAYING" && <ScreenHostControls displayKey={displayKey} state={state} now={now} onDone={() => void refresh()} />}
          <AudioPanel voiced />
          <button
            type="button"
            className="psy-chip"
            aria-label="Schermo intero"
            title="Schermo intero"
            onClick={() => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)}
          >
            ⛶
          </button>
          {host && (
            <a href="/psyco" className="psy-chip" title="Esci dallo schermo (la partita continua)">
              Esci
            </a>
          )}
        </div>
      </header>
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[3vh] text-center">
        <DisplayPhase state={state} now={now} url={url} hostControls={host ? <ScreenHostControls displayKey={displayKey} state={state} now={now} onDone={() => void refresh()} big /> : null} />
      </section>
      {!audioOn && state.status === "open" && (
        <button type="button" className="psy-btn fixed bottom-[4vh] right-[3vw] z-40 !text-[2.6vh]" onClick={() => void getSoundEngine().unlock()}>
          🔊 ATTIVA AUDIO
        </button>
      )}
      {/* posto del narratore (l'Investigatore): illustrazione provvisoria, poi il modello 3D */}
      <PsycoNarratorSlot size="tv" className="fixed bottom-[3vh] left-[2vw] z-30" />
      <Captions position="bottom" className="!bottom-[5vh] !left-[16vw] [&_p]:!text-[3vh]" />
    </main>
  );
}

function DisplayPhase({ state, now, url, hostControls }: { state: PsycoPublicState; now: () => number; url: string; hostControls: React.ReactNode }) {
  const r = state.round;
  const v = r?.vote;
  if (state.status === "closed") {
    return (
      <>
        <h1 className="psy-title text-[12vh]">PARTITA FINITA</h1>
        <p className="psy-type text-[3.5vh]">Grazie per aver giocato a PSYCO.</p>
      </>
    );
  }
  switch (state.phase) {
    case "LOBBY":
      return (
        <div className="grid w-full max-w-[1600px] grid-cols-[auto_1fr] items-center gap-[4vw] text-left">
          <div className="flex flex-col items-center gap-[2vh]">
            <QrCode text={url} className={state.screen ? "h-[40vh] w-[40vh]" : "h-[44vh] w-[44vh]"} />
            <p className="psy-type text-[2.6vh] text-paper/80">{url.replace(/^https?:\/\//, "")}</p>
          </div>
          {/* «Schermo + telefoni»: qualche riga in più (spiegazione, comandi) → tutto un po' più compatto */}
          <div className={clsx("flex min-w-0 flex-col", state.screen ? "gap-[2.2vh]" : "gap-[3vh]")}>
            <PsycoLogo size="tv" tagline className={clsx("!items-start", state.screen && "[&>span:first-child]:!text-[10.5vh]")} />
            <p className="psy-display text-[4vh] text-paper">
              Inquadra il QR o vai su <span className="text-lamp">/psyco/entra</span> e scrivi
            </p>
            <p className={clsx("psy-clock tracking-[0.25em] text-paper", state.screen ? "text-[10vh]" : "text-[12vh]")}>{state.code}</p>
            <p className="text-[2.4vh] font-extrabold text-paper/75">
              {state.activeCount < state.minPlayers ? `Servono almeno ${state.minPlayers} giocatori (ora ${state.activeCount})` : `${state.activeCount} giocatori pronti: si può cominciare!`}
            </p>
            {state.screen && (
              <p className="psy-type text-[2.2vh] text-paper/80">
                📱 Si gioca tutti dal telefono, anche chi ha creato la partita (con lo stesso account). Questo schermo non mostra mai ruoli né regole.
              </p>
            )}
            <PlayerList players={state.participants} maxVisible={40} className="[&_li]:!text-[2.2vh]" />
            {hostControls && <div className="flex justify-start">{hostControls}</div>}
          </div>
        </div>
      );
    case "ROLE_REVEAL":
      return (
        <>
          <Lens className="h-[22vh] w-[22vh] psy-flicker" />
          <h2 className="psy-title text-[10vh]">RUOLI ASSEGNATI</h2>
          <p className="psy-type text-[3.6vh] text-paper/90">Uno di voi è lo PSYCO. Guardate il vostro ruolo… e non fatevi vedere.</p>
          {r && <Progress done={r.seen.length} total={r.members.length} label="Hanno visto il ruolo" />}
        </>
      );
    case "DIFFICULTY_VOTE":
    case "RULE_VOTE":
    case "RULE_PROPOSALS":
    case "PROPOSAL_VOTE":
      return (
        <>
          <p className="rounded-full bg-blood/30 px-[2vw] py-[1vh] text-[3.4vh] font-black text-[#ffd8da] ring-2 ring-blood/60">{r?.psycoNickname.toUpperCase()}, NON GUARDARE!</p>
          <h2 className="psy-title text-[9vh]">
            {state.phase === "DIFFICULTY_VOTE" ? "SCELTA DELLA DIFFICOLTÀ" : state.phase === "RULE_PROPOSALS" ? "SI SCRIVONO LE REGOLE" : v?.runoff ? "SPAREGGIO" : "SI VOTA LA REGOLA"}
          </h2>
          <p className="psy-type text-[3.2vh] text-paper/85">Gli altri stanno scegliendo la regola segreta sui loro telefoni.</p>
          {state.phase === "RULE_VOTE" && r && r.candidatesShown > 1 && <p className="text-[2.6vh] font-bold text-lamp">Regola proposta n. {r.candidatesShown}</p>}
          {v && <Progress done={v.voted.length} total={v.eligible} label="Hanno votato" />}
          {state.phase === "RULE_PROPOSALS" && r && <Progress done={r.proposed.length + r.passed.length} total={Math.max(1, r.members.length - 1)} label="Hanno proposto" />}
        </>
      );
    case "RULE_CONFIRMED":
      return (
        <>
          <h2 className="psy-title psy-stamp-in text-[10vh]">LA REGOLA È STATA SCELTA!</h2>
          <p className="psy-display text-[5vh] text-lamp">{r?.psycoNickname}, preparati a scoprirla!</p>
          {r?.difficulty && <p className="psy-chip !text-[2.4vh]">Difficoltà: {DIFFICULTY_LABEL[r.difficulty]}</p>}
          {r && state.mode === "personal" && <Progress done={r.ready.length} total={r.members.length} label="Pronti" />}
          {hostControls}
        </>
      );
    case "PLAYING":
      return r ? (
        <>
          <p className="psy-display text-[4.4vh] text-paper/90">
            PSYCO: <span className="text-blood">{r.psycoNickname}</span>
          </p>
          <BigTimer timer={r.timer} now={now} size="tv" />
          <p className="psy-type flex items-center gap-[1vw] text-[3vh] text-paper/80">
            <span>
              Tentativi: {r.attempts}
              {r.difficulty ? ` · ${DIFFICULTY_LABEL[r.difficulty]}` : ""}
            </span>
            <CallsChip state={state} className="!text-[2.4vh]" />
          </p>
          <EventFlash state={state} kind="guess_wrong" className="text-[5vh]">
            SBAGLIATO! SI CONTINUA
          </EventFlash>
          {/* la chiamata all'Investigatore: SOLO l'avviso, mai l'indizio (che lo schermo non riceve) */}
          <CallNotice state={state} holdNarrator className="!px-[2vw] !py-[1.4vh] text-[3.4vh]" />
        </>
      ) : null;
    case "GUESS_VOTE":
      return (
        <>
          <h2 className="psy-title text-[11vh]">{r?.psycoNickname.toUpperCase()} HA CAPITO?</h2>
          <p className="psy-type text-[3.6vh] text-paper/90">Silenzio… ascoltiamolo. Poi chi conosce la regola vota.</p>
          {v && <Progress done={v.voted.length} total={v.eligible} label="Hanno votato" />}
        </>
      );
    case "ROUND_END":
      return (
        <>
          <RoundResult state={state} big />
          {hostControls}
        </>
      );
  }
  return null;
}
