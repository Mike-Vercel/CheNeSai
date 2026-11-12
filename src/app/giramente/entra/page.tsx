import { SiteHeader } from "@/features/home/SiteHeader";
import { JoinRoom } from "@/features/giramente/JoinFlow";
import { Logo } from "@/features/giramente/ui";
import { getHostUser } from "@/lib/server/gioco-libero";
import { redirect } from "next/navigation";

export const metadata = { title: "Entra in partita" };

/** Ingresso con il codice: account obbligatorio (lo stesso del sito, dal telefono o dal PC). */
export default async function Entra() {
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=${encodeURIComponent("/giramente/entra")}`);
  return (
    <div className="min-h-dvh">
      <SiteHeader user={{ username: host.profile?.username ?? null }} />
      <main className="mx-auto flex w-full max-w-lg flex-col items-center gap-8 px-4 pb-20 pt-8">
        <Logo size="lg" tagline />
        <JoinRoom />
      </main>
    </div>
  );
}
