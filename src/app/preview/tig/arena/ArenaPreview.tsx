"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { ArenaHost, ArenaPhase, ArenaSpotlight, ArenaTeam, HostId, MascotLevel, MascotProps, VisualQuality } from "@/features/tig/arena-contract";
import { HOST_IDS, HOST_MODELS, TigArena, TigMascot, detectVisualQuality } from "@/features/tig/three";
import { setPreviewMascotModel } from "@/features/tig/mascots/registry";

/**
 * Anteprima dell'arena di TAVOLI IN GUERRA! con dati finti: fasi, numero di tavoli, punti che cambiano, eventi,
 * presentatori che parlano, qualità, HUD simulato (per controllare l'inquadratura), mascotte e galleria personaggi.
 */

const HostGallery = dynamic(() => import("@/features/tig/three/characters/HostGallery"), { ssr: false });

const PHASES: ArenaPhase[] = ["lobby", "intro", "manche-intro", "game", "reveal", "leaderboard", "chaos", "duel", "evolve", "break", "final", "awards"];
const PHASE_LABEL: Record<ArenaPhase, string> = {
  lobby: "Lobby",
  intro: "Intro",
  "manche-intro": "Manche",
  game: "Prova",
  reveal: "Reveal",
  leaderboard: "Classifica",
  chaos: "Caos",
  duel: "Duello",
  evolve: "Evoluzione",
  break: "Pausa",
  final: "Finale",
  awards: "Premiazione",
};
const SPOTS: ArenaSpotlight["kind"][] = ["duel", "chaos", "evolve", "winner", "attack", "sabotage", "shield"];
const MANCHE = ["CHI PARTE MALE...", "FREGALI TUTTI!", "IL PUB DECIDE!", "IL GRANDE INGANNO", "TUTTO O NIENTE!"];
const NAMES = [
  "Brindisi Tattici",
  "Le Volpi del Bancone",
  "Spritz Brigade",
  "I Senza Idea",
  "Gli Ultimi Saranno Primi",
  "La Mossa del Cavallo",
  "Birra e Bluff",
  "I Calcolatori",
  "Le Menti del Pub",
  "Squadra Corse",
  "Gli Imbattibili (Forse)",
  "I Diplomatici",
  "La Vecchia Guardia",
  "Negroni Sbagliati",
  "Tavolo del Caos",
  "Le Zanzare",
  "I Filosofi del Bar",
  "Mai Una Gioia",
  "Quelli di Passaggio",
  "La Rimonta",
  "Gin Tonic Club",
  "I Ritardatari",
  "Le Sette Note",
  "Tavolo Ventiquattro",
];
const COLORS = ["#ff8a1f", "#2de2ff", "#ff4fa3", "#7dff6b", "#ffd23f", "#a46bff", "#ff5a4f", "#3d8bff", "#00e0a4", "#ff9ad5", "#c6ff3d", "#ffb35c", "#5ce1ff", "#e05cff", "#ffe07a", "#5cffb0", "#ff7a7a", "#8aa0ff", "#ffc4e1", "#b4ff8a", "#ff6f3d", "#3dffe0", "#d08aff", "#f2ff6b"];

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function withRanks(teams: ArenaTeam[]): ArenaTeam[] {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const rank = new Map<string, number>();
  sorted.forEach((t, i) => {
    const prev = sorted[i - 1];
    rank.set(t.teamId, prev && prev.score === t.score ? rank.get(prev.teamId)! : i + 1);
  });
  return teams.map((t) => ({ ...t, rank: rank.get(t.teamId)! }));
}

function makeTeams(n: number, seed: number): ArenaTeam[] {
  const r = rng(seed);
  const teams: ArenaTeam[] = Array.from({ length: n }, (_, i) => ({
    teamId: `t${i + 1}`,
    tableNo: i + 1,
    name: NAMES[i % NAMES.length],
    color: COLORS[i % COLORS.length],
    mascotSlot: i < 12 ? i + 1 : null,
    mascotLevel: (r() < 0.55 ? 1 : r() < 0.7 ? 2 : 3) as MascotLevel,
    score: Math.round(r() * 9) * 50 + 100,
    rank: 1,
    chaosProgress: Math.round(r() * 100) / 100,
    online: r() > 0.08 || i === 0,
  }));
  return withRanks(teams);
}

