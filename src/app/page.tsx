import type { Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { Character, Logo } from "@/features/game/components/brand";
import { GameCard } from "@/features/home/cards";
import { FEATURED_GAME, GAMES, PLATFORM_NAME } from "@/features/home/games";
import { SiteHeader } from "@/features/home/SiteHeader";
import { JoinByCode } from "@/features/players/JoinByCode";
import { InstallAppButton } from "@/features/pwa/InstallAppButton";
import { getHostUser } from "@/lib/server/gioco-libero";

export const viewport: Viewport = { themeColor: "#000000" };

export const metadata = {
  title: { absolute: `${PLATFORM_NAME} · CHE NE SAI?! il quiz show da giocare in compagnia` },
  description: "Crea una partita dal PC, collega il televisore e gioca con i telefoni: domande, punteggi e podio li fa il sito.",
};

const GLOW_BLUE = { "--qz-glow": "rgba(8, 124, 255, 0.42)" } as React.CSSProperties;
const GLOW_PINK = { "--qz-glow": "rgba(255, 20, 147, 0.4)" } as React.CSSProperties;

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M7 4.6v14.8a1 1 0 0 0 1.5.86l12.2-7.4a1 1 0 0 0 0-1.72L8.5 3.74A1 1 0 0 0 7 4.6z" />
    </svg>
  );
}

