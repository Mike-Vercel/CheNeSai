import type { Viewport } from "next";
import { notFound, redirect } from "next/navigation";
import { ScreenChoice } from "@/features/gioca/ScreenChoice";
import { SiteHeader } from "@/features/home/SiteHeader";
import { getHostUser, openOwnedGame } from "@/lib/server/gioco-libero";

export const metadata = { title: "Dove giochiamo?" };
export const viewport: Viewport = { themeColor: "#000000" };

/** Partita creata dal telefono: sul televisore (telefono telecomando) o tutto su questo telefono. */
export default async function SchermoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=/gioca/schermo/${id}`);
  const game = await openOwnedGame(host.userId, id);
  if (!game) notFound();
  return (
    <div className="qz-black min-h-dvh bg-black text-white">
      <SiteHeader user={{ username: host.profile?.username ?? null }} />
      <main className="mx-auto w-full max-w-lg px-4 pb-16 pt-2 md:pt-10">
        <ScreenChoice sessionId={game.id} code={game.code} />
      </main>
    </div>
  );
}
