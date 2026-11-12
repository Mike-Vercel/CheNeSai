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
| `/gioca` | Nuova partita: 10/15/20/30 domande, 1–5 round (almeno 3 domande per round), difficoltà Facile/Bilanciata/Difficile, scelta dello schermo del TV, in una colonna centrata. Sopra, solo se c'è, la scheda *Hai una partita in corso* (Riprendi / Termina). Al primo accesso con Google chiede lo username. |
| `/profilo` | Menu @username → *Le tue partite*: username, email, esci e lo storico delle partite (data, codice, giocatori, stato, podio). |
| `/gioca/partita/[id]` | Pagina dell'host sul PC: **Apri TV** sullo schermo scelto, codice e QR, giocatori collegati, comandi. |
| `/gioca/tv/[id]` | Il TV (lo stesso schermo delle serate) con i comandi minimi dell'host sovrapposti. |

Comandi dell'host (solo questi, solo sulle **sue** partite): **INIZIA PARTITA** in lobby (con almeno un
giocatore: parte l'intro con le regole e poi lo scorrimento automatico porta avanti tutto), **Pausa /
Riprendi**, **Termina partita**; dopo il podio **Nuova partita** e **Torna alla home**.

La nuova partita nasce già: composta (`composeFreeGameTx`: sempre votazione, ruota e canzone, vedi sotto), con scorrimento **automatico**,
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
- **Ruota di Palmino**: dalla 5ª domanda, ogni tanto (al massimo una per round, 2–3 a partita), Palmino gira
  una ruota che sceglie la categoria della domanda successiva. Le candidate degli spicchi seguono le stesse
  regole (prima le mai viste da questo host); conta come "vista" solo la domanda che esce davvero.
  Dettagli in `docs/ARCHITECTURE.md`.

## Sempre in partita: votazione, Ruota di Palmino, canzone

Ogni partita libera (e ogni rivincita) è composta da `composeFreeGameTx` (`src/lib/server/cms/compose.ts`,
regole pure in `src/lib/game-engine/free-game.ts`) con tre garanzie; il wizard le dice sotto le scelte.

- **Votazione delle materie** (round `category_vote`, 3 materie, 15 s, voto dai telefoni o dallo show in
  verticale). **Mai la prima cosa della partita**: arriva sempre dopo almeno 3 domande giocate.
  Con 3+ round è un round intermedio (il 2° con 3–4 round, il 3° con 5) e si vota all'inizio di quel round.
  Con **1 o 2 round** è il primo round con il **voto a metà round** (`game_rounds.vote_after = 3`):
  3 domande *comuni* (materie miste, `vote_option_id` nullo), poi la votazione "alla 4ª domanda", poi fino
  a 5 domande della materia votata, poi le eventuali altre comuni. Le materie sono quelle con abbastanza
  domande fresche per l'host.
  - Motore: `resolveNextQuestion` dà le prime `vote_after` comuni, poi risponde "voto in sospeso";
    `START_VOTE` è ammesso anche dopo i punti (SCORE_REVEAL/LEADERBOARD) e solo a comuni giocate;
    scorrimento automatico, "Avanti" dell'host e pulsante suggerito in regia usano `voteDue`.
  - Presentazione del round: "Dopo 3 domande la materia la scegliete voi!"; al voto Palmino annuncia
    "E adesso decidete voi la materia…" (`FIXED_POOLS.votingMidRound`). "Domanda X di N" e l'ultima del
    round contano le comuni più la materia scelta.
  - Serate della regia: `vote_after` resta nullo, voto a inizio round come sempre.
