import { redirect } from "next/navigation";
import { getHostUser } from "@/lib/server/gioco-libero";
import { getDisplayKey } from "@/lib/server/psyco/rooms";

export const metadata = { title: "Schermo" };

/**
 * «Riprendi» dal PC: apre lo SCHERMO PUBBLICO della stanza (solo per chi la gestisce). Il PC non
 * entra mai nella stanza come giocatore: niente ruolo, niente regola.
 */
export default async function ApriSchermo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=${encodeURIComponent(`/psyco/schermo/apri/${id}`)}`);
  const key = await getDisplayKey({ userId: host.userId, ip: null, username: null }, id).catch(() => null);
  redirect(key ? `/psyco/schermo/${encodeURIComponent(key)}` : "/psyco");
}
