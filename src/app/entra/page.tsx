import Link from "next/link";
import { Logo } from "@/features/game/components/brand";
import { JoinByCode } from "@/features/players/JoinByCode";

export const metadata = { title: "Entra in partita" };

/** Ingresso dei giocatori dal telefono: codice partita (il QR del TV porta direttamente a /play/CODICE). */
export default function EntraPage() {
  return (
    <main className="qz-stage relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden className="qz-rays pointer-events-none absolute -inset-1/2 animate-spin-slow opacity-40 motion-reduce:animate-none" />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-6 text-center">
        <Logo variant="full" size="xl" priority className="!h-auto w-full max-w-sm" />
        <h1 className="font-display text-3xl text-white">Entra in partita</h1>
        <p className="-mt-3 text-lg font-bold text-white/90">Scrivi il codice che vedi sul TV, oppure inquadra il QR code con la fotocamera.</p>
        <JoinByCode cta="ENTRA" inputId="entra-code" autoFocus />
        <Link href="/" className="font-bold text-white/80 underline underline-offset-4 hover:text-white">
          Torna alla home
        </Link>
      </div>
    </main>
  );
}
