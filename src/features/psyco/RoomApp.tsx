"use client";

import Link from "next/link";
import { useState } from "react";
import { ExitButton } from "@/features/game/components/ExitButton";
import { LoadingSplash } from "@/features/game/components/LoadingSplash";
import { useDeviceKind } from "@/features/gioca/use-device";
import type { DifficultyChoice, PsycoPrivateView, PsycoPublicState, PsycoView, SecretRule } from "@/lib/psyco/types";
import { AudioPanel, Captions, usePsycoAudio } from "./audio";
import { CallNotice, CallsChip, PsycoCallControls } from "./InvestigatorCall";
import { PsycoNarratorSlot } from "./NarratorSlot";
import { HostBar, ScreenPanel, StartPanel } from "./HostControls";
import { CandidateVote, DifficultyVote, DontLook, ErrorNote, GuessVote, ProposalForm, ProposalVote, useActions } from "./panels";
import { psycoAct, usePsyco } from "./use-psyco";
import { BigTimer, CountdownOverlay, History, InvitePanel, LinkBadge, PlayerList, Progress, PsycoLogo, RoleFlipCard, RoundResult, RuleCard, EventFlash } from "./ui";

/**
 * PSYCO sul PROPRIO dispositivo (account obbligatorio): ruolo privato, regola solo a chi la conosce
 * (la vista privata arriva dall'endpoint autenticato, mai dal canale realtime), voti, «HO CAPITO!».
 * Chi gestisce la partita ha in più i comandi (avvio, pausa, chiusura delle votazioni…).
 */
export function RoomApp({ roomId }: { roomId: string }) {
  const { state, view, status, error, refresh, applyView, now } = usePsyco({ source: { kind: "room", roomId } });
  const { run, busy, error: actError, clearError } = useActions(roomId, applyView, () => void refresh());
  // voce e musica: sul telefono di chi gestisce la partita solo se non c'è uno schermo TV collegato
  usePsycoAudio(state, now, { voiced: !!view?.isHost && !state?.displayOnline });

  if (error && !state) {
    if (["NOT_MEMBER", "KICKED", "NOT_FOUND", "UNAUTHENTICATED"].includes(error.code)) {
      return (
        <Shell>
          <section className="flex flex-col items-center gap-5 py-16 text-center">
            <PsycoLogo size="md" />
            <p className="text-xl font-extrabold">{error.message}</p>
            <Link href="/psyco/entra" className="psy-btn">
              ENTRA CON UN CODICE
            </Link>
            <Link href="/psyco" className="font-bold text-paper/70 underline">
              Home di PSYCO
            </Link>
          </section>
        </Shell>
      );
    }
  }
  if (!state || !view) {
    return <LoadingSplash game="psyco" label="Entro nella stanza…" />;
  }
  if (state.status === "closed") {
    return (
      <Shell state={state}>
        <section className="flex flex-col items-center gap-6 py-10 text-center">
          <h1 className="psy-title text-6xl">PARTITA FINITA</h1>
          <p className="psy-type text-xl">Grazie per aver giocato a PSYCO.</p>
          <History state={state} />
          <Link href="/psyco" className="psy-btn">
            NUOVA PARTITA
          </Link>
        </section>
      </Shell>
    );
  }

  return (
    <Shell state={state} view={view} onLeave={() => void run({ action: "leave" }).then((ok) => ok && window.location.assign("/psyco"))}>
      <LinkBadge status={status} />
      {state.phase === "PLAYING" && state.round && <CountdownOverlay timer={state.round.timer} now={now} />}
      <div className="flex w-full flex-col items-center gap-6">
        {view.isHost && !state.displayOnline && <PsycoNarratorSlot size="sm" />}
        <HostOffline state={state} view={view} onClaim={() => void run({ action: "claim_host" })} />
        <ScreenHint state={state} view={view} roomId={roomId} />
        <ErrorNote error={actError} onClose={clearError} />
        {/* avviso pubblico della chiamata all'Investigatore: lo PSYCO non lo vede (sta già telefonando) */}
        <CallNotice state={state} hidden={view.role === "psyco"} className="w-full max-w-xl" />
        <Phase state={state} view={view} run={run} busy={busy} now={now} roomId={roomId} applyView={applyView} />
        {view.isHost && state.phase !== "LOBBY" && state.phase !== "ROUND_END" && <HostBar state={state} view={view} run={run} busy={busy} />}
        {state.phase !== "LOBBY" && (
          <section className="w-full max-w-2xl">
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-paper/50">
              In stanza · {state.activeCount}
            </p>
            <PlayerList players={state.participants} state={state} highlight={view.me?.participantId} />
          </section>
        )}
      </div>
      <Captions />
    </Shell>
  );
}

