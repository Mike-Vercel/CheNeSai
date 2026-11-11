import { clsx } from "clsx";
import Link from "next/link";
import { PLATFORM_NAME } from "./games";

export interface HeaderUser {
  /** null = account senza username (deve sceglierlo) */
  username: string | null;
}

/**
 * Barra in alto della piattaforma: nome a sinistra, a destra "Hai un codice?" e "Accedi"
 * oppure il menu dell'account (@username → Nuova partita, Le tue partite, Collega un televisore, Esci).
 */
export function SiteHeader({ user, overlay = false, className }: { user: HeaderUser | null; overlay?: boolean; className?: string }) {
  return (
    <header className={clsx("z-30 flex h-16 items-center gap-3 px-4 md:h-20 md:px-10", overlay ? "absolute inset-x-0 top-0" : "relative", className)}>
      {overlay && <div aria-hidden className="qz-fade-top pointer-events-none absolute inset-x-0 top-0 -z-10 h-32" />}
      <Link href="/" className="font-display text-2xl leading-none tracking-tight text-white md:text-3xl">
        {PLATFORM_NAME}
      </Link>
      <nav aria-label="Account" className="ml-auto flex items-center gap-2 md:gap-4">
        <Link href="/entra" className="hidden rounded-full px-3 py-2 text-sm font-extrabold text-white/85 hover:text-white sm:inline-block">
          Hai un codice?
        </Link>
        {user ? <AccountMenu user={user} /> : (
          <Link href="/accedi" prefetch={false} className="rounded-full bg-white px-4 py-2 text-sm font-black text-ink transition hover:bg-gold active:scale-95">
            Accedi
          </Link>
        )}
      </nav>
    </header>
  );
}

function AccountMenu({ user }: { user: HeaderUser }) {
  const label = user.username ? `@${user.username}` : "Il tuo account";
  const initial = (user.username ?? "?").slice(0, 1).toUpperCase();
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 text-sm font-extrabold text-white hover:bg-white/20 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-gold font-display text-lg text-ink">
          {initial}
        </span>
        <span className="max-w-[9rem] truncate">{label}</span>
      </summary>
      <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-2xl bg-coal-3 p-2 shadow-2xl ring-1 ring-white/10">
        {user.username ? (
          <Link href="/gioca" prefetch={false} className="block rounded-xl px-3 py-2.5 text-sm font-bold text-white hover:bg-white/10">
            Nuova partita
          </Link>
        ) : (
          <Link href="/gioca" prefetch={false} className="block rounded-xl px-3 py-2.5 text-sm font-bold text-gold hover:bg-white/10">
            Scegli il tuo username
          </Link>
        )}
        <Link href="/profilo" prefetch={false} className="block rounded-xl px-3 py-2.5 text-sm font-bold text-white hover:bg-white/10">
          Le tue partite
        </Link>
        <Link href="/tv" prefetch={false} className="block rounded-xl px-3 py-2.5 text-sm font-bold text-white hover:bg-white/10">
          Collega un televisore
        </Link>
        <form action="/auth/esci" method="post">
          <button type="submit" className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-white/75 hover:bg-white/10 hover:text-white">
            Esci
          </button>
        </form>
      </div>
    </details>
  );
}
