import { redirect } from "next/navigation";
import { JoinFlow } from "@/features/tig/join/JoinFlow";
import { getHostUser } from "@/lib/server/gioco-libero";

export const metadata = { title: "Entra con un codice" };

/** Ingresso con il codice squadra (locali senza tavoli numerati o QR che non si legge): account obbligatorio. */
export default async function EntraConCodice() {
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=${encodeURIComponent("/taverna-dei-pirati/entra")}`);
  return <JoinFlow username={host.profile?.username ?? null} />;
}
