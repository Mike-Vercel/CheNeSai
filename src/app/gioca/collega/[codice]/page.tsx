import type { Viewport } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { statusLabel } from "@/features/gioca/HostGamesList";
import { PairFromQr } from "@/features/gioca/PairFromQr";
import { SiteHeader } from "@/features/home/SiteHeader";
import { getHostUser, hostGamesFresh, isOpenGame } from "@/lib/server/gioco-libero";

export const metadata = { title: "Collega il televisore" };
export const viewport: Viewport = { themeColor: "#000000" };

/** Aperta dal QR del televisore (/tv): quale partita mostro su quel TV? */
export default async function CollegaPage({ params }: { params: Promise<{ codice: string }> }) {
  const { codice } = await params;
  const code = /^[0-9]{4}$/.test(codice) ? codice : null;
  const host = await getHostUser();
  if (!host) redirect(`/accedi?next=/gioca/collega/${encodeURIComponent(codice)}`);
  if (!host.profile) redirect("/gioca");
  const open = (await hostGamesFresh(host.userId, 10)).filter(isOpenGame);
  return (
    <div className="qz-black min-h-dvh bg-black text-white">
      <SiteHeader user={{ username: host.profile.username }} />
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-16 pt-2 md:pt-10">
        <header className="text-center">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-white/55">Televisore {code ?? ""}</p>
          <h1 className="mt-2 font-display text-4xl leading-none">Cosa mostro sul TV?</h1>
        </header>
        {!code ? (
          <p className="rounded-2xl bg-flame/20 p-4 text-center font-bold">Codice non valido: inquadra di nuovo il QR sul televisore.</p>
        ) : open.length === 0 ? (
          <div className="flex flex-col gap-3 rounded-[28px] bg-coal-1 p-5 text-center ring-1 ring-white/8">
            <p className="font-bold text-white/85">Non hai partite aperte. Creane una, scegli «Sul televisore» e scrivi il codice {code}.</p>
            <Link href="/gioca" className="rounded-full bg-gold px-6 py-3 font-display text-2xl text-ink">
              Nuova partita
            </Link>
          </div>
        ) : (
          <PairFromQr code={code} games={open.map((g) => ({ id: g.id, code: g.code, players: g.players, label: statusLabel(g) }))} />
        )}
      </main>
    </div>
  );
}
