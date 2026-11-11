import Link from "next/link";
import { Character, Logo } from "@/features/game/components/brand";
import { PLATFORM_NAME } from "@/features/home/games";

/** Impaginazione delle pagine account: palco con i presentatori a sinistra, modulo a destra. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-night text-white md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(26rem,0.9fr)]">
      <aside aria-hidden className="relative hidden overflow-hidden md:block">
        <div className="qz-stage absolute inset-0" />
        <div className="qz-rays absolute -inset-1/2 animate-spin-slow opacity-40 motion-reduce:animate-none" />
        <Logo variant="mark" size="xl" priority className="absolute left-1/2 top-[6%] !h-auto !w-[min(26rem,52%,42vh)] -translate-x-1/2" />
        <Character who="professore" priority className="absolute bottom-[-6%] left-[-4%] !h-[50%] w-auto max-w-none" />
        <Character who="regina" priority flip className="absolute bottom-[-6%] right-[-4%] !h-[48%] w-auto max-w-none" />
        <Character who="palmino" priority className="absolute bottom-[-4%] left-1/2 !h-[33%] w-auto max-w-none -translate-x-1/2" />
      </aside>
      <main className="flex min-h-dvh flex-col px-4 py-6 md:px-12">
        <Link href="/" className="font-display text-2xl text-white">
          {PLATFORM_NAME}
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
          <Logo variant="full" size="lg" priority className="mx-auto mb-4 !h-auto w-56 md:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
