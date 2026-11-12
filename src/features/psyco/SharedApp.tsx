"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ExitButton } from "@/features/game/components/ExitButton";
import { LoadingSplash } from "@/features/game/components/LoadingSplash";
import { useDeviceKind } from "@/features/gioca/use-device";
import type { InvestigatorMessage, PsycoPrivateView, PsycoPublicState, PsycoView, PublicParticipant } from "@/lib/psyco/types";
import { api, ApiError } from "@/lib/realtime/api-client";
import { AudioPanel, Captions, usePsycoAudio } from "./audio";
import { CallButton, CallsChip, IncomingCall, MessagesSheet, useLive } from "./InvestigatorCall";
import { PsycoIntro } from "./intro/PsycoIntro";
import { PsycoNarratorDock } from "./NarratorSlot";
import { HostBar, ScreenPanel, StartPanel } from "./HostControls";
import { getNarrator } from "./narrator";
import { CandidateVote, DifficultyVote, DontLook, ErrorNote, ProposalForm, ProposalVote, useActions } from "./panels";
import { psycoAct, usePsyco } from "./use-psyco";
import { BigTimer, CountdownOverlay, History, LinkBadge, PlayerList, Progress, PsycoLogo, RoleFlipCard, RoundResult, RuleCard, EventFlash } from "./ui";

/**
 * PSYCO con UN SOLO dispositivo (telefono, tablet o PC): basta l'account di chi crea la partita,
 * gli altri sono nickname locali. Il telefono passa di mano: schermate di copertura tra un giocatore
 * e l'altro, la regola si vede SOLO dopo «SONO LUCA» e sparisce appena si conferma. Lo PSYCO non
 * partecipa mai alla scelta. (La segretezza dipende anche da come si passa il telefono: nessuno deve
 * sbirciare.) Su PC/portatile il dispositivo non «passa di mano»: i testi diventano «Tocca a X: gli
 * altri non guardino lo schermo».
 */
export function SharedApp({ roomId }: { roomId: string }) {
  const { state, view, status, error, refresh, applyView, now } = usePsyco({ source: { kind: "room", roomId } });
  const { run, busy, error: actError, clearError } = useActions(roomId, applyView, () => void refresh());
  usePsycoAudio(state, now, { voiced: !state?.displayOnline });
  // schermata privata aperta (ruolo, regola, voto segreto): ritratto del narratore ridotto
  const [privateOpen, setPrivateOpen] = useState(false);

  if (error && !state) {
    return (
      <Frame>
        <section className="flex flex-col items-center gap-5 py-16 text-center">
          <p className="text-xl font-extrabold">{error.message}</p>
          <Link href="/psyco" className="psy-btn">
            HOME DI PSYCO
          </Link>
        </section>
      </Frame>
    );
  }
  if (!state || !view) {
    return <LoadingSplash game="psyco" label="Preparo il tavolo…" />;
  }
  if (state.status === "closed") {
    return (
      <Frame state={state}>
        <section className="flex flex-col items-center gap-6 py-10 text-center">
          <h1 className="psy-title text-6xl">PARTITA FINITA</h1>
          <History state={state} />
          <Link href="/psyco" className="psy-btn">
            NUOVA PARTITA
          </Link>
        </section>
      </Frame>
    );
  }
  return (
    <Frame state={state}>
      <LinkBadge status={status} />
      {state.phase === "PLAYING" && state.round && <CountdownOverlay timer={state.round.timer} now={now} />}
      <div className="flex w-full flex-col items-center gap-6">
        <PsycoNarratorDock compact={privateOpen} />
        <ErrorNote error={actError} onClose={clearError} />
        <SharedPhase
          key={`${state.round?.no ?? 0}:${state.phase}`}
          state={state}
          view={view}
          run={run}
          busy={busy}
          now={now}
          roomId={roomId}
          refresh={() => void refresh()}
          onPrivate={setPrivateOpen}
        />
        {state.phase !== "LOBBY" && state.phase !== "ROUND_END" && <HostBar state={state} view={view} run={(a) => run(a)} busy={busy} />}
      </div>
      {/* senza TV il sottotitolo è nel fumetto accanto al ritratto; con la TV resta quello fisso */}
      {state.displayOnline && <Captions />}
      <PsycoIntro roomId={roomId} eligible={!state.displayOnline && state.phase === "LOBBY"} />
    </Frame>
  );
}

