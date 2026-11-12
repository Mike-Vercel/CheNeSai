import { redirect } from "next/navigation";
import { SiteHeader } from "@/features/home/SiteHeader";
import { CreateForm } from "@/features/psyco/CreateForm";
import { PsycoLogo } from "@/features/psyco/ui";
import { getHostUser } from "@/lib/server/gioco-libero";

export const metadata = { title: "Nuova partita" };

/** Creazione della partita: SOLO con un account (chi crea è proprietario e gestore della stanza). */
export default async function NuovaPartita({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  const sp = await searchParams;
  const modo = sp.modo === "condiviso" ? "condiviso" : "personale";
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=${encodeURIComponent(`/psyco/nuova?modo=${modo}`)}`);
  return (
    <div className="min-h-dvh">
      <SiteHeader user={{ username: host.profile?.username ?? null }} />
      <main className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 pb-20 pt-4">
        <PsycoLogo size="md" />
        <h1 className="psy-display text-center text-4xl">Nuova partita</h1>
        <CreateForm initialMode={modo === "condiviso" ? "shared" : "personal"} username={host.profile?.username ?? null} />
      </main>
    </div>
  );
}
