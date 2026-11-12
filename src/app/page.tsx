import type { Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
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
        <div className="relative flex flex-col items-center px-4 pb-10 pt-[calc(4.5rem+env(safe-area-inset-top))] md:pt-[calc(6rem+env(safe-area-inset-top))] lg:min-h-[max(40rem,min(100svh,56.25vw))] lg:justify-end lg:pb-12 lg:pt-20">
          <div aria-hidden className="qz-spotlight qz-breathe absolute inset-0 -z-20 motion-reduce:animate-none" />

          {/* PC: la copertina del gioco a tutto schermo (logo e presentatori sono già nell'immagine), sfumata nel nero */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden lg:block">
            <Image src="/games/che-ne-sai-copertina-desktop.webp" alt="" fill preload sizes="100vw" className="qz-hero-cover object-cover object-top" />
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/80 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black via-black/75 to-transparent" />
            <div className="absolute inset-y-0 left-0 w-[12%] bg-gradient-to-r from-black/70 to-transparent" />
            <div className="absolute inset-y-0 right-0 w-[12%] bg-gradient-to-l from-black/70 to-transparent" />
          </div>
          <div aria-hidden className="qz-vignette pointer-events-none absolute inset-0 -z-10" />
          <div aria-hidden className="qz-fade-bottom pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[22%]" />

          <div className="relative flex w-full max-w-[46rem] flex-col items-center text-center">
            <h1 id="featured-title" className="w-full">
              <span className="sr-only">CHE NE SAI?!</span>
              {/* telefono e tablet: la copertina del gioco, al centro, che sfuma nel nero */}
              <span className="qz-hero-logo relative mx-auto block aspect-[1024/1536] w-[min(100%,24rem,calc(66svh*0.6667))] overflow-hidden rounded-3xl shadow-[0_30px_80px_-30px_rgba(131,43,255,0.55)] lg:hidden">
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
            <p className="sr-only">{g.tagline}</p>
            <ul aria-label="In breve" className="hidden">
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
              <p className="mt-4 text-sm font-bold text-white/60 lg:hidden">Gioca dal telefono o dal PC, anche sul televisore.</p>

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
