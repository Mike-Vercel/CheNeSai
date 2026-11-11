import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HostConsole } from "@/features/gioca/HostConsole";
import { SiteHeader } from "@/features/home/SiteHeader";
import { getSql } from "@/lib/database/db";
import { getHostUser, getOwnedGame, loadPublicGamesSettings, quotaOf } from "@/lib/server/gioco-libero";

export const metadata = { title: "La tua partita" };

export default async function PartitaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=/gioca/partita/${id}`);
  const sql = getSql();
  const game = await getOwnedGame(sql, host.userId, id);
  if (!game) notFound();
  const quota = quotaOf(host, await loadPublicGamesSettings(sql));
  return (
    <div className="min-h-dvh bg-night text-white">
      <SiteHeader user={{ username: host.profile?.username ?? null }} />
      <div className="mx-auto w-full max-w-6xl px-4 md:px-10">
        <Link href="/gioca#le-tue-partite" className="text-sm font-bold text-white/75 hover:text-white">
          ← Le tue partite
        </Link>
      </div>
      <HostConsole sessionId={game.id} displayKey={game.displayKey} canCreateMore={quota.canCreate} />
    </div>
  );
}