function Shell({ children, state, view, onLeave }: { children: React.ReactNode; state?: PsycoPublicState; view?: PsycoPrivateView; onLeave?: () => void }) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="min-h-dvh">
      <header className="qz-safe-header sticky top-0 z-30 flex items-center gap-3 bg-noir/80 backdrop-blur">
        <Link href="/psyco" aria-label="Home di PSYCO" className="psy-title text-3xl">
          PSYCO
        </Link>
        {state && (
          <span className="hidden min-[420px]:inline-flex">
            <span className="psy-chip !min-h-8 font-mono tracking-[0.2em]" aria-label={`Codice ${state.code}`}>
              {state.code}
            </span>
          </span>
        )}
        {state?.round && state.phase !== "LOBBY" && <span className="hidden text-sm font-black text-paper/70 sm:inline">Manche {state.round.no}</span>}
        <div className="ml-auto flex items-center gap-2">
          {state && <AudioPanel voiced={!!view?.isHost && !state.displayOnline} />}
          {onLeave && view?.me && (
            <div className="relative">
              <button type="button" className="psy-chip" aria-expanded={menu} onClick={() => setMenu((m) => !m)} aria-label="Altro">
                ⋯
              </button>
              {menu && (
                <div className="psy-panel absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl p-2">
                  <button type="button" className="w-full rounded-xl px-3 py-2.5 text-left font-bold text-[#ffb3b7] hover:bg-white/8" onClick={onLeave}>
                    Lascia la partita
                  </button>
                </div>
              )}
            </div>
          )}
          <ExitButton to="/psyco" size="sm" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-28 pt-6">{children}</main>
    </div>
  );
}

function HostOffline({ state, view, onClaim }: { state: PsycoPublicState; view: PsycoPrivateView; onClaim: () => void }) {
  if (state.mode !== "personal" || view.isHost || !view.me || state.hostOnline) return null;
  return (
    <div role="status" className="flex w-full max-w-xl flex-wrap items-center justify-between gap-3 rounded-2xl bg-lamp/15 px-4 py-3 text-sm font-bold text-lamp ring-1 ring-lamp/40">
      Chi gestisce la partita non risponde.
      <button type="button" className="psy-chip" onClick={onClaim}>
        Prendi tu la gestione
      </button>
    </div>
  );
}

/**
 * Partita «Schermo + telefoni» aperta dall'host su un COMPUTER: qui si gioca come su un telefono
 * (ruolo compreso). Se questo computer è lo schermo per tutti, va aperto lo schermo pubblico.
 */
function ScreenHint({ state, view, roomId }: { state: PsycoPublicState; view: PsycoPrivateView; roomId: string }) {
  const device = useDeviceKind();
  if (!state.screen || !view.isHost || device !== "desktop") return null;
  return (
    <div role="note" className="flex w-full max-w-xl flex-wrap items-center justify-between gap-3 rounded-2xl bg-lamp/15 px-4 py-3 text-sm font-bold text-lamp ring-1 ring-lamp/40">
      <span>Questo computer è lo schermo per tutti? Aprilo come SCHERMO PUBBLICO: qui vedresti il tuo ruolo.</span>
      <Link href={`/psyco/schermo/apri/${roomId}`} className="psy-chip" prefetch={false}>
        📺 Apri lo schermo
      </Link>
    </div>
  );
}

type Run = ReturnType<typeof useActions>["run"];

