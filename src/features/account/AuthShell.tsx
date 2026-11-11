import Link from "next/link";
import { Character, Logo } from "@/features/game/components/brand";
import { PLATFORM_NAME } from "@/features/home/games";

const GLOW_BLUE = { "--qz-glow": "rgba(8, 124, 255, 0.38)" } as React.CSSProperties;
const GLOW_PINK = { "--qz-glow": "rgba(255, 20, 147, 0.36)" } as React.CSSProperties;

/**
 * Impaginazione delle pagine account: sala buia come la home, i presentatori ai lati sullo sfondo
 * e il modulo in una scheda al centro (sul telefono il modulo sta direttamente sul nero).
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="qz-black relative isolate min-h-dvh bg-black text-white">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="qz-spotlight absolute inset-0" />
        <div className="absolute inset-0 hidden brightness-[.8] lg:block">
          <div className="qz-presenter absolute bottom-0 right-[calc(50%+16rem)] h-[74%]">
            <div className="qz-floor-glow absolute inset-x-[-25%] bottom-0 h-3/5" style={GLOW_BLUE} />
            <Character who="professore" priority className="relative !h-full w-auto max-w-none translate-y-[6%]" />
          </div>
          <div className="qz-presenter qz-presenter-later absolute bottom-0 left-[calc(50%+16rem)] h-[72%]">
            <div className="qz-floor-glow absolute inset-x-[-25%] bottom-0 h-3/5" style={GLOW_PINK} />
            <Character who="regina" priority flip className="relative !h-full w-auto max-w-none translate-y-[6%]" />
          </div>
        </div>
        <div className="qz-vignette absolute inset-0" />
      </div>

      <header className="qz-safe-header flex h-16 items-center justify-between gap-4 px-4 md:h-20 md:px-10">
        <Link href="/" className="font-display text-2xl leading-none tracking-tight text-white md:text-3xl">
          {PLATFORM_NAME}
        </Link>
        <Link href="/" className="group inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-extrabold text-white/75 transition hover:text-white">
          <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 transition group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.5 4.5 7 10l5.5 5.5" />
          </svg>
          Torna alla home
        </Link>
      </header>

      <main className="flex flex-col items-center px-4 pb-12 md:pb-16">
        <Logo variant="mark" size="lg" priority className="qz-hero-logo hidden !h-auto !w-[min(10rem,14svh)] lg:block" />
        <Logo variant="full" size="lg" priority className="qz-hero-logo !h-auto w-[min(15rem,62vw)] lg:hidden" />
        <div className="qz-card-in mt-4 w-full max-w-[28rem] sm:rounded-[28px] sm:bg-coal-1/92 sm:p-7 sm:shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95)] sm:ring-1 sm:ring-white/10 lg:mt-5">
          {children}
        </div>
      </main>
    </div>
  );
}
