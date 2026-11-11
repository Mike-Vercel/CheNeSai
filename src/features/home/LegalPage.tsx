import Link from "next/link";
import { PLATFORM_NAME } from "./games";
import { LEGAL_UPDATED } from "./site";

/** Impaginazione delle pagine legali: testo leggibile su una colonna, stessi colori del sito. */
export function LegalPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-night text-white">
      <header className="flex h-16 items-center px-4 md:h-20 md:px-10">
        <Link href="/" className="font-display text-2xl text-white md:text-3xl">
          {PLATFORM_NAME}
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 md:pt-12">
        <h1 className="font-display text-4xl leading-tight md:text-6xl">{title}</h1>
        <p className="mt-2 text-sm font-bold text-white/70">Ultimo aggiornamento: {LEGAL_UPDATED}</p>
        <p className="mt-6 text-lg font-semibold leading-relaxed text-white/95">{intro}</p>
        <div className="qz-legal mt-10 space-y-10 text-base leading-relaxed text-white/90 md:text-lg">{children}</div>
        <p className="mt-14 flex flex-wrap gap-x-6 gap-y-2 font-bold">
          <Link href="/" className="text-gold underline underline-offset-4">
            Torna alla home
          </Link>
          <Link href="/privacy" className="text-white/80 underline underline-offset-4 hover:text-white">
            Privacy
          </Link>
          <Link href="/termini" className="text-white/80 underline underline-offset-4 hover:text-white">
            Termini di servizio
          </Link>
        </p>
      </main>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl text-white md:text-3xl">{title}</h2>
      <div className="mt-3 space-y-3 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-1.5">{children}</div>
    </section>
  );
}
