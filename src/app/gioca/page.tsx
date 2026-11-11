import type { Viewport } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChooseUsername } from "@/features/account/ChooseUsername";
import { NewGameWizard } from "@/features/gioca/NewGameWizard";
import { statusLabel } from "@/features/gioca/HostGamesList";
import { OpenGameCard } from "@/features/gioca/OpenGameCard";
import { SiteHeader } from "@/features/home/SiteHeader";
import { getSql } from "@/lib/database/db";
import { getHostUser, hostGamesFresh, isOpenGame, loadPublicGamesSettings, quotaOf } from "@/lib/server/gioco-libero";

export const metadata = { title: "Nuova partita" };
export const viewport: Viewport = { themeColor: "#000000" };

/**
 * Nuova partita: SOLO la preparazione (domande, round, difficoltà, schermo), in una colonna centrata.
 * Sopra, una scheda compatta se c'è una partita ancora aperta; lo storico sta nel profilo.
 */
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

  const settings = await loadPublicGamesSettings(getSql());
  const quota = quotaOf(host, settings);
  // partite abbandonate da 24 ore chiuse prima di guardare (vedi auto-close.ts)
  const open = (await hostGamesFresh(host.userId, 10)).filter(isOpenGame);
  const closed = !settings.enabled && !host.adminRole;

  return (
    <div className="qz-black min-h-dvh bg-black text-white">
      <SiteHeader user={user} />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-20 pt-4 md:pt-10">
        <header className="text-center">
          <h1 className="font-display text-5xl leading-none md:text-6xl">Nuova partita</h1>
          <p className="mx-auto mt-3 max-w-md text-base font-bold text-white/75 md:text-lg">Scegli quanto dura: le domande le prepara il sito, prima quelle che non hai mai visto.</p>
        </header>
        {open[0] && <OpenGameCard game={{ id: open[0].id, code: open[0].code, players: open[0].players, label: statusLabel(open[0]).toLowerCase() }} others={open.length - 1} />}
        {closed ? (
          <p role="status" className="rounded-3xl bg-coal-2 p-6 text-center text-lg font-bold">
            Il gioco libero è chiuso in questo momento. Riprova più tardi.
          </p>
        ) : !quota.canCreate ? (
          <p role="status" className="rounded-3xl bg-coal-2 p-6 text-center text-lg font-bold">
            Hai usato tutte le partite del tuo account ({quota.limit}).{" "}
            <Link href="/" className="text-gold underline">
              Torna alla home
            </Link>
          </p>
        ) : (
          <NewGameWizard quota={quota} />
        )}
        <p className="text-center text-sm font-bold text-white/55">
          Le partite giocate sono nel tuo{" "}
          <Link href="/profilo" className="text-white/80 underline-offset-4 hover:text-white hover:underline">
            profilo
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