function Frame({ children, state }: { children: React.ReactNode; state?: PsycoPublicState }) {
  return (
    <div className="min-h-dvh">
      <header className="qz-safe-header sticky top-0 z-30 flex items-center gap-3 bg-noir/80 backdrop-blur">
        <Link href="/psyco" aria-label="Home di PSYCO" className="psy-title text-3xl">
          PSYCO
        </Link>
        <span className="hidden sm:inline-flex">
          <span className="psy-chip !min-h-8">Un solo dispositivo</span>
        </span>
        {state?.round && state.phase !== "LOBBY" && <span className="hidden text-sm font-black text-paper/70 sm:inline">Manche {state.round.no}</span>}
        <div className="ml-auto flex items-center gap-2">
          {state && <AudioPanel voiced={!state.displayOnline} />}
          <ExitButton to="/psyco" size="sm" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-28 pt-6">{children}</main>
    </div>
  );
}

type Run = ReturnType<typeof useActions>["run"];

/** Chi deve prendere il telefono adesso (in ordine di posto), oppure null se hanno finito tutti. */
function nextHolder(state: PsycoPublicState): PublicParticipant | null {
  const r = state.round;
  if (!r) return null;
  const members = state.participants.filter((p) => r.members.includes(p.id));
  const knowers = members.filter((p) => p.id !== r.psycoId);
  switch (state.phase) {
    case "ROLE_REVEAL":
      return members.find((p) => !r.seen.includes(p.id)) ?? null;
    case "DIFFICULTY_VOTE":
    case "RULE_VOTE":
    case "PROPOSAL_VOTE":
      return knowers.find((p) => !(r.vote?.voted ?? []).includes(p.id)) ?? null;
    case "RULE_PROPOSALS":
      return knowers.find((p) => !r.proposed.includes(p.id) && !r.passed.includes(p.id)) ?? null;
    default:
      return null;
  }
}

function SharedPhase({
  state,
  view,
  run,
  busy,
  now,
  roomId,
  refresh,
  onPrivate,
}: {
  state: PsycoPublicState;
  view: PsycoPrivateView;
  run: Run;
  busy: string | null;
  now: () => number;
  roomId: string;
  refresh: () => void;
  onPrivate: (open: boolean) => void;
}) {
  const r = state.round;
  const psycoName = r?.psycoNickname ?? "";
  const desktop = useDeviceKind() === "desktop";

  if (state.phase === "LOBBY") return <SharedLobby state={state} run={run} busy={busy} roomId={roomId} />;

  if (["ROLE_REVEAL", "DIFFICULTY_VOTE", "RULE_VOTE", "RULE_PROPOSALS", "PROPOSAL_VOTE"].includes(state.phase)) {
    return <PassTheDevice state={state} run={run} busy={busy} roomId={roomId} onPrivate={onPrivate} />;
  }

  if (state.phase === "RULE_CONFIRMED") {
    return (
      <section className="flex w-full flex-col items-center gap-5 text-center">
        <h2 className="psy-title psy-stamp-in text-6xl md:text-7xl">LA REGOLA È STATA SCELTA!</h2>
        <p className="psy-display text-3xl text-lamp">{psycoName}, PREPARATI A SCOPRIRLA!</p>
        <p className="psy-type max-w-md text-lg text-paper/85">
          {desktop
            ? "Girate lo schermo verso tutti: da qui in poi mostra solo il timer."
            : "Mettete il telefono al centro del tavolo, ben visibile a tutti: da qui in poi mostra solo il timer."}
        </p>
        <button type="button" className="psy-btn w-full max-w-sm text-3xl" disabled={!!busy} onClick={() => void run({ action: "start_round" })}>
          TUTTI PRONTI: VIA!
        </button>
        <PeekRule state={state} roomId={roomId} />
      </section>
    );
  }

  if (state.phase === "PLAYING" && r) {
    return (
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
        <button type="button" className="psy-btn psy-glow w-full max-w-sm py-6 text-4xl" disabled={!!busy || !!r.timer.pausedAt} onClick={() => void run({ action: "guess" })}>
          HO CAPITO LA REGOLA!
        </button>
        <p className="text-sm font-bold text-paper/60">Lo preme {psycoName} quando crede di aver capito.</p>
        <SharedCall state={state} roomId={roomId} refresh={refresh} now={now} />
        <PeekRule state={state} roomId={roomId} />
      </section>
    );
  }

  if (state.phase === "GUESS_VOTE" && r) return <SharedGuessVote state={state} run={run} busy={busy} />;

  if (state.phase === "ROUND_END") {
    return (
      <div className="flex w-full flex-col items-center gap-6">
        <RoundResult state={state} />
        <History state={state} />
        <ManageLocals state={state} run={run} busy={busy} />
        <StartPanel key={r?.no} state={state} run={run} busy={busy} label="NUOVA MANCHE" />
        <button type="button" className="psy-chip" onClick={() => void run({ action: "close_room" })}>
          Chiudi la partita
        </button>
      </div>
    );
  }
  void view;
  return null;
}

