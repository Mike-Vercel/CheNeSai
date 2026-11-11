import { LegalPage, LegalSection } from "@/features/home/LegalPage";
import { PLATFORM_NAME } from "@/features/home/games";
import { CONTACT_EMAIL } from "@/features/home/site";

export const metadata = { title: "Informativa sulla privacy", robots: { index: true, follow: true } };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Informativa sulla privacy"
      intro={`${PLATFORM_NAME} ospita CHE NE SAI?!, un quiz da giocare in compagnia. Raccogliamo solo i dati che servono a far funzionare il gioco: niente pubblicità, niente profilazione, nessuna vendita di dati.`}
    >
      <LegalSection title="Quali dati trattiamo">
        <p>
          <strong>Chi crea una partita (account host)</strong>
        </p>
        <ul>
          <li>indirizzo email e password (la password è conservata cifrata dal servizio di autenticazione, noi non la vediamo);</li>
          <li>lo username che scegli;</li>
          <li>se entri con Google: il nome e la foto del profilo Google che Google ci comunica insieme all&apos;email;</li>
          <li>le partite che crei (data, numero di domande e round, codice partita);</li>
          <li>le domande già uscite nelle tue partite, per non riproportele.</li>
        </ul>
        <p>
          <strong>Chi gioca dal telefono</strong> (senza account)
        </p>
        <ul>
          <li>il nickname scelto per la partita;</li>
          <li>le risposte date, i punteggi e la posizione in classifica di quella partita;</li>
          <li>un identificativo casuale salvato nel telefono (cookie) per farti rientrare se la pagina si chiude.</li>
        </ul>
        <p>Per sicurezza registriamo anche l&apos;indirizzo IP nei limiti contro gli abusi (troppe richieste in poco tempo).</p>
      </LegalSection>

      <LegalSection title="Perché">
        <ul>
          <li>far funzionare il gioco: creare la partita, far entrare i giocatori, calcolare punteggi e podio;</li>
          <li>ricordare le domande già uscite, così le partite successive ne propongono di nuove;</li>
          <li>proteggere il servizio da abusi.</li>
        </ul>
        <p>La base giuridica è l&apos;esecuzione del servizio che chiedi (art. 6.1.b GDPR) e il nostro legittimo interesse a proteggerlo (art. 6.1.f).</p>
      </LegalSection>

      <LegalSection title="Chi ci aiuta (responsabili del trattamento)">
        <ul>
          <li>
            <strong>Supabase</strong>: database e accesso agli account, con i server nell&apos;Unione europea (Francoforte, Germania).
          </li>
          <li>
            <strong>Vercel</strong>: ospita il sito e le pagine che vedi.
          </li>
          <li>
            <strong>ElevenLabs</strong>: sintesi vocale dei presentatori. Per far pronunciare le battute vengono inviati i testi delle frasi, che possono contenere
            i nickname dei giocatori.
          </li>
          <li>
            <strong>Google</strong>: solo se scegli &laquo;Continua con Google&raquo; per accedere.
          </li>
        </ul>
        <p>Non vendiamo né cediamo i dati a nessuno e non usiamo strumenti pubblicitari.</p>
      </LegalSection>

      <LegalSection title="Per quanto tempo">
        <p>
          I dati dell&apos;account restano finché l&apos;account esiste. Puoi chiederne la cancellazione in ogni momento: eliminiamo account, username e storico
          delle domande. Le partite già giocate possono restare in forma anonima per le statistiche del gioco.
        </p>
      </LegalSection>

      <LegalSection title="I tuoi diritti">
        <p>
          Puoi chiedere di vedere, correggere o cancellare i tuoi dati, limitarne l&apos;uso o opporti, scrivendo a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-gold underline underline-offset-4">
            {CONTACT_EMAIL}
          </a>
          . Rispondiamo entro 30 giorni. Puoi anche rivolgerti al Garante per la protezione dei dati personali.
        </p>
      </LegalSection>

      <LegalSection title="Cookie">
        <p>
          Usiamo solo cookie tecnici: quello dell&apos;accesso al tuo account (dura fino a 400 giorni, così non devi rientrare ogni volta) e quello che ti
          riconosce come giocatore in una partita. Nessun cookie di profilazione o di terze parti per pubblicità.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
