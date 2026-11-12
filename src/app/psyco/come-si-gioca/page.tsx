import Link from "next/link";
import { SiteHeader } from "@/features/home/SiteHeader";
import { PsycoLogo, RoleFace, RuleCard } from "@/features/psyco/ui";
import { getHostUser } from "@/lib/server/gioco-libero";

export const metadata = { title: "Come si gioca" };

const STEPS: { title: string; text: string }[] = [
  { title: "1. I ruoli", text: "A ogni manche il sito sceglie uno PSYCO (a rotazione: tutti lo fanno prima che qualcuno lo rifaccia). Ognuno guarda il proprio ruolo in segreto." },
  {
    title: "2. La regola segreta",
    text: "Tutti tranne lo PSYCO scelgono INSIEME una regola: dall'archivio (facile, media, difficile o a sorpresa, votando se tenerla o cambiarla) oppure inventandola (ognuno propone, poi si vota; in caso di parità si fa lo spareggio).",
  },
  {
    title: "3. Si gioca",
    text: "Parte il timer. Lo PSYCO fa domande a voce a chi vuole; gli altri rispondono RISPETTANDO la regola. Nessuno scrive niente: si parla e basta, seduti insieme. Bloccato? Lo PSYCO può «CHIAMARE L'INVESTIGATORE»: squilla il suo telefono e arriva un messaggio con un indizio, solo per lui (ogni chiamata è più chiara della precedente; il timer intanto corre).",
  },
  { title: "4. «HO CAPITO LA REGOLA!»", text: "Quando crede di averla capita, lo PSYCO preme il pulsante (il timer si ferma) e la spiega a voce. Gli altri votano: serve la maggioranza. Se ha sbagliato si continua dal tempo rimasto." },
  { title: "5. Fine della manche", text: "Vince lo PSYCO se indovina, vince il gruppo se scade il tempo. La regola viene svelata a tutti. Poi nuova manche: nuovo PSYCO, nuova regola, stessa stanza." },
];

export default async function ComeSiGioca() {
  const host = await getHostUser().catch(() => null);
  return (
    <div className="min-h-dvh">
      <SiteHeader user={host ? { username: host.profile?.username ?? null } : null} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 pb-20 pt-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <PsycoLogo size="lg" tagline />
          <h1 className="psy-display mt-4 text-4xl md:text-5xl">Come si gioca</h1>
          <p className="max-w-xl text-lg font-bold text-paper/80">Da 3 giocatori in su, senza un massimo. Nessuno deve uscire dalla stanza: i telefoni servono solo per i ruoli, la scelta della regola, i voti e il timer.</p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="aspect-[3/4] overflow-hidden rounded-3xl ring-2 ring-blood/50">
            <RoleFace role="psyco" compact />
          </div>
          <div className="aspect-[3/4] overflow-hidden rounded-3xl ring-2 ring-blood/40">
            <RoleFace role="knower" psycoName="Mike" compact />
          </div>
        </div>
        <ol className="flex flex-col gap-4">
          {STEPS.map((s) => (
            <li key={s.title} className="psy-panel rounded-3xl p-5">
              <h2 className="psy-display text-2xl text-paper">{s.title}</h2>
              <p className="mt-2 text-base font-bold text-paper/85 md:text-lg">{s.text}</p>
            </li>
          ))}
        </ol>
        <section className="flex flex-col gap-4">
          <h2 className="psy-display text-3xl">Un esempio</h2>
          <RuleCard rule={{ title: "Nei panni del vicino", text: "Si risponde fingendo di essere il giocatore seduto alla propria destra.", difficulty: "media" }} />
          <p className="font-bold text-paper/80">Mike è lo PSYCO e chiede a Sara: «Che lavoro fai?». Sara risponde «Faccio il cuoco»… perché Luca, alla sua destra, è cuoco. Mike deve accorgersene.</p>
        </section>
        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["Un solo telefono", "Basta l'account di chi crea la partita: gli altri sono nickname. Il telefono passa di mano, con schermate di copertura tra un giocatore e l'altro."],
            ["Ognuno il suo telefono", "Chi crea mostra QR e codice; gli altri entrano col proprio account (se non sono registrati, si iscrivono e tornano da soli alla stanza)."],
            ["PC o TV per tutti", "Dal PC scegli «Schermo + telefoni»: lo schermo grande mostra QR, giocatori, timer e risultati, e tutti (tu compreso) giocano dal telefono. Non mostra mai ruoli, regola né voti; una TV non ha bisogno di un account."],
          ].map(([t, d]) => (
            <div key={t} className="psy-paper p-5">
              <h3 className="psy-display text-2xl text-[#8e0b12]">{t}</h3>
              <p className="mt-2 font-bold text-[#3a2616]">{d}</p>
            </div>
          ))}
        </section>
        <p className="text-sm font-bold text-paper/60">
          Punteggi e classifiche arriveranno più avanti: per ora il sito registra chi era lo PSYCO, la regola, l&apos;esito, il tempo e i tentativi di ogni manche. Con un solo telefono la segretezza dipende anche da voi: niente sbirciate!
        </p>
        <Link href="/psyco" className="psy-btn self-center">
          GIOCA A PSYCO
        </Link>
      </main>
    </div>
  );
}
