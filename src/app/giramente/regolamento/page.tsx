import Link from "next/link";
import { SiteHeader } from "@/features/home/SiteHeader";
import { Logo } from "@/features/giramente/ui";
import { ROUNDS } from "@/lib/giramente/types";
import { getHostUser } from "@/lib/server/gioco-libero";

export const metadata = { title: "Regolamento" };

const SECTORS: [string, string][] = [
  ["INTRUSO", "Trova l'elemento che non appartiene al gruppo."],
  ["SEQUENZA", "Completa una sequenza logica, numerica, visiva o di concetti."],
  ["INDIZI", "Arriva alla soluzione da alcuni indizi."],
  ["PROSPETTIVA", "Un enigma visivo: osserva e interpreta."],
  ["MISTERO", "Una prova a sorpresa: la categoria si scopre solo all'ultimo."],
  ["JOLLY", "Entra Zafira e ti offre un potere: Occhio Furbo o Scudo. Se ne hai già uno: +50 punti."],
  ["BONUS", "La prova normale vale +100 punti in più se rispondi giusto."],
  ["COLPO DI SCENA", "Sfida lampo: meno tempo, +100 se indovini. Puoi rifiutarla."],
];

export default async function Regolamento() {
  const host = await getHostUser().catch(() => null);
  return (
    <div className="min-h-dvh">
      <SiteHeader user={host ? { username: host.profile?.username ?? null } : null} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-20 pt-4">
        <div className="flex justify-center">
          <Logo size="md" tagline />
        </div>
        <h1 className="gm-display text-center text-5xl">REGOLAMENTO</h1>
        <section className="gm-panel rounded-3xl p-5">
          <h2 className="gm-display text-3xl text-[#39ff14]">Come si gioca</h2>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 font-semibold text-white/90">
            <li>Da 2 a 8 giocatori, oppure da 2 a 4 squadre di 2–6 persone (il capitano conferma le risposte). Nessuno viene eliminato.</li>
            <li>Un telefono per tutti (il tuo account, gli altri col nome) oppure un dispositivo a testa, telefono o PC, ognuno col proprio account.</li>
            <li>Il televisore mostra la ruota, la classifica e il presentatore: aprilo dal menu della partita.</li>
            <li>Il punteggio non scende mai sotto zero. Massimo teorico senza bonus: 2.200 punti.</li>
          </ul>
        </section>
        {ROUNDS.map((r) => (
          <section key={r.no} className="gm-panel rounded-3xl p-5">
            <p className="text-sm font-black uppercase tracking-widest text-white/60">Manche {r.no} di 5</p>
            <h2 className="gm-display text-3xl">{r.name}</h2>
            <ul className="mt-2 flex flex-col gap-1.5 font-semibold">
              {r.rules.map((x) => (
                <li key={x}>▸ {x}</li>
              ))}
            </ul>
          </section>
        ))}
        <section className="gm-panel rounded-3xl p-5">
          <h2 className="gm-display text-3xl text-[#39ff14]">Le caselle della ruota</h2>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            {SECTORS.map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-black/40 p-3">
                <dt className="gm-display text-xl">{k}</dt>
                <dd className="text-sm font-semibold text-white/85">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm font-semibold text-white/80">Le caselle speciali non sostituiscono la prova: assegnano comunque un enigma. Verde o Rosso si sceglie PRIMA di girare e non si cambia.</p>
        </section>
        <section className="gm-panel rounded-3xl p-5">
          <h2 className="gm-display text-3xl text-[#ff6b7a]">I poteri della Jolly</h2>
          <ul className="mt-2 flex flex-col gap-1.5 font-semibold">
            <li>👁 OCCHIO FURBO: un indizio in più, gratis (nelle manche 1 e 3, il quarto indizio del Collegamento o l&apos;indizio del Tabellone).</li>
            <li>🛡 SCUDO: annulla la penalità di una risposta sbagliata in ROSSO (non la rende giusta).</li>
            <li>Un potere alla volta, si consuma solo quando serve davvero, scade alla fine della manche 4 e non vale nel Giro Decisivo.</li>
          </ul>
        </section>
        <section className="gm-panel rounded-3xl p-5">
          <h2 className="gm-display text-3xl text-[#f5c542]">Il vincitore</h2>
          <p className="mt-2 font-semibold">Vince chi ha più punti dopo il Giro Decisivo. In caso di parità al primo posto: spareggio con un enigma a indizi (600, 400, 200), ripetuto finché non resta un solo vincitore.</p>
        </section>
        <Link href="/giramente/nuova" className="gm-btn self-center">
          ▶ NUOVA PARTITA
        </Link>
      </main>
    </div>
  );
}