function SharedLobby({ state, run, busy, roomId }: { state: PsycoPublicState; run: Run; busy: string | null; roomId: string }) {
  const desktop = useDeviceKind() === "desktop";
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <PsycoLogo size="lg" tagline />
      <p className="psy-type max-w-lg text-center text-lg text-paper/85">
        {desktop
          ? "Un solo schermo per tutti: a turno, chi tocca guarda e gli altri no. Nessuno deve uscire dalla stanza, basta non sbirciare."
          : "Un telefono per tutti: si passa di mano. Nessuno deve uscire dalla stanza, basta non sbirciare."}
      </p>
      <ManageLocals state={state} run={run} busy={busy} />
      <StartPanel state={state} run={run} busy={busy} label="INIZIA LA PARTITA" />
      <ScreenPanel roomId={roomId} />
    </div>
  );
}

function ManageLocals({ state, run, busy }: { state: PsycoPublicState; run: Run; busy: string | null }) {
  const [name, setName] = useState("");
  return (
    <section className="psy-panel flex w-full flex-col gap-3 rounded-3xl p-5">
      <h2 className="psy-display text-2xl">Giocatori ({state.activeCount})</h2>
      <PlayerList players={state.participants} onKick={(p) => void run({ action: "remove_local", participantId: p.id })} />
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          void run({ action: "add_local", nickname: name }).then((ok) => ok && setName(""));
        }}
      >
        <input className="psy-input" aria-label="Nickname da aggiungere" placeholder="Aggiungi un nickname" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="psy-btn text-xl" disabled={!!busy || !name.trim()}>
          +
        </button>
      </form>
    </section>
  );
}

