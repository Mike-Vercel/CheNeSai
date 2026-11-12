"use client";

import { clsx } from "clsx";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { getNarrator, type NarratorState } from "./narrator";
import { deviceCaps, report3dFailure, use3dAllowed, useIntroActive } from "./investigatore/device";
import { Silhouette } from "./ui";

const InvestigatoreStage = lazy(() => import("./investigatore/InvestigatoreStage"));

/**
 * POSTO DEL PERSONAGGIO NARRATORE (l'Investigatore) nelle schermate di PSYCO.
 *
 * Ritratto in cornice (classe .psy-portrait) con l'Investigatore 3D a mezzo busto che parla con la voce
 * del narratore: labbra a tempo (AnalyserNode della voce → jawOpen/mouthO/mouthE), occhi che sbattono,
 * Idle quando tace e Talk_* quando parla (investigatore/InvestigatoreStage.tsx, sistema GLB dei presentatori).
 * Finché il GLB carica, senza WebGL, col renderer software o se il 3D si rompe: la silhouette noir.
 * Durante l'intro 3D niente secondo canvas (resta la silhouette, coperta dall'intro).
 * Il file (variante A/B) si sceglie in src/features/three/characters/investigatore.ts.
 *
 * API:
 *  - `size`: "xs" (ridotto, schermate segrete), "sm" (telefono), "md" (dispositivo condiviso), "lg", "tv"
 *    (TV, in basso a sinistra), "tvs" (TV in sala d'attesa, sotto il QR);
 *  - `render?: (s) => ReactNode` sostituisce il ritratto; `s` = { speaking, audible, id, text, analyser };
 *  - attributi DOM: data-psyco-narrator, data-speaking="true|false", data-voice-id, data-mode="3d|2d".
 *  - fuori da React: getNarrator().onState(fn) e getNarrator().getAnalyser() (src/features/psyco/narrator.ts).
 */
export interface NarratorSlotState extends NarratorState {
  analyser: AnalyserNode | null;
}

const SIZE = {
  xs: "h-16 w-14",
  sm: "h-28 w-24",
  md: "h-32 w-28 md:h-44 md:w-36",
  lg: "h-56 w-44",
  tvs: "h-[29vh] w-[23vh]",
  tv: "h-[36vh] w-[29vh]",
} as const;
export type NarratorSlotSize = keyof typeof SIZE;

function useNarratorState(): NarratorState {
  const [s, setS] = useState<NarratorState>({ speaking: false, audible: false, id: null, text: null });
  useEffect(() => getNarrator().onState(setS), []);
  return s;
}

/** true quando l'elemento è (almeno in parte) sullo schermo e la scheda è visibile. */
function useOnScreen(ref: React.RefObject<HTMLElement | null>): boolean {
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => setInView(e.some((x) => x.isIntersecting)), { rootMargin: "80px" });
    io.observe(el);
    const onVis = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ref]);
  return inView && pageVisible;
}

/** Silhouette noir (posto provvisorio e riserva del 3D): anelli e bocca che seguono il volume della voce. */
function SilhouettePortrait({ s }: { s: NarratorState }) {
  const mouth = useRef<SVGEllipseElement | null>(null);
  useEffect(() => {
    const el = mouth.current;
    if (!s.speaking || !el) return;
    const an = getNarrator().getAnalyser();
    const data = an ? new Uint8Array(an.fftSize) : null;
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      let level: number;
      if (an && data && s.audible) {
        an.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += Math.abs(data[i] - 128);
        level = Math.min(1, (sum / data.length) * 0.09);
      } else {
        const t = (performance.now() - t0) / 1000;
        level = 0.35 + 0.3 * Math.abs(Math.sin(t * 9) * Math.sin(t * 3.7));
      }
      el.setAttribute("ry", String(0.8 + level * 7));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      el.setAttribute("ry", "0.8");
    };
  }, [s.speaking, s.audible]);
  return (
    <svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMax meet" className="absolute inset-0 h-full w-full drop-shadow-[0_6px_14px_rgba(0,0,0,.8)]">
      <g transform="translate(-6 8) scale(1.1)">
        <Silhouette />
        <ellipse ref={mouth} cx="60" cy="69" rx="3.2" ry="0.8" fill="#5a0a10" stroke="#e0161f" strokeWidth="0.6" opacity={s.speaking ? 0.95 : 0} />
        <circle cx="54" cy="60" r="1.4" fill="#ffb547" opacity={s.speaking ? 1 : 0.55} />
        <circle cx="66" cy="60" r="1.4" fill="#ffb547" opacity={s.speaking ? 1 : 0.55} />
      </g>
    </svg>
  );
}

