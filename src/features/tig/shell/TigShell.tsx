"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getSoundEngine } from "@/features/media/audio-engine";
import { api, ApiError } from "@/lib/realtime/api-client";
import { runOfShow, STATE_LABEL, totalMinutes } from "@/lib/tig/rules";
import { MASCOT_SLOTS, MAX_DURATION, MAX_TABLES, MIN_DURATION, MIN_TABLES, type MyEvent } from "@/lib/tig/types";
import { Logo } from "../ui";
import { detectVisualQuality, TigArena } from "../visuals";

/**
 * LA SHELL DI TAVOLI IN GUERRA!: aprire il gioco = entrare nell'arena. Una pagina a tutto schermo con l'arena
 * sempre accesa e sopra il MENU da videogioco: RIPRENDI, CREA SERATA, ENTRA CON UN CODICE, REGOLAMENTO
 * (↑↓/Invio, mouse, tocco). CREA SERATA è un wizard a pannelli; poi si va in regia.
 */
export interface TigShellProps {
  loggedIn: boolean;
  username: string | null;
  events: MyEvent[];
  start: "menu" | "create";
}

const noop = () => () => {};

export function TigShell(props: TigShellProps) {
  const client = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  return (
    <div className="fixed inset-0 overflow-hidden">
      <h1 className="sr-only">TAVOLI IN GUERRA! · Il game show per pub che trasforma ogni tavolo in una squadra</h1>
      {client ? (
        <ShellClient {...props} />
      ) : (
        <div className="tig-arena grid place-items-center">
          <Logo size="xl" />
        </div>
      )}
    </div>
  );
}

type Panel = "main" | "create" | "resume";

function ShellClient({ loggedIn, username, events, start }: TigShellProps) {
  const [panel, setPanel] = useState<Panel>(start === "create" ? "create" : "main");
  const [quality] = useState(detectVisualQuality);
  const [focus, setFocus] = useState<string | null>(null);
  // schermo largo: a destra del menu l'arena con le postazioni dei tavoli (vetrina); sul telefono solo atmosfera
  const [wide] = useState(() => window.matchMedia?.("(min-width: 1024px)").matches ?? false);
  const goLogin = (next: string) => window.location.assign(`/accedi?next=${encodeURIComponent(next)}`);
  const select = (id: string) => {
    uiClick();
    switch (id) {
      case "riprendi":
        if (events.length === 1) window.location.assign(eventHref(events[0]));
        else setPanel("resume");
        return;
      case "crea":
        if (!loggedIn) return goLogin("/tavoli-in-guerra/nuova");
        return setPanel("create");
      case "entra":
        return window.location.assign("/tavoli-in-guerra/entra");
      case "regolamento":
        return window.location.assign("/tavoli-in-guerra/regolamento");
    }
  };
  const toMain = () => {
    if (window.location.pathname !== "/tavoli-in-guerra") window.history.replaceState(window.history.state, "", "/tavoli-in-guerra");
    setPanel("main");
  };
  const ledTitle = panel === "create" ? "CREA SERATA" : focus === "entra" ? "ENTRA AL TAVOLO" : focus === "regolamento" ? "LE REGOLE" : focus === "riprendi" ? "RIPRENDI" : "TAVOLI IN GUERRA!";
  return (
    <>
      <TigArena
        phase={panel === "create" ? "intro" : "lobby"}
        teams={wide ? SHOWCASE : []}
        mancheNo={null}
        title={wide ? ledTitle : null}
        subtitle={wide && panel === "main" ? "5 manche · 115 minuti · ogni tavolo è una squadra" : null}
        spotlight={wide && focus ? { kind: "duel", teamIds: [SHOWCASE[focus.length % SHOWCASE.length].teamId], eventId: focus } : null}
        hosts={wide ? [{ who: "don-patrizio", speaking: false }, { who: "zafira", speaking: false }] : []}
        now={() => Date.now()}
        quality={quality}
        safeArea={{ left: wide ? 0.52 : 0, top: 0.06, right: 0, bottom: 0.04 }}
      />
      <div className="absolute inset-0 flex flex-col lg:flex-row">
        <div className="tig-scroll relative z-10 flex min-h-0 w-full flex-1 flex-col justify-center overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(4rem+env(safe-area-inset-top))] lg:max-w-[min(46rem,52vw)] lg:px-10 lg:pt-16">
          {panel === "main" && <MainMenu events={events} loggedIn={loggedIn} onSelect={select} onActive={setFocus} />}
          {panel === "create" && <CreateWizard onExit={toMain} username={username} />}
          {panel === "resume" && <ResumePanel events={events} onBack={toMain} />}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-3 pt-[calc(.6rem+env(safe-area-inset-top))]">
        <Link href="/" prefetch={false} className="tig-chip pointer-events-auto hover:border-white/50" aria-label="Esci dal gioco: torna a CheNeSai">
          ‹ CheNeSai
        </Link>
        <span className="flex-1" />
        {loggedIn ? (
          <a href="/profilo" className="tig-chip pointer-events-auto max-w-[11rem] truncate hover:border-white/50">
            {username ? `@${username}` : "Il mio profilo"}
          </a>
        ) : (
          <a href={`/accedi?next=${encodeURIComponent("/tavoli-in-guerra")}`} className="tig-chip pointer-events-auto !border-[#ffb020]/70">
            ACCEDI
          </a>
        )}
      </div>
    </>
  );
}