function Phase({
  state,
  view,
  run,
  busy,
  now,
  roomId,
  applyView,
}: {
  state: PsycoPublicState;
  view: PsycoPrivateView;
  run: Run;
  busy: string | null;
  now: () => number;
  roomId: string;
  applyView: (v: PsycoView) => void;
}) {
  const r = state.round;
  const v = r?.vote ?? null;
  const vote = (choice: string) => v && void run({ action: "vote", ballot: v.ballot, choice });
  const isPsyco = view.role === "psyco";
  const psycoName = r?.psycoNickname ?? "";

  if (state.phase === "LOBBY") {
    return (
      <div className="flex w-full flex-col items-center gap-6">
        <PsycoLogo size="lg" tagline />
        <InvitePanel code={state.code} compact />
        <section className="w-full">
          <p className="mb-2 text-center text-sm font-black uppercase tracking-widest text-paper/60">
            Giocatori in stanza: {state.activeCount}
          </p>
          <PlayerList players={state.participants} highlight={view.me?.participantId} onKick={view.isHost ? (p) => void run({ action: "kick", participantId: p.id }) : undefined} />
        </section>
        {view.isHost ? (
          <>
            <StartPanel state={state} run={run} busy={busy} label="INIZIA LA PARTITA" />
            <ScreenPanel roomId={roomId} />
          </>
        ) : (
          <p className="psy-type text-center text-xl text-paper/85">In attesa che si cominci… più siete, più sarà difficile.</p>
        )}
      </div>
    );
  }

  // entrato a manche iniziata: niente ruolo, niente segreti
  if (!view.role && state.phase !== "ROUND_END") {
    return (
      <section className="flex flex-col items-center gap-4 text-center">
        <h2 className="psy-display text-4xl">Sei nella stanza!</h2>
        <p className="psy-type max-w-md text-lg text-paper/85">La manche è già cominciata: giocherai dalla prossima. Intanto guarda e ascolta.</p>
        {state.phase === "PLAYING" && r && <BigTimer timer={r.timer} now={now} />}
      </section>
    );
  }

  switch (state.phase) {
    case "ROLE_REVEAL":
      return <RoleReveal key={r?.no} view={view} psycoName={view.psycoNickname ?? psycoName} onSeen={() => void run({ action: "seen" })} seen={r?.seen.length ?? 0} total={r?.members.length ?? 0} />;

    case "DIFFICULTY_VOTE":
      if (isPsyco) return <PsycoWait state={state} sub="Gli altri stanno scegliendo la regola. Tu non puoi vederla: preparati a scoprirla!" />;
      return (
        <>
          <DifficultyVote myVote={view.myVote} onVote={(c: DifficultyChoice) => vote(c)} busy={!!busy} />
          {v && <Progress done={v.voted.length} total={v.eligible} label="Hanno votato" />}
        </>
      );

    case "RULE_VOTE":
      if (isPsyco || !view.secret?.candidate) return <PsycoWait state={state} sub="Gli altri stanno leggendo e votando la regola. Niente sbirciate!" />;
      return (
        <>
          <CandidateVote key={view.secret.candidate.id} candidate={view.secret.candidate} myVote={view.myVote} onVote={vote} busy={!!busy} shown={r?.candidatesShown ?? 1} />
          {v && <Progress done={v.voted.length} total={v.eligible} label="Hanno votato" />}
        </>
      );

    case "RULE_PROPOSALS":
      if (isPsyco || !view.secret) return <PsycoWait state={state} sub="Gli altri stanno inventando la regola. Non guardare i loro schermi!" />;
      return (
        <>
          <ProposalForm
            key={r?.no}
            myProposal={view.myProposal}
            myPassed={view.myPassed}
            others={view.secret.proposals}
            busy={!!busy}
            onPropose={(text, category, hint) => run({ action: "propose", text, category, hint })}
            onPass={() => void run({ action: "pass" })}
          />
          <Progress done={(r?.proposed.length ?? 0) + (r?.passed.length ?? 0)} total={(r?.members.length ?? 1) - 1} label="Hanno proposto o passato" />
        </>
      );

    case "PROPOSAL_VOTE":
      if (isPsyco || !view.secret) return <PsycoWait state={state} sub="Gli altri stanno votando la regola migliore." />;
      return (
        <>
          <ProposalVote key={v?.ballot} proposals={view.secret.proposals} runoff={v?.runoff ?? null} myVote={view.myVote} onVote={vote} busy={!!busy} />
          {v && <Progress done={v.voted.length} total={v.eligible} label="Hanno votato" />}
        </>
      );

    case "RULE_CONFIRMED":
      return (
        <section className="flex w-full flex-col items-center gap-5 text-center">
          {isPsyco ? (
            <>
              <h2 className="psy-title psy-stamp-in text-6xl md:text-7xl">LA REGOLA È STATA SCELTA!</h2>
              <p className="psy-display text-3xl text-lamp">PREPARATI A SCOPRIRLA!</p>
            </>
          ) : (
            view.secret?.rule && <RuleCard rule={view.secret.rule} big className="w-full max-w-xl text-left" label="regola confermata" />
          )}
          <p className="font-bold text-paper/80">Quando tutti sono pronti parte il conto alla rovescia.</p>
          <button type="button" className="psy-btn w-full max-w-sm text-3xl" disabled={view.ready || !!busy} onClick={() => void run({ action: "ready" })}>
            {view.ready ? "PRONTO ✓" : "SONO PRONTO"}
          </button>
          {r && <Progress done={r.ready.length} total={r.members.length} label="Pronti" />}
        </section>
      );

    case "PLAYING":
      return r ? (
        <section className="flex w-full flex-col items-center gap-6 text-center">
          <p className="psy-type flex flex-wrap items-center justify-center gap-2 text-lg text-paper/80">
            <span>
              PSYCO: <b className="text-blood">{psycoName}</b> · tentativi {r.attempts}
            </span>
            <CallsChip state={state} className="!min-h-8 !text-sm" />
          </p>
          <BigTimer timer={r.timer} now={now} size="lg" />
          <EventFlash state={state} kind="guess_wrong" className="text-2xl">
          SBAGLIATO! SI CONTINUA
        </EventFlash>
          {isPsyco ? (
            <>
              <p className="psy-type max-w-md text-lg">Fai domande a voce, osserva, cerca lo schema. Quando credi di averlo capito:</p>
              <button type="button" className="psy-btn psy-glow w-full max-w-sm py-6 text-4xl" disabled={!!busy || !!r.timer.pausedAt} onClick={() => void run({ action: "guess" })}>
                HO CAPITO LA REGOLA!
              </button>
              <PsycoCallControls
                state={state}
                messages={view.investigator?.messages ?? []}
                disabled={!!busy}
                now={now}
                call={async (requestId) => {
                  const res = await psycoAct(roomId, { action: "call_investigator", requestId });
                  if (!("state" in res)) return [];
                  applyView(res);
                  return res.view.investigator?.messages ?? [];
                }}
              />
            </>
          ) : (
            view.secret?.rule && <RuleReminder rule={view.secret.rule} />
          )}
        </section>
      ) : null;

    case "GUESS_VOTE":
      if (isPsyco || !view.secret)
        return (
          <section className="flex flex-col items-center gap-4 text-center">
            <h2 className="psy-title text-6xl">SPIEGA LA REGOLA!</h2>
            <p className="psy-type max-w-md text-xl">Di&apos; a voce quale pensi che sia la regola. Gli altri votano se hai indovinato.</p>
            {v && <Progress done={v.voted.length} total={v.eligible} label="Hanno votato" />}
          </section>
        );
      return (
        <>
          {view.secret.rule && <RuleReminder rule={view.secret.rule} />}
          <GuessVote psycoName={psycoName} myVote={view.myVote} onVote={vote} busy={!!busy} runoff={(v?.ballot ?? "").endsWith("#2")} />
          {v && <Progress done={v.voted.length} total={v.eligible} label="Hanno votato" />}
        </>
      );

    case "ROUND_END":
      return (
        <div className="flex w-full flex-col items-center gap-6">
          <RoundResult state={state} />
          <History state={state} />
          {view.isHost ? (
            <>
              <StartPanel key={r?.no} state={state} run={run} busy={busy} label="NUOVA MANCHE" />
              <button type="button" className="psy-chip" onClick={() => void run({ action: "close_room" })}>
                Chiudi la partita
              </button>
            </>
          ) : (
            <p className="psy-type text-center text-lg text-paper/80">In attesa della prossima manche: nuovo PSYCO, nuova regola.</p>
          )}
        </div>
      );
  }
  return null;
}

