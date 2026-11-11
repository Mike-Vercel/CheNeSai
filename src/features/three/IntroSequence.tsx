"use client";

import { Suspense, lazy, useCallback, useEffect, useEffectEvent, useState } from "react";
import { IntroErrorBoundary, detectWebGL } from "./IntroErrorBoundary";
import { IntroFallback2D } from "./IntroFallback2D";
import { IntroOverlay, OVERLAY_CSS } from "./IntroOverlay";
import { INTRO_FONT_FACE_CSS, preloadIntroAssets as preloadAssetFiles } from "./assets";
import { startIntroAudio } from "./intro-audio";
import { useIntroTimeline } from "./use-intro-timeline";
import { DEFAULT_SCORING, useIntroSchedule, type RulesScoring } from "./rules";
import { INTRO_DURATION_MS as DURATION } from "./timeline";

/** Scena WebGL caricata a parte: three/drei non entrano nel bundle della pagina finché serve. */
const IntroScene = lazy(() => import("./IntroScene"));

export interface IntroSequenceProps {
  /** Server timestamp (ms epoch) when the intro started. */
  startedAtMs: number;
  /** Returns the current server time in ms (client clock corrected by the server offset). */
  now: () => number;
  reducedMotion?: boolean; // fewer camera moves/particles, no flashes
  lowPower?: boolean; // lower DPR, fewer particles, no postprocessing
  muted?: boolean; // nessun audio (sigla e voci)
  /** Sigla ufficiale durante l'intro (default sì). */
  music?: boolean;
  /** Battute parlate dei personaggi durante l'intro (default sì). */
  voice?: boolean;
  /** Segmento "Spiega le regole" prima del 3·2·1 (default sì). */
  explainRules?: boolean;
  /** Punti reali della sessione per le schede delle regole (default 1000 / −400 / 0). */
  scoring?: Partial<RulesScoring>;
  onFinished?: () => void; // called once when the timeline passes the end
}

/**
 * Durata dell'intro SENZA il segmento regole (ms). Con le regole la durata reale si allunga
 * della loro somma (vedi rules.ts → IntroSchedule.total); dopo la fine resta il frame finale.
 */
export const INTRO_DURATION_MS: number = DURATION;

/**
 * Da chiamare in lobby: scalda immagini, font e il chunk della scena 3D,
 * così all'avvio dell'intro (e durante il countdown) non si scarica nulla di pesante.
 */
export function preloadIntroAssets(): void {
  if (typeof window === "undefined") return;
  preloadAssetFiles();
  if (detectWebGL()) {
    void import("./IntroScene").catch(() => undefined);
    // personaggi GLB (~4.5 MB in tutto): scaricati e decodificati in anticipo, così entrano senza attese
    // preferenze del TV (DisplayApp → "qz.tv.prefs"): PC lento → varianti leggere; personaggi 2D → niente GLB
    let low = false;
    let chars3d = true;
    try {
      const p = JSON.parse(localStorage.getItem("qz.tv.prefs") ?? "{}") as { lowPower?: boolean; characters3d?: boolean };
      low = p.lowPower === true;
      chars3d = p.characters3d !== false;
    } catch {
      /* preferenze assenti o illeggibili: valori predefiniti */
    }
    if (chars3d) void import("./characters/glb-host").then((m) => m.preloadHostGlbs(low)).catch(() => undefined);
  }
}

/** Variante con opzioni extra (anteprima admin): `forceFallback` mostra sempre l'intro 2D. */
export function IntroSequenceView({ forceFallback = false, ...props }: IntroSequenceProps & { forceFallback?: boolean }) {
  const { startedAtMs, now, reducedMotion = false, lowPower = false, muted = false, music = true, voice = true, explainRules = true, scoring, onFinished } = props;
  const schedule = useIntroSchedule(explainRules);
  const fullScoring: RulesScoring = { ...DEFAULT_SCORING, ...scoring };
  const [webgl] = useState(detectWebGL);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);

  const timeline = useIntroTimeline({ startedAtMs, now, onFinished, schedule });

  // sigla ufficiale + voci: leggono sempre il tempo corrente dalla timeline del server
  const elapsedSeconds = useEffectEvent(() => (now() - startedAtMs) / 1000);
  const currentSchedule = useEffectEvent(() => schedule);
  useEffect(() => {
    if (muted || (!music && !voice)) return;
    return startIntroAudio(() => elapsedSeconds(), () => currentSchedule(), { music, voice });
  }, [muted, music, voice, startedAtMs]);

  const onContextLost = useCallback(() => setContextLost(true), []);
  const onContextRestored = useCallback(() => {
    // three.js re-inizializza lo stato GL e ricarica in GPU texture/geometrie al frame successivo
    setContextLost(false);
  }, []);
  // ultima risorsa: se il contesto non torna entro 4 s, ricrea il canvas da zero
  useEffect(() => {
    if (!contextLost) return;
    const id = window.setTimeout(() => {
      setCanvasKey((k) => k + 1);
      setContextLost(false);
    }, 4000);
    return () => window.clearTimeout(id);
  }, [contextLost]);

  const use3D = webgl && !forceFallback && !sceneFailed;
  const fallback = <IntroFallback2D state={timeline} reducedMotion={reducedMotion} startedAtMs={startedAtMs} now={now} scoring={fullScoring} />;

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#07020d]" data-intro-mode={use3D && !contextLost ? "3d" : "2d"}>
      <style>{INTRO_FONT_FACE_CSS + OVERLAY_CSS}</style>
      {use3D ? (
        <>
          <IntroErrorBoundary fallback={fallback} onError={() => setSceneFailed(true)}>
            <Suspense fallback={null}>
              <IntroScene
                key={canvasKey}
                startedAtMs={startedAtMs}
                now={now}
                reducedMotion={reducedMotion}
                lowPower={lowPower}
                schedule={schedule}
                onContextLost={onContextLost}
                onContextRestored={onContextRestored}
              />
            </Suspense>
            <IntroOverlay state={timeline} reducedMotion={reducedMotion} scoring={fullScoring} />
          </IntroErrorBoundary>
          {/* contesto WebGL perso: il canvas resta montato (per il ripristino) sotto al fallback 2D */}
          {contextLost && <div className="absolute inset-0">{fallback}</div>}
        </>
      ) : (
        fallback
      )}
    </div>
  );
}

/** Intro cinematografica 3D di CHE NE SAI?! (solo client: caricare con next/dynamic `{ ssr: false }`). */
export function IntroSequence(props: IntroSequenceProps) {
  return <IntroSequenceView {...props} />;
}

export default IntroSequence;