/** Vetrina dell'arena nel menu: sei postazioni d'esempio (nessuna squadra vera). */
const SHOWCASE = [1, 2, 3, 4, 5, 6].map((n) => ({ teamId: `vetrina-${n}`, tableNo: n, name: `Tavolo ${n}`, color: ["#ff3b4e", "#ffb020", "#38d9ff", "#7cff4f", "#b46cff", "#ff6bd6"][n - 1], mascotSlot: n * 2 - 1, mascotLevel: (n % 3 === 0 ? 3 : n % 2 === 0 ? 2 : 1) as 1 | 2 | 3, score: [420, 380, 510, 290, 455, 340][n - 1], rank: 0, chaosProgress: [0.3, 0.7, 1, 0.15, 0.55, 0.9][n - 1], online: true }));

export const eventHref = (e: MyEvent) => (e.role === "organizer" ? `/tavoli-in-guerra/regia/${e.eventId}` : `/tavoli-in-guerra/gioca/${e.eventId}`);

function uiClick() {
  try {
    const e = getSoundEngine();
    if (e.unlocked) e.play("whoosh");
    else void e.unlock().then((ok) => ok && e.play("whoosh"));
  } catch {
    /* audio non disponibile */
  }
}

interface Item {
  id: string;
  label: string;
  sub: string;
  badge?: string;
  tone?: "red";
}

