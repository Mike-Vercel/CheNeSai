import { redirect } from "next/navigation";
import { SiteHeader } from "@/features/home/SiteHeader";
import { CreateFlow } from "@/features/giramente/CreateFlow";
import { NuovaIntroGate } from "@/features/giramente/intro/GiramenteIntro";
import { Logo } from "@/features/giramente/ui";
import { getHostUser } from "@/lib/server/gioco-libero";

export const metadata = { title: "Nuova partita" };

/**
 * Creazione della partita: SOLO con un account (chi crea gestisce la partita).
 * Prima l'INTRO (studio, sigla, Don Patrizio che dà il benvenuto: una volta per scheda, `?intro=1|0`), poi le impostazioni.
 */
export default async function NuovaPartita({ searchParams }: { searchParams: Promise<{ modo?: string; avanzate?: string }> }) {
  const sp = await searchParams;
  const host = await getHostUser();
  const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString();
  if (!host) redirect(`/accedi?next=${encodeURIComponent(`/giramente/nuova${q ? `?${q}` : ""}`)}`);
  return (
    <div className="min-h-dvh">
      <SiteHeader user={{ username: host.profile?.username ?? null }} />
      <NuovaIntroGate>
        <main className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-4 pb-20 pt-4">
          <Logo size="md" />
          <CreateFlow username={host.profile?.username ?? null} initialMode={sp.modo === "squadre" ? "teams" : "individual"} initialAdvanced={sp.avanzate === "1"} />
        </main>
      </NuovaIntroGate>
    </div>
  );
}
