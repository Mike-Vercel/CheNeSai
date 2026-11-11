import { notFound, redirect } from "next/navigation";
import { HostTv } from "@/features/gioca/HostTv";
import { getSql } from "@/lib/database/db";
import { getHostUser, loadPublicGamesSettings, openOwnedGame, quotaOf } from "@/lib/server/gioco-libero";

export const metadata = { title: "Schermo TV" };

/** TV della partita libera: solo il proprietario la apre (la chiave dello schermo resta sul server). */
export default async function HostTvPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=/gioca/tv/${id}`);
  const sql = getSql();
  const game = await openOwnedGame(host.userId, id);
  if (!game) notFound();
  const quota = quotaOf(host, await loadPublicGamesSettings(sql));
  return <HostTv sessionId={game.id} displayKey={game.displayKey} canCreateMore={quota.canCreate} />;
}