export default async function Home() {
  const host = await getHostUser().catch(() => null);
  const user = host ? { username: host.profile?.username ?? null } : null;
  const g = FEATURED_GAME;

  return (
    <div className="qz-black min-h-dvh bg-black text-white">
      <SiteHeader user={user} overlay />

      {/* ------------------------------------------------ gioco in primo piano: palco buio, luci sul logo */}
      <section aria-labelledby="featured-title" className="relative isolate overflow-hidden">
        <div className="relative flex flex-col items-center px-4 pb-10 pt-[calc(4.5rem+env(safe-area-inset-top))] md:pt-[calc(6rem+env(safe-area-inset-top))] lg:min-h-[max(38rem,calc(100svh-5.5rem))] lg:justify-center lg:pb-8 lg:pt-20">
          <div aria-hidden className="qz-spotlight qz-breathe absolute inset-0 -z-20 motion-reduce:animate-none" />

          {/* presentatori ai lati, ciascuno con la sua luce a terra (da tablet in su) */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden lg:block">
            <div className="qz-presenter absolute bottom-0 right-[calc(50%+16.5rem)] h-[72%]">
              <div className="qz-floor-glow absolute inset-x-[-25%] bottom-0 h-3/5" style={GLOW_BLUE} />
              <Character who="professore" priority className="relative !h-full w-auto max-w-none translate-y-[6%]" />
            </div>
            <div className="qz-presenter qz-presenter-later absolute bottom-0 left-[calc(50%+16.5rem)] h-[70%]">
              <div className="qz-floor-glow absolute inset-x-[-25%] bottom-0 h-3/5" style={GLOW_PINK} />
              <Character who="regina" priority flip className="relative !h-full w-auto max-w-none translate-y-[6%]" />
            </div>
          </div>
          <div aria-hidden className="qz-vignette pointer-events-none absolute inset-0 -z-10" />
          <div aria-hidden className="qz-fade-bottom pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[22%]" />

          <div className="relative flex w-full max-w-[46rem] flex-col items-center text-center">
            <h1 id="featured-title" className="w-full">
              <span className="sr-only">CHE NE SAI?!</span>
              <Logo variant="mark" size="xl" priority className="qz-hero-logo mx-auto hidden !h-auto !w-[min(35rem,56vw,40svh)] lg:block" />
              {/* telefono e tablet: la copertina del gioco, al centro, che sfuma nel nero */}
              <span className="qz-hero-logo relative mx-auto block aspect-[1122/1402] w-[min(100%,26rem,calc(62svh*0.8))] overflow-hidden rounded-3xl shadow-[0_30px_80px_-30px_rgba(131,43,255,0.55)] lg:hidden">
                <Image
                  src={g.cover.kind === "image" ? g.cover.src : "/games/che-ne-sai-copertina.webp"}
                  alt=""
                  fill
                  preload
                  sizes="(min-width: 1024px) 1px, (min-width: 768px) 26rem, 92vw"
                  className="object-cover"
                />
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black via-black/60 to-transparent" />
              </span>
            </h1>
            <p className="qz-rise mt-3 hidden max-w-[31rem] text-lg font-extrabold leading-snug text-white md:mt-4 md:text-[1.375rem] lg:block">{g.tagline}</p>
            <ul aria-label="In breve" className="qz-rise mt-3 hidden flex-wrap justify-center gap-x-3 gap-y-1 text-[15px] font-bold text-white/70 md:text-base lg:flex">
              {g.meta.map((m, i) => (
                <li key={m} className="flex items-center gap-3">
                  {i > 0 && <span aria-hidden className="h-1 w-1 rounded-full bg-white/45" />}
                  {m}
                </li>
              ))}
            </ul>

            <div className="qz-rise relative z-10 -mt-9 flex w-full flex-col items-center md:-mt-10 lg:mt-[max(1.75rem,4svh)]">
              <Link
                href="/gioca"
                prefetch={false}
                className="qz-cta inline-flex h-[4.5rem] w-full max-w-[20rem] items-center justify-center gap-3 rounded-full bg-gold font-display text-[2.5rem] leading-none text-ink hover:bg-[#ffe066] focus-visible:outline-offset-4 md:h-[clamp(4.75rem,9svh,6rem)] md:w-[22rem] md:max-w-none md:gap-4 md:text-[3.25rem]"
              >
                <PlayIcon className="h-7 w-7 md:h-9 md:w-9" />
                GIOCA
              </Link>
              <p className="mt-4 text-sm font-bold text-white/60 lg:hidden">Per ospitare una partita usa il PC collegato al TV.</p>

              {/* chi ha già un codice: sul telefono resta in vista, sul PC è una riga sottile sotto GIOCA */}
              <div className="mt-8 w-full max-w-[20rem] md:mt-[max(1.5rem,3.5svh)] md:flex md:max-w-none md:items-center md:justify-center md:gap-4">
                <p id="join-label" className="mb-2 text-base font-extrabold text-white md:mb-0 md:shrink-0 md:text-[15px] md:font-bold md:text-white/65">
                  Hai un codice partita?
                </p>
                <div className="md:w-72">
                  <JoinByCode cta="ENTRA" inputId="home-code" compact />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ righe stile catalogo: le copertine dei giochi */}
      <section aria-labelledby="row-games" className="relative z-10 mt-8 lg:mt-0">
        <h2 id="row-games" className="px-4 font-display text-3xl md:px-10 md:text-4xl">
          I nostri giochi
        </h2>
        <ul className="qz-row mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-6 pt-1 md:gap-5 md:px-10">
          {GAMES.map((game, i) => (
            <li key={game.id} className="snap-start">
              <GameCard game={game} priority={i === 0} />
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-16 bg-coal-1 px-4 pb-10 pt-12 md:mt-24 md:px-10">
        <p className="font-display text-5xl leading-none text-white/90 md:text-8xl">{PLATFORM_NAME}</p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-bold text-white/80">
          <Link href="/classifica" className="hover:text-white hover:underline">
            Classifica del mese
          </Link>
          <Link href="/entra" className="hover:text-white hover:underline">
            Entra con un codice
          </Link>
          <Link href="/tv" className="hover:text-white hover:underline">
            Collega un televisore
          </Link>
          <Link href="/accedi" className="hover:text-white hover:underline">
            Crea un account
          </Link>
          <Link href="/privacy" className="hover:text-white hover:underline">
            Privacy
          </Link>
          <Link href="/termini" className="hover:text-white hover:underline">
            Termini
          </Link>
          <InstallAppButton />
          <Link href="/admin" className="ml-auto text-white/60 hover:text-white">
            Area regia
          </Link>
        </div>
      </footer>
    </div>
  );
}
