/* eslint-disable @next/next/no-img-element -- immagini statiche già ottimizzate (webp) */
import { clsx } from "clsx";
import Link from "next/link";
import { Character, Logo } from "@/features/game/components/brand";
import type { Presenter } from "@/lib/game-engine/types";
import type { CoverMark, GameEntry } from "./games";

/** Copertina di un gioco nelle righe della home (16:9, come una locandina di catalogo). */
export function GameCard({ game, fluid }: { game: GameEntry; fluid?: boolean }) {
  const available = game.status === "disponibile" && game.href;
  const body = (
    <>
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-night-3">
        {game.cover.kind === "image" ? (
          <>
            <div aria-hidden className="qz-stage absolute inset-0" />
            <Character who="professore" small className="absolute -bottom-[18%] -left-[6%] !h-[96%] w-auto max-w-none transition duration-500 group-hover:-translate-y-1" glow={false} />
            <Character who="regina" small flip className="absolute -bottom-[18%] -right-[6%] !h-[92%] w-auto max-w-none transition duration-500 group-hover:-translate-y-1" glow={false} />
            <Logo variant="mark" size="md" className="absolute left-1/2 top-[46%] !h-[84%] !w-auto -translate-x-1/2 -translate-y-1/2 transition duration-500 group-hover:scale-105" />
          </>
        ) : (
          <div aria-hidden className="absolute inset-0 grid place-items-center overflow-hidden" style={{ backgroundColor: game.cover.color }}>
            <div className="qz-rays absolute -inset-1/2 opacity-70" />
            <CoverArt mark={game.cover.mark} />
          </div>
        )}
        {!available && <span className="absolute left-3 top-3 rounded-full bg-night/85 px-3 py-1 text-[13px] font-black text-white">Presto disponibile</span>}
        {available && <span className="absolute left-3 top-3 rounded-full bg-gold px-3 py-1 text-[13px] font-black text-ink">Gioca ora</span>}
      </div>
      <div className={clsx("mt-3 px-1", fluid && "sr-only")}>
        <h3 className="font-display text-xl leading-tight text-white md:text-2xl">{game.title}</h3>
        <p className={clsx("mt-1 text-sm font-bold leading-snug", available ? "text-white/85" : "text-white/70")}>{game.tagline}</p>
      </div>
    </>
  );
  const cls = clsx("group block", fluid ? "w-full" : "w-[78vw] max-w-[26rem] shrink-0 md:w-auto md:max-w-none");
  if (!available) return <div className={clsx(cls, "opacity-90")}>{body}</div>;
  return (
    <Link href={game.href!} prefetch={false} className={clsx(cls, "rounded-2xl outline-offset-4 transition active:scale-[0.98]")} aria-label={`Gioca a ${game.title}`}>
      {body}
    </Link>
  );
}

const STEP_BG: Record<Presenter, string> = { professore: "#087cff", regina: "#ff1493", palmino: "#00d46a" };

/** Scheda "come si gioca": un presentatore e una frase. */
export function StepCard({ who, title, text }: { who: Presenter | null; title: string; text: string }) {
  return (
    <article className="flex h-full w-[78vw] max-w-[22rem] shrink-0 flex-col overflow-hidden rounded-2xl bg-night-2 md:w-auto md:max-w-none">
      <div className="relative h-44 overflow-hidden" style={{ backgroundColor: who ? STEP_BG[who] : "#2e1650" }}>
        {who ? (
          <Character who={who} small glow={false} className="absolute -bottom-[30%] left-1/2 !h-[150%] w-auto max-w-none -translate-x-1/2" />
        ) : (
          <img src="/brand/logo-wheel-1024.webp" alt="" width={1024} height={1024} loading="lazy" className="absolute left-1/2 top-1/2 h-[140%] w-auto max-w-none -translate-x-1/2 -translate-y-1/2 animate-spin-slow motion-reduce:animate-none" />
        )}
      </div>
      <div className="flex-1 p-5">
        <h3 className="font-display text-2xl leading-tight text-white">{title}</h3>
        <p className="mt-2 text-base font-semibold leading-snug text-white/90">{text}</p>
      </div>
    </article>
  );
}

/** Copertine provvisorie dei giochi in arrivo: un segno grande e semplice, in bianco sul colore. */
function CoverArt({ mark }: { mark: CoverMark }) {
  const cls = "relative h-[46%] w-auto text-white transition duration-500 group-hover:scale-110";
  if (mark === "note") {
    return (
      <svg viewBox="0 0 64 64" className={cls} fill="currentColor" aria-hidden>
        <path d="M24 10l30-6v38a9 9 0 1 1-6-8.5V17l-18 3.6V48a9 9 0 1 1-6-8.5z" />
      </svg>
    );
  }
  if (mark === "pencil") {
    return (
      <svg viewBox="0 0 64 64" className={cls} fill="currentColor" aria-hidden>
        <path d="M44 6l14 14-30 30-14-14zM11 39l14 14-17 5z" />
      </svg>
    );
  }
  return <span className="relative font-display text-[6rem] leading-none text-white transition duration-500 group-hover:scale-110 md:text-[8rem]">Aa</span>;
}
