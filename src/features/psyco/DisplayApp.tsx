"use client";

import { useEffect, useState } from "react";
import { LoadingSplash } from "@/features/game/components/LoadingSplash";
import { getSoundEngine } from "@/features/media/audio-engine";
import { DIFFICULTY_LABEL, type PsycoPublicState } from "@/lib/psyco/types";
import { AudioPanel, Captions, usePsycoAudio } from "./audio";
import { PsycoIntro } from "./intro/PsycoIntro";
import { PsycoNarratorSlot } from "./NarratorSlot";
import { usePsyco } from "./use-psyco";
import { BigTimer, CountdownOverlay, EventFlash, joinUrl, Lens, LinkBadge, PlayerList, Progress, PsycoLogo, QrCode, RoundResult } from "./ui";

/**
 * SCHERMO PUBBLICO (TV o PC): logo, codice, QR, giocatori, stato, timer, manche, risultati.
 * Non è un partecipante, non ha account e riceve SOLO lo stato pubblico: niente regola, proposte,
 * voti individuali o ruoli segreti (il server non glieli manda proprio). Qui suonano voce e musica.
 */
export function DisplayApp({ displayKey }: { displayKey: string }) {
  const { state, status, error, now } = usePsyco({ source: { kind: "display", displayKey } });
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
          <AudioPanel voiced />
          <button type="button" className="psy-chip" onClick={() => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)}>
            ⛶
          </button>
        </div>
      </header>
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[3vh] text-center">
        <DisplayPhase state={state} now={now} url={url} />
      </section>
      {!audioOn && state.status === "open" && (
        <button type="button" className="psy-btn fixed bottom-[4vh] right-[3vw] z-40 !text-[2.6vh]" onClick={() => void getSoundEngine().unlock()}>
          🔊 ATTIVA AUDIO
        </button>
      )}
      {/* il narratore: l'Investigatore 3D in basso a sinistra, il sottotitolo accanto */}
      {/* in sala d'attesa un po' più piccolo: resta sotto il QR e il suo indirizzo senza toccarli */}
      <PsycoNarratorSlot size={state.phase === "LOBBY" && state.status === "open" ? "tvs" : "tv"} className="fixed bottom-[3vh] left-[2vw] z-30" />
      <Captions position="bottom" className="!bottom-[5vh] !left-[calc(4vw+29vh)] !right-[2vw] [&_p]:!text-[3vh]" />
      <PsycoIntro roomId={state.roomId} eligible={state.phase === "LOBBY" && state.status === "open"} />
    </main>
  );
}

function DisplayPhase({ state, now, url }: { state: PsycoPublicState; now: () => number; url: string }) {
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
            <QrCode text={url} className="h-[44vh] w-[44vh]" />
            <p className="psy-type text-[2.6vh] text-paper/80">{url.replace(/^https?:\/\//, "")}</p>
          </div>
          <div className="flex min-w-0 flex-col gap-[3vh]">
            <PsycoLogo size="tv" tagline className="!items-start" />
            <p className="psy-display text-[4vh] text-paper">
              Inquadra il QR o vai su <span className="text-lamp">/psyco/entra</span> e scrivi
            </p>
            <p className="psy-clock text-[12vh] tracking-[0.25em] text-paper">{state.code}</p>
            <p className="text-[2.4vh] font-extrabold text-paper/75">
              {state.activeCount < state.minPlayers ? `Servono almeno ${state.minPlayers} giocatori (ora ${state.activeCount})` : `${state.activeCount} giocatori pronti: si può cominciare!`}
            </p>
            <PlayerList players={state.participants} maxVisible={40} className="[&_li]:!text-[2.2vh]" />
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
        </>
      );
    case "PLAYING":
      return r ? (
        <>
          <p className="psy-display text-[4.4vh] text-paper/90">
            PSYCO: <span className="text-blood">{r.psycoNickname}</span>
          </p>
          <BigTimer timer={r.timer} now={now} size="tv" />
          <p className="psy-type text-[3vh] text-paper/80">
            Tentativi: {r.attempts}
            {r.difficulty ? ` · ${DIFFICULTY_LABEL[r.difficulty]}` : ""}
          </p>
          <EventFlash state={state} kind="guess_wrong" className="text-[5vh]">
            SBAGLIATO! SI CONTINUA
          </EventFlash>
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
      return <RoundResult state={state} big />;
  }
  return null;
}
