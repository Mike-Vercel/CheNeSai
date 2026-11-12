import type { Viewport } from "next";
import { notFound, redirect } from "next/navigation";
import { PhoneShow } from "@/features/gioca/PhoneShow";
import { getSql } from "@/lib/database/db";
import { getHostUser, loadPublicGamesSettings, openOwnedGame, quotaOf } from "@/lib/server/gioco-libero";
import { setDisplayMode } from "@/lib/server/display-mode";

export const metadata = { title: "Partita online" };
export const viewport: Viewport = { themeColor: "#170824", viewportFit: "cover" };

/**
 * Partita ONLINE dal PC (o da qualunque dispositivo): ognuno gioca dal suo dispositivo, anche a
 * distanza, con lo show completo. Sul PC lo show è orizzontale e l'host gioca cliccando le risposte
 * (o con i tasti 1–4); sul telefono è lo stesso show verticale di /gioca/telefono.
 * Chi entra deve avere il suo account (vedi isOnlineSession in lib/server/players.ts).
 */
export default async function OnlinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=/gioca/online/${id}`);
  const game = await openOwnedGame(host.userId, id);
  if (!game) notFound();
  const quota = quotaOf(host, await loadPublicGamesSettings(getSql()));
  if (game.status !== "finished" && game.status !== "archived") await setDisplayMode(game.id, "phone").catch(() => false);
  return <PhoneShow sessionId={game.id} displayKey={game.displayKey} code={game.code} host={host.profile?.username ?? null} canCreateMore={quota.canCreate} />;
}
