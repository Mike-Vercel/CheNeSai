import type { Viewport } from "next";
import Link from "next/link";
import { GameCard } from "@/features/home/cards";
import { HeroCarousel, type HeroSlide } from "@/features/home/HeroCarousel";
import { GAMES, PLATFORM_NAME } from "@/features/home/games";
import { SiteHeader } from "@/features/home/SiteHeader";
import { JoinByCode } from "@/features/players/JoinByCode";
import { InstallAppButton } from "@/features/pwa/InstallAppButton";
import { getHostUser } from "@/lib/server/gioco-libero";

export const viewport: Viewport = { themeColor: "#000000" };

export const metadata = {
  title: { absolute: `${PLATFORM_NAME} · CHE NE SAI?! il quiz show da giocare in compagnia` },
  description: "Crea una partita dal PC, collega il televisore e gioca con i telefoni: domande, punteggi e podio li fa il sito.",
};

/** Le schermate della hero (ordine = ordine di scorrimento). */
const HERO_SLIDES: HeroSlide[] = [
  { id: "che-ne-sai", title: "CHE NE SAI?!", tagline: "Il quiz show da giocare in compagnia.", href: "/gioca", cover: { src: "/games/che-ne-sai-copertina.webp", width: 1024, height: 1536 }, coverWide: "/games/che-ne-sai-copertina-desktop.webp", accent: "gold" },
  { id: "psyco", title: "PSYCO", tagline: "Tutti conoscono la regola. Tranne te.", href: "/psyco", cover: { src: "/games/psyco-copertina.webp", width: 1055, height: 1318 }, coverWide: "/games/psyco-copertina-desktop.webp", accent: "red" },
  { id: "giramente", title: "GIRAMENTE!", tagline: "La ruota gira. La mente decide.", href: "/giramente", cover: { src: "/games/giramente-copertina.webp", width: 1024, height: 1536 }, coverWide: "/games/giramente-copertina-desktop.webp", accent: "green" },
];

export default async function Home() {
  const host = await getHostUser().catch(() => null);
  const user = host ? { username: host.profile?.username ?? null } : null;

  return (
    <div className="qz-black min-h-dvh bg-black text-white">
      <SiteHeader user={user} overlay />

      {/* ------------------------------------------------ i giochi in primo piano: si scorre verso destra */}
      <section aria-labelledby="featured-title" className="relative isolate overflow-hidden pb-10 lg:pb-12">
        <h1 id="featured-title" className="sr-only">
          {PLATFORM_NAME}: CHE NE SAI?!, PSYCO, GIRAMENTE!
        </h1>
        <div aria-hidden className="qz-spotlight qz-breathe absolute inset-0 -z-20 motion-reduce:animate-none" />
        <div aria-hidden className="qz-vignette pointer-events-none absolute inset-0 -z-10" />

        <HeroCarousel slides={HERO_SLIDES} />

        {/* chi ha già un codice: sul telefono resta in vista, sul PC è una riga sottile sotto i giochi */}
        <div className="qz-rise relative z-10 mx-auto mt-6 w-full max-w-[20rem] px-4 md:mt-[max(1.25rem,3svh)] md:flex md:max-w-none md:items-center md:justify-center md:gap-4">
          <p className="mb-2 text-center text-sm font-bold text-white/60 md:hidden">Gioca dal telefono o dal PC, anche sul televisore.</p>
          <p id="join-label" className="mb-2 text-base font-extrabold text-white md:mb-0 md:shrink-0 md:text-[15px] md:font-bold md:text-white/65">
            Hai un codice partita?
          </p>
          <div className="md:w-72">
            <JoinByCode cta="ENTRA" inputId="home-code" compact />
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
