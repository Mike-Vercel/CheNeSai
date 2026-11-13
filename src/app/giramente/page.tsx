import type { Metadata } from "next";
import { GameShell } from "@/features/giramente/shell/GameShell";
import { toShellRoom } from "@/features/giramente/shell/shell-rooms";
import { getHostUser } from "@/lib/server/gioco-libero";
import { listMyRooms } from "@/lib/server/giramente/rooms";

export const metadata: Metadata = {
  title: { absolute: "GIRAMENTE! · La ruota gira. La mente decide." },
  description: "GIRAMENTE! – il game show con la ruota: cinque manche, enigmi di logica, Verde o Rosso, i Jolly di Zafira e il Giro Decisivo. Da soli o a squadre, con un telefono o con tanti.",
};

/** Aprire GIRAMENTE! = entrare nel gioco: lo studio 3D, l'intro (una volta per scheda) e il MENU da videogioco. */
export default async function GiramenteHome() {
  const host = await getHostUser().catch(() => null);
  const rooms = host ? await listMyRooms(host.userId).catch(() => []) : [];
  return <GameShell username={host?.profile?.username ?? null} loggedIn={!!host} rooms={rooms.map(toShellRoom)} start="menu" />;
}
