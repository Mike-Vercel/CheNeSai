import { redirect } from "next/navigation";
import { GameApp } from "@/features/giramente/GameApp";
import { getHostUser } from "@/lib/server/gioco-libero";

export const metadata = { title: "Un solo telefono" };

/** La partita sul telefono che passa di mano (account obbligatorio; l'accesso vero è verificato da ogni API). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=${encodeURIComponent(`/giramente/un-dispositivo/${id}`)}`);
  return <GameApp roomId={id} />;
}
