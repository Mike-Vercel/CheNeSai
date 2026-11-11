import type { Viewport } from "next";
import { notFound, redirect } from "next/navigation";
import { PhoneRemote } from "@/features/gioca/PhoneRemote";
import { SiteHeader } from "@/features/home/SiteHeader";
import { getSql } from "@/lib/database/db";
import { getHostUser, loadPublicGamesSettings, openOwnedGame, quotaOf } from "@/lib/server/gioco-libero";
import { setDisplayMode } from "@/lib/server/display-mode";

export const metadata = { title: "Telecomando" };
export const viewport: Viewport = { themeColor: "#000000" };

/** Modalità A: lo show sul televisore, il telefono dell'host fa da telecomando. */
export default async function TelecomandoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=/gioca/telecomando/${id}`);
  const game = await openOwnedGame(host.userId, id);
  if (!game) notFound();
  const quota = quotaOf(host, await loadPublicGamesSettings(getSql()));
  // telefono telecomando: lo show è sul televisore abbinato
  if (game.status !== "finished" && game.status !== "archived") await setDisplayMode(game.id, "tv").catch(() => false);
  return (
    <div className="qz-black min-h-dvh bg-black text-white">
      <SiteHeader user={{ username: host.profile?.username ?? null }} />
      <PhoneRemote sessionId={game.id} displayKey={game.displayKey} canCreateMore={quota.canCreate} host={host.profile?.username ?? null} />
    </div>
  );
}
