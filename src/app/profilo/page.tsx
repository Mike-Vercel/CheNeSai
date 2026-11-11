import type { Viewport } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HostGamesList } from "@/features/gioca/HostGamesList";
import { SiteHeader } from "@/features/home/SiteHeader";
import { getHostUser, hostGamesFresh } from "@/lib/server/gioco-libero";

export const metadata = { title: "Il tuo profilo" };
export const viewport: Viewport = { themeColor: "#000000" };

/** Profilo dell'host: chi sei, le tue partite (aperte e concluse) ed esci. */
export default async function ProfiloPage() {
  const host = await getHostUser();
  if (!host) redirect("/accedi?next=/profilo");
  if (!host.profile) redirect("/gioca");
  const games = await hostGamesFresh(host.userId, 30);
  const p = host.profile;
  return (
    <div className="qz-black min-h-dvh bg-black text-white">
      <SiteHeader user={{ username: p.username }} />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-20 pt-4 md:pt-10">
        <section aria-labelledby="profile-title" className="flex items-center gap-4 rounded-[28px] bg-coal-1 p-5 ring-1 ring-white/8 sm:p-7">
          <span aria-hidden className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gold font-display text-3xl text-ink">
            {p.username.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 id="profile-title" className="truncate font-display text-3xl leading-tight md:text-4xl">
              @{p.username}
            </h1>
            {host.email && <p className="truncate text-sm font-bold text-white/65">{host.email}</p>}
            <p className="text-sm font-bold text-white/65">
              {p.gamesCreated} {p.gamesCreated === 1 ? "partita creata" : "partite create"}
            </p>
          </div>
          <form action="/auth/esci" method="post">
            <button type="submit" className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/20">
              Esci
            </button>
          </form>
        </section>

        <section aria-labelledby="games-title">
          <div className="flex items-end justify-between gap-3">
            <h2 id="games-title" className="font-display text-3xl">
              Le tue partite
            </h2>
            <Link href="/gioca" className="rounded-full bg-gold px-4 py-2 text-sm font-black text-ink hover:bg-white">
              + Nuova partita
            </Link>
          </div>
          <HostGamesList games={games} />
          <p className="mt-4 text-sm font-bold text-white/55">Le partite lasciate aperte si chiudono da sole dopo 24 ore senza attività.</p>
        </section>
      </main>
    </div>
  );
}
