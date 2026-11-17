import { redirect } from "next/navigation";
import { TigShell } from "@/features/tig/shell/TigShell";
import { getHostUser } from "@/lib/server/gioco-libero";
import { listMyEvents } from "@/lib/server/tig/events";

export const metadata = { title: "Crea serata" };

/** CREA SERATA: solo con un account (chi crea è l'organizzatore e gestisce la regia). */
export default async function NuovaSerata() {
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=${encodeURIComponent("/tavoli-in-guerra/nuova")}`);
  const events = await listMyEvents(host.userId).catch(() => []);
  return <TigShell loggedIn username={host.profile?.username ?? null} events={events} start="create" />;
}
