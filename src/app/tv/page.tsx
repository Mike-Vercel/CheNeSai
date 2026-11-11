import type { Viewport } from "next";
import { TvPairing } from "@/features/gioca/TvPairing";

export const metadata = { title: "Televisore", description: "Collega questo televisore alla partita di CHE NE SAI?! con un codice di 4 cifre" };
export const viewport: Viewport = { themeColor: "#170824" };

/**
 * /tv – il televisore come schermo della partita avviata dal telefono (indirizzo corto, facile da
 * scrivere col telecomando). Nessun account: un codice di 4 cifre da scrivere sul telefono dell'host.
 * ?p=…&t=… : abbinamento già fatto (pulsante «Trasmetti» del telefono).
 */
export default async function TvPage({ searchParams }: { searchParams: Promise<{ p?: string; t?: string; nuovo?: string }> }) {
  const sp = await searchParams;
  const direct = sp.p && sp.t && /^[0-9a-f-]{36}$/i.test(sp.p) ? { pairingId: sp.p, token: sp.t } : null;
  return <TvPairing direct={direct} reset={sp.nuovo === "1"} />;
}
