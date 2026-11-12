import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/features/home/SiteHeader";
import { PsycoLogo } from "@/features/psyco/ui";
import { getHostUser } from "@/lib/server/gioco-libero";
import { listMyRooms } from "@/lib/server/psyco/rooms";

export const metadata = { title: { absolute: "PSYCO · Tutti conoscono la regola. Tranne te." } };

const PHASE_LABEL: Record<string, string> = {
  LOBBY: "in sala d'attesa",
  ROUND_END: "fine manche",
  PLAYING: "manche in corso",
};

/** Home del minigioco: CREA PARTITA, ENTRA IN PARTITA, UN SOLO DISPOSITIVO, COME SI GIOCA (+ «Riprendi»). */
export default async function PsycoHome() {
  const host = await getHostUser().catch(() => null);
  const user = host ? { username: host.profile?.username ?? null } : null;
  const rooms = host ? await listMyRooms(host.userId).catch(() => []) : [];
  // senza account: al login e poi di nuovo qui, nella scelta giusta
  const guard = (path: string) => (host ? path : `/accedi?next=${encodeURIComponent(path)}`);

  return (
    <div className="min-h-dvh">
      <SiteHeader user={user} overlay />
      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden lg:block">
          <Image src="/games/psyco-copertina-desktop.webp" alt="" fill preload sizes="100vw" className="object-cover object-center opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-r from-noir via-noir/70 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-noir to-transparent" />
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-noir/90 to-transparent" />
        </div>
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-4 pb-12 pt-[calc(5rem+env(safe-area-inset-top))] lg:min-h-[min(100svh,56vw)] lg:items-start lg:justify-center lg:pt-24">
          <div className="relative w-[min(78vw,22rem)] overflow-hidden rounded-3xl shadow-[0_30px_80px_-30px_rgba(224,22,31,0.55)] ring-1 ring-white/10 lg:hidden">
            <Image src="/games/psyco-copertina.webp" alt="Copertina di PSYCO" width={1055} height={1318} preload sizes="(min-width: 768px) 22rem, 78vw" className="h-auto w-full" />
          </div>
          <div className="flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
            <h1 className="sr-only">PSYCO</h1>
            <PsycoLogo size="xl" className="hidden lg:inline-flex lg:items-start" />
            <p className="psy-type text-2xl text-paper md:text-3xl">
              Tutti conoscono la regola. <span className="text-blood">Tranne te.</span>
            </p>
            <p className="max-w-xl text-base font-bold text-paper/80 md:text-lg">
              Uno di voi è lo PSYCO. Gli altri scelgono una regola segreta e la rispettano mentre rispondono alle sue domande. Lui deve scoprirla prima che finisca il tempo. Nessuno esce dalla stanza.
            </p>
          </div>
          <nav aria-label="Come vuoi giocare" className="grid w-full max-w-xl gap-3 sm:grid-cols-2">
            <Link href={guard("/psyco/nuova?modo=personale")} prefetch={false} className="psy-btn psy-glow text-2xl">
              CREA PARTITA
            </Link>
            <Link href="/psyco/entra" prefetch={false} className="psy-btn psy-btn-paper text-2xl">
              ENTRA IN PARTITA
            </Link>
            <Link href={guard("/psyco/nuova?modo=condiviso")} prefetch={false} className="psy-btn psy-btn-ghost text-2xl">
              UN SOLO DISPOSITIVO
            </Link>
            <Link href="/psyco/come-si-gioca" prefetch={false} className="psy-btn psy-btn-ghost text-2xl">
              COME SI GIOCA
            </Link>
          </nav>
          <p className="max-w-xl text-center text-sm font-bold text-paper/60 lg:text-left">
            Un telefono per tutti? Basta il tuo account. Ognuno col suo telefono? Ognuno entra col proprio account (registrarsi è gratis e dura un minuto).
          </p>
          {rooms.length > 0 && (
            <section className="psy-panel w-full max-w-xl rounded-3xl p-4" aria-labelledby="riprendi">
              <h2 id="riprendi" className="psy-display text-2xl">
                Riprendi
              </h2>
              <ul className="mt-2 flex flex-col gap-2">
                {rooms.map((r) => (
                  <li key={r.roomId}>
                    <Link
                      href={r.mode === "shared" ? `/psyco/un-dispositivo/${r.roomId}` : `/psyco/stanza/${r.roomId}`}
                      prefetch={false}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-white/6 px-4 py-3 font-bold hover:bg-white/12"
                    >
                      <span>
                        <span className="font-mono tracking-widest">{r.code}</span> · {r.mode === "shared" ? "un solo dispositivo" : `${r.players} giocatori`}
                      </span>
                      <span className="text-sm text-paper/70">{r.roundNo > 0 ? `manche ${r.roundNo} · ` : ""}{PHASE_LABEL[r.phase] ?? "scelta della regola"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
