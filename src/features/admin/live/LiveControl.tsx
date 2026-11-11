"use client";

import { clsx } from "clsx";
import { useAutoReload } from "@/lib/realtime/use-auto-reload";
import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AdminLiveState } from "@/lib/server/admin-live";
import type { GameCommand } from "@/lib/game-engine/types";
import { COMMAND_LABELS, PHASE_LABELS } from "@/lib/game-engine/transitions";
import { api, ApiError, uuid } from "@/lib/realtime/api-client";
import { Badge, Button, Field, Input, Modal, Select, Toggle, useConfirm, useToast } from "@/components/ui";
import { LETTERS } from "@/features/game/components/answers";
import { EVENT_ICON, formatPoints, signedPoints } from "@/features/game/lines";
import { TvStage } from "@/features/display/TvStage";
import { TvMessageScreen } from "@/features/display/TvScreens";
import { useCan } from "@/features/admin/AdminShell";
import { computeLiveTiming } from "@/lib/show/running-order";
import { TimingBadge, TimingPanel } from "./TimingPanel";

type Args = Record<string, unknown>;

const MAIN_FLOW: GameCommand[] = [
  "OPEN_LOBBY",
  "START_INTRO",
  "SKIP_INTRO",
  "START_ROUND",
  "START_VOTE",
  "CLOSE_VOTE",
  "SHOW_QUESTION",
  "SHOW_OPTIONS",
  "CLOSE_ANSWERS",
  "REVEAL",
  "SCORE",
  "SHOW_LEADERBOARD",
];

const CMD_STYLE: Partial<Record<GameCommand, "gold" | "primary" | "success" | "violet" | "danger">> = {
  SHOW_QUESTION: "primary",
  SHOW_OPTIONS: "success",
  REVEAL: "violet",
  SCORE: "gold",
  CLOSE_ANSWERS: "danger",
};

