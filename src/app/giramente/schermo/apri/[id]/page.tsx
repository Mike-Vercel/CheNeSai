import { redirect } from "next/navigation";
import { getHostUser } from "@/lib/server/gioco-libero";
import { getDisplayKey } from "@/lib/server/giramente/rooms";

export const metadata = { title: "Schermo" };

/** Apre lo SCHERMO TV della partita (solo per chi la gestisce). */
export default async function ApriSchermo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ live?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=${encodeURIComponent(`/giramente/schermo/apri/${id}`)}`);
  const key = await getDisplayKey({ userId: host.userId, ip: null, username: null }, id).catch(() => null);
  redirect(key ? `/giramente/schermo/${encodeURIComponent(key)}${sp.live === "1" ? "?live=1" : ""}` : "/giramente");
}
