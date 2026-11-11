import type { Viewport } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChooseUsername } from "@/features/account/ChooseUsername";
import { NewGameWizard } from "@/features/gioca/NewGameWizard";
import { HostGamesList } from "@/features/gioca/HostGamesList";
import { SiteHeader } from "@/features/home/SiteHeader";
import { getSql } from "@/lib/database/db";
import { getHostUser, listHostGames, loadPublicGamesSettings, quotaOf } from "@/lib/server/gioco-libero";

export const metadata = { title: "Nuova partita" };
export const viewport: Viewport = { themeColor: "#000000" };

export default async function GiocaPage() {
  const host = await getHostUser();
  if (!host) redirect("/accedi?next=/gioca");
  const user = { username: host.profile?.username ?? null };

  if (!host.profile) {
    return (
      <div className="qz-black min-h-dvh bg-black text-white">
        <SiteHeader user={user} />
        <main className="mx-auto w-full max-w-lg px-4 pb-16 pt-6 md:pt-14">
          <ChooseUsername />
        </main>
      </div>
    );
  }

  const sql = getSql();
  const settings = await loadPublicGamesSettings(sql);
  const quota = quotaOf(host, settings);
  const games = await listHostGames(sql, host.userId);
  const closed = !settings.enabled && !host.adminRole;

  return (
    <div className="qz-black min-h-dvh bg-black text-white">
      <SiteHeader user={user} />
      <main className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-20 pt-4 md:px-10 md:pt-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <section aria-labelledby="new-game-title">
          <h1 id="new-game-title" className="font-display text-4xl leading-tight md:text-6xl">
            Nuova partita
          </h1>
          <p className="mt-2 max-w-xl text-lg font-bold text-white/85">
            Scegli quanto dura: le domande le prepara il sito, prima quelle che non hai mai visto. Poi apri la TV e fai entrare i telefoni.
          </p>
          {closed ? (
            <p role="status" className="mt-8 rounded-3xl bg-coal-2 p-6 text-lg font-bold">
              Il gioco libero è chiuso in questo momento. Riprova più tardi.
            </p>
          ) : !quota.canCreate ? (
            <p role="status" className="mt-8 rounded-3xl bg-coal-2 p-6 text-lg font-bold">
              Hai usato tutte le partite del tuo account ({quota.limit}). <Link href="/" className="text-gold underline">Torna alla home</Link>
            </p>
          ) : (
            <NewGameWizard quota={quota} />
          )}
        </section>
        <aside id="le-tue-partite" aria-labelledby="your-games-title" className="lg:pt-24">
          <h2 id="your-games-title" className="font-display text-2xl md:text-3xl">
            Le tue partite
          </h2>
          <HostGamesList games={games} />
        </aside>
      </main>
    </div>
  );
}
