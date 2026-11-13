"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  GiramenteCharacter,
  GiramenteWheel,
  JollyPortal,
  SecretBoard,
  WHEEL_SEGMENTS_FINALE,
  WHEEL_SEGMENTS_STANDARD,
  createAnalyserMouth,
  detectVisualQuality,
  maskPhrase,
  type CharacterAction,
  type CharacterWho,
  type VisualQuality,
  type WheelSpinCommand,
} from "@/features/giramente/three";
import { ACTION_PLAN, CHARACTER_FILES, CHARACTER_INFO, MOUTH_VARIANT, type MouthVariant } from "@/features/giramente/three/characters";
import { letterBase } from "@/features/giramente/three/board-layout";

export type PreviewSection = "ruota" | "personaggi" | "portale" | "tabellone";

export interface GiramentePreviewProps {
  quality: VisualQuality | null;
  solo: PreviewSection | null;
  target: number | null;
  freeze: number | null;
  center: "brain" | "logo";
  finale: boolean;
  hi: boolean;
  stand: boolean;
  who: CharacterWho | null;
  variant: MouthVariant | "ab";
  action: string | null;
  talk: boolean;
  /** bocca ferma a questa apertura (confronto A/B a bocca aperta negli screenshot) */
  mouth: number | null;
  framing: "full" | "bust";
  portal: boolean;
  reveal: number | null;
  solved: boolean;
}

const ACTIONS = Object.keys(ACTION_PLAN) as CharacterAction[];
const ACTION_LABEL: Record<CharacterAction, string> = {
  idle: "Riposo",
  saluto: "Saluto",
  presentazione: "Presentazione",
  indica: "Indica la ruota",
  applauso: "Applauso",
  risata: "Risata",
  sorpresa: "Sorpresa",
  delusione: "Delusione",
  pensiero: "Pensiero",
  vittoria: "Vittoria",
  spinta: "Spinge la ruota",
  ingresso: "Ingresso",
  uscita: "Uscita",
};

/** Voce di prova per il lip-sync (clip già nel sito): maschile per DonTrallà, femminile per Zafira. */
const VOICE: Record<CharacterWho, string> = { dontralla: "/audio/intro/professore.mp3", zafira: "/audio/intro/regina.mp3" };

const btn = "rounded-xl border px-3 py-2 text-sm font-extrabold uppercase tracking-wide transition active:scale-95 disabled:opacity-40";
const btnOn = "border-[#39FF14] bg-[#39FF14] text-[#080B0D] shadow-[0_0_18px_rgba(57,255,20,0.45)]";
const btnOff = "border-[#2b3237] bg-[#14191c] text-[#F4F6F7] hover:border-[#39FF14]";

function Btn({ on = false, onClick, children, disabled }: { on?: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" className={`${btn} ${on ? btnOn : btnOff}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-[#20262B] px-4 py-8 md:px-8">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-3xl font-black italic tracking-wide md:text-4xl">{title}</h2>
        {note && <p className="text-sm text-[#F4F6F7]/60">{note}</p>}
      </header>
      {children}
    </section>
  );
}

/** Suono dello scatto del puntatore (sintetizzato, nessun file): solo anteprima. */
function useTickSound() {
  const ctx = useRef<AudioContext | null>(null);
  return useCallback(() => {
    try {
      ctx.current ??= new AudioContext();
      const ac = ctx.current;
      if (ac.state !== "running") return;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "square";
      o.frequency.value = 1900;
      g.gain.setValueAtTime(0.05, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.03);
      o.connect(g).connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + 0.035);
    } catch {
      /* audio non disponibile */
    }
  }, []);
}

