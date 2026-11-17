import { redirect } from "next/navigation";
import { PlayerApp } from "@/features/tig/player/PlayerApp";
import { getHostUser } from "@/lib/server/gioco-libero";

export const metadata = { title: "Al tavolo" };

/** Telefono o PC del giocatore (account obbligatorio; l'appartenenza alla squadra la verifica ogni API). */
export default async function GiocaTig({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=${encodeURIComponent(`/taverna-dei-pirati/gioca/${eventId}`)}`);
  return <PlayerApp eventId={eventId} />;
}
