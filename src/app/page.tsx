import Link from "next/link";
import { Character, Logo } from "@/features/game/components/brand";
import { GameCard, StepCard } from "@/features/home/cards";
import { FEATURED_GAME, PLATFORM_NAME, UPCOMING_GAMES } from "@/features/home/games";
import { SiteHeader } from "@/features/home/SiteHeader";
import { JoinByCode } from "@/features/players/JoinByCode";
import { InstallAppButton } from "@/features/pwa/InstallAppButton";
import { getHostUser } from "@/lib/server/gioco-libero";

export const metadata = {
  title: { absolute: `${PLATFORM_NAME} · CHE NE SAI?! il quiz show da giocare in compagnia` },
  description: "Crea una partita dal PC, collega il televisore e gioca con i telefoni: domande, punteggi e podio li fa il sito.",
};

const STEPS = [
  { who: "professore" as const, title: "Crea la partita", text: "Dal PC scegli quante domande e quanti round. Le domande le prepara il sito, mai le stesse." },
  { who: "regina" as const, title: "Il PC diventa la TV", text: "Collega il PC al televisore con l'HDMI: il quiz si apre a tutto schermo sullo schermo giusto." },
  { who: "palmino" as const, title: "Entrano i telefoni", text: "Gli amici inquadrano il QR code o scrivono il codice. Niente app da scaricare, niente account." },
];

const FACTS = [
  ["10–30", "domande"],
  ["1–5", "round"],
  ["fino a 20", "giocatori"],
] as const;