/** Il cuore del dispositivo condiviso: «PASSA IL TELEFONO A …» → «SONO … » → schermata privata → copertura. */
function PassTheDevice({ state, run, busy, roomId, onPrivate }: { state: PsycoPublicState; run: Run; busy: string | null; roomId: string; onPrivate: (open: boolean) => void }) {
  const [holder, setHolder] = useState<PublicParticipant | null>(null);
  const [hv, setHv] = useState<PsycoPrivateView | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const next = nextHolder(state);
  const r = state.round!;
  const psycoName = r.psycoNickname;
  const choosing = state.phase !== "ROLE_REVEAL";
  const announced = useRef<string | null>(null);
  // su PC/portatile lo schermo non passa di mano: «tocca a…», gli altri non guardano
  const desktop = useDeviceKind() === "desktop";

  // «Passa il telefono…» / «Tocca al prossimo…»: la voce lo dice a ogni passaggio
  const nextId = next?.id ?? null;
  useEffect(() => {
    if (holder || !nextId) return;
    const key = `${state.phase}:${r.vote?.ballot ?? ""}:${nextId}`;
    if (announced.current === key) return;
    announced.current = key;
    getNarrator().say([desktop ? "tocca-al-prossimo" : "passa-telefono"]);
  }, [holder, nextId, state.phase, r.vote?.ballot, desktop]);

  const privateOpen = !!holder;
  useEffect(() => {
    onPrivate(privateOpen);
    return () => onPrivate(false);
  }, [privateOpen, onPrivate]);

  // il voto/la fase sono cambiati sotto le mani (es. maggioranza raggiunta): si torna alla copertura
  const ballot = r.vote?.ballot ?? state.phase;
  const holderPhase = useRef(ballot);
  useEffect(() => {
    if (holderPhase.current !== ballot) {
      holderPhase.current = ballot;
      setHolder(null);
      setHv(null);
    }
  }, [ballot]);

  async function take(p: PublicParticipant) {
    setLoading(true);
    setErr(null);
    try {
      const v = await api<PsycoView>(`/api/psyco/rooms/${roomId}?as=${p.id}`);
      setHv(v.view);
      setHolder(p);
      if (state.phase === "ROLE_REVEAL") getNarrator().say(["guarda-ruolo"]);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Connessione assente");
    } finally {
      setLoading(false);
    }
  }
  function done() {
    setHolder(null);
    setHv(null);
  }
  async function act(a: Parameters<Run>[0]) {
    if (!holder) return false;
    const ok = await run(a, holder.id);
    if (ok) done();
    return ok;
  }

  if (!holder || !hv) {
    if (!next) {
      return (
        <section className="flex flex-col items-center gap-4 text-center">
          <PsycoLogo className="psy-flicker" />
          <p className="psy-type text-lg">Un attimo…</p>
        </section>
      );
    }
    const label = state.phase === "ROLE_REVEAL" ? "MOSTRA IL MIO RUOLO" : state.phase === "RULE_PROPOSALS" ? "TOCCA A ME: PROPONGO" : "TOCCA A ME: VOTO";
    const done_ =
      state.phase === "ROLE_REVEAL"
        ? r.seen.length
        : state.phase === "RULE_PROPOSALS"
          ? r.proposed.length + r.passed.length
          : (r.vote?.voted.length ?? 0);
    const total = state.phase === "ROLE_REVEAL" ? r.members.length : (r.vote?.eligible ?? r.members.length - 1);
    return (
      <section className="psy-rise flex w-full flex-col items-center gap-6 text-center">
        {choosing && (
          <p className="rounded-full bg-blood/25 px-4 py-2 text-base font-black text-[#ffd8da] ring-1 ring-blood/60">
            {psycoName}, NON GUARDARE! Gli altri scelgono la regola.
          </p>
        )}
        <p className="psy-type text-xl text-paper/80">{state.phase === "ROLE_REVEAL" ? "Ruoli segreti" : phaseTitle(state.phase)}</p>
        <h2 className="psy-display text-4xl leading-tight md:text-5xl">
          {desktop ? "TOCCA A" : "PASSA IL TELEFONO A"}
          <br />
          <span className="psy-title text-6xl md:text-7xl">{next.nickname.toUpperCase()}</span>
        </h2>
        {desktop && <p className="psy-type -mt-2 text-lg text-lamp">Gli altri non guardino lo schermo.</p>}
        <button type="button" className="psy-btn w-full max-w-md py-5 text-2xl" disabled={loading} onClick={() => void take(next)}>
          SONO {next.nickname.toUpperCase()} — {label}
        </button>
        <Progress done={done_} total={total} label={state.phase === "ROLE_REVEAL" ? "Hanno visto il ruolo" : "Fatto"} />
        <ErrorNote error={err} />
      </section>
    );
  }

  const v = r.vote;
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <p className="psy-chip">Tocca a {holder.nickname}</p>
      {state.phase === "ROLE_REVEAL" && <SharedRole view={hv} psycoName={hv.psycoNickname ?? psycoName} onSeen={() => void act({ action: "seen" })} />}
      {state.phase === "DIFFICULTY_VOTE" && v && <DifficultyVote myVote={hv.myVote} busy={!!busy} onVote={(c) => void act({ action: "vote", ballot: v.ballot, choice: c })} />}
      {state.phase === "RULE_VOTE" && v && hv.secret?.candidate && (
        <CandidateVote candidate={hv.secret.candidate} myVote={hv.myVote} busy={!!busy} shown={r.candidatesShown} onVote={(c) => void act({ action: "vote", ballot: v.ballot, choice: c })} />
      )}
      {state.phase === "RULE_PROPOSALS" && hv.secret && (
        <ProposalForm
          myProposal={hv.myProposal}
          myPassed={hv.myPassed}
          others={hv.secret.proposals}
          busy={!!busy}
          onPropose={(text, category, hint) => act({ action: "propose", text, category, hint })}
          onPass={() => void act({ action: "pass" })}
        />
      )}
      {state.phase === "PROPOSAL_VOTE" && v && hv.secret && (
        <ProposalVote proposals={hv.secret.proposals} runoff={v.runoff} myVote={hv.myVote} busy={!!busy} onVote={(id) => void act({ action: "vote", ballot: v.ballot, choice: id })} />
      )}
      {hv.role === "psyco" && state.phase !== "ROLE_REVEAL" && (
        <DontLook sub={desktop ? "Sei lo PSYCO: questa scelta non è per te. Lascia il posto al prossimo." : "Sei lo PSYCO: questa scelta non è per te. Passa il telefono."} />
      )}
      <button type="button" className="psy-chip" onClick={done}>
        Copri lo schermo
      </button>
    </div>
  );
}

