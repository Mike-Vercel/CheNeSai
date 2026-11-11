import type { Viewport } from "next";
import { notFound, redirect } from "next/navigation";
import { HostConsole } from "@/features/gioca/HostConsole";
import { SiteHeader } from "@/features/home/SiteHeader";
import { getSql } from "@/lib/database/db";
import { getHostUser, getOwnedGame, loadPublicGamesSettings, quotaOf } from "@/lib/server/gioco-libero";

export const metadata = { title: "La tua partita" };
export const viewport: Viewport = { themeColor: "#000000" };

export default async function PartitaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=/gioca/partita/${id}`);
  const sql = getSql();
  const game = await getOwnedGame(sql, host.userId, id);
  if (!game) notFound();
  const quota = quotaOf(host, await loadPublicGamesSettings(sql));
  return (
    <div className="qz-black min-h-dvh bg-black text-white">
      <SiteHeader user={{ username: host.profile?.username ?? null }} />
      <HostConsole sessionId={game.id} displayKey={game.displayKey} canCreateMore={quota.canCreate} />
    </div>
  );
}
