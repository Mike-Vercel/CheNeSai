import { redirect } from "next/navigation";
import { RegiaApp } from "@/features/tig/regia/RegiaApp";
import { getHostUser } from "@/lib/server/gioco-libero";

export const metadata = { title: "Regia" };

/** Regia della serata: solo l'organizzatore (account che l'ha creata); lo verifica ogni API. */
export default async function Regia({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=${encodeURIComponent(`/taverna-dei-pirati/regia/${eventId}`)}`);
  return <RegiaApp eventId={eventId} />;
}
