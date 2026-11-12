import { redirect } from "next/navigation";
import { RoomApp } from "@/features/psyco/RoomApp";
import { getHostUser } from "@/lib/server/gioco-libero";

export const metadata = { title: "Stanza" };

/** La stanza sul proprio dispositivo (account obbligatorio; l'accesso vero è verificato da ogni API). */
export default async function Stanza({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=${encodeURIComponent(`/psyco/stanza/${id}`)}`);
  return <RoomApp roomId={id} />;
}
