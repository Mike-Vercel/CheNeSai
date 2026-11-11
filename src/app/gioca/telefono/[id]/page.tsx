import type { Viewport } from "next";
import { notFound, redirect } from "next/navigation";
import { PhoneShow } from "@/features/gioca/PhoneShow";
import { getSql } from "@/lib/database/db";
import { getHostUser, loadPublicGamesSettings, openOwnedGame, quotaOf } from "@/lib/server/gioco-libero";
import { setDisplayMode } from "@/lib/server/display-mode";

export const metadata = { title: "Show sul telefono" };
export const viewport: Viewport = { themeColor: "#170824", viewportFit: "cover" };

/** Modalità B: tutto lo show su questo telefono, in verticale, e l'host gioca dallo stesso schermo. */
export default async function TelefonoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=/gioca/telefono/${id}`);
  const game = await openOwnedGame(host.userId, id);
  if (!game) notFound();
  const quota = quotaOf(host, await loadPublicGamesSettings(getSql()));
  // show sul telefono: anche gli amici vedono e sentono lo show sul loro telefono (non "Guarda il TV")
  if (game.status !== "finished" && game.status !== "archived") await setDisplayMode(game.id, "phone").catch(() => false);
  return <PhoneShow sessionId={game.id} displayKey={game.displayKey} code={game.code} host={host.profile?.username ?? null} canCreateMore={quota.canCreate} />;
}
