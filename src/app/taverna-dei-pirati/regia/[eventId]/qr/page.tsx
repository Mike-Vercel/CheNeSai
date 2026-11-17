import { redirect } from "next/navigation";
import { QrSheet } from "@/features/tig/regia/QrSheet";
import { getHostUser } from "@/lib/server/gioco-libero";

export const metadata = { title: "QR dei tavoli" };

/** Foglio dei QR da stampare: solo l'organizzatore. */
export default async function QrTavoli({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=${encodeURIComponent(`/taverna-dei-pirati/regia/${eventId}/qr`)}`);
  return <QrSheet eventId={eventId} />;
}