export function LiveControl({ sessionId, embedded = false }: { sessionId: string; embedded?: boolean }) {
  useAutoReload();
  const [live, setLive] = useState<AdminLiveState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<GameCommand | null>(null);
  const [offset, setOffset] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const [eventModal, setEventModal] = useState(false);
  const [tieModal, setTieModal] = useState<string[] | null>(null);
  const [adjust, setAdjust] = useState<{ id: string; nickname: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const canAdmin = useCan("admin");
  const versionRef = useRef<number>(0);
  const failsRef = useRef(0);

  const load = useCallback(async () => {
    const t0 = Date.now();
    try {
      const r = await api<AdminLiveState>(`/api/admin/sessions/${sessionId}/live`);
      const t1 = Date.now();
      setOffset(Date.parse(r.public.serverNow) - (t0 + (t1 - t0) / 2));
      versionRef.current = r.public.version;
      setLive(r);
      setError(null);
      failsRef.current = 0;
    } catch (e) {
      failsRef.current += 1;
      if (failsRef.current >= 2) setError(e instanceof ApiError ? e.message : "Connessione assente");
    }
  }, [sessionId]);

  // Ricaricare la regia non fa perdere nulla: lo stato è sempre quello del server.
  const phase = live?.public.phase;
  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const fast = phase === "OPTIONS_VISIBLE" || phase === "CATEGORY_VOTING" || phase === "LOBBY";
    const id = setInterval(() => void load(), fast ? 1000 : 2500);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load, phase]);
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const joinUrl = useMemo(() => (live && typeof window !== "undefined" ? `${process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost") ? process.env.NEXT_PUBLIC_APP_URL : window.location.origin}/play/${live.code}` : ""), [live]);
  useEffect(() => {
    if (joinUrl) void QRCode.toDataURL(joinUrl, { margin: 1, width: 360 }).then(setQr).catch(() => setQr(null));
  }, [joinUrl]);

  const send = useCallback(
    async (command: GameCommand, args: Args = {}, opts: { skipConfirm?: boolean } = {}): Promise<boolean> => {
      if (pending) return false;
      if (!opts.skipConfirm) {
        if (command === "FINISH") {
          const okc = await confirm({ title: "Terminare la partita?", message: "Verrà mostrato il podio finale e la classifica sarà congelata. L'operazione non si può annullare.", confirmLabel: "TERMINA", danger: true, typeToConfirm: "FINE" });
          if (!okc) return false;
        }
        if (command === "RESET_TEST") {
          const okc = await confirm({ title: "Resettare la simulazione?", message: "Giocatori, risposte e punteggi di questa prova verranno cancellati.", confirmLabel: "RESET", danger: true });
          if (!okc) return false;
        }
        if (command === "SKIP_INTRO") {
          const okc = await confirm({ title: "Saltare l'introduzione?", message: "Il TV passerà subito al logo finale.", confirmLabel: "Salta" });
          if (!okc) return false;
        }
      }
      setPending(command);
      let current: Args = args;
      try {
        // Il ciclo permette di ripetere il comando con "force" dopo una conferma.
        for (;;) {
          try {
            await api(`/api/admin/sessions/${sessionId}/command`, {
              method: "POST",
              json: { command, commandId: uuid(), expectedVersion: versionRef.current, args: current },
              timeoutMs: 15000,
            });
            await load();
            return true;
          } catch (e) {
            if (e instanceof ApiError && e.code === "TIMER_RUNNING" && !current.force) {
              const okc = await confirm({ title: "Il tempo non è ancora scaduto", message: "Vuoi chiudere le risposte e rivelare subito la soluzione?", confirmLabel: "Rivela comunque", danger: true });
              if (!okc) return false;
              current = { ...current, force: true };
              continue;
            }
            if (e instanceof ApiError && e.code === "TIE_NEEDS_ADMIN") {
              setTieModal(((e.details as { tied?: string[] } | undefined)?.tied ?? []) as string[]);
              return false;
            }
            if (e instanceof ApiError && e.code === "VERSION_CONFLICT") {
              toast("info", "Lo stato era già cambiato: regia aggiornata");
              await load();
              return false;
            }
            toast("error", e instanceof ApiError ? e.message : "Comando non inviato");
            await load();
            return false;
          }
        }
      } finally {
        setPending(null);
      }
    },
    [pending, sessionId, load, confirm, toast],
  );

  const media = useCallback(
    async (action: "play" | "stop" | "test-tone") => {
      try {
        await api(`/api/admin/sessions/${sessionId}/media`, { method: "POST", json: { action } });
        toast("ok", action === "play" ? "Riproduzione avviata sul TV" : action === "stop" ? "Audio fermato" : "Tono di prova inviato al TV");
      } catch (e) {
        toast("error", e instanceof ApiError ? e.message : "Errore");
      }
    },
    [sessionId, toast],
  );

  if (!live) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-6 text-center">
        <p className="font-bold text-white/70">{error ?? "Caricamento regia…"}</p>
      </div>
    );
  }

  const st = live.public;
  const now = clock + offset;
  const vp = st.phase === "PAUSED" && st.pausedFrom ? st.pausedFrom : st.phase;
  const closesAt = vp === "CATEGORY_VOTING" ? st.vote?.closesAt : st.question?.closesAt;
  const remainingMs = closesAt && st.phase !== "PAUSED" ? Math.max(0, Date.parse(closesAt) - now) : 0;
  const allowed = new Set(live.allowed);
  const displayUrl = `/display/${sessionId}?k=${live.displayKey}`;
  const currentRound = live.rounds.find((r) => r.id === st.round?.id) ?? null;

  const flowButtons = MAIN_FLOW.filter((c) => allowed.has(c));
  const timing = computeLiveTiming(live.timing.plan, live.timing.input, now);

  return (
    <div className={clsx("flex flex-col gap-3", !embedded && "min-h-dvh p-3 md:p-4")}>
      {/* intestazione */}
      <header className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#1d0c30] px-4 py-3">
        {!embedded && (
          <Link href={`/admin/sessions/${sessionId}`} className="rounded-lg bg-white/10 px-3 py-1 text-sm font-bold">
            ← Sessione
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl text-gold">{st.title}</p>
          <p className="text-sm text-white/60">
            Codice <span className="font-display tracking-widest text-white">{st.code}</span> · v{st.version}
            {live.isTest && <Badge color="violet" className="ml-2">PROVA</Badge>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={st.phase === "PAUSED" ? "red" : st.phase === "FINISHED" ? "gray" : "green"} className="px-3 py-1 text-sm">
            {PHASE_LABELS[st.phase]}
          </Badge>
          <Badge color="blue" className="px-3 py-1 text-sm">
            👥 {live.counts.players} ({live.counts.online} online)
          </Badge>
          <TimingBadge timing={timing} />
          <a href={displayUrl} target="_blank" rel="noopener" className="rounded-lg bg-electric px-3 py-1.5 text-sm font-extrabold">
            📺 Apri schermo TV
          </a>
          <button
            className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold"
            onClick={() => {
              void navigator.clipboard?.writeText(joinUrl);
              toast("ok", "Link giocatori copiato");
            }}
          >
            🔗 Link giocatori
          </button>
        </div>
      </header>

      {live.warnings.length > 0 && (
        <div className="flex flex-col gap-1 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-2">
          {live.warnings.map((w) => (
            <p key={w} className="text-sm font-bold text-gold">
              ⚠ {w}
            </p>
          ))}
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-[1.25fr_1fr]">
        {/* colonna comandi */}
        <section className="flex flex-col gap-3">
          <div className="rounded-2xl border-2 border-gold/50 bg-[#1d0c30] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl text-white">Comandi</h2>
              {live.suggested && (
                <span className="text-sm font-bold text-white/70">
                  Prossima azione: <span className="text-gold">{COMMAND_LABELS[live.suggested]}</span>
                </span>
              )}
            </div>
            {live.suggested && allowed.has(live.suggested) && (
              <Button
                variant={CMD_STYLE[live.suggested] ?? "gold"}
                size="xl"
                className="mb-3 w-full"
                loading={pending === live.suggested}
                disabled={!!pending}
                onClick={() => (live.suggested === "ACTIVATE_EVENT" ? setEventModal(true) : void send(live.suggested!))}
              >
                {COMMAND_LABELS[live.suggested]} ▶
              </Button>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {flowButtons
                .filter((c) => c !== live.suggested)
                .map((c) => (
                  <Button key={c} variant={CMD_STYLE[c] ?? "ghost"} size="lg" loading={pending === c} disabled={!!pending} onClick={() => void send(c)}>
                    {COMMAND_LABELS[c]}
                  </Button>
                ))}
              {allowed.has("ACTIVATE_EVENT") && (
                <Button variant="violet" size="lg" disabled={!!pending} onClick={() => setEventModal(true)}>
                  🌴 ATTIVA EVENTO
                </Button>
              )}
              {allowed.has("PAUSE") && (
                <Button variant="outline" size="lg" disabled={!!pending} onClick={() => void send("PAUSE")}>
                  ⏸ PAUSA
                </Button>
              )}
              {allowed.has("RESUME") && (
                <Button variant="success" size="lg" disabled={!!pending} onClick={() => void send("RESUME")}>
                  ▶ RIPRENDI
                </Button>
              )}
              {allowed.has("FINISH") && (
                <Button variant="danger" size="lg" disabled={!!pending} onClick={() => void send("FINISH")}>
                  TERMINA PARTITA
                </Button>
              )}
            </div>
            {allowed.has("START_ROUND") && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-bold text-white/60">Avvia un round specifico:</span>
                {live.rounds
                  .filter((r) => !r.startedAt)
                  .map((r) => (
                    <button key={r.id} disabled={!!pending} onClick={() => void send("START_ROUND", { roundId: r.id })} className="rounded-lg bg-white/10 px-2 py-1 font-bold hover:bg-white/20">
                      {r.position + 1}. {r.title}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* domanda corrente con soluzione (solo regia) */}
          <div className="rounded-2xl border border-white/10 bg-[#1d0c30] p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg text-white">Domanda attuale</h2>
              {(vp === "OPTIONS_VISIBLE" || vp === "CATEGORY_VOTING") && (
                <span className={clsx("font-display text-3xl", remainingMs < 5000 ? "text-flame" : "text-lime")}>{Math.ceil(remainingMs / 1000)}s</span>
              )}
            </div>
            {live.current ? (
              <>
                <p className="text-lg font-extrabold">{live.current.text}</p>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {live.current.options.map((o) => (
                    <div key={o.position} className={clsx("flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold", o.isCorrect ? "bg-lime/25 ring-2 ring-lime" : "bg-white/5")}>
                      <span className="font-display">{LETTERS[o.position]}</span>
                      <span className="flex-1">{o.text}</span>
                      <span className="text-white/70">{live.current!.distribution[o.position]}</span>
                      {o.isCorrect && <span className="text-lime">✓</span>}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-cyan transition-all" style={{ width: `${live.current.eligible ? (live.current.answered / live.current.eligible) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-bold">
                    {live.current.answered}/{live.current.eligible} risposte
                  </span>
                </div>
                {live.current.mediaKind === "audio" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="violet" onClick={() => void media("play")}>
                      ▶ Riproduci sul TV
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void media("stop")}>
                      ■ Stop
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-white/60">Nessuna domanda in corso.</p>
            )}
            {st.vote && (
              <div className="mt-3 rounded-xl bg-white/5 p-3 text-sm">
                <p className="font-bold">Votazione: {live.counts.voted} voti</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {st.vote.options.map((o) => (
                    <Badge key={o.id} color={st.vote!.winnerOptionId === o.id ? "green" : "gray"}>
                      {LETTERS[o.position]} {o.label} {o.votes ?? ""}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {live.next && (
              <div className="mt-3 rounded-xl border border-dashed border-white/15 p-3 text-sm">
                <p className="font-bold text-white/60">Prossima domanda · {live.next.roundTitle}</p>
                <p className="font-bold">{live.next.text}</p>
                {live.next.scheduledEvent && <p className="mt-1 text-fuchsia">🌴 Evento programmato: {live.next.scheduledEvent}</p>}
              </div>
            )}
          </div>

          {/* giocatori */}
          <PlayersPanel
            live={live}
            canAdmin={canAdmin}
            pending={!!pending}
            onAssign={(participantId, teamId) => void send("ASSIGN_TEAM", { participantId, teamId }, { skipConfirm: true })}
            onBalance={async (onlyUnassigned) => {
              const okc = await confirm({
                title: onlyUnassigned ? "Assegnare i giocatori senza squadra?" : "Bilanciare le squadre?",
                message: onlyUnassigned
                  ? "I giocatori senza squadra vengono distribuiti nelle squadre più piccole (e con meno punti)."
                  : "Tutti i giocatori vengono ridistribuiti: squadre con lo stesso numero di giocatori e punti il più possibile simili. I punti personali non cambiano.",
                confirmLabel: onlyUnassigned ? "Assegna" : "Bilancia",
              });
              if (okc) await send("BALANCE_TEAMS", { onlyUnassigned }, { skipConfirm: true });
            }}
            onKick={async (id, nick) => {
              const okc = await confirm({ title: `Espellere ${nick}?`, message: "Il giocatore non potrà più rispondere in questa partita.", confirmLabel: "Espelli", danger: true });
              if (okc) await send("KICK", { participantId: id, reason: "Espulso dalla regia" }, { skipConfirm: true });
            }}
            onAdjust={(id, nickname) => setAdjust({ id, nickname })}
          />
        </section>

        {/* colonna anteprima TV e impostazioni */}
        <section className="flex flex-col gap-3">
          <div className="rounded-2xl border border-white/10 bg-[#1d0c30] p-3">
            <p className="mb-2 text-sm font-bold text-white/60">Anteprima schermo TV</p>
            <div className="relative aspect-video w-full overflow-hidden rounded-xl [container-type:size]">
              <TvStage
                state={st}
                remainingMs={remainingMs}
                mediaUrl={(id) => `/api/display/${sessionId}/media/${id}?k=${live.displayKey}`}
                qrDataUrl={qr}
                joinUrl={joinUrl}
                intro={<TvMessageScreen title="Intro 3D in onda sul TV" subtitle="Usa SALTA INTRO per andare al logo finale" />}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#1d0c30] p-4">
            <h2 className="mb-2 font-display text-lg">Ingressi e audio</h2>
            <div className="flex flex-col gap-2">
              <Toggle checked={!st.joinLocked} label="Nuovi ingressi consentiti" onChange={(v) => void send("SET_JOIN", { joinLocked: !v })} disabled={!!pending || st.phase === "FINISHED"} />
              <Toggle checked={st.allowLateJoin} label="Ingressi tardivi (a partita iniziata)" onChange={(v) => void send("SET_JOIN", { allowLateJoin: v })} disabled={!!pending || st.phase === "FINISHED"} />
              <div className="mt-1 flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => void media("test-tone")}>
                  🔊 Prova volume sul TV
                </Button>
              </div>
            </div>
            {qr && (
              <div className="mt-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR giocatori" className="h-24 w-24 rounded-lg bg-white p-1" />
                <p className="break-all text-xs text-white/60">{joinUrl}</p>
              </div>
            )}
          </div>

          {live.isTest && <TestTools send={send} pending={!!pending} allowed={allowed} />}

          <TimingPanel live={live} timing={timing} />
          <PresentersLivePanel sessionId={sessionId} version={live.public.version} />
          <RoundsOverview live={live} currentRoundId={currentRound?.id ?? null} />
        </section>
      </div>

      <EventModal
        open={eventModal}
        onClose={() => setEventModal(false)}
        live={live}
        onActivate={async (key, reserveId) => {
          const okd = await send("ACTIVATE_EVENT", { definitionKey: key, ...(reserveId ? { reserveQuestionId: reserveId } : {}) });
          if (okd) setEventModal(false);
        }}
      />
      <Modal open={!!tieModal} onClose={() => setTieModal(null)} title="Parità! Voto decisivo della regia">
        <div className="flex flex-col gap-2">
          {st.vote?.options
            .filter((o) => tieModal?.includes(o.id))
            .map((o) => (
              <Button
                key={o.id}
                variant="gold"
                size="lg"
                onClick={async () => {
                  setTieModal(null);
                  await send("CLOSE_VOTE", { adminChoice: o.id }, { skipConfirm: true });
                }}
              >
                {LETTERS[o.position]} · {o.label}
              </Button>
            ))}
        </div>
      </Modal>
      <AdjustModal
        target={adjust}
        onClose={() => setAdjust(null)}
        onSubmit={async (delta, reason) => {
          const okd = await send("ADJUST_SCORE", { participantId: adjust!.id, delta, reason }, { skipConfirm: true });
          if (okd) setAdjust(null);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
const WHO_ICON: Record<string, string> = { professore: "🎓", regina: "👑", palmino: "🌴" };

/** Presentatori in diretta: commenti automatici on/off e ultime battute dette (con i nomi veri). */
function PresentersLivePanel({ sessionId, version }: { sessionId: string; version: number }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [lines, setLines] = useState<{ who: string; event: string; text: string; at: string }[]>([]);
  useEffect(() => {
    let alive = true;
    void api<{ config: { enabled: boolean } }>("/api/admin/show/config").then((r) => alive && setEnabled(r.config.enabled)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    let alive = true;
    void api<{ lines: { who: string; event: string; text: string; at: string }[] }>(`/api/admin/sessions/${sessionId}/show-log`)
      .then((r) => alive && setLines(r.lines))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [sessionId, version]);
  const toggle = async (v: boolean) => {
    try {
      const r = await api<{ config: { enabled: boolean } }>("/api/admin/show/config", { method: "PUT", json: { enabled: v } });
      setEnabled(r.config.enabled);
      toast("ok", v ? "Commenti automatici attivi" : "Commenti automatici spenti");
    } catch (e) {
      toast("error", e instanceof ApiError ? e.message : "Non riuscito");
    }
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-[#1d0c30] p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg">Presentatori</h2>
        {enabled !== null && <Toggle checked={enabled} onChange={(v) => void toggle(v)} label={enabled ? "Commenti automatici" : "Commenti spenti"} />}
      </div>
      {lines.length === 0 ? (
        <p className="text-sm text-white/55">Ancora nessun commento: parlano dopo i punti, quando succede qualcosa di interessante.</p>
      ) : (
        <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
          {lines.map((l, i) => (
            <li key={i} className="text-sm">
              <span className="mr-1">{WHO_ICON[l.who] ?? "🎙️"}</span>
              <span className="text-white/90">{l.text.replace(/\[[a-z ]+\]\s*/gi, "")}</span>
            </li>
          ))}
        </ul>
      )}
      <Link href="/admin/presentatori" className="mt-2 inline-block text-xs font-bold text-gold underline">
        Battute e regole →
      </Link>
    </div>
  );
}

function PlayersPanel({
  live,
  canAdmin,
  pending,
  onKick,
  onAdjust,
  onAssign,
  onBalance,
}: {
  live: AdminLiveState;
  canAdmin: boolean;
  pending: boolean;
  onKick: (id: string, nick: string) => void;
  onAdjust: (id: string, nick: string) => void;
  onAssign: (participantId: string, teamId: string | null) => void;
  onBalance: (onlyUnassigned: boolean) => void;
}) {
  const [filter, setFilter] = useState("");
  const list = live.participants.filter((p) => p.nickname.toLowerCase().includes(filter.toLowerCase()));
  const teamsOn = live.teamSettings.mode !== "individual";
  const showTeams = teamsOn || live.teams.length > 0;
  const teamOf = new Map(live.teams.map((t) => [t.id, t]));
  const finished = live.public.phase === "FINISHED";
  const unassigned = live.participants.filter((p) => p.status === "active" && !p.teamId).length;
  return (
    <div className="rounded-2xl border border-white/10 bg-[#1d0c30] p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg">Giocatori ({live.counts.players})</h2>
        <Input placeholder="Cerca…" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 max-w-48 py-1 text-sm" />
      </div>
      {showTeams && (
        <div className="mb-3 rounded-xl bg-white/5 p-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">Squadre</span>
            {!teamsOn && <Badge color="gray">modalità individuale</Badge>}
            {teamsOn && <Badge color="gold">{live.teamSettings.selfSelect ? "scelgono i giocatori" : "assegna la regia"}</Badge>}
            {live.teams.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold" style={{ borderColor: t.color }}>
                <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                {t.name} · {t.members}
              </span>
            ))}
          </div>
          {live.teams.length >= 2 && !finished && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="violet" disabled={pending} onClick={() => onBalance(false)}>
                ⚖ Bilancia squadre
              </Button>
              <Button size="sm" variant="ghost" disabled={pending || unassigned === 0} onClick={() => onBalance(true)}>
                Assegna i {unassigned} senza squadra
              </Button>
            </div>
          )}
          {live.teams.length < 2 && <p className="mt-1 text-xs text-white/60">Crea almeno 2 squadre nell&apos;editor della serata.</p>}
        </div>
      )}
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-white/50">
            <tr>
              <th className="py-1">#</th>
              <th>Nickname</th>
              {showTeams && <th>Squadra</th>}
              <th className="text-right">Punti</th>
              <th className="text-center">Stato</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className={clsx("border-t border-white/5", p.status !== "active" && "opacity-40")}>
                <td className="py-1.5 font-display text-gold">{p.rank ?? "–"}</td>
                <td className="font-bold">
                  {p.nickname} {p.isBot && <Badge color="violet">bot</Badge>} {p.anomalies > 0 && <Badge color="red">{p.anomalies} anomalie</Badge>}
                </td>
                {showTeams && (
                  <td>
                    {p.status === "active" && !finished ? (
                      <select
                        aria-label={`Squadra di ${p.nickname}`}
                        className="h-7 max-w-36 rounded border border-white/15 bg-black/40 px-1 text-xs font-bold"
                        style={p.teamId ? { borderColor: teamOf.get(p.teamId)?.color } : undefined}
                        value={p.teamId ?? ""}
                        disabled={pending}
                        onChange={(e) => onAssign(p.id, e.target.value || null)}
                      >
                        <option value="">— nessuna —</option>
                        {live.teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-white/60">{p.teamId ? (teamOf.get(p.teamId)?.name ?? "") : "—"}</span>
                    )}
                  </td>
                )}
                <td className="text-right font-display">{formatPoints(p.points)}</td>
                <td className="text-center">
                  <span title={p.online ? "Online" : "Non risponde da oltre 60 s"} className={clsx("inline-block h-2.5 w-2.5 rounded-full", p.online ? "bg-lime" : "bg-white/30")} />
                  {p.answeredCurrent && <span className="ml-1 text-cyan" title="Ha risposto">✓</span>}
                </td>
                <td className="text-right">
                  {p.status === "active" && (
                    <span className="flex justify-end gap-1">
                      {canAdmin && (
                        <button className="rounded bg-white/10 px-2 py-0.5 text-xs font-bold" onClick={() => onAdjust(p.id, p.nickname)}>
                          ±
                        </button>
                      )}
                      <button className="rounded bg-flame/30 px-2 py-0.5 text-xs font-bold" onClick={() => onKick(p.id, p.nickname)}>
                        Espelli
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="py-4 text-center text-white/50">Nessun giocatore</p>}
      </div>
    </div>
  );
}

function RoundsOverview({ live, currentRoundId }: { live: AdminLiveState; currentRoundId: string | null }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#1d0c30] p-4">
      <h2 className="mb-2 font-display text-lg">Scaletta</h2>
      <ol className="flex flex-col gap-2 text-sm">
        {live.rounds.map((r) => (
          <li key={r.id} className={clsx("rounded-xl p-2", r.id === currentRoundId ? "bg-gold/15 ring-1 ring-gold" : "bg-white/5")}>
            <p className="font-bold">
              {r.position + 1}. {r.title} <span className="text-white/50">· {r.kind}</span> {r.startedAt && <Badge color="green">avviato</Badge>}
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {r.questions.map((q) => (
                <li key={q.id} className={clsx("flex gap-2", q.scoredAt ? "text-white/40 line-through" : q.shownAt ? "text-cyan" : "text-white/80")}>
                  <span className="truncate">
                    {q.isReserve ? "🎁 " : ""}
                    {q.voteOptionId ? `[${r.voteOptions.find((o) => o.id === q.voteOptionId)?.label ?? "?"}] ` : ""}
                    {q.text}
                  </span>
                  {q.scheduledEvent && <span className="shrink-0 text-fuchsia">🌴</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TestTools({ send, pending, allowed }: { send: (c: GameCommand, a?: Args, o?: { skipConfirm?: boolean }) => Promise<boolean>; pending: boolean; allowed: Set<GameCommand> }) {
  const [count, setCount] = useState(10);
  return (
    <div className="rounded-2xl border-2 border-violet/60 bg-violet/10 p-4">
      <h2 className="mb-2 font-display text-lg text-[#c9a3ff]">Prova generale (simulazione)</h2>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Bot">{(id) => <Input id={id} type="number" min={1} max={200} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-24" />}</Field>
        <Button variant="violet" disabled={pending || !allowed.has("SIM_ADD_BOTS")} onClick={() => void send("SIM_ADD_BOTS", { count })}>
          + Aggiungi bot
        </Button>
        <Button variant="ghost" disabled={pending || !allowed.has("SIM_BOTS_ANSWER")} onClick={() => void send("SIM_BOTS_ANSWER")}>
          Bot: rispondi
        </Button>
        <Button variant="ghost" disabled={pending || !allowed.has("SIM_BOTS_VOTE")} onClick={() => void send("SIM_BOTS_VOTE")}>
          Bot: vota
        </Button>
        <Button variant="danger" disabled={pending || !allowed.has("RESET_TEST")} onClick={() => void send("RESET_TEST")}>
          Reset simulazione
        </Button>
      </div>
      <p className="mt-2 text-xs text-white/60">In modalità prova la soluzione si può rivelare senza attendere il timer e nulla entra nelle classifiche reali.</p>
    </div>
  );
}

function EventModal({ open, onClose, live, onActivate }: { open: boolean; onClose: () => void; live: AdminLiveState; onActivate: (key: string, reserveId: string | null) => void }) {
  const [reserve, setReserve] = useState<string>("");
  return (
    <Modal open={open} onClose={onClose} title="Eventi di Palmino" wide>
      <p className="mb-3 text-sm text-white/70">
        L&apos;evento viene annunciato sul TV PRIMA che si aprano le risposte e vale per la {live.public.phase === "QUESTION_VISIBLE" ? "domanda attuale" : "prossima domanda"}. Le regole sono identiche per tutti.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {live.events.map((e) => {
          const exhausted = e.used >= e.max;
          return (
            <div key={e.key} className={clsx("rounded-xl border p-3", exhausted ? "border-white/10 opacity-50" : "border-fuchsia/50 bg-fuchsia/10")}>
              <p className="font-display text-lg">
                {EVENT_ICON[e.type]} {e.title}
              </p>
              <p className="text-sm text-white/70">{e.tagline}</p>
              <p className="mt-1 text-xs text-white/50">
                Usato {e.used}/{e.max}
              </p>
              {e.type === "mystery_question" && (
                <Select className="mt-2 text-sm" value={reserve} onChange={(ev) => setReserve(ev.target.value)}>
                  <option value="">Prima riserva disponibile</option>
                  {live.reserves.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.text.slice(0, 60)}
                    </option>
                  ))}
                </Select>
              )}
              <Button className="mt-2 w-full" variant="violet" size="sm" disabled={exhausted || (e.type === "mystery_question" && live.reserves.length === 0)} onClick={() => onActivate(e.key, e.type === "mystery_question" && reserve ? reserve : null)}>
                Attiva
              </Button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function AdjustModal({ target, onClose, onSubmit }: { target: { id: string; nickname: string } | null; onClose: () => void; onSubmit: (delta: number, reason: string) => void }) {
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");
  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={`Rettifica punti: ${target?.nickname ?? ""}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="gold" disabled={!delta || reason.trim().length < 3} onClick={() => onSubmit(delta, reason.trim())}>
            Applica {delta ? signedPoints(delta) : ""}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Variazione punti (negativa per togliere)">{(id) => <Input id={id} type="number" step={100} value={delta} onChange={(e) => setDelta(Number(e.target.value))} />}</Field>
        <Field label="Motivo (registrato nel log)">{(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Es. errore nella domanda 7" />}</Field>
      </div>
    </Modal>
  );
}
