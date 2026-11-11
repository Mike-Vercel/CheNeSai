import Link from "next/link";
import { LegalPage, LegalSection } from "@/features/home/LegalPage";
import { PLATFORM_NAME } from "@/features/home/games";
import { CONTACT_EMAIL } from "@/features/home/site";

export const metadata = { title: "Termini di servizio", robots: { index: true, follow: true } };

export default function TerminiPage() {
  return (
    <LegalPage
      title="Termini di servizio"
      intro={`Usando ${PLATFORM_NAME} e CHE NE SAI?! accetti queste poche regole. Sono semplici: il gioco è gratuito, serve a divertirsi in compagnia e va usato con buon senso.`}
    >
      <LegalSection title="Il servizio">
        <ul>
          <li>Il gioco è gratuito. Per creare una partita serve un account; per giocare dal telefono basta il codice della partita.</li>
          <li>Le domande, le voci dei presentatori e la grafica sono preparate da noi e restano nostre: puoi usarle per giocare, non per copiarle o rivenderle.</li>
          <li>Possiamo cambiare, sospendere o limitare il servizio (per esempio il numero di partite per account) quando serve.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Uso corretto">
        <ul>
          <li>Niente nickname o username offensivi, volgari, discriminatori o che imitano altre persone. Chi ospita la partita può espellere un giocatore.</li>
          <li>Niente tentativi di forzare il sistema, creare partite o account in massa o disturbare le partite degli altri.</li>
          <li>Account che non rispettano queste regole possono essere sospesi o eliminati.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Nessuna garanzia">
        <p>
          Il gioco è offerto così com&apos;è. Facciamo del nostro meglio perché domande e risposte siano corrette e il sito funzioni, ma non possiamo
          garantire che sia sempre disponibile o privo di errori. Non siamo responsabili di danni derivanti dall&apos;uso del gioco, nei limiti consentiti
          dalla legge.
        </p>
      </LegalSection>

      <LegalSection title="Dati personali">
        <p>
          Come trattiamo i dati è spiegato nell&apos;
          <Link href="/privacy" className="font-bold text-gold underline underline-offset-4">
            informativa sulla privacy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Contatti">
        <p>
          Per domande, segnalazioni o per chiudere il tuo account scrivi a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-gold underline underline-offset-4">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
