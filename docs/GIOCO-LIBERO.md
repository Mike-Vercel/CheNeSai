# Gioco libero (partite create dal pubblico)

Chiunque apre il sito, preme **GIOCA**, crea un account (solo chi ospita: i giocatori dal telefono
entrano senza account), sceglie quante domande e quanti round e gioca: il PC diventa la TV, i telefoni
entrano con il QR code o il codice, la partita scorre da sola.

## Percorso

| Pagina | Cosa fa |
| --- | --- |
| `/` | Home della piattaforma (stile catalogo): CHE NE SAI?! in primo piano quasi a tutto schermo con **GIOCA**, "Hai un codice partita?", righe *I nostri giochi*, *Come si gioca*, *In arrivo*. Sul telefono il primo campo è il codice partita. |
| `/entra` | Ingresso dal telefono con il codice (il QR del TV porta direttamente a `/play/CODICE`, come sempre). |
| `/accedi` | Crea account (username univoco + email + password), Accedi, Password dimenticata, **Continua con Google**. |
| `/accedi/nuova-password` | Dopo il link "password dimenticata". |
| `/gioca` | Nuova partita: 10/15/20/30 domande, 1–5 round (almeno 3 domande per round), difficoltà Facile/Bilanciata/Difficile, scelta dello schermo del TV. Sotto: *Le tue partite* (si riprendono se si chiude la finestra). Al primo accesso con Google chiede lo username. |
| `/gioca/partita/[id]` | Pagina dell'host sul PC: **Apri TV** sullo schermo scelto, codice e QR, giocatori collegati, comandi. |
| `/gioca/tv/[id]` | Il TV (lo stesso schermo delle serate) con i comandi minimi dell'host sovrapposti. |

Comandi dell'host (solo questi, solo sulle **sue** partite): **INIZIA PARTITA** in lobby (con almeno un
giocatore: parte l'intro con le regole e poi lo scorrimento automatico porta avanti tutto), **Pausa /
Riprendi**, **Termina partita**; dopo il podio **Nuova partita** e **Torna alla home**.

La nuova partita nasce già: composta (`composeAndCreateSession`), con scorrimento **automatico**,
pubblicata (stessi controlli delle serate) e con la lobby aperta. Il titolo è "Partita di <username>".

## Account host

- Normali utenti Supabase Auth con un profilo in `host_profiles` (username univoco senza distinzione tra
  maiuscole e minuscole, 3–20 caratteri: lettere, numeri, `_` e `.`; alcuni nomi sono riservati).
  Lo username si vede in alto a destra; in partita ognuno sceglie comunque il nickname che vuole.
- **Non sono amministratori**: l'area `/admin` continua a richiedere una riga attiva in `admin_users`
  (`getAdmin`). Se un admin usa `/gioca` con il suo account, non ha limiti di partite.
- **Accesso che dura**: il cookie di sessione dura 400 giorni (`@supabase/ssr`) e viene rinnovato dal
  proxy (`src/proxy.ts`) sulle pagine del sito; il refresh token di Supabase non scade. Chi ha fatto
  l'accesso una volta resta collegato per almeno un anno su quel browser (a meno che non prema *Esci*).
  Nel progetto Supabase online **non** attivare *Authentication → Sessions → Time-box user sessions* né
  *Inactivity timeout* (sono opzioni del piano Pro, di base spente).

- **Cancellare un account** (richiesta privacy): Supabase Dashboard → Authentication → Users → utente →
  *Delete user*. Profilo e storico personale spariscono; partite, registri e classifiche restano senza
  riferimento all'account (la migrazione consente ai registri append-only solo di azzerare il riferimento).
- Pagine `/privacy` e `/termini` (necessarie per pubblicare la schermata di consenso di Google):
  **sostituire `CONTACT_EMAIL`** in `src/features/home/site.ts` (ora è un segnaposto).

## Quota, interruttore e limiti (Admin → Impostazioni → Gioco libero)

- **Gioco libero aperto al pubblico** (predefinito: sì). Se spento, solo admin e super admin creano partite.
- **Partite per account** (predefinito: **0 = illimitate**). Con un numero > 0 ogni account può creare
  al massimo quel numero di partite (conta `host_profiles.games_created`); la pagina `/gioca` mostra
  "Ti restano N partite" solo quando c'è un limite. Admin e super admin: sempre illimitate.
- **Giocatori massimi per partita** (predefinito 20): copiato nelle impostazioni della partita alla
  creazione (`settings.maxPlayers`); oltre, il telefono vede "La partita è al completo".
- Limiti di frequenza: 6 partite ogni 10 minuti per account, 20 all'ora per rete; 10 registrazioni
  all'ora per rete; controllo username 120 al minuto.

## Domande già uscite (storico per account)

- Il trigger di `question_plays` ora registra anche `host_user_id` quando una domanda viene mostrata in
  una partita libera: lo storico resta anche se la partita viene eliminata.
- Composizione di una partita libera, in ordine: domande mai giocate (in nessuna serata) e mai viste
  dall'host → già giocate altrove ma non da lui → già inserite in una serata della regia in programma →
  **già viste da questo host** (solo se l'archivio non basta, con avviso).
- Le partite libere non "prenotano" domande per le serate della regia (si giocano subito), ma le domande
  che mostrano contano come giocate anche per le serate (come qualsiasi serata non di prova).

## Partite libere nella regia

- **Serate** ha il selettore *Serate della regia / Partite libere*: le partite libere non compaiono tra
  le serate, hanno l'etichetta "Partita libera · @username".
- Non entrano nella classifica del mese, nel cruscotto e nello storico delle statistiche.
- Helper server `isPublicSession(sessionId)` (`src/lib/server/gioco-libero.ts`) per forzare in futuro la
  voce "nomi salvati" nelle partite libere.
- Nota costi voci: all'apertura della lobby parte "Prepara voci" come per le serate (budget mensile in
  Admin → Voci). Va deciso se limitarlo per le partite libere.