- **Ruota di Palmino**: almeno una (`atLeastOne` nel piano, stesso seme = id della partita). Le regole
  restano (mai prima della 5ª, mai prima domanda di un round, mai l'ultima): con il minimo di 10 domande
  c'è sempre un posto. Mai sulle domande della materia votata (dunque mai sulla prima dopo il voto): solo
  sulle comuni dopo il voto o in un altro round; mai sulla canzone.
- **Canzone ("Ascolta")**: una domanda con l'estratto audio, se l'archivio ne ha, al posto di una domanda
  di un round normale (non votato; la finale solo se non c'è altro), mai prima domanda del round né ultima
  della partita; con un round solo è la 2ª o la 3ª domanda (fra le comuni prima del voto). Prima quelle che l'host non ha mai sentito, poi la sentita meno di recente. Il TV (e con
  lo show sul telefono ogni telefono) la suona con Web Audio dopo la lettura; lo scorrimento automatico
  apre le risposte solo a estratto finito.
- Archivio troppo piccolo (solo nei test): niente votazione o niente canzone, con un avviso; la partita
  nasce comunque.

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

## Partita creata dal telefono

Su telefono o tablet (puntatore "dito" senza hover, lato corto ≤ 1100 px, oppure Client Hints
`mobile`: vedi `src/features/gioca/device-mode.ts`) dopo **CREA PARTITA** si sceglie dove giocare
(`/gioca/schermo/[id]`). Dal computer non cambia nulla (TV dritto come prima).

**A. Sul televisore** (`/gioca/telecomando/[id]`): il telefono diventa il telecomando.
1. Sul televisore (browser della smart TV, Chromecast con Google TV, Fire TV, PC) si apre
   `<sito>/tv` (link anche nel piè di pagina della home): compare un codice di **4 cifre** e un QR.
2. L'host scrive il codice sul telefono (oppure inquadra il QR → `/gioca/collega/[codice]`).
3. Il TV riceve la partita una volta sola (abbinamento monouso in `tv_pairings`, solo il proprietario,
   codici che scadono in ~10 minuti, tentativi limitati) e mostra la lobby; resta abbinato anche se si
   ricarica la pagina e segue da solo la rivincita.
4. Sul telefono: INIZIA PARTITA, pausa/avanti/termina, scorrimento, giocatori, **audio del TV**
   (volume, muto, voci, musica: il TV li applica entro ~3 s, tabella `tv_remote`), invita amici,
   rivincita. Stato «TV collegato» dalla presenza del TV.
- **Trasmetti** (Presentation API) compare solo se il browser dice che c'è un dispositivo Cast pronto
  per l'indirizzo della pagina: funziona con Chrome per computer; Chrome per Android trasmette solo app
  Cast registrate, quindi lì resta nascosto.
- Ultima spiaggia: duplicazione dello schermo (Smart View / AirPlay) con lo schermo TV in orizzontale.

**B. Su questo telefono** (`/gioca/telefono/[id]`): tutto lo show in verticale (1080×1920): lobby con
QR, codice e «Invita amici», intro e regole ricomposte in colonna, domande, soluzioni, classifiche e
podio. L'host gioca dallo stesso schermo: entra come giocatore (nickname = username) e tocca le
risposte direttamente sullo show. Audio sbloccato dal tocco sulla scelta, schermo sempre acceso,
schermo intero dove il browser lo consente (Android sì, iPhone no).

**Invita amici**: condivisione del sistema (WhatsApp, Telegram…) con link `/play/CODICE`; in più
WhatsApp diretto (`wa.me`), copia link e QR. C'è anche nel foglio impostazioni del TV dal computer.

## Partita ONLINE (anche dal PC)

`display_mode = 'phone'` è la partita **ONLINE**: lo show completo è su ogni dispositivo e ognuno gioca
dal suo (PC, telefono, tablet), anche a distanza.
- **Dal PC**: in «Nuova partita» si sceglie «ONLINE — ognuno gioca dal suo dispositivo» (il TV in
  salotto resta la scelta predefinita) → `/gioca/online/[id]`. Dal pannello dell'host (TV su un altro
  schermo) c'è «Passa all'ONLINE». Dal telefono resta «Su questo telefono» (`/gioca/telefono/[id]`).
