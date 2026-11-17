"use client";

/* eslint-disable @next/next/no-img-element -- immagini statiche già ottimizzate (webp) */
import { clsx } from "clsx";
import { useEffect, useState, type ReactNode } from "react";

/** Gioco della schermata di caricamento: ognuno ha la sua atmosfera. */
export type SplashGame = "che-ne-sai" | "psyco" | "giramente" | "tig";

interface SplashTheme {
  /** "" = nessuna illustrazione (copertina disegnata in CSS, es. TAVOLI IN GUERRA! in attesa della copertina) */
  image: string;
  /** versione orizzontale per schermi larghi (TV, PC) */
  imageWide?: { src: string; width: number; height: number };
  imageBg: string;
  width: number;
  height: number;
  alt: string;
  tips: readonly string[];
}

const THEMES: Record<SplashGame, SplashTheme> = {
  "che-ne-sai": {
    image: "/brand/loading.webp",
    imageBg: "/brand/loading-600.webp",
    width: 1199,
    height: 1110,
    alt: "CHE NE SAI?!",
    tips: [
      "Il Professore ripassa gli appunti…",
      "La Regina si sistema la corona…",
      "Palmino accorda il microfono…",
      "Si accendono le luci dello studio…",
      "Mescoliamo le domande…",
      "Lucidiamo il pulsante rosso…",
    ],
  },
  psyco: {
    image: "/games/psyco-copertina-560.webp",
    imageWide: { src: "/games/psyco-copertina-desktop.webp", width: 1672, height: 941 },
    imageBg: "/games/psyco-copertina-560.webp",
    width: 560,
    height: 792,
    alt: "PSYCO",
    tips: [
      "Sto nascondendo la regola…",
      "Controllo che nessuno sbirci…",
      "L'investigatore accende la lampada…",
      "Raccolgo gli indizi…",
      "Chiudo il fascicolo segreto…",
    ],
  },
  giramente: {
    image: "/games/giramente-copertina-560.webp",
    imageWide: { src: "/games/giramente-copertina-desktop-960.webp", width: 960, height: 540 },
    imageBg: "/games/giramente-copertina-560.webp",
    width: 560,
    height: 840,
    alt: "GIRAMENTE!",
    tips: [
      "Don Patrizio si sistema la cravatta…",
      "Lucidiamo la ruota…",
      "Accendiamo il cervello al centro della ruota…",
      "Zafira si nasconde dietro le quinte…",
      "Mescoliamo gli enigmi…",
    ],
  },
  tig: {
    image: "",
    imageBg: "",
    width: 560,
    height: 560,
    alt: "TAVOLI IN GUERRA!",
    tips: [
      "Si apparecchiano i tavoli…",
      "Si accendono le luci dell'arena…",
      "Le mascotte si scaldano…",
      "Carichiamo il Bottone del Caos…",
      "Contiamo i punti, due volte…",
    ],
  },
};

/** Frase che cambia ogni ~2,4 s (la prima è quella passata da chi chiama, se c'è). */
function useRotatingTip(first: string | undefined, tips: readonly string[]): string {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => n + 1), 2400);
    return () => clearInterval(id);
  }, []);
  const list = first ? [first, ...tips.filter((t) => t !== first)] : tips;
  return list[i % list.length];
}

/**
 * Schermata di caricamento dei giochi: l'illustrazione del gioco che si fonde con lo sfondo (niente
 * riquadro), luci animate, barra di avanzamento e frasi che cambiano mentre carica.
 * `game` sceglie l'atmosfera: "che-ne-sai" (studio TV colorato) o "psyco" (noir, lampada che sfarfalla).
 */