function PsycoWait({ state, sub }: { state: PsycoPublicState; sub: string }) {
  const v = state.round?.vote;
  return (
    <div className="flex flex-col items-center gap-6">
      <DontLook sub={sub} />
      {v && <Progress done={v.voted.length} total={v.eligible} label="Hanno votato" />}
    </div>
  );
}

function RoleReveal({ view, psycoName, onSeen, seen, total }: { view: PsycoPrivateView; psycoName: string; onSeen: () => void; seen: number; total: number }) {
  const [open, setOpen] = useState(false);
  if (view.roleSeen) {
    return (
      <section className="flex flex-col items-center gap-5 text-center">
        <h2 className="psy-display text-4xl">Ruolo visto ✓</h2>
        <p className="psy-type text-lg text-paper/80">Aspettiamo che lo vedano tutti. Tieni lo schermo lontano da occhi indiscreti.</p>
        <Progress done={seen} total={total} label="Hanno visto il ruolo" />
      </section>
    );
  }
  return (
    <section className="flex flex-col items-center gap-5 text-center">
      <h2 className="psy-display text-3xl">{open ? "Il tuo ruolo" : "Guarda il tuo ruolo… e non farti vedere"}</h2>
      <button type="button" onClick={() => setOpen(true)} aria-label={open ? "Ruolo mostrato" : "Tocca per scoprire il tuo ruolo"} className="rounded-3xl">
        <RoleFlipCard open={open} role={view.role} psycoName={view.role === "knower" ? psycoName : null} />
      </button>
      {open ? (
        <button
          type="button"
          className="psy-btn w-full max-w-sm"
          onClick={() => {
            setOpen(false);
            onSeen();
          }}
        >
          HO VISTO IL MIO RUOLO
        </button>
      ) : (
        <p className="font-bold text-paper/75">Tocca la carta per girarla</p>
      )}
    </section>
  );
}

/** Promemoria della regola per chi la conosce: nascosto finché non lo si tiene premuto/aperto. */
function RuleReminder({ rule }: { rule: SecretRule }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-2">
      <button type="button" className="psy-chip" aria-expanded={show} onClick={() => setShow((s) => !s)}>
        {show ? "Nascondi la regola" : "Rivedi la regola (solo per te)"}
      </button>
      {show && <RuleCard rule={rule} className="w-full text-left" />}
    </div>
  );
}
