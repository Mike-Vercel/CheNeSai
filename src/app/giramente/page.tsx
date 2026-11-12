import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/features/home/SiteHeader";
import { Logo } from "@/features/giramente/ui";
import { getHostUser } from "@/lib/server/gioco-libero";
import { listMyRooms } from "@/lib/server/giramente/rooms";

export const metadata = { title: { absolute: "GIRAMENTE! · La ruota gira. La mente decide." } };

const PHASE_LABEL: Record<string, string> = { LOBBY: "in sala partita", ROUND_RESULTS: "classifica" };

/** Home del gioco (mockup approvato): NUOVA PARTITA, MODALITÀ DI GIOCO, IMPOSTAZIONI, REGOLAMENTO (+ «Riprendi»). */
export default async function GiramenteHome() {
  const host = await getHostUser().catch(() => null);
  const user = host ? { username: host.profile?.username ?? null } : null;
  const rooms = host ? await listMyRooms(host.userId).catch(() => []) : [];
  const guard = (path: string) => (host ? path : `/accedi?next=${encodeURIComponent(path)}`);
  return (
    <div className="min-h-dvh">
      <SiteHeader user={user} overlay />
      {/* PC: la copertina ufficiale a tutta larghezza, che sfuma nel nero verso il menu */}
      <div aria-hidden className="relative hidden aspect-[1672/941] max-h-[82svh] w-full overflow-hidden lg:block">
        <Image src="/games/giramente-copertina-desktop.webp" alt="" fill preload sizes="100vw" className="object-cover object-center" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[14%] bg-gradient-to-t from-[#080b0d] to-transparent" />
      </div>
      <main className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-7 px-4 pb-16 pt-[calc(5.5rem+env(safe-area-inset-top))] text-center lg:-mt-4 lg:pt-0">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-24 -z-10 h-72 w-[46rem] max-w-[120vw] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(57,255,20,.18),transparent_65%)] lg:hidden" />
        <h1 className="sr-only">GIRAMENTE!</h1>
        {/* telefono e tablet: la copertina verticale (ha già il logo e lo slogan) */}
        <div className="relative w-[min(82vw,22rem,calc(56svh*0.6667))] overflow-hidden rounded-3xl shadow-[0_30px_80px_-30px_rgba(57,255,20,0.45)] ring-1 ring-white/10 lg:hidden">
          <Image src="/games/giramente-copertina.webp" alt="Copertina di GIRAMENTE!" width={1024} height={1536} preload sizes="(min-width: 768px) 22rem, 82vw" className="h-auto w-full" />
        </div>
        <span className="sr-only">
          <Logo size="xl" tagline />
        </span>
        <p className="max-w-xl text-base font-bold text-white/85 md:text-lg">
          Il game show con la ruota: cinque manche, enigmi di logica, Verde o Rosso, i Jolly di Zafira e il Giro Decisivo. La fortuna sceglie la sfida, la tua mente decide come finisce.
        </p>
        <nav aria-label="Menu di GIRAMENTE!" className="flex w-full max-w-md flex-col items-stretch gap-3">
          <Link href={guard("/giramente/nuova")} prefetch={false} className="gm-btn h-16 text-3xl">
            ▶ NUOVA PARTITA
          </Link>
          <Link href={guard("/giramente/nuova?modo=squadre")} prefetch={false} className="gm-btn gm-btn-ghost">
            👥 MODALITÀ DI GIOCO
          </Link>
          <Link href={guard("/giramente/nuova?avanzate=1")} prefetch={false} className="gm-btn gm-btn-ghost">
            ⚙ IMPOSTAZIONI
          </Link>
          <Link href="/giramente/regolamento" prefetch={false} className="gm-btn gm-btn-ghost">
            📖 REGOLAMENTO
          </Link>
          <Link href="/giramente/entra" prefetch={false} className="gm-btn gm-btn-red">
            ENTRA CON UN CODICE
          </Link>
        </nav>
        <p className="max-w-md text-sm font-bold text-white/60">Un telefono per tutti? Basta il tuo account. Ognuno col suo telefono (o PC)? Ognuno entra col proprio account. Per il televisore c&apos;è lo schermo TV.</p>
        {rooms.length > 0 && (
          <section className="gm-panel w-full max-w-md rounded-3xl p-4 text-left" aria-labelledby="riprendi">
            <h2 id="riprendi" className="gm-display text-2xl">
              Riprendi
            </h2>
            <ul className="mt-2 flex flex-col gap-2">
              {rooms.map((r) => (
                <li key={r.roomId}>
                  <Link href={r.devices === "shared" ? `/giramente/un-dispositivo/${r.roomId}` : `/giramente/stanza/${r.roomId}`} prefetch={false} className="flex items-center justify-between gap-3 rounded-2xl bg-white/6 px-4 py-3 font-bold hover:bg-white/12">
                    <span>
                      <span className="font-mono tracking-widest">{r.code}</span> · {r.devices === "shared" ? "un solo telefono" : `${r.players} concorrenti`}
                    </span>
                    <span className="text-sm text-white/70">{r.roundNo > 0 ? `manche ${r.roundNo}` : (PHASE_LABEL[r.phase] ?? "")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
