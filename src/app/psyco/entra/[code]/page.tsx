import { redirect } from "next/navigation";
import { SiteHeader } from "@/features/home/SiteHeader";
import { JoinRoom } from "@/features/psyco/JoinFlow";
import { PsycoLogo } from "@/features/psyco/ui";
import { normalizeRoomCode } from "@/lib/psyco/logic";
import { getHostUser } from "@/lib/server/gioco-libero";

export const metadata = { title: "Entra in partita" };

/**
 * Link del QR / dell'invito. Dispositivo personale = account obbligatorio: chi non è collegato va al
 * login (o alla registrazione) e poi torna QUI con lo stesso codice (?next=/psyco/entra/CODICE).
 */
export default async function EntraConCodice({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = normalizeRoomCode(decodeURIComponent(raw)).slice(0, 6);
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=${encodeURIComponent(`/psyco/entra/${code}`)}`);
  return (
    <div className="min-h-dvh">
      <SiteHeader user={{ username: host.profile?.username ?? null }} />
      <main className="mx-auto flex w-full max-w-lg flex-col items-center gap-8 px-4 pb-20 pt-8">
        <PsycoLogo size="lg" tagline />
        <JoinRoom code={code} />
      </main>
    </div>
  );
}
