import { redirect } from "next/navigation";
import { JoinFlow } from "@/features/tig/join/JoinFlow";
import { getHostUser } from "@/lib/server/gioco-libero";

export const metadata = { title: "Entra al tavolo" };

/** QR del tavolo: account obbligatorio (lo stesso del sito); il token firmato lo verifica il server. */
export default async function QrTavolo({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=${encodeURIComponent(`/taverna-dei-pirati/t/${token}`)}`);
  return <JoinFlow token={decodeURIComponent(token)} username={host.profile?.username ?? null} />;
}