function MainMenu({ events, loggedIn, onSelect, onActive }: { events: MyEvent[]; loggedIn: boolean; onSelect: (id: string) => void; onActive: (id: string) => void }) {
  const items: Item[] = [
    ...(events.length ? [{ id: "riprendi", label: "RIPRENDI", sub: events.length === 1 ? `${events[0].venue} · ${STATE_LABEL[events[0].state]}${events[0].role === "organizer" ? " · regia" : ""}` : `${events.length} serate aperte`, badge: events[0].role === "organizer" ? "REGIA" : "IN GARA" }] : []),
    { id: "crea", label: "CREA SERATA", sub: loggedIn ? "Locale, tavoli, durata, QR: la regia è tua" : "Serve un account: accedi e si parte" },
    { id: "entra", label: "ENTRA CON UN CODICE", sub: "Il tuo tavolo ha un codice? Inseriscilo qui", tone: "red" },
    { id: "regolamento", label: "REGOLAMENTO", sub: "Manche, punti, poteri e Bottone del Caos" },
  ];
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (window.matchMedia?.("(pointer: fine)").matches) refs.current[0]?.focus({ preventScroll: true });
  }, []);
  const move = (to: number) => {
    const i = (to + items.length) % items.length;
    setActive(i);
    onActive(items[i].id);
    refs.current[i]?.focus({ preventScroll: true });
  };
  return (
    <section aria-label="Menu di TAVOLI IN GUERRA!" className="tig-rise flex w-full flex-col gap-[clamp(1rem,3vh,2rem)]">
      <Logo size="lg" tagline align="left" className="px-2" />
      <div
        role="menu"
        aria-label="Menu principale"
        className="flex flex-col gap-1.5"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") move(active + 1);
          else if (e.key === "ArrowUp") move(active - 1);
          else if (e.key === "Home") move(0);
          else if (e.key === "End") move(items.length - 1);
          else return;
          e.preventDefault();
        }}
      >
        {items.map((it, i) => {
          const on = i === active;
          return (
            <button
              key={it.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={on ? 0 : -1}
              data-active={on || undefined}
              onMouseEnter={() => {
                setActive(i);
                onActive(it.id);
              }}
              onFocus={() => setActive(i)}
              onClick={() => onSelect(it.id)}
              className={clsx("tig-menu-item group relative flex w-full flex-col items-start rounded-2xl px-5 py-2.5 text-left transition [outline:none]", on ? "text-white" : "text-white/60 hover:text-white")}
            >
              <span aria-hidden className={clsx("tig-menu-bar absolute inset-0 -skew-x-6 rounded-2xl border transition", on ? "opacity-100" : "opacity-0", it.tone === "red" ? "border-[#ff2d3d]/70 bg-gradient-to-r from-[#ff2d3d]/35 to-transparent" : "border-[#ffb020]/60 bg-gradient-to-r from-[#ffb020]/30 to-transparent")} />
              <span className="relative flex w-full items-center gap-3">
                <span aria-hidden className={clsx("text-xl transition", it.tone === "red" ? "text-[#ff6b78]" : "text-[#ffb020]", on ? "opacity-100" : "-translate-x-2 opacity-0")}>
                  ▶
                </span>
                <span className="tig-display min-w-0 flex-1 text-[clamp(1.7rem,min(3.4vw,6vh),2.9rem)] drop-shadow-[0_2px_0_rgba(0,0,0,.8)]">{it.label}</span>
                {it.badge && <span className="tig-chip shrink-0 !text-xs !tracking-[0.18em]">{it.badge}</span>}
              </span>
              <span className={clsx("relative ml-9 overflow-hidden text-sm font-bold text-white/80 transition-all", on ? "mt-0.5 max-h-10 opacity-100" : "max-h-0 opacity-0")}>{it.sub}</span>
            </button>
          );
        })}
      </div>
      <p className="hidden items-center gap-3 px-5 text-[11px] font-bold uppercase tracking-[0.15em] text-white/45 [@media(pointer:fine)]:flex">
        <kbd className="rounded border border-white/25 px-1.5 py-0.5 text-[10px]">↑↓</kbd> scegli <kbd className="rounded border border-white/25 px-1.5 py-0.5 text-[10px]">Invio</kbd> conferma
      </p>
    </section>
  );
}