export function PsycoNarratorSlot({ size = "md", className, render }: { size?: NarratorSlotSize; className?: string; render?: (s: NarratorSlotState) => React.ReactNode }) {
  const s = useNarratorState();
  const box = useRef<HTMLDivElement | null>(null);
  const onScreen = useOnScreen(box);
  const allowed = use3dAllowed();
  const intro = useIntroActive();
  const [ready, setReady] = useState(false);
  const use3d = !render && allowed && !intro;
  const lowPower = deviceCaps().lowPower;

  return (
    <div
      ref={box}
      data-psyco-narrator
      data-speaking={s.speaking ? "true" : "false"}
      data-voice-id={s.id ?? ""}
      data-mode={use3d && ready ? "3d" : "2d"}
      aria-hidden
      className={clsx("psy-portrait relative shrink-0 overflow-hidden rounded-2xl transition-[box-shadow] duration-300", SIZE[size], className)}
    >
      {render ? (
        render({ ...s, analyser: getNarrator().getAnalyser() })
      ) : (
        <>
          <div className={clsx("absolute inset-0 transition-opacity duration-500", use3d && ready ? "opacity-0" : "opacity-100")}>
            <SilhouettePortrait s={s} />
          </div>
          {use3d && (
            <Suspense fallback={null}>
              <InvestigatoreStage
                lowPower={lowPower}
                visible={onScreen}
                framing={size === "xs" ? "face" : "bust"}
                onReady={() => setReady(true)}
                onFail={(r) => {
                  setReady(false);
                  report3dFailure(r);
                }}
                className={clsx("!absolute inset-0 transition-opacity duration-500", ready ? "opacity-100" : "opacity-0")}
              />
            </Suspense>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Telefono e dispositivo condiviso: il ritratto in alto con il sottotitolo ACCANTO (fumetto), al posto
 * del sottotitolo fisso. Fra una frase e l'altra resta l'ultima, sbiadita. `compact` = schermate segrete
 * (ruolo, regola): ritratto piccolo, mai sopra carte o pulsanti (è nel flusso della pagina, non sovrapposto).
 */
export function PsycoNarratorDock({ compact = false, size, className }: { compact?: boolean; size?: NarratorSlotSize; className?: string }) {
  const s = useNarratorState();
  const [last, setLast] = useState<string | null>(null);
  if (s.text && s.text !== last) setLast(s.text);
  const text = s.text ?? last;
  return (
    <div data-psyco-dock className={clsx("flex w-full max-w-xl items-start gap-3", className)}>
      <PsycoNarratorSlot size={size ?? (compact ? "xs" : "md")} />
      <div className="min-w-0 flex-1 pt-1">
        <p className="mb-1 text-[0.65rem] font-black uppercase tracking-[0.25em] text-lamp/80">L&apos;Investigatore</p>
        {text && (
          <p
            aria-live="polite"
            className={clsx(
              "psy-bubble psy-type rounded-2xl px-3 py-2 text-paper transition-opacity duration-500",
              compact ? "text-sm" : "text-base md:text-lg",
              s.speaking ? "opacity-100" : "opacity-55",
            )}
          >
            {text}
          </p>
        )}
      </div>
    </div>
  );
}
