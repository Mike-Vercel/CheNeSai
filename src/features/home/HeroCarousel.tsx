"use client";

import { clsx } from "clsx";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * HERO DELLA HOME a carosello: un gioco per schermata (CHE NE SAI?!, PSYCO, GIRAMENTE!…).
 *  - telefono/tablet: si scorre col dito verso destra (scroll-snap nativo, fluido, niente librerie);
 *  - PC: frecce ai lati, pallini sotto, tasti ← → quando il carosello ha il fuoco;
 *  - ogni schermata: copertina del gioco (larga su PC, verticale sul telefono) + GIOCA nel colore del gioco.
 * Niente scorrimento automatico: decide chi guarda.
 */
export interface HeroSlide {
  id: string;
  title: string;
  tagline: string;
  href: string;
  /** copertina verticale (telefono) e larga (PC) */
  cover: { src: string; width: number; height: number };
  coverWide: string;
  /** colore del pulsante GIOCA e del bagliore */
  accent: "gold" | "red" | "green";
}

const ACCENT = {
  gold: { vars: {}, btn: "bg-gold text-ink hover:bg-[#ffe066]", glow: "shadow-[0_30px_80px_-30px_rgba(131,43,255,0.55)]", dot: "bg-gold" },
  red: { vars: { "--cta-edge": "#7a0a10", "--cta-glow": "rgba(224,22,31,0.5)", "--cta-halo": "rgba(255,60,70,0.9)" }, btn: "bg-[#e0161f] text-white hover:bg-[#ff2a33]", glow: "shadow-[0_30px_80px_-30px_rgba(224,22,31,0.6)]", dot: "bg-[#e0161f]" },
  green: { vars: { "--cta-edge": "#178a06", "--cta-glow": "rgba(57,255,20,0.45)", "--cta-halo": "rgba(120,255,90,0.9)" }, btn: "bg-[#39ff14] text-[#06210a] hover:bg-[#7dff63]", glow: "shadow-[0_30px_80px_-30px_rgba(57,255,20,0.5)]", dot: "bg-[#39ff14]" },
} as const;

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M7 4.6v14.8a1 1 0 0 0 1.5.86l12.2-7.4a1 1 0 0 0 0-1.72L8.5 3.74A1 1 0 0 0 7 4.6z" />
    </svg>
  );
}

function Arrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      {dir === "left" ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
    </svg>
  );
}

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // schermata attiva = quella più visibile (si aggiorna anche scorrendo col dito)
  useEffect(() => {
    const el = track.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting && e.intersectionRatio >= 0.6) setActive(Number((e.target as HTMLElement).dataset.index));
      },
      { root: el, threshold: [0.6] },
    );
    for (const child of Array.from(el.children)) io.observe(child);
    return () => io.disconnect();
  }, []);

  const go = useCallback(
    (i: number) => {
      const el = track.current;
      if (!el) return;
      const n = slides.length;
      const target = ((i % n) + n) % n;
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollTo({ left: target * el.clientWidth, behavior: reduced ? "auto" : "smooth" });
    },
    [slides.length],
  );

  return (
    <div
      className="relative"
      role="region"
      aria-roledescription="carosello"
      aria-label="I giochi"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          go(active + 1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          go(active - 1);
        }
      }}
    >
      <div ref={track} className="qz-hero-track flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {slides.map((s, i) => {
          const a = ACCENT[s.accent];
          return (
            <section
              key={s.id}
              data-index={i}
              aria-roledescription="schermata"
              aria-label={`${i + 1} di ${slides.length}: ${s.title}`}
              className="relative isolate flex w-full shrink-0 snap-start snap-always flex-col items-center px-4 pb-6 pt-[calc(4.5rem+env(safe-area-inset-top))] md:pt-[calc(6rem+env(safe-area-inset-top))] lg:min-h-[max(40rem,min(100svh-7rem,56.25vw))] lg:justify-end lg:pb-10 lg:pt-20"
            >
              {/* PC: copertina larga a tutto schermo, sfumata nel nero */}
              <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden lg:block">
                <Image src={s.coverWide} alt="" fill preload={i === 0} loading={i === 0 ? undefined : "lazy"} sizes="100vw" className="qz-hero-cover object-cover object-top" />
                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/80 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black via-black/75 to-transparent" />
                <div className="absolute inset-y-0 left-0 w-[12%] bg-gradient-to-r from-black/70 to-transparent" />
                <div className="absolute inset-y-0 right-0 w-[12%] bg-gradient-to-l from-black/70 to-transparent" />
              </div>

              <div className="relative flex w-full max-w-[46rem] flex-col items-center text-center">
                <h2 className="w-full">
                  <span className="sr-only">{s.title}</span>
                  {/* telefono e tablet: copertina verticale al centro */}
                  <span className={clsx("qz-hero-logo relative mx-auto block w-[min(100%,24rem,calc(62svh*0.6667))] overflow-hidden rounded-3xl lg:hidden", a.glow)} style={{ aspectRatio: `${s.cover.width} / ${s.cover.height}` }}>
                    <Image src={s.cover.src} alt="" fill preload={i === 0} loading={i === 0 ? undefined : "lazy"} sizes="(min-width: 1024px) 1px, (min-width: 768px) 24rem, 92vw" className="object-cover" />
                    <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black via-black/60 to-transparent" />
                  </span>
                </h2>
                <p className="sr-only">{s.tagline}</p>
                <div className="relative z-10 -mt-9 flex w-full flex-col items-center md:-mt-10 lg:mt-[max(1.75rem,4svh)]">
                  <Link
                    href={s.href}
                    prefetch={false}
                    aria-label={`GIOCA — ${s.title}`}
                    style={a.vars as React.CSSProperties}
                    className={clsx(
                      "qz-cta inline-flex h-[4.5rem] w-full max-w-[20rem] items-center justify-center gap-3 rounded-full font-display text-[2.5rem] leading-none focus-visible:outline-offset-4 md:h-[clamp(4.75rem,9svh,6rem)] md:w-[22rem] md:max-w-none md:gap-4 md:text-[3.25rem]",
                      a.btn,
                    )}
                  >
                    <PlayIcon className="h-7 w-7 md:h-9 md:w-9" />
                    GIOCA
                  </Link>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* PC: frecce ai lati */}
      <button
        type="button"
        onClick={() => go(active - 1)}
        aria-label="Gioco precedente"
        className="absolute left-4 top-1/2 z-20 hidden h-14 w-14 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-black/80 hover:ring-white/60 lg:grid"
      >
        <Arrow dir="left" />
      </button>
      <button
        type="button"
        onClick={() => go(active + 1)}
        aria-label="Gioco successivo"
        className="absolute right-4 top-1/2 z-20 hidden h-14 w-14 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-black/80 hover:ring-white/60 lg:grid"
      >
        <Arrow dir="right" />
      </button>

      {/* pallini: quale gioco si sta guardando (cliccabili) + suggerimento di scorrere sul telefono */}
      <div className="relative z-20 mt-1 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2.5" role="tablist" aria-label="Scegli il gioco">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active === i}
              aria-label={s.title}
              onClick={() => go(i)}
              className={clsx("h-2.5 rounded-full transition-all duration-300", active === i ? clsx("w-8", ACCENT[s.accent].dot) : "w-2.5 bg-white/35 hover:bg-white/60")}
            />
          ))}
        </div>
        <p className="text-xs font-bold text-white/50 lg:hidden">Scorri per vedere gli altri giochi →</p>
      </div>
    </div>
  );
}
