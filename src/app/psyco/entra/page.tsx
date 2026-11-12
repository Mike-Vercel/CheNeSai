import { SiteHeader } from "@/features/home/SiteHeader";
import { CodeForm } from "@/features/psyco/JoinFlow";
import { PsycoLogo } from "@/features/psyco/ui";
import { getHostUser } from "@/lib/server/gioco-libero";

export const metadata = { title: "Entra in partita" };

export default async function EntraPsyco() {
  const host = await getHostUser().catch(() => null);
  return (
    <div className="min-h-dvh">
      <SiteHeader user={host ? { username: host.profile?.username ?? null } : null} />
      <main className="mx-auto flex w-full max-w-lg flex-col items-center gap-8 px-4 pb-20 pt-8">
        <PsycoLogo size="lg" />
        <h1 className="psy-display text-center text-4xl">Entra in partita</h1>
        <CodeForm />
        {!host && <p className="max-w-sm text-center text-sm font-bold text-paper/65">Per giocare dal tuo telefono serve un account: dopo l&apos;accesso torni da solo alla stanza.</p>}
      </main>
    </div>
  );
}