type Hud = "none" | "tel" | "tv" | "pc";
const HUD_SAFE: Record<Hud, ArenaHostSafe> = {
  none: undefined,
  tel: { left: 0, top: 0, right: 1, bottom: 0.44 },
  tv: { left: 0, top: 0.1, right: 1, bottom: 0.8 },
  pc: { left: 0, top: 0, right: 0.64, bottom: 1 },
};
type ArenaHostSafe = { left: number; top: number; right: number; bottom: number } | undefined;

/** Bocca finta (0..1) per chi parla: sillabe simulate scritte in un ref a ogni fotogramma. */
function useFakeMouth(on: boolean): RefObject<number> {
  const ref = useRef(0);
  useEffect(() => {
    if (!on) {
      ref.current = 0;
      return;
    }
    let id = 0;
    const loop = (t: number) => {
      const p = t / 1000;
      const syl = Math.max(0, Math.sin(p * 11) * Math.sin(p * 4.1 + 1.2));
      const pause = Math.sin(p * 0.9) > -0.6 ? 1 : 0;
      ref.current = Math.min(1, (0.1 + syl * 0.9) * pause);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [on]);
  return ref;
}

function FpsMeter() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let last = (window as unknown as { __tigFrames?: number }).__tigFrames ?? 0;
    const id = setInterval(() => {
      const now = (window as unknown as { __tigFrames?: number }).__tigFrames ?? 0;
      setFps(now - last);
      last = now;
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return <span data-fps={fps}>{fps} fps disegnati</span>;
}

const btn = "rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[13px] font-bold tracking-wide hover:bg-white/15";
const btnOn = "rounded-md border border-[#ff8a1f] bg-[#ff8a1f]/25 px-2 py-1 text-[13px] font-bold tracking-wide";

export function ArenaPreview({ params }: { params: Record<string, string> }) {
  const view = params.view === "mascotte" ? "mascotte" : params.view === "galleria" ? "galleria" : "arena";
  const [quality, setQuality] = useState<VisualQuality>(() => (params.q === "high" || params.q === "low" || params.q === "2d" ? params.q : detectVisualQuality()));
  const [phase, setPhase] = useState<ArenaPhase>((PHASES as string[]).includes(params.phase ?? "") ? (params.phase as ArenaPhase) : "lobby");
  const [count, setCount] = useState(() => Math.min(24, Math.max(2, Number(params.teams ?? 12) || 12)));
  const seed = Number(params.seed ?? 7) || 7;
  const [teams, setTeams] = useState<ArenaTeam[]>(() => makeTeams(count, seed));
  const [auto, setAuto] = useState(params.auto === "1");
  const [hud, setHud] = useState<Hud>((["none", "tel", "tv", "pc"] as string[]).includes(params.hud ?? "") ? (params.hud as Hud) : "none");
  const [hostIds, setHostIds] = useState<HostId[]>(() => {
    const list = (params.hosts ?? "professore,regina").split(",").filter((h): h is HostId => (HOST_IDS as string[]).includes(h));
    return params.hosts === "none" ? [] : list.slice(0, 4);
  });
  const [speaking, setSpeaking] = useState<number>(params.speak === "1" ? 0 : -1);
  const [spotlight, setSpotlight] = useState<ArenaSpotlight | null>(null);
  const [ui, setUi] = useState(params.ui !== "0");
  const [mancheNo, setMancheNo] = useState(2);
  const t0 = useRef(0);
  const now = useCallback(() => Date.now(), []);
  // prova del percorso GLB delle mascotte vere con un modello qualsiasi (?glb=/models/…glb)
  const [glbOn, setGlbOn] = useState(false);
  useEffect(() => {
    if (!params.glb) return;
    setPreviewMascotModel(params.glb);
    const t = setTimeout(() => setGlbOn(true), 0);
    return () => {
      clearTimeout(t);
      setPreviewMascotModel(null);
    };
  }, [params.glb]);

  const mouth0 = useFakeMouth(speaking === 0);
  const mouth1 = useFakeMouth(speaking === 1);
  const mouth2 = useFakeMouth(speaking === 2);
  const mouth3 = useFakeMouth(speaking === 3);
  const mouths = useMemo(() => [mouth0, mouth1, mouth2, mouth3], [mouth0, mouth1, mouth2, mouth3]);
  const hosts: ArenaHost[] = hostIds.map((who, i) => ({ who, speaking: speaking === i, mouthRef: mouths[i] }));

  const fire = useCallback(
    (kind: ArenaSpotlight["kind"]) => {
      const r = rng(Date.now() & 0xffff);
      const pick = () => teams[Math.floor(r() * teams.length)];
      const a = pick();
      let b = pick();
      while (b.teamId === a.teamId && teams.length > 1) b = pick();
      const two = kind === "duel" || kind === "chaos" || kind === "attack" || kind === "sabotage";
      const ids = two ? [a.teamId, b.teamId] : [a.teamId];
      setSpotlight({ kind, teamIds: ids, eventId: `${kind}-${Date.now()}` });
      if (kind === "duel" || kind === "chaos" || kind === "evolve") setPhase(kind);
      if (kind === "evolve") setTeams((ts) => ts.map((t) => (t.teamId === a.teamId ? { ...t, mascotLevel: (Math.min(3, t.mascotLevel + 1) as MascotLevel), chaosProgress: 0 } : t)));
      if (kind === "attack" || kind === "sabotage") {
        setTimeout(() => setTeams((ts) => withRanks(ts.map((t) => (t.teamId === b.teamId ? { ...t, score: Math.max(0, t.score - 40) } : t.teamId === a.teamId ? { ...t, score: t.score + 40 } : t)))), 1300);
      }
      if (kind === "winner") setTimeout(() => setTeams((ts) => withRanks(ts.map((t) => (t.teamId === a.teamId ? { ...t, score: t.score + 50 } : t)))), 300);
    },
    [teams],
  );

  // spotlight iniziale da URL
  useEffect(() => {
    const k = params.spot as ArenaSpotlight["kind"] | undefined;
    if (!k || !SPOTS.includes(k)) return;
    const t = setTimeout(() => {
      const ids = k === "duel" || k === "chaos" || k === "attack" || k === "sabotage" ? ["t3", "t8"] : ["t5"];
      setSpotlight({ kind: k, teamIds: ids.filter((id) => teams.some((x) => x.teamId === id)), eventId: `url-${k}` });
    }, Math.max(50, Number(params.spotAt ?? 50) || 50));
    return () => clearTimeout(t);
    // solo all'avvio
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const randomScores = useCallback(() => {
    setTeams((ts) => {
      const r = rng(Date.now() & 0xffff);
      return withRanks(ts.map((t) => (r() < 0.6 ? { ...t, score: Math.max(0, t.score + Math.round((r() * 140 - 25) / 10) * 10), chaosProgress: Math.min(1, t.chaosProgress + r() * 0.2) } : t)));
    });
  }, []);
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(randomScores, 2600);
    return () => clearInterval(id);
  }, [auto, randomScores]);

  useEffect(() => {
    t0.current = Date.now();
  }, [phase]);

  const changeCount = (n: number) => {
    setCount(n);
    setTeams(makeTeams(n, seed));
    setSpotlight(null);
  };

  const title =
    phase === "manche-intro" || phase === "game" || phase === "reveal"
      ? phase === "manche-intro"
        ? MANCHE[mancheNo - 1]
        : phase === "game"
          ? "MEMORIA LAMPO"
          : "LA RISPOSTA GIUSTA"
      : phase === "duel"
        ? "SFIDA ACCETTATA"
        : phase === "break"
          ? "PAUSA"
          : null;
  const subtitle = phase === "manche-intro" ? "4 SFIDE · 20 MINUTI" : phase === "game" ? "GUARDA BENE: 8 SECONDI" : phase === "reveal" ? "+100 AI TAVOLI CHE L'HANNO PRESA" : phase === "break" ? "ORDINI, RESPIRO, SI RIPARTE ALLE 22:45" : phase === "lobby" ? "INQUADRA IL QR DEL TUO TAVOLO" : null;

  if (view === "galleria") {
    const ids = (params.ids ?? "").split(",").filter((h): h is HostId => (HOST_IDS as string[]).includes(h));
    return (
      <div className="h-dvh w-full">
        <HostGallery ids={ids.length ? ids : HOST_IDS} quality={quality === "low" ? "low" : "high"} speakAll={params.all !== "0"} action={(params.action as never) ?? "idle"} />
      </div>
    );
  }

  if (view === "mascotte") return <MascotShowcase quality={quality} setQuality={setQuality} params={params} />;

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <TigArena
        key={glbOn ? "glb" : "segnaposto"}
        phase={phase}
        teams={teams}
        mancheNo={phase === "manche-intro" || phase === "game" || phase === "reveal" ? mancheNo : null}
        title={title}
        subtitle={subtitle}
        spotlight={spotlight}
        hosts={hosts}
        now={now}
        quality={quality}
        safeArea={HUD_SAFE[hud]}
        className="absolute inset-0"
      />
      {/* HUD simulato: dove starebbe l'interfaccia di gioco */}
      {hud === "tel" && <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[44%] border-t-2 border-dashed border-white/30 bg-[#0a0e14]/80" />}
      {hud === "tv" && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[10%] border-b-2 border-dashed border-white/30 bg-[#0a0e14]/70" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[20%] border-t-2 border-dashed border-white/30 bg-[#0a0e14]/70" />
        </>
      )}
      {hud === "pc" && <div className="pointer-events-none absolute inset-y-0 right-0 w-[36%] border-l-2 border-dashed border-white/30 bg-[#0a0e14]/80" />}
      {ui ? (
        <div className="absolute left-2 top-2 z-10 flex max-h-[calc(100dvh-16px)] w-[min(420px,calc(100vw-16px))] flex-col gap-2 overflow-auto rounded-xl border border-white/10 bg-[#070a10]/85 p-3 text-sm backdrop-blur" style={{ fontFamily: "system-ui, sans-serif" }}>
          <div className="flex items-center justify-between">
            <b className="tracking-wider" style={{ fontFamily: "var(--font-tig-display)" }}>
              ARENA · TAVOLI IN GUERRA!
            </b>
            <button className={btn} onClick={() => setUi(false)}>
              nascondi
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {PHASES.map((p) => (
              <button key={p} className={p === phase ? btnOn : btn} onClick={() => setPhase(p)}>
                {PHASE_LABEL[p]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2">
            Tavoli <input type="range" min={2} max={24} value={count} onChange={(e) => changeCount(Number(e.target.value))} className="flex-1" /> <b className="w-6 text-right">{count}</b>
          </label>
          <div className="flex flex-wrap gap-1">
            <button className={btn} onClick={randomScores}>
              punti a caso
            </button>
            <button className={auto ? btnOn : btn} onClick={() => setAuto((a) => !a)}>
              auto
            </button>
            <button className={btn} onClick={() => setMancheNo((m) => (m % 5) + 1)}>
              manche {mancheNo}
            </button>
            <button className={btn} onClick={() => setTeams((ts) => ts.map((t, i) => (i === 1 ? { ...t, online: !t.online } : t)))}>
              tavolo 2 on/off
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {SPOTS.map((k) => (
              <button key={k} className={spotlight?.kind === k ? btnOn : btn} onClick={() => fire(k)}>
                {k}
              </button>
            ))}
            <button className={btn} onClick={() => setSpotlight(null)}>
              ✕
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {(["high", "low", "2d"] as VisualQuality[]).map((q) => (
              <button key={q} className={q === quality ? btnOn : btn} onClick={() => setQuality(q)}>
                {q}
              </button>
            ))}
            <span className="mx-1 opacity-50">|</span>
            {(["none", "tel", "tv", "pc"] as Hud[]).map((h) => (
              <button key={h} className={h === hud ? btnOn : btn} onClick={() => setHud(h)}>
                hud {h}
              </button>
            ))}
          </div>
          <details>
            <summary className="cursor-pointer font-bold">Presentatori ({hostIds.length}/4)</summary>
            <div className="mt-1 grid grid-cols-2 gap-1">
              {HOST_IDS.map((h) => {
                const i = hostIds.indexOf(h);
                return (
                  <div key={h} className="flex items-center gap-1">
                    <button
                      className={i >= 0 ? btnOn : btn}
                      onClick={() => {
                        setSpeaking(-1);
                        setHostIds((ids) => (ids.includes(h) ? ids.filter((x) => x !== h) : ids.length < 4 ? [...ids, h] : ids));
                      }}
                    >
                      {HOST_MODELS[h].name.split(" (")[0]}
                    </button>
                    {i >= 0 && (
                      <button className={speaking === i ? btnOn : btn} onClick={() => setSpeaking((s) => (s === i ? -1 : i))}>
                        parla
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
          <div className="flex items-center justify-between text-xs opacity-75">
            <FpsMeter />
            <span>
              <a className="underline" href="?view=mascotte">
                mascotte
              </a>{" "}
              ·{" "}
              <a className="underline" href="?view=galleria">
                galleria personaggi
              </a>
            </span>
          </div>
        </div>
      ) : (
        params.ui !== "0" && (
          <button className={`${btn} absolute left-2 top-2 z-10`} onClick={() => setUi(true)}>
            pannello
          </button>
        )
      )}
    </div>
  );
}

const ACTIONS: MascotProps["action"][] = ["idle", "cheer", "sad", "attack", "hit", "evolve", "win"];

function MascotShowcase({ quality, setQuality, params }: { quality: VisualQuality; setQuality: (q: VisualQuality) => void; params: Record<string, string> }) {
  const [action, setAction] = useState<MascotProps["action"]>((ACTIONS as string[]).includes(params.action ?? "") ? (params.action as MascotProps["action"]) : "idle");
  const [evolving, setEvolving] = useState<MascotLevel | null>(null);
  const items: { slot: number; level: MascotLevel; color: string }[] = [
    { slot: 3, level: 1, color: "#2de2ff" },
    { slot: 7, level: 2, color: "#ff4fa3" },
    { slot: 11, level: 3, color: "#ffd23f" },
  ];
  return (
    <div className="flex min-h-dvh flex-col items-center gap-4 p-4" style={{ background: "radial-gradient(60% 50% at 50% 40%, rgba(255,138,31,0.12), transparent), #020306" }}>
      <h1 className="text-3xl font-black tracking-wider">MASCOTTE · SEGNAPOSTO E LIVELLI</h1>
      <p className="max-w-2xl text-center text-sm opacity-75" style={{ fontFamily: "system-ui, sans-serif" }}>
        Le 12 mascotte vere arriveranno come GLB. Fino ad allora ogni slot mostra un totem olografico dichiaratamente provvisorio. Livello 1 Base · 2 Potenziata · 3 Leggendaria.
      </p>
      <div className="flex flex-wrap justify-center gap-1" style={{ fontFamily: "system-ui, sans-serif" }}>
        {ACTIONS.map((a) => (
          <button key={a} className={a === action ? btnOn : btn} onClick={() => setAction(a)}>
            {a}
          </button>
        ))}
        <button
          className={btn}
          onClick={() => {
            setEvolving(1);
            setTimeout(() => setEvolving(2), 300);
          }}
        >
          evolvi 1→2
        </button>
        <button className={btn} onClick={() => setEvolving((l) => (l === 2 ? 3 : 2))}>
          evolvi 2→3
        </button>
        {(["high", "low", "2d"] as VisualQuality[]).map((q) => (
          <button key={q} className={q === quality ? btnOn : btn} onClick={() => setQuality(q)}>
            {q}
          </button>
        ))}
      </div>
      <div className="grid w-full max-w-6xl grid-cols-1 gap-4 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.slot} className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] p-2">
            <TigMascot slot={it.slot} level={it.level} color={it.color} action={action} quality={quality} className="aspect-square w-full" />
            <b className="text-xl tracking-wider">
              SLOT {it.slot} · LIVELLO {it.level}
            </b>
          </div>
        ))}
      </div>
      <div className="flex w-full max-w-6xl flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] p-2">
        <TigMascot slot={5} level={evolving ?? 1} color="#a46bff" action={evolving ? "evolve" : action} quality={quality} className="aspect-[2/1] w-full max-w-xl" />
        <b className="text-lg tracking-wider">EVOLUZIONE (slot 5 · livello {evolving ?? 1})</b>
      </div>
    </div>
  );
}