export function LoadingSplash({ label, game = "che-ne-sai", children, className }: { label?: string; game?: SplashGame; children?: ReactNode; className?: string }) {
  const t = THEMES[game];
  const tip = useRotatingTip(label, t.tips);
  const noir = game === "psyco";
  const gm = game === "giramente";
  const tig = game === "tig";
  return (
    <div
      className={clsx("qz-splash relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden", noir ? "bg-black" : gm ? "bg-[#080b0d]" : tig ? "bg-[#06070c]" : "bg-[#0b0418]", className)}
      role="status"
      aria-live="polite"
    >
      {/* sfondo: la stessa illustrazione, grande e sfocata (riempie anche i TV), più le luci del gioco */}
      {t.imageBg && <img src={t.imageBg} alt="" aria-hidden className={clsx("absolute inset-0 -z-20 h-full w-full scale-125 object-cover blur-3xl", noir ? "opacity-30" : "opacity-40")} />}
      {tig ? (
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_15%_0%,rgba(255,45,61,.35),transparent_55%),radial-gradient(ellipse_at_85%_0%,rgba(255,176,32,.3),transparent_55%),radial-gradient(ellipse_at_50%_110%,rgba(155,92,255,.28),transparent_60%)]" />
      ) : gm ? (
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_0%_40%,rgba(57,255,20,.28),transparent_55%),radial-gradient(ellipse_at_100%_40%,rgba(255,37,58,.28),transparent_55%)]" />
      ) : noir ? (
        <>
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_35%,rgba(190,20,20,.35),transparent_60%)]" />
          <div aria-hidden className="psy-splash-lamp absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_78%_12%,rgba(255,200,120,.32),transparent_45%)]" />
        </>
      ) : (
        <>
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_45%,rgba(131,43,255,.45),transparent_60%),radial-gradient(ellipse_at_15%_0%,rgba(8,124,255,.35),transparent_55%),radial-gradient(ellipse_at_85%_100%,rgba(255,20,147,.35),transparent_55%)]" />
          <div aria-hidden className="qz-rays qz-splash-rays absolute inset-[-50%] -z-10 opacity-60" />
        </>
      )}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,.75)_100%)]" />

      <div className="relative z-10 flex w-full flex-col items-center gap-5 px-4" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {tig ? (
          <p className="psy-splash-art -rotate-2 text-center font-[Impact,_'Arial_Narrow',_sans-serif] text-[clamp(3rem,13vmin,7rem)] uppercase leading-[0.86] text-[#fff4dc] [text-shadow:0_4px_0_#3a0a10,0_0_40px_rgba(255,176,32,.55)]">
            <span className="block text-[0.6em]">Tavoli in</span>
            <span className="block text-[#ffb020]">
              Guerra<span className="text-[#ff2d3d]">!</span>
            </span>
          </p>
        ) : (
        <picture className="contents">
          {t.imageWide && <source media="(min-aspect-ratio: 5/4)" srcSet={t.imageWide.src} width={t.imageWide.width} height={t.imageWide.height} />}
          <img
            src={t.image}
            width={t.width}
            height={t.height}
            alt={t.alt}
            className={clsx(
              "h-auto drop-shadow-[0_30px_60px_rgba(0,0,0,.6)]",
              noir ? "psy-splash-art w-[min(80vw,48vh)] [@media(min-aspect-ratio:5/4)]:w-[min(78vw,110vh)]" : gm ? "psy-splash-art w-[min(70vw,46vh)] [@media(min-aspect-ratio:5/4)]:w-[min(78vw,110vh)]" : "qz-splash-art w-[min(92vw,62vh)]",
            )}
          />
        </picture>
        )}
        <div
          className={clsx(
            "relative h-3.5 w-[min(72vw,22rem)] overflow-hidden rounded-full border-2 bg-black/60",
            noir ? "border-[#b31414]/80 shadow-[0_0_22px_rgba(200,20,20,.45)]" : tig ? "border-[#ffb020]/80 shadow-[0_0_22px_rgba(255,176,32,.45)]" : gm ? "border-[#39ff14]/80 shadow-[0_0_22px_rgba(57,255,20,.45)]" : "border-gold/80 shadow-[0_0_22px_rgba(255,212,59,.45)]",
          )}
          role="progressbar"
          aria-label={tip}
        >
          <div className={clsx("qz-loading-bar h-full rounded-full bg-gradient-to-r", noir ? "from-[#5c0606] via-[#d11a1a] to-[#ff8a7a]" : tig ? "from-[#ff2d3d] via-[#ffb020] to-[#9b5cff]" : gm ? "from-[#0f7a2a] via-[#39ff14] to-[#ff253a]" : "from-gold-deep via-gold to-[#fff3a6]")} />
        </div>
        <p key={tip} className={clsx("qz-splash-tip min-h-[1.6em] text-center text-lg md:text-xl", noir ? "font-mono font-bold tracking-wide text-[#f3e6d0]/90" : tig ? "font-extrabold uppercase tracking-wide text-white/90" : gm ? "font-bold italic text-white/90" : "font-display text-white/90")}>
          {tip}
        </p>
        {children}
      </div>
    </div>
  );
}