// ------------------------------------------------------------------ RUOTA
function WheelDemo({ quality, p }: { quality: VisualQuality; p: GiramentePreviewProps }) {
  const [finale, setFinale] = useState(p.finale);
  const [center, setCenter] = useState<"brain" | "logo">(p.center);
  const [stand, setStand] = useState(p.stand);
  const [highlight, setHighlight] = useState(true);
  const [sound, setSound] = useState(false);
  const segments = finale ? WHEEL_SEGMENTS_FINALE : WHEEL_SEGMENTS_STANDARD;
  // giro iniziale da URL: fermo a `freeze` ms dall'inizio (screenshot) o appena partito
  const [spin, setSpin] = useState<WheelSpinCommand | null>(() =>
    p.target !== null ? { spinId: `url-${p.target}-${p.freeze ?? 0}`, targetIndex: p.target, startedAt: Date.now() - (p.freeze ?? 0), durationMs: 6500 } : null,
  );
  const frozenAt = useMemo(() => (p.freeze !== null && spin ? spin.startedAt + p.freeze : null), [p.freeze, spin]);
  const now = useCallback(() => frozenAt ?? Date.now(), [frozenAt]);
  const [rest, setRest] = useState<number | null>(p.hi && p.target !== null ? p.target : 0);
  const [result, setResult] = useState<string | null>(null);
  const [forced, setForced] = useState(0);
  const tick = useTickSound();

  const go = (target: number) => {
    setResult(null);
    // il "server": sceglie il risultato e l'istante di partenza; i client riproducono
    setSpin({ spinId: `giro-${Date.now()}`, targetIndex: target, startedAt: Date.now() + 120, durationMs: 6200 + Math.floor(Math.random() * 900) });
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="relative">
        <GiramenteWheel
          segments={segments}
          spin={spin}
          restIndex={rest}
          now={now}
          quality={quality}
          highlight={highlight}
          showStand={stand}
          center={center}
          onTick={sound ? tick : undefined}
          onSpinEnd={(id) => {
            if (!spin || spin.spinId !== id) return;
            setRest(spin.targetIndex);
            setResult(segments[spin.targetIndex].label);
            if (p.freeze === null) setSpin(null);
          }}
          className="h-[min(78vh,780px)] min-h-[360px] w-full"
        />
      </div>
      <aside className="flex flex-col gap-4">
        <div className="rounded-2xl border-2 border-[#39FF14]/70 bg-black/60 px-4 py-3 text-center text-xl font-black uppercase tracking-wide shadow-[0_0_24px_rgba(57,255,20,0.3)]" data-testid="wheel-result">
          {result ? `È uscito: ${result}` : spin ? "La ruota gira…" : "Pronta a girare"}
        </div>
        <button
          type="button"
          className="rounded-2xl border-2 border-[#39FF14] bg-[#39FF14] px-6 py-4 text-3xl font-black italic text-[#080B0D] shadow-[0_0_30px_rgba(57,255,20,0.5)] active:scale-95 disabled:opacity-40"
          disabled={!!spin && p.freeze === null}
          onClick={() => go(Math.floor(Math.random() * segments.length))}
          data-testid="gira"
        >
          GIRA!
        </button>
        <div className="flex gap-2">
          <select className="flex-1 rounded-xl border border-[#2b3237] bg-[#14191c] px-3 py-2" value={forced} onChange={(e) => setForced(Number(e.target.value))} aria-label="Spicchio forzato">
            {segments.map((s, i) => (
              <option key={s.id} value={i}>
                {i}. {s.label}
              </option>
            ))}
          </select>
          <Btn onClick={() => go(forced)} disabled={!!spin && p.freeze === null}>
            Gira qui
          </Btn>
        </div>
        <p className="text-xs text-[#F4F6F7]/55">Nel gioco il risultato lo decide il SERVER (spinId, targetIndex, startedAt, durationMs): ogni schermo calcola lo stesso angolo nello stesso istante.</p>
        <div className="flex flex-wrap gap-2">
          <Btn on={!finale} onClick={() => setFinale(false)}>
            8 caselle
          </Btn>
          <Btn on={finale} onClick={() => setFinale(true)}>
            Giro decisivo
          </Btn>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn on={center === "brain"} onClick={() => setCenter("brain")}>
            Centro: cervello
          </Btn>
          <Btn on={center === "logo"} onClick={() => setCenter("logo")}>
            Centro: logo G!
          </Btn>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn on={stand} onClick={() => setStand(!stand)}>
            Supporto
          </Btn>
          <Btn on={highlight} onClick={() => setHighlight(!highlight)}>
            Evidenzia vincente
          </Btn>
          <Btn
            on={sound}
            onClick={() => {
              setSound(!sound);
              void new AudioContext().resume();
            }}
          >
            Scatti
          </Btn>
        </div>
      </aside>
    </div>
  );
}

// ------------------------------------------------------------------ PERSONAGGI
/** Voce vera in loop con AnalyserNode → bocca (serve un tocco per sbloccare l'audio). */
function useVoice(url: string, on: boolean) {
  const mouth = useRef(0);
  useEffect(() => {
    if (!on) return;
    const audio = new Audio(url);
    audio.loop = true;
    audio.crossOrigin = "anonymous";
    const ac = new AudioContext();
    const src = ac.createMediaElementSource(audio);
    const an = ac.createAnalyser();
    an.fftSize = 1024;
    src.connect(an);
    an.connect(ac.destination);
    const read = createAnalyserMouth(an);
    let id = 0;
    const loop = () => {
      mouth.current = read();
      id = requestAnimationFrame(loop);
    };
    void ac.resume().then(() => audio.play().catch(() => {}));
    id = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(id);
      audio.pause();
      mouth.current = 0;
      void ac.close();
    };
  }, [url, on]);
  return mouth;
}