function phaseTitle(phase: PsycoPublicState["phase"]): string {
  return { DIFFICULTY_VOTE: "Scegliete la difficoltà", RULE_VOTE: "Votate la regola", RULE_PROPOSALS: "Scrivete le regole", PROPOSAL_VOTE: "Votate la regola migliore" }[phase as string] ?? "";
}

function SharedRole({ view, psycoName, onSeen }: { view: PsycoPrivateView; psycoName: string; onSeen: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 350);
    return () => clearTimeout(t);
  }, []);
  return (
    <section className="flex flex-col items-center gap-5 text-center">
      <RoleFlipCard open={open} role={view.role} psycoName={view.role === "knower" ? psycoName : null} />
      <button type="button" className="psy-btn w-full max-w-sm" onClick={onSeen}>
        HO VISTO IL MIO RUOLO
      </button>
    </section>
  );
}

/**
 * «CHIAMA L'INVESTIGATORE» sul dispositivo condiviso: la chiamata è per lo PSYCO (schermata a tutto
 * schermo «per MIKE»), l'indizio arriva dalla vista privata dello PSYCO (`as`), mai da quella pubblica.
 * I messaggi si rileggono scegliendo «SONO MIKE» (come la regola per chi la conosce).
 */
function SharedCall({ state, roomId, refresh, now }: { state: PsycoPublicState; roomId: string; refresh: () => void; now: () => number }) {
  const r = state.round!;
  const [ringing, setRinging] = useState(false);
  const [reading, setReading] = useState<InvestigatorMessage[] | null>(null);
  const [asking, setAsking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const live = useLive(r.timer, now);
  const psycoId = r.psycoId;
  if (r.calls.max <= 0 || !psycoId) return null;
  const playing = state.phase === "PLAYING" && live;

  async function openMessages() {
    setErr(null);
    try {
      const v = await api<PsycoView>(`/api/psyco/rooms/${roomId}?as=${psycoId}`);
      setReading(v.view.investigator?.messages ?? []);
      setAsking(false);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Connessione assente");
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <CallButton max={r.calls.max} used={r.calls.used} disabled={!playing} onCall={() => setRinging(true)} />
      {r.calls.used > 0 &&
        (asking ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-bold text-paper/75">Solo {r.psycoNickname} può leggerli. Gli altri non guardino.</p>
            <div className="flex gap-2">
              <button type="button" className="psy-btn psy-btn-paper text-lg" onClick={() => void openMessages()}>
                SONO {r.psycoNickname.toUpperCase()}: MOSTRA
              </button>
              <button type="button" className="psy-chip" onClick={() => setAsking(false)}>
                Annulla
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="psy-chip" onClick={() => setAsking(true)}>
            📩 Messaggi di {r.psycoNickname} ({r.calls.used})
          </button>
        ))}
      <ErrorNote error={err} />
      {ringing && (
        <IncomingCall
          active={state.phase === "PLAYING"}
          forName={r.psycoNickname}
          isLast={r.calls.used + 1 >= r.calls.max}
          onAnswer={async (id) => {
            const res = await psycoAct(roomId, { action: "call_investigator", requestId: id }, psycoId);
            refresh();
            const list = "state" in res ? (res.view.investigator?.messages ?? []) : [];
            const last = list[list.length - 1];
            if (!last) throw new Error("La linea è caduta: riprova");
            return last;
          }}
          onClose={() => setRinging(false)}
        />
      )}
      {reading && <MessagesSheet messages={reading} forName={r.psycoNickname} onClose={() => setReading(null)} />}
    </div>
  );
}

/** Rivedere la regola sul telefono condiviso: si sceglie il proprio nome (mai lo PSYCO) e la si tiene premuta. */
function PeekRule({ state, roomId }: { state: PsycoPublicState; roomId: string }) {
  const [who, setWho] = useState<string>("");
  const [rule, setRule] = useState<PsycoPrivateView["secret"] | null>(null);
  const [holding, setHolding] = useState(false);
  const r = state.round!;
  const knowers = state.participants.filter((p) => r.members.includes(p.id) && p.id !== r.psycoId);
  async function load(id: string) {
    setWho(id);
    setRule(null);
    if (!id) return;
    const v = await api<PsycoView>(`/api/psyco/rooms/${roomId}?as=${id}`).catch(() => null);
    setRule(v?.view.secret ?? null);
  }
  return (
    <details className="psy-panel w-full max-w-md rounded-2xl p-4 text-left" onToggle={(e) => !(e.currentTarget as HTMLDetailsElement).open && void load("")}>
      <summary className="cursor-pointer font-extrabold">Rivedi la regola (solo chi la conosce)</summary>
      <div className="mt-3 flex flex-col gap-3">
        <select className="psy-input" value={who} onChange={(e) => void load(e.target.value)} aria-label="Chi sei">
          <option value="">— chi sei? —</option>
          {knowers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nickname}
            </option>
          ))}
        </select>
        {rule?.rule && (
          <button
            type="button"
            className="psy-btn psy-btn-paper text-xl select-none"
            onPointerDown={() => setHolding(true)}
            onPointerUp={() => setHolding(false)}
            onPointerLeave={() => setHolding(false)}
            onContextMenu={(e) => e.preventDefault()}
          >
            TIENI PREMUTO PER VEDERE
          </button>
        )}
        {holding && rule?.rule && <RuleCard rule={rule.rule} className="w-full" />}
      </div>
    </details>
  );
}