export default async function Home() {
  const host = await getHostUser().catch(() => null);
  const user = host ? { username: host.profile?.username ?? null } : null;
  const g = FEATURED_GAME;

  return (
    <div className="min-h-dvh bg-night text-white">
      <SiteHeader user={user} overlay />

      {/* ------------------------------------------------ gioco in primo piano */}
      <section aria-labelledby="featured-title" className="px-2 pt-2 md:px-5 md:pt-4">
        <div className="qz-billboard relative isolate flex min-h-[calc(100svh-1rem)] flex-col items-center justify-end md:justify-center overflow-hidden rounded-[22px] px-4 pb-8 pt-24 md:min-h-[88svh] md:rounded-[32px] md:px-10 md:pb-12 md:pt-20">
          <div aria-hidden className="qz-stage absolute inset-0 -z-20" />
          <div aria-hidden className="qz-rays absolute -inset-1/2 -z-10 animate-spin-slow opacity-40 motion-reduce:animate-none" />

          {/* presentatori ai lati (desktop) */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden md:block">
            <Character who="professore" priority className="qz-presenter absolute bottom-[-6%] left-[-12%] !h-[62%] w-auto max-w-none lg:left-[-7%] xl:left-[-2%]" />
            <Character who="regina" priority flip className="qz-presenter qz-presenter-later absolute bottom-[-6%] right-[-12%] !h-[60%] w-auto max-w-none lg:right-[-7%] xl:right-[-2%]" />
          </div>
          <div aria-hidden className="qz-scrim absolute inset-x-0 bottom-0 -z-10 h-[38%]" />

          <div className="relative flex w-full max-w-[44rem] flex-col items-center text-center">
            <h1 id="featured-title" className="w-full">
              <span className="sr-only">CHE NE SAI?!</span>
              <Logo variant="mark" size="xl" priority className="qz-hero-logo mx-auto hidden !h-auto !w-[min(38rem,72vw,46svh)] md:block" />
              <Logo variant="full" size="xl" priority className="qz-hero-logo mx-auto !h-auto w-[min(26rem,92vw)] md:hidden" />
            </h1>
            <p className="qz-rise mt-3 max-w-[34rem] text-lg font-extrabold leading-snug text-white md:mt-5 md:text-2xl">{g.tagline}</p>
            <ul aria-label="In breve" className="qz-rise mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-sm font-bold text-white/80 md:text-base">
              {g.meta.map((m, i) => (
                <li key={m} className="flex items-center gap-3">
                  {i > 0 && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />}
                  {m}
                </li>
              ))}
            </ul>

            <div className="qz-rise mt-7 flex w-full flex-col items-center gap-5 md:mt-9 md:flex-row md:items-end md:justify-center md:gap-8">
              {/* telefono: prima si entra con il codice */}
              <div className="order-2 w-full max-w-sm md:order-1 md:w-auto md:max-w-none">
                <Link
                  href="/gioca" prefetch={false}
                  className="qz-play inline-flex h-16 w-full items-center justify-center gap-3 rounded-full bg-gold px-12 font-display text-3xl text-ink transition hover:bg-white active:scale-[0.97] md:h-20 md:w-auto md:px-20 md:text-4xl"
                >
                  <span aria-hidden className="text-2xl md:text-3xl">▶</span> GIOCA
                </Link>
                <p className="mt-2 text-sm font-bold text-white/75 md:hidden">Per ospitare una partita usa il PC collegato al TV.</p>
              </div>
              <div className="order-1 w-full max-w-sm md:order-2 md:w-80 md:text-left">
                <p id="join-label" className="mb-2 text-base font-extrabold text-white md:text-sm md:font-bold md:text-white/80">
                  Hai un codice partita?
                </p>
                <JoinByCode cta="ENTRA" inputId="home-code" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ righe stile catalogo */}
      <section aria-labelledby="row-games" className="mt-14 px-4 md:mt-24 md:px-10">
        <h2 id="row-games" className="font-display text-3xl md:text-4xl">
          I nostri giochi
        </h2>
        <div className="mt-5 grid items-center gap-6 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:gap-10">
          <GameCard game={g} fluid />
          <div>
            <h3 className="font-display text-3xl leading-tight md:text-5xl">{g.title}</h3>
            <p className="mt-3 max-w-xl text-lg font-bold leading-snug text-white/90">
              Tre presentatori con la voce, la ruota delle categorie, gli imprevisti di Palmino e la finale a punti doppi. Tu scegli quante domande e quanti round: il resto va da solo.
            </p>
            <dl className="mt-5 grid max-w-md grid-cols-3 gap-3">
              {FACTS.map(([v, l]) => (
                <div key={l} className="rounded-2xl bg-night-2 px-3 py-3">
                  <dt className="sr-only">{l}</dt>
                  <dd className="font-display text-2xl leading-none text-gold md:text-3xl">{v}</dd>
                  <dd className="mt-1 text-sm font-bold text-white/80">{l}</dd>
                </div>
              ))}
            </dl>
            <Link href="/gioca" prefetch={false} className="qz-play mt-6 inline-flex h-14 items-center gap-2 rounded-full bg-gold px-8 font-display text-2xl text-ink transition hover:bg-white">
              <span aria-hidden>▶</span> Crea una partita
            </Link>
          </div>
        </div>
      </section>

      <section id="come-si-gioca" aria-labelledby="row-how" className="mt-20 md:mt-32">
        <div className="px-4 md:px-10">
          <h2 id="row-how" className="font-display text-3xl md:text-4xl">
            Come si gioca
          </h2>
          <p className="mt-1 max-w-2xl text-lg font-bold text-white/85">Serve un PC (meglio se collegato al TV) e un telefono a testa.</p>
        </div>
        <ul className="qz-row mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:grid md:grid-cols-2 md:gap-5 md:overflow-visible md:px-10 xl:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.title} className="snap-start">
              <StepCard who={s.who} title={s.title} text={s.text} />
            </li>
          ))}
          <li className="snap-start">
            <StepCard who={null} title="Il sito fa il resto" text="Domande, voci dei presentatori, punteggi e podio scorrono da soli. Tu giochi insieme agli altri." />
          </li>
        </ul>
      </section>

      <section aria-labelledby="row-soon" className="mt-16 md:mt-28">
        <h2 id="row-soon" className="px-4 font-display text-3xl md:px-10 md:text-4xl">
          In arrivo
        </h2>
        <ul className="qz-row mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-10">
          {UPCOMING_GAMES.map((game) => (
            <li key={game.id} className="snap-start">
              <GameCard game={game} />
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-20 bg-night-2 px-4 pb-10 pt-12 md:mt-28 md:px-10">
        <p className="font-display text-5xl leading-none text-white/90 md:text-8xl">{PLATFORM_NAME}</p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-bold text-white/80">
          <Link href="/classifica" className="hover:text-white hover:underline">
            Classifica del mese
          </Link>
          <Link href="/entra" className="hover:text-white hover:underline">
            Entra con un codice
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
