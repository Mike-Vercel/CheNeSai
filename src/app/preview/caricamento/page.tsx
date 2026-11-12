import type { Metadata } from "next";
import { LoadingSplash, type SplashGame } from "@/features/game/components/LoadingSplash";

export const metadata: Metadata = { title: "Anteprima · caricamento", robots: { index: false, follow: false } };

/** /preview/caricamento?game=che-ne-sai|psyco — la schermata di caricamento di ogni gioco. */
export default async function CaricamentoPreview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const game: SplashGame = sp.game === "psyco" ? "psyco" : "che-ne-sai";
  return <LoadingSplash game={game} />;
}