## Schermo TV (PC collegato al televisore con HDMI)

Modulo comune `src/features/display/screen-picker.ts` + `TvScreenControls.tsx`, usato dalla regia
(**Apri TV** accanto al link del TV in regia live e nella pagina della serata, scelta dello schermo nella
*Serata rapida*) e dal gioco libero (`/gioca`, pagina dell'host).

- Chrome/Edge su PC: la prima volta il browser chiede il permesso **Gestione finestre**; poi l'elenco
  mostra "Schermo 1 – principale 1920×1080", "Schermo 2 – TV 3840×2160". La scelta resta salvata su quel
  PC. Il TV si apre in una finestra sullo schermo scelto, a schermo intero quando il browser lo consente;
  altrimenti basta un clic su "Tocca per schermo intero" (il browser vuole un gesto dell'utente).
- Durante la partita: **Sposta su…** dalla regia/host, oppure il comando discreto **🖥 Schermo** in alto a
  sinistra sul TV (compare muovendo il mouse).
- Firefox, Safari o un solo schermo: si apre una finestra normale con l'istruzione "trascinala sul
  televisore e premi F11". Il televisore va collegato in modalità **Estendi** (non Duplica).

## Cosa deve fare il proprietario (una volta)

### 1. Database online

```
npm run deploy:migrate
```

applica `20261111190000_gioco_libero.sql` (tabella `host_profiles`, `game_sessions.host_user_id`,
`question_plays.host_user_id`, trigger aggiornato, registri append-only che consentono la cancellazione
degli account). È idempotente.

### 2. Registrazioni con email

Supabase Dashboard → progetto **che-ne-sai** → **Authentication → Sign In / Providers**:

- **Allow new users to sign up**: attivo.
- **Email** provider attivo.
- **Confirm email**: vedi la nota sulle email qui sotto.

> **Email di Supabase (piano gratuito)**: il mittente predefinito di Supabase manda pochissime email
> all'ora (2–4) e, nei progetti nuovi, **solo agli indirizzi del team del progetto**: le email di conferma
> agli utenti normali non partono. Due strade:
> 1. **Disattivare "Confirm email"** (Authentication → Sign In / Providers → Email): l'account è subito
>    attivo e si gioca al primo colpo. Consigliato per partire.
> 2. Configurare un **SMTP personalizzato** (Authentication → Emails → SMTP Settings: Resend, Brevo,
>    SendGrid, Gmail…) e lasciare la conferma attiva. Anche il recupero password usa le email.
>
> L'app gestisce entrambi i casi: con conferma attiva mostra "Controlla la tua email" (con "Invia di
> nuovo"), il link torna su `/auth/callback` e da lì al gioco.

### 3. URL del sito

Authentication → **URL Configuration**:

- **Site URL**: `https://che-ne-sai.vercel.app`
- **Redirect URLs**: aggiungere
  - `https://che-ne-sai.vercel.app/**`
  - (se servono le anteprime Vercel) `https://che-ne-sai-*.vercel.app/**`
  - (sviluppo) `http://localhost:3000/**`

### 4. Accesso con Google

1. **Google Cloud Console** (console.cloud.google.com) → crea o scegli un progetto →
   **APIs & Services → OAuth consent screen**: tipo *External*, nome app "CHE NE SAI?!", email di
   supporto, dominio autorizzato `supabase.co` (e il tuo dominio se ne usi uno), ambiti `email`, `profile`,
   `openid`; poi **Publish app** (altrimenti entrano solo gli utenti di test).
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**, tipo **Web application**:
   - *Authorized JavaScript origins*: `https://che-ne-sai.vercel.app`
   - *Authorized redirect URIs*: `https://<project-ref>.supabase.co/auth/v1/callback`
     (`<project-ref>` è il codice del progetto Supabase: lo vedi nell'indirizzo della Dashboard o in
     `.env.production.local` come `SUPABASE_PROJECT_REF`).
   - Copia **Client ID** e **Client secret**.
3. **Supabase Dashboard → Authentication → Sign In / Providers → Google**: attiva, incolla Client ID e
   Client secret, salva.
4. Prova: home → GIOCA → **Continua con Google**. Al primo accesso il sito chiede lo username.

Finché il provider Google non è attivo, "Continua con Google" riporta su `/accedi` con il messaggio
"L'accesso con Google non è ancora attivo…" (nessuna pagina di errore di Supabase).

## Sviluppo locale

- `supabase/config.toml` ora ha `enable_signup = true` (vale al prossimo `npm run db:start`); per
  Google in locale servono `[auth.external.google]` attivo e gli indirizzi di ritorno del dev server
  (`http://localhost:<porta>/**`) in `additional_redirect_urls`. Con lo stack già avviato e le registrazioni ancora chiuse, la route di
  registrazione crea l'account con la chiave di servizio **solo se Supabase è locale** (127.0.0.1/localhost),
  così lo sviluppo funziona senza riavviare. In locale la conferma email è spenta (`enable_confirmations = false`).
- Test: `tests/unit/public-game.test.ts`, `tests/unit/screen-picker.test.ts`,
  `tests/integration/gioco-libero.test.ts`, `tests/e2e/gioco-libero.spec.ts`
  (e2e: `QZ_OPTIONS_READ_DELAY=0`, `ELEVENLABS_API_KEY=` vuota; l'account e le partite di prova
  vengono eliminati alla fine, insieme al loro storico delle domande).