function ResumePanel({ events, onBack }: { events: MyEvent[]; onBack: () => void }) {
  useEscape(onBack);
  return (
    <section className="tig-panel tig-pop flex flex-col gap-3 rounded-3xl p-5">
      <PanelHead kicker="Le tue serate" title="RIPRENDI" onBack={onBack} />
      <ul className="flex flex-col gap-2">
        {events.map((e) => (
          <li key={e.eventId}>
            <a href={eventHref(e)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 transition hover:border-[#ffb020]/60">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-extrabold">{e.venue}</span>
                <span className="text-sm font-bold text-white/60">
                  {STATE_LABEL[e.state]} · {e.tables} tavoli
                </span>
              </span>
              <span className="tig-chip">{e.role === "organizer" ? "REGIA" : "GIOCA"}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function useEscape(onBack: () => void) {
  const ref = useRef(onBack);
  useEffect(() => {
    ref.current = onBack;
  });
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        ref.current();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
}

function PanelHead({ kicker, title, onBack }: { kicker: string; title: string; onBack: () => void }) {
  return (
    <header className="flex items-start gap-3">
      <button type="button" onClick={onBack} aria-label="Indietro" className="mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/20 bg-black/40 text-2xl font-black hover:border-[#ffb020]/70">
        ‹
      </button>
      <div>
        <p className="tig-label">{kicker}</p>
        <h2 className="tig-display text-[clamp(2rem,4vw,3rem)]">{title}</h2>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Wizard CREA SERATA
// ---------------------------------------------------------------------------
const STEPS = ["Il locale", "I tavoli", "La durata", "L'ingresso"] as const;

function CreateWizard({ onExit }: { onExit: () => void; username: string | null }) {
  const [step, setStep] = useState(0);
  const [venue, setVenue] = useState("");
  const [tables, setTables] = useState(8);
  const [mascotUnique, setMascotUnique] = useState(true);
  const [duration, setDuration] = useState(115);
  const [accessMode, setAccessMode] = useState<"qr" | "code">("qr");
  const [staffPin, setStaffPin] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [chaos2, setChaos2] = useState(60);
  const [chaos3, setChaos3] = useState(150);
  const [hideScores, setHideScores] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const back = () => (step === 0 ? onExit() : setStep(step - 1));
  useEscape(back);
  const maxTables = mascotUnique ? MASCOT_SLOTS : MAX_TABLES;
  const segs = runOfShow(duration);
  const canNext = step !== 0 || venue.trim().length >= 2;
  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ eventId: string }>("/api/tig/events", { method: "POST", json: { venue: venue.trim(), tables, durationMin: duration, accessMode, mascotUnique, staffPin, chaosLevel2: chaos2, chaosLevel3: Math.max(chaos3, chaos2 + 10), hideScoresInFinal: hideScores } });
      window.location.assign(`/tavoli-in-guerra/regia/${r.eventId}`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Non riesco a creare la serata");
      setBusy(false);
    }
  };
  return (
    <section className="tig-panel tig-pop flex max-h-full min-h-0 flex-col gap-4 rounded-3xl p-5 sm:p-6" aria-label="Crea serata">
      <PanelHead kicker={`Passo ${step + 1} di ${STEPS.length} · ${STEPS[step]}`} title="CREA SERATA" onBack={back} />
      <ol className="flex gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <li key={s} className={clsx("h-1.5 flex-1 rounded-full", i <= step ? "bg-[#ffb020]" : "bg-white/15")} />
        ))}
      </ol>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < STEPS.length - 1) {
            if (canNext) setStep(step + 1);
          } else void create();
        }}
      >
        {step === 0 && (
          <label className="flex flex-col gap-2">
            <span className="tig-label">Nome del locale</span>
            <input className="tig-input" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Es. Birrificio del Porto" maxLength={60} autoFocus autoComplete="off" />
            <span className="text-sm font-bold text-white/55">Serve a riconoscere la serata e a non riproporre gli stessi contenuti nello stesso locale.</span>
          </label>
        )}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="tig-label">Quanti tavoli (= squadre)</span>
              <div className="flex items-center gap-3">
                <button type="button" className="tig-btn tig-btn-ghost h-14 w-14 !p-0 text-3xl" onClick={() => setTables((n) => Math.max(MIN_TABLES, n - 1))} aria-label="Un tavolo in meno">
                  −
                </button>
                <output className="tig-display w-24 text-center text-6xl tabular-nums" aria-live="polite">
                  {Math.min(tables, maxTables)}
                </output>
                <button type="button" className="tig-btn tig-btn-ghost h-14 w-14 !p-0 text-3xl" onClick={() => setTables((n) => Math.min(maxTables, n + 1))} aria-label="Un tavolo in più">
                  +
                </button>
              </div>
            </div>
            <Toggle
              checked={mascotUnique}
              onChange={(v) => {
                setMascotUnique(v);
                if (v) setTables((n) => Math.min(n, MASCOT_SLOTS));
              }}
              label="Mascotte uniche"
              hint={
                MAX_TABLES > MASCOT_SLOTS
                  ? `Ogni mascotte va a un solo tavolo (fino a ${MASCOT_SLOTS} tavoli). Spento: fino a ${MAX_TABLES} tavoli, mascotte ripetibili.`
                  : "Ogni mascotte va a un solo tavolo. Spento: due tavoli possono scegliere la stessa mascotte."
              }
            />
          </div>
        )}
        {step === 2 && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-2">
              <span className="tig-label">Durata della serata: {duration} minuti</span>
              <input type="range" min={MIN_DURATION} max={MAX_DURATION} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full accent-[#ffb020]" />
            </label>
            <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
              {segs.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-1.5">
                  <span className="truncate font-bold text-white/80">{s.label}</span>
                  <span className="shrink-0 font-black tabular-nums text-[#ffd15c]">
                    {s.minutes}′{s.games ? ` · ${s.games} prove` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs font-bold text-white/50">Totale {totalMinutes(segs)} minuti. In regia puoi cambiare la durata di ogni segmento anche durante la serata.</p>
            <button type="button" className="self-start text-sm font-bold text-white/60 underline" aria-expanded={advanced} onClick={() => setAdvanced((v) => !v)}>
              {advanced ? "Nascondi le opzioni avanzate" : "Opzioni avanzate (Energia Caos, classifica buia)"}
            </button>
            {advanced && (
              <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/35 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="tig-label">Energia per il livello 2</span>
                    <input type="number" min={10} max={1000} className="tig-input !min-h-11" value={chaos2} onChange={(e) => setChaos2(Math.max(10, Math.min(1000, Number(e.target.value) || 10)))} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="tig-label">Energia per il livello 3</span>
                    <input type="number" min={20} max={2000} className="tig-input !min-h-11" value={chaos3} onChange={(e) => setChaos3(Math.max(20, Math.min(2000, Number(e.target.value) || 20)))} />
                  </label>
                </div>
                <p className="text-xs font-bold text-white/50">L’Energia Caos si guadagna partecipando in tempo, con gli esiti e accettando le sfide: fa evolvere le mascotte, non dà punti.</p>
                <Toggle checked={hideScores} onChange={setHideScores} label="Classifica buia nell'ultima manche" hint="In TUTTO O NIENTE! la TV nasconde la classifica; ogni tavolo vede sempre il proprio saldo." />
              </div>
            )}
          </div>
        )}
        {step === 3 && (
          <div className="flex flex-col gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["qr", "QR per tavolo", "Ogni tavolo ha il suo QR stampato: si scansiona e si entra nella squadra del tavolo."],
                  ["code", "Codice squadra", "Per locali senza tavoli numerati: lo staff consegna un codice a ogni gruppo."],
                ] as const
              ).map(([v, t, d]) => (
                <button key={v} type="button" onClick={() => setAccessMode(v)} aria-pressed={accessMode === v} className={clsx("flex flex-col gap-1 rounded-2xl border-2 p-4 text-left transition", accessMode === v ? "border-[#ffb020] bg-[#ffb020]/10" : "border-white/12 bg-black/35 hover:border-white/30")}>
                  <span className="tig-display text-2xl">{t}</span>
                  <span className="text-sm font-bold text-white/70">{d}</span>
                </button>
              ))}
            </div>
            <Toggle checked={staffPin} onChange={setStaffPin} label="PIN dello staff" hint="Un PIN di 4 cifre per tavolo, detto dallo staff al tavolo: il QR fotografato da casa non basta." />
          </div>
        )}
        {err && <p className="rounded-xl border border-[#ff2d3d]/50 bg-[#2a0509]/80 px-3 py-2 text-sm font-bold text-[#ffd5d9]">{err}</p>}
        <div className="flex gap-2">
          <button type="button" className="tig-btn tig-btn-ghost flex-1" onClick={back}>
            {step === 0 ? "Annulla" : "‹ Indietro"}
          </button>
          <button type="submit" className={clsx("tig-btn flex-[2]", step === STEPS.length - 1 && "tig-btn-red")} disabled={!canNext || busy}>
            {busy ? "Creo…" : step === STEPS.length - 1 ? "CREA LA SERATA" : "AVANTI ›"}
          </button>
        </div>
      </form>
    </section>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/35 p-3 text-left">
      <span className={clsx("relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-[#ffb020]" : "bg-white/20")}>
        <span className={clsx("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all", checked ? "left-[1.4rem]" : "left-0.5")} />
      </span>
      <span>
        <span className="block font-extrabold">{label}</span>
        <span className="text-sm font-bold text-white/60">{hint}</span>
      </span>
    </button>
  );
}
