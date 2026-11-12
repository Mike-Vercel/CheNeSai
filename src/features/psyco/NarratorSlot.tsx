"use client";

import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { getNarrator, type NarratorState } from "./narrator";
import { Silhouette } from "./ui";

/**
 * POSTO DEL PERSONAGGIO NARRATORE (l'Investigatore) nelle schermate di PSYCO.
 *
 * Oggi: illustrazione noir provvisoria (silhouette col cappello sotto la lampada) che «parla» quando
 * parla il narratore (anelli e bocca che seguono il volume della voce).
 * Domani: il modello 3D (REFERENCE/GIOCHI/PSYCO/MODELLI-3D/INVESTIGATORE_PARLANTE.glb) col sistema dei
 * presentatori (src/features/three/characters/*, glb-host.tsx): basta passare `render` e usare
 * `analyser` per il lip sync, senza toccare le schermate.
 *
 * API:
 *  - `size`: "sm" (telefono), "md" (dispositivo condiviso), "lg" / "tv" (schermo grande);
 *  - `render?: (s) => ReactNode` sostituisce l'illustrazione; `s` = { speaking, audible, id, text,
 *    analyser } (analyser = AnalyserNode della voce, null finché l'audio è bloccato);
 *  - attributi DOM: data-psyco-narrator, data-speaking="true|false", data-voice-id.
 *  - fuori da React: getNarrator().onState(fn) e getNarrator().getAnalyser() (src/features/psyco/narrator.ts).
 */
export interface NarratorSlotState extends NarratorState {
  analyser: AnalyserNode | null;
}

const SIZE = {
  sm: "h-20 w-20",
  md: "h-28 w-28 md:h-32 md:w-32",
  lg: "h-44 w-44",
  tv: "h-[24vh] w-[24vh]",
} as const;

export function PsycoNarratorSlot({ size = "md", className, render }: { size?: keyof typeof SIZE; className?: string; render?: (s: NarratorSlotState) => React.ReactNode }) {
  const [s, setS] = useState<NarratorState>({ speaking: false, audible: false, id: null, text: null });
  const mouth = useRef<SVGEllipseElement | null>(null);
  useEffect(() => getNarrator().onState(setS), []);

  // bocca che segue il volume reale della voce (se l'audio suona), altrimenti un movimento finto
  useEffect(() => {
    if (!s.speaking) return;
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
      mouth.current?.setAttribute("ry", String(0.8 + level * 7));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      mouth.current?.setAttribute("ry", "0.8");
    };
  }, [s.speaking, s.audible]);

  return (
    <div
      data-psyco-narrator
      data-speaking={s.speaking ? "true" : "false"}
      data-voice-id={s.id ?? ""}
      aria-hidden
      className={clsx("relative shrink-0", SIZE[size], className)}
    >
      {render ? (
        render({ ...s, analyser: getNarrator().getAnalyser() })
      ) : (
        <div className="relative h-full w-full">
          {/* luce della lampada */}
          <div className={clsx("absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_25%,rgba(255,181,71,.55),rgba(142,11,18,.35)_55%,transparent_72%)] transition-opacity duration-500", s.speaking ? "opacity-100" : "opacity-60")} />
          {s.speaking && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full ring-2 ring-blood/50 [animation-duration:1.6s]" />
              <span className="absolute inset-[-8%] rounded-full ring-1 ring-lamp/30" />
            </>
          )}
          <svg viewBox="0 0 120 120" className="relative h-full w-full drop-shadow-[0_6px_14px_rgba(0,0,0,.8)]">
            <g transform="translate(6 10) scale(0.9)">
              <Silhouette />
            </g>
            {/* bocca (si apre quando parla) */}
            <ellipse ref={mouth} cx="60" cy="69" rx="4.2" ry="0.8" fill="#e0161f" opacity={s.speaking ? 0.9 : 0} />
            {/* occhi che brillano sotto la tesa */}
            <circle cx="54" cy="60" r="1.4" fill="#ffb547" opacity={s.speaking ? 1 : 0.55} />
            <circle cx="66" cy="60" r="1.4" fill="#ffb547" opacity={s.speaking ? 1 : 0.55} />
          </svg>
        </div>
      )}
    </div>
  );
}
