"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { JollyPortalProps } from "./types";
import { Portrait2D } from "./Portrait2D";
import { prefersReducedMotion } from "./quality";
import "./jolly-portal.css";

/** classi di jolly-portal.css (CSS globale con prefisso: il progetto non usa i CSS Modules) */
const styles = { closing: "gr3-jp-closing", flat: "gr3-jp-flat", open: "gr3-jp-open", portrait: "gr3-jp-portrait", ring: "gr3-jp-ring", wash: "gr3-jp-wash", washOff: "gr3-jp-wash-off", washOn: "gr3-jp-wash-on", wrap: "gr3-jp-wrap" };

const JollyPortal3D = lazy(() => import("./JollyPortal3D"));

/** Durata dell'uscita (s): Zafira rientra nel portale e il portale si chiude, poi onDone. */
export const JOLLY_EXIT_S = 1.7;
const EXIT_2D_MS = 650;

/**
 * Ingresso speciale della JOLLY (brief §14): le luci cambiano, si apre un portale verde e rosso, Zafira esce
 * camminando, resta (idle o parla) finché play è true; con play=false rientra, il portale si chiude e
 * dopo l'uscita parte onDone (il chiamante può smontarlo). Saltabile: basta mettere play=false.
 * Qualità "2d" o movimento ridotto: portale in CSS e ritratto 2D dichiarato.
 */
export default function JollyPortal({ play, quality, speaking, mouthRef, onDone, onEntered, className, src }: JollyPortalProps) {
  const [mounted, setMounted] = useState(play);
  const [failed, setFailed] = useState(false);
  const [opened, setOpened] = useState(false);
  if (play && !mounted) setMounted(true);
  const cb = useRef({ onDone, onEntered });
  useEffect(() => {
    cb.current = { onDone, onEntered };
  });
  const flat = quality === "2d" || failed || prefersReducedMotion();

  // versione 2D: ingresso con le transizioni CSS, uscita a tempo
  useEffect(() => {
    if (!flat || !mounted) return;
    if (play) {
      // un fotogramma dopo il montaggio, così le transizioni CSS partono dallo stato chiuso
      const id = requestAnimationFrame(() => setOpened(true));
      const t = setTimeout(() => cb.current.onEntered?.(), 700);
      return () => {
        cancelAnimationFrame(id);
        clearTimeout(t);
      };
    }
    const t = setTimeout(() => {
      setOpened(false);
      setMounted(false);
      cb.current.onDone?.();
    }, EXIT_2D_MS);
    return () => clearTimeout(t);
  }, [flat, mounted, play]);

  if (!mounted) return null;
  if (flat) {
    return (
      <div className={`${styles.flat} ${play ? (opened ? styles.open : "") : styles.closing} ${className ?? ""}`} role="img" aria-label="Entra la Jolly: Zafira">
        <div className={styles.ring} aria-hidden />
        <Portrait2D who="zafira" speaking={speaking} mouthRef={mouthRef} className={styles.portrait} />
      </div>
    );
  }
  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      <div className={`${styles.wash} ${play ? styles.washOn : styles.washOff}`} aria-hidden />
      <Suspense fallback={null}>
        <JollyPortal3D
          play={play}
          quality={quality}
          speaking={speaking}
          mouthRef={mouthRef}
          src={src}
          onEntered={() => cb.current.onEntered?.()}
          onExited={() => {
            setMounted(false);
            cb.current.onDone?.();
          }}
          onFail={(r) => {
            console.warn(`[giramente] portale 3D → 2D: ${r}`);
            setFailed(true);
          }}
        />
      </Suspense>
    </div>
  );
}
