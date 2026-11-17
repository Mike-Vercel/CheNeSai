import Link from "next/link";
import { Logo } from "@/features/tig/ui";
import { POINTS } from "@/lib/tig/rules";
import { MANCHE_TAGLINES, MANCHE_TITLES } from "@/lib/tig/types";

export const metadata = { title: "Regolamento" };

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "Un tavolo = una squadra",
    items: [
      "Ogni tavolo ha il suo QR: chi lo scansiona per primo crea la squadra (nome e capitano), gli altri entrano nella stessa squadra.",
      "Un account gioca con un solo tavolo per serata. Basta anche un solo telefono per tutto il tavolo.",
      "Lo staff convalida le squadre: finché il nome non è approvato, la TV mostra solo «TAVOLO N».",
      "Nessuno viene eliminato: si gioca fino alla fine e tutti possono rimontare.",
    ],
  },
  {
    title: "Equità",
    items: [
      "Decisione di squadra: tutti discutono, il capitano invia (con un solo telefono invia chiunque).",
      "Voti interni: conta la percentuale del tavolo, mai la somma dei telefoni. Nei sondaggi del locale: un voto per tavolo.",
      "Un tavolo da 2 può battere un tavolo da 8: più telefoni non danno più punti.",
      "Tempi, punti ed esiti li decide solo il server; la TV e i telefoni li mostrano.",
    ],
  },
  {
    title: "Punti",
    items: [
      `Prova risolta: ${POINTS.standard} punti, bonus velocità fino a +${POINTS.speedBonusMax}. Indizi progressivi: ${POINTS.clues.join(" / ")}.`,
      `Duelli e attacchi: da +${POINTS.duel[0]} a +${POINTS.duel[1]}. Furti e penalità al massimo ${POINTS.transferMax} punti.`,
      `Nessun tavolo perde più di ${POINTS.lossPerMancheMax} punti per azioni altrui in una manche, né subisce più di ${POINTS.attacksPerWindow} attacchi in 10 minuti.`,
      `Lo scudo blocca il prossimo attacco: uno per manche, non cumulabile, scade a fine manche.`,
      `Puntata finale: al massimo il 25% del saldo e mai oltre ${POINTS.betMaxAbs}. Scelta finale: ${POINTS.finalSafe} prudenti o ${POINTS.finalRisky} rischiosi. Il saldo non va mai sotto zero.`,
      "Parità: contano le sfide vinte, poi la precisione media, poi uno spareggio identico di 45 secondi.",
    ],
  },
  {
    title: "Bottone del Caos",
    items: [
      "Una volta per squadra per serata, solo tra una prova e l'altra delle manche 2, 3 e 4.",
      "Il tavolo sceglie chi sfidare: sulla TV scatta «ALLARME CAOS!» e parte un duello identico di 45 secondi.",
      `Chi vince prende +${POINTS.caosWin}; nessun malus per chi perde. Mai su se stessi, mai più di due sfide allo stesso tavolo in 10 minuti.`,
    ],
  },
  {
    title: "Mascotte ed Energia Caos",
    items: [
      "Ogni tavolo vota la sua mascotte tra 12: la più votata va al tavolo (in modalità standard ogni mascotte a un solo tavolo).",
      "L'Energia Caos si guadagna partecipando in tempo, con gli esiti e accettando le sfide: è separata dai punti.",
      "Con l'energia la mascotte evolve: Base → Potenziata → Leggendaria. Anche l'ultimo in classifica può evolvere.",
    ],
  },
];

export default function Regolamento() {
  return (
    <main className="tig-arena !relative min-h-dvh overflow-y-auto">
      <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-20 pt-6">
        <div className="flex items-center justify-between gap-2">
          <Link href="/tavoli-in-guerra" className="tig-chip hover:border-white/50">
            ‹ Menu
          </Link>
          <Link href="/tavoli-in-guerra/entra" className="tig-chip !border-[#ff2d3d]/60">
            Entra con un codice
          </Link>
        </div>
        <Logo size="lg" tagline />
        <section className="tig-panel rounded-3xl p-5">
          <p className="tig-label">La serata · 115 minuti (90–120)</p>
          <h1 className="tig-display mt-1 text-4xl">Regolamento</h1>
          <ol className="mt-4 flex flex-col gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <li key={n} className="flex gap-3 rounded-2xl border border-white/10 bg-black/35 p-3">
                <span className="tig-display grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#ffb020] text-3xl text-black">{n}</span>
                <span>
                  <span className="tig-display block text-2xl">{MANCHE_TITLES[n]}</span>
                  <span className="text-sm font-bold text-white/70">{MANCHE_TAGLINES[n]}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm font-bold text-white/60">Tra la terza e la quarta manche c’è la pausa; alla fine la premiazione, dall’ultimo al primo.</p>
        </section>
        {SECTIONS.map((s) => (
          <section key={s.title} className="tig-panel rounded-3xl p-5">
            <h2 className="tig-display text-3xl">{s.title}</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {s.items.map((i) => (
                <li key={i} className="flex gap-2 text-base font-semibold text-white/85">
                  <span aria-hidden className="mt-1 text-[#ffb020]">
                    ▸
                  </span>
                  {i}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="text-center text-sm font-bold text-white/55">Gioco per maggiorenni. Niente obblighi di bere, niente prove umilianti: le tensioni sono di gioco, mai personali.</p>
      </div>
    </main>
  );
}