function CharacterDemo({ who, quality, p }: { who: CharacterWho; quality: VisualQuality; p: GiramentePreviewProps }) {
  const initial = (ACTIONS as string[]).includes(p.action ?? "") ? (p.action as CharacterAction) : "idle";
  const [action, setAction] = useState<CharacterAction>(initial);
  const [nonce, setNonce] = useState(0);
  const [talk, setTalk] = useState(p.talk);
  const [voice, setVoice] = useState(false);
  const [framing, setFraming] = useState<"full" | "bust">(p.framing);
  const mouth = useVoice(VOICE[who], voice);
  const fixedMouth = useRef(p.mouth ?? 0);
  const variants: MouthVariant[] = p.variant === "ab" ? ["a", "b"] : [p.variant];
  const info = CHARACTER_INFO[who];
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-2xl font-black uppercase italic">
        {info.name} <span className="text-base font-semibold normal-case text-[#F4F6F7]/60">— {info.role}</span>
      </h3>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <Btn
            key={a}
            on={action === a}
            onClick={() => {
              setAction(a);
              setNonce((n) => n + 1);
            }}
          >
            {ACTION_LABEL[a]}
            {ACTION_PLAN[a].procedural && ACTION_PLAN[a].base !== "Walking" ? " ·P" : ""}
          </Btn>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn on={talk && !voice} onClick={() => (setVoice(false), setTalk(!talk || voice))}>
          Parla (bocca simulata)
        </Btn>
        <Btn on={voice} onClick={() => (setTalk(false), setVoice(!voice))}>
          Parla (voce vera)
        </Btn>
        <Btn on={framing === "bust"} onClick={() => setFraming("bust")}>
          Mezzo busto
        </Btn>
        <Btn on={framing === "full"} onClick={() => setFraming("full")}>
          Figura intera
        </Btn>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {variants.map((v) => (
          <figure key={v} className="flex flex-col items-center gap-2">
            <div className="relative h-[min(64vh,560px)] min-h-[320px] w-full overflow-hidden rounded-3xl border border-[#2b3237] bg-[radial-gradient(80%_60%_at_50%_100%,rgba(57,255,20,0.12),transparent_70%),linear-gradient(180deg,#12171a,#080B0D)]">
              <GiramenteCharacter
                key={`${v}-${quality}`}
                who={who}
                action={action}
                speaking={talk || voice || p.mouth !== null}
                mouthRef={voice ? mouth : p.mouth !== null ? fixedMouth : undefined}
                framing={framing}
                quality={quality}
                src={CHARACTER_FILES[who][v]}
                className="!absolute inset-0"
              />
              <span key={nonce} className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-extrabold uppercase tracking-wide">
                {ACTION_PLAN[action].base === "Walking"
                  ? "clip vera Walking + spostamento in codice"
                  : ACTION_PLAN[action].procedural
                    ? `posa procedurale su ${ACTION_PLAN[action].base}`
                    : `clip vera: ${ACTION_PLAN[action].base}`}
              </span>
            </div>
            <figcaption className="text-center text-sm font-bold">
              Bocca {v.toUpperCase()} · {v === "a" ? "file _PARLANTE dell'utente" : "file senza bocca + nostra bocca (script Blender)"}
              {MOUTH_VARIANT[who] === v ? " · ATTIVA" : ""}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ PORTALE
function PortalDemo({ quality, p }: { quality: VisualQuality; p: GiramentePreviewProps }) {
  const [play, setPlay] = useState(p.portal);
  const [status, setStatus] = useState(p.portal ? "ingresso…" : "nascosto");
  const [talk, setTalk] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Btn
          on={play}
          onClick={() => {
            setPlay(true);
            setStatus("ingresso…");
          }}
        >
          ▶ Entra la Jolly
        </Btn>
        <Btn
          onClick={() => {
            setPlay(false);
            setStatus("uscita…");
          }}
        >
          ■ Esci / salta
        </Btn>
        <Btn on={talk} onClick={() => setTalk(!talk)}>
          Battuta (parla)
        </Btn>
        <span className="text-sm text-[#F4F6F7]/70" data-testid="portal-status">
          Stato: {status}
        </span>
      </div>
      <div className="relative h-[min(70vh,640px)] min-h-[340px] w-full overflow-hidden rounded-3xl border border-[#2b3237] bg-[#06080a]">
        <JollyPortal play={play} quality={quality} speaking={talk} onEntered={() => setStatus("in scena (scegli il vantaggio)")} onDone={() => setStatus("uscita finita (onDone)")} className="absolute inset-0" />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ TABELLONE
const PHRASES = [
  { category: "Proverbio", text: "Chi dorme non piglia pesci" },
  { category: "Modo di dire", text: "L'appetito vien mangiando" },
  { category: "Film italiano", text: "La vita è bella" },
  { category: "Città d'arte", text: "Firenze, culla del Rinascimento!" },
];

function BoardDemo({ quality, p }: { quality: VisualQuality; p: GiramentePreviewProps }) {
  const [k, setK] = useState(0);
  const phrase = PHRASES[k % PHRASES.length];
  // ordine di rivelazione deterministico delle lettere (anteprima: nel gioco lo decide il server)
  const order = useMemo(() => {
    const rank = (c: string) => ("AEIORNTLSC".indexOf(c) + 100) % 100;
    return [...new Set([...phrase.text].filter((c) => /\p{L}/u.test(c)).map(letterBase))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }, [phrase]);
  const [shown, setShown] = useState(p.reveal ?? 2);
  const [solved, setSolved] = useState(p.solved);
  const revealed = solved ? order : order.slice(0, shown);
  const fresh = solved || shown === 0 ? [] : [order[shown - 1]];
  const rows = maskPhrase(phrase.text, revealed, fresh);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Btn onClick={() => setShown((n) => Math.min(order.length, n + 1))} disabled={solved || shown >= order.length}>
          Svela lettera
        </Btn>
        <Btn on={solved} onClick={() => setSolved(!solved)}>
          Risolvi
        </Btn>
        <Btn
          onClick={() => {
            setK(k + 1);
            setShown(2);
            setSolved(false);
          }}
        >
          Altra frase
        </Btn>
      </div>
      <SecretBoard key={k} category={phrase.category} rows={rows} solved={solved} quality={quality} />
    </div>
  );
}

// ------------------------------------------------------------------ pagina
export function GiramentePreview(p: GiramentePreviewProps) {
  const [detected] = useState<VisualQuality>(() => detectVisualQuality());
  const [quality, setQuality] = useState<VisualQuality>(p.quality ?? detected);
  const show = (s: PreviewSection) => !p.solo || p.solo === s;
  const whos: CharacterWho[] = p.who ? [p.who] : ["dontralla", "zafira"];
  return (
    <main className="mx-auto flex max-w-[1680px] flex-col">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-[#20262B] bg-[#080B0D]/90 px-4 py-3 backdrop-blur md:px-8">
        <h1 className="text-2xl font-black italic md:text-3xl">
          GIRAMENTE<span className="text-[#39FF14]">!</span> <span className="text-[#F4F6F7]/50">· anteprima 3D</span>
        </h1>
        <span className="rounded-full border border-[#FF253A] px-2 py-0.5 text-xs font-extrabold uppercase text-[#FF253A]">anteprima, non è il gioco</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase text-[#F4F6F7]/60">qualità (rilevata: {detected})</span>
          {(["high", "low", "2d"] as VisualQuality[]).map((q) => (
            <Btn key={q} on={quality === q} onClick={() => setQuality(q)}>
              {q}
            </Btn>
          ))}
        </div>
      </header>
      {show("ruota") && (
        <Section title="La ruota" note="giro deterministico dall'orologio del server · scatti del puntatore · spicchio vincente evidenziato">
          <WheelDemo quality={quality} p={p} />
        </Section>
      )}
      {show("personaggi") && (
        <Section title="DonTrallà e Zafira" note="A = bocca dell'utente (_PARLANTE), B = nostra bocca · ·P = movimento procedurale (nel file non c'è la clip)">
          {whos.map((w) => (
            <CharacterDemo key={w} who={w} quality={quality} p={p} />
          ))}
        </Section>
      )}
      {show("portale") && (
        <Section title="Entra la Jolly" note="luci che cambiano, portale verde e rosso, Zafira che entra; «Esci / salta» la fa uscire">
          <PortalDemo quality={quality} p={p} />
        </Section>
      )}
      {show("tabellone") && (
        <Section title="Il Tabellone Segreto" note="riceve solo le lettere scoperte e la forma delle parole">
          <BoardDemo quality={quality} p={p} />
        </Section>
      )}
    </main>
  );
}
