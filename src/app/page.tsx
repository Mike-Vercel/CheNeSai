import Link from "next/link";
import { Logo } from "@/features/game/components/brand";
import { JoinByCode } from "@/features/players/JoinByCode";

export default function Home() {
  return (
    <main className="qz-stage qz-safe relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden className="qz-rays pointer-events-none absolute -inset-1/2 animate-spin-slow opacity-50" />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-6 text-center">
        <Logo variant="full" size="xl" priority className="!h-auto w-full max-w-md animate-float" />
        <p className="text-lg font-bold text-white/90">Il game show del venerdì sera. Inquadra il QR sul TV oppure inserisci il codice partita.</p>
        <JoinByCode />
        <Link href="/classifica" className="font-bold text-gold underline">
          Classifica del mese
        </Link>
      </div>
    </main>
  );
}
