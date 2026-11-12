import { redirect } from "next/navigation";
import { SharedApp } from "@/features/psyco/SharedApp";
import { getHostUser } from "@/lib/server/gioco-libero";

export const metadata = { title: "Un solo dispositivo" };

/** Partita su un solo dispositivo: basta l'account di chi l'ha creata (gli altri sono nickname). */
export default async function UnDispositivo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=${encodeURIComponent(`/psyco/un-dispositivo/${id}`)}`);
  return <SharedApp roomId={id} />;
}
