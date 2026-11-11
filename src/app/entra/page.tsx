import type { Viewport } from "next";
import Link from "next/link";
import { Logo } from "@/features/game/components/brand";
import { JoinByCode } from "@/features/players/JoinByCode";

export const metadata = { title: "Entra in partita" };
export const viewport: Viewport = { themeColor: "#000000" };

/** Ingresso dei giocatori dal telefono: codice partita (il QR del TV porta direttamente a /play/CODICE). */
export default function EntraPage() {
  return (
    <main className="qz-black relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-black px-4 py-10">
      <div aria-hidden className="qz-spotlight qz-breathe pointer-events-none absolute inset-0 -z-10 motion-reduce:animate-none" />
      <div aria-hidden className="qz-vignette pointer-events-none absolute inset-0 -z-10" />
      <div className="relative flex w-full max-w-md flex-col items-center gap-6 text-center">
        <Logo variant="full" size="xl" priority className="qz-hero-logo !h-auto w-full max-w-sm" />
        <div className="qz-rise">
          <h1 className="font-display text-4xl text-white">Entra in partita</h1>
          <p className="mt-2 text-lg font-bold text-white/80">Scrivi il codice che vedi sul TV, oppure inquadra il QR code con la fotocamera.</p>
        </div>
        <div className="qz-rise w-full">
          <JoinByCode cta="ENTRA" inputId="entra-code" autoFocus />
        </div>
        <Link href="/" className="font-bold text-white/70 underline underline-offset-4 transition hover:text-white">
          Torna alla home
        </Link>
      </div>
    </main>
  );
}