/** Verifica del tentativo sul telefono condiviso: ognuno tocca il proprio nome (il voto non rivela la regola). */
function SharedGuessVote({ state, run, busy }: { state: PsycoPublicState; run: Run; busy: string | null }) {
  const r = state.round!;
  const v = r.vote!;
  const knowers = state.participants.filter((p) => r.members.includes(p.id) && p.id !== r.psycoId);
  return (
    <section className="flex w-full max-w-xl flex-col items-center gap-4 text-center">
      <h2 className="psy-title text-5xl md:text-6xl">HA INDOVINATO?</h2>
      <p className="psy-type text-lg text-paper/90">
        {r.psycoNickname} spiega a voce la regola. Ognuno vota col proprio nome: serve la maggioranza.{v.ballot.endsWith("#2") ? " Parità: si rivota, poi vale il «no»." : ""}
      </p>
      <ul className="flex w-full flex-col gap-2">
        {knowers.map((p) => {
          const voted = v.voted.includes(p.id);
          return (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/6 px-4 py-3 ring-1 ring-white/12">
              <span className="font-extrabold">{p.nickname}</span>
              {voted ? (
                <span className="font-black text-[#5fe08a]">Votato ✓</span>
              ) : (
                <span className="flex gap-2">
                  <button type="button" disabled={!!busy} className={clsx("psy-chip !bg-blood/80")} onClick={() => void run({ action: "vote", ballot: v.ballot, choice: "yes" }, p.id)}>
                    Sì
                  </button>
                  <button type="button" disabled={!!busy} className="psy-chip" onClick={() => void run({ action: "vote", ballot: v.ballot, choice: "no" }, p.id)}>
                    No
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <Progress done={v.voted.length} total={v.eligible} label="Hanno votato" />
    </section>
  );
}
