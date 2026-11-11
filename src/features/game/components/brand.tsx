/* eslint-disable @next/next/no-img-element -- immagini statiche già ottimizzate (webp) e dimensionate */
import { clsx } from "clsx";
import type { Presenter } from "@/lib/game-engine/types";

export const CHARACTERS: Record<Presenter, { name: string; role: string; src: string; small: string; w: number; h: number; accent: string }> = {
  professore: { name: "Il Professore", role: "Presentatore", src: "/characters/professore-1024.webp", small: "/characters/professore-512.webp", w: 961, h: 1024, accent: "#087cff" },
  regina: { name: "La Regina", role: "Presentatrice", src: "/characters/regina-1024.webp", small: "/characters/regina-512.webp", w: 1023, h: 953, accent: "#ff1493" },
  palmino: { name: "Palmino", role: "Il jolly imprevedibile", src: "/characters/palmino-1024.webp", small: "/characters/palmino-512.webp", w: 881, h: 1024, accent: "#00d46a" },
};

/** Uno dei tre personaggi ufficiali (immagini originali scontornate). */
export function Character({
  who,
  className,
  small,
  flip,
  glow = true,
  priority,
}: {
  who: Presenter;
  className?: string;
  small?: boolean;
  flip?: boolean;
  glow?: boolean;
  priority?: boolean;
}) {
  const c = CHARACTERS[who];
  return (
    <img
      src={small ? c.small : c.src}
      width={c.w}
      height={c.h}
      alt={c.name}
      draggable={false}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={clsx("pointer-events-none h-auto select-none object-contain", flip && "-scale-x-100", className)}
      style={glow ? { filter: `drop-shadow(0 0 18px ${c.accent}88) drop-shadow(0 12px 18px rgba(0,0,0,.55))` } : undefined}
    />
  );
}

const LOGO_FILES = {
  mark: { base: "/brand/logo-mark", w: 1241, h: 1157 },
  full: { base: "/brand/logo-full", w: 1467, h: 1015 },
} as const;

/**
 * Logo ufficiale CHE NE SAI?! (immagini fornite dal locale, sfondo rimosso).
 * - "mark": solo la scritta con ruota e pulsante (intestazioni, dove i personaggi sono già presenti)
 * - "full": logo con i tre personaggi (lobby, pagina iniziale, telefono)
 * Le dimensioni "tv*" usano unità container (cqh) per scalare su TV Full HD/4K e nelle anteprime.
 */
export function Logo({
  size = "md",
  variant = "mark",
  className,
  priority,
}: {
  size?: "sm" | "md" | "lg" | "xl" | "tv" | "tvxl";
  variant?: "mark" | "full";
  className?: string;
  priority?: boolean;
}) {
  const f = LOGO_FILES[variant];
  const height = {
    sm: "h-16",
    md: "h-28",
    lg: "h-44",
    xl: "h-72",
    tv: "h-[17cqh]",
    tvxl: "h-[34cqh]",
  }[size];
  const file = size === "sm" ? 480 : size === "md" || size === "lg" || size === "tv" ? 900 : 1600;
  return (
    <img
      src={`${f.base}-${file}.webp`}
      width={f.w}
      height={f.h}
      alt="CHE NE SAI?!"
      draggable={false}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={clsx("pointer-events-none w-auto max-w-full select-none object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,.45)]", height, className)}
    />
  );
}

/** Cornice di lampadine stile marquee (decorativa, aria-hidden). */
export function Marquee({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("qz-bulbs animate-marquee pointer-events-none", className)} />;
}