- **Show interattivo orizzontale**: su PC e tablet in orizzontale (finestra ≥ 900×520 e larga almeno
  1,2 volte l'altezza: `src/features/shared/device.ts`) lo show è quello del TV, con le risposte da
  cliccare (o **tasti 1–4**, **Invio** per confermare le multiple, Tab + Spazio con l'anello di fuoco),
  la materia da votare (1–3), l'esito e i punti dopo la soluzione, il proprio nome evidenziato nelle
  classifiche e i propri punti in alto a destra. Telefoni e finestre strette: lo show verticale di sempre.
  I tasti non scattano mai con il fuoco in un campo di testo o nel menu (`src/features/shared/keyboard.ts`,
  riusabile dagli altri giochi). Anche il telefono-telecomando delle partite col TV accetta 1–4 dal PC.
- **Account obbligatorio** (solo online, mai in salotto): chi entra da `/play/CODICE` deve avere fatto
  l'accesso (`ACCOUNT_REQUIRED`, la pagina porta a `/accedi?next=/play/CODICE`). Un account = un
  giocatore per partita (`participants.user_id`, indice unico): rientrando con lo stesso account da un
  altro dispositivo si ritrova lo stesso giocatore con i suoi punti e il dispositivo di prima resta
  collegato (`participant_devices`). Se una partita passa da TV a online con giocatori già dentro col
  nickname, **non vengono espulsi**: il loro cookie vale ancora e rientrano dallo stesso dispositivo;
  l'account serve solo a chi entra da nuovo (se poi fanno l'accesso dallo stesso dispositivo il loro
  posto si lega all'account). Le serate di prova della regia (`is_test`) sono escluse.
- **Host che sparisce**: se la scheda dell'host si chiude o perde la rete, i dispositivi dei giocatori
  chiedono il passo di riserva (`POST /api/play/[code]/tick`, cookie del giocatore): il server lo esegue
  solo se il passo è in ritardo di almeno 6 s (`FALLBACK_GRACE_MS`), con gli stessi controlli dello
  scorrimento automatico (idempotente, una volta sola anche con tanti giocatori). L'host che riapre la
  partita la ritrova e continua.
- **Vista per la LIVE** (`/gioca/live/[sessionId]`): finestra a parte con lo show pulito in 16:9 da
  catturare con OBS / TikTok LIVE Studio (Cattura finestra, oppure Sorgente browser con l'indirizzo
  copiato, che contiene un gettone firmato valido solo per la vista e per le rivincite). Mai codice,
  QR, link, comandi, puntatore, né la risposta scelta prima della soluzione; `?audio=0` = muta.
  La apre un giocatore della partita (cookie) o l'host (account). Esempio: due creator, ognuno sul suo
  PC, giocano in una finestra e catturano l'altra.

## Chiusura automatica dopo 24 ore

Le partite **libere** (mai le serate della regia) non finite e senza attività da 24 ore (stato di
gioco, telefoni, TV abbinato) si chiudono col normale FINISH (`src/lib/server/auto-close.ts`):
- quando l'host apre `/gioca`, il profilo o una sua partita, e (al massimo ogni 10 minuti) quando un
  TV o un telefono ne legge lo stato;
- ogni giorno con il Cron di Vercel (`vercel.json` → `/api/cron/chiudi-partite`, alle 4:15 UTC).
  **Impostare `CRON_SECRET`** nelle variabili d'ambiente del progetto Vercel: Vercel lo manda come
  `Authorization: Bearer …` e senza la variabile la route rifiuta ogni chiamata.

## Cosa deve fare il proprietario (una volta)

### 1. Database online

```
npm run deploy:migrate
```

applica `20261111190000_gioco_libero.sql` (tabella `host_profiles`, `game_sessions.host_user_id`,
`question_plays.host_user_id`, trigger aggiornato, registri append-only che consentono la cancellazione
degli account). È idempotente.

Le partite ONLINE con account richiedono anche `20261113100000_partite_online_account.sql`
(`participants.user_id` con indice unico per partita, tabella `participant_devices`): solo aggiunte,
idempotente. Va applicata PRIMA di pubblicare il codice che la usa.

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
