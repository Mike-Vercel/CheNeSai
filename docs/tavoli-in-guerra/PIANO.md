# TAVOLI IN GUERRA! — Piano di implementazione V1

Fonti (leggerle per intero): `C:/Users/micha/Desktop/TAVOLI_IN_GUERRA_Concept_Regolamento_80_Minigiochi.pdf`,
`C:/Users/micha/Desktop/TAVOLI_IN_GUERRA_Brief_per_Claude.md` e i requisiti dell'utente riassunti qui sotto.
Il proprietario ha detto: «prendi tutte le decisioni tu, è già tutto scritto». Questo file fissa le decisioni.

## 1. Requisiti dell'utente (vincolanti)
- Gioco NUOVO e INDIPENDENTE nella piattaforma CHE NE SAI?: non cambiare CHE NE SAI?/BOCCIATI!, PSYCO, GIRAMENTE!,
  i loro personaggi, auth, sessioni, classifiche. Niente migrazioni distruttive (solo additive, idempotenti, tabelle `tig_*`).
  Componenti condivisi solo in modo retrocompatibile, con verifica di regressione.
- Game show per pub, 18+ (20–35 anni, media 25), 115 minuti configurabili 90–120. Tono adulto, ironico, competitivo;
  niente infantile, niente obbligo di bere, niente umiliazioni, niente contenuti discriminatori.
- Squadre si sfidano, rubano punti (entro limiti), poteri, bluff, alleanze/tradimenti, minigiochi diversi, rimonte,
  mascotte che evolvono. Nessuna eliminazione.
- **UN TAVOLO = UNA SQUADRA**: QR per tavolo; più scansioni dello stesso QR = stessa squadra (vincolo DB + transazione).
  Un account = una squadra per evento. Convalida dello staff. Lobby bloccabile; ingressi tardivi autorizzati.
  Alternativa «codice squadra approvato» per locali senza tavoli numerati. Un solo telefono per tavolo supportato.
- Superfici: TV del locale (spettacolo), smartphone e PC (giocatori), regia/admin (organizzatore).
- Equità: 8 persone non battono 2 per numero; voti normalizzati per tavolo; input: decisione di squadra (capitano invia),
  voto interno (percentuale), cooperazione (frammenti scalati sui telefoni presenti), duello.
- Scaletta: lobby 10' · M1 CHI PARTE MALE... 15' (4 giochi) · M2 FREGALI TUTTI! 20' (4) · M3 IL PUB DECIDE! 20' (4) ·
  pausa 10' · M4 IL GRANDE INGANNO 20' (4) · M5 TUTTO O NIENTE! 15' (3) · premiazione 5'. Regia: pausa, ripresa,
  durate modificabili, skip con audit.
- Catalogo 80 meccaniche (5 manche × 16) come obiettivo; una serata ne usa ~19 senza doppioni; varianti di contenuto.
  Meccaniche davvero diverse (memoria, velocità, puzzle, bluff, voto, strategia, coordinazione, duelli, misteri,
  immagini/video/audio con alternative accessibili, rischio, cooperazione, sabotaggio, scelte segrete, previsione).
  Risultati SOLO dal server. **Mai dichiarare implementata una meccanica che non lo è.**
- Mascotte: 12 NUOVE mascotte 3D (GLB forniti dopo). NON inventarne nomi, aspetto, sesso: solo l'infrastruttura
  (12 slot). Scelta col voto dei membri; in modalità standard ogni mascotte a un solo tavolo (assegnazione atomica).
  Compaiono in: scheda squadra, ingresso, classifiche, duelli, sabotaggi, vittorie, sconfitte, evoluzioni, premiazione.
- Evoluzione: Livello 1 Base → 2 Potenziata → 3 Leggendaria grazie all'**Energia Caos** (separata dai punti; anche
  l'ultimo può evolvere). Solo estetica. Varianti GLB per livello oppure materiali/accessori/effetti.
- **Bottone del Caos**: 1 volta per squadra per serata, solo nelle finestre consentite: «ALLARME CAOS!» sulla TV,
  le due mascotte, minigioco speciale simmetrico 45 s, +50 al vincitore; niente usi doppi, niente accanimento.
- Personaggi esistenti (non modificarli): possono presentare/commentare. 12 nuove mascotte supportate in automatico.
- Voci: libreria ENORME. File reale `TAVOLI_IN_GUERRA_FRASI_COMPLETE.txt` (frasi complete con ID, personaggio, sesso,
  voce, tono, scena, testo, variabili, durata) + `TAVOLI_IN_GUERRA_PERSONAGGI.md` + catalogo leggibile dal codice.
  ≥120 frasi per i presentatori principali, ≥60 per gli altri esistenti, ≥100 per ogni nuova mascotte QUANDO definita.
  Sistema audio: varianti casuali per evento, niente ripetizioni ravvicinate, nomi squadra sicuri, interruzioni,
  sincronia voce/animazione, niente sovrapposizioni, file futuri, sottotitoli, fallback.
- Grafica: **tutto in 3D, super fluido e responsive** (richiesta esplicita). TV da grande produzione; telefono immediato
  (pulsanti grandi, niente superfluo nei minigiochi, mascotte, Energia Caos); PC come player completo (mouse/tastiera).
- Architettura: stack esistente, server autoritativo, realtime, riconnessione, timer sincronizzati, idempotenza,
  transazioni, log eventi, permessi, anti-manipolazione, 3D ottimizzato e progressivo, più eventi isolati.

## 2. Audit sintetico del repository (fatti verificati)
- Next.js 16 App Router + React 19 (React Compiler) + Tailwind; Supabase Postgres via postgres.js (`getSql`), Supabase
  Realtime broadcast (`src/lib/server/psyco/realtime.ts`, `src/lib/server/giramente/realtime.ts`), auth Supabase
  (`getHostUser()` in `src/lib/server/gioco-libero.ts`, login `/accedi?next=`), proxy `src/proxy.ts`, deploy Vercel
  (push su `main`), migrazioni applicate in produzione dal proprietario con `npm run deploy:migrate`.
- Modello di gioco a stanze da imitare: **GIRAMENTE!** (`src/lib/giramente`, `src/lib/server/giramente/*`:
  engine con `for update`, stato pubblico + viste private, scadenze avanzate a ogni lettura, score log, rate limit,
  realtime; `src/features/giramente/*`: game shell 3D, menu da videogioco, studio 3D `three/studio/*`, audio/director,
  intro) e PSYCO (QR/display key, viste private).
- Condivisi riusabili: `src/features/shared/keyboard.ts`, `src/features/shared/device.ts`, `ExitButton`,
  `LoadingSplash`, `AudioExitGuard`, `audio-engine.ts` (sfx, temi, `playVoiceClip`, `stopVoices`), TTS ElevenLabs
  con cache (voci in `.env.local`, mai nel client), GLB host `src/features/three/characters/glb-host.tsx`,
  catalogo home `src/features/home/games.ts` + `HeroCarousel.tsx`, admin `src/app/admin`.
- Personaggi con modello 3D (REFERENCE, mai modificare gli originali; nel sito copie ottimizzate in `public/`):
  nel sito: `professore`, `regina`, `palmino`, `investigatore`, GIRAMENTE `dontralla` (Don Patrizio), `zafira`;
  solo in `REFERENCE/MODELLI-3D/*_PARLANTE.glb` (5 clip: Idle_3, Walking, Running, Talk_Passionately,
  Talk_with_Hands_Open; morph jawOpen/mouthO/mouthE/blink/browsUp): NEK, CICCIO, FRANCA, PIROETTO (Piroletto),
  MINU, CHICCA, BUMBARU (+ BUMBARINO nella pancia, vedi `REFERENCE/MODELLI-3D/LEGGIMI.md`), MORDICCHIO (spostato 12 cm),
  MAMMUSSS (due bocche: `snakeOpen`), RUMPO. Senza modello: Nonno Totò, ZIP, Lola, PIXIE, Pina Piumino, Croc, Trizzy, VOLTIX.

## 3. Decisioni V1
- Nome tecnico `tig`. Rotte: `/tavoli-in-guerra` (shell 3D + menu: CREA SERATA, ENTRA, REGOLAMENTO, RIPRENDI),
  `/tavoli-in-guerra/t/[token]` (QR del tavolo), `/tavoli-in-guerra/entra` (codice squadra), `/tavoli-in-guerra/gioca/[eventId]`
  (player telefono/PC), `/tavoli-in-guerra/tv/[key]` (TV, chiave schermo; `?live=1` senza codici), `/tavoli-in-guerra/regia/[eventId]`
  (organizzatore = account che crea la serata; nessun ruolo admin di piattaforma richiesto). API sotto `/api/tig/*`.
  Moduli: `src/lib/tig/*` (tipi, regole pure, catalogo), `src/lib/server/tig/*`, `src/features/tig/*`, `src/app/tavoli-in-guerra/*`.
- Account obbligatorio per i giocatori (regola della piattaforma); un telefono può rappresentare tutto il tavolo.
- Stato evento: DRAFT → LOBBY_OPEN → LOBBY_LOCKED → INTRO → ROUND_INTRO → GAME_ACTIVE → GAME_RESULTS → (LEADERBOARD) →
  … → BREAK → … → FINAL → AWARDS → COMPLETED; PAUSED (sospende le scadenze) e CANCELLED trasversali. Sequenza
  (`version`) a ogni modifica; snapshot completo a ogni lettura; ogni client allinea l'orologio al server.
- Punti: ledger `tig_score_ledger` (motivo, fonte, riferimento, `idempotency_key` UNICA), saldo mai < 0, standard 100,
  bonus velocità max 20, indizi 100/70/40, duelli +40/+50, trasferimenti ≤ 40, perdite da azioni altrui ≤ 80 per manche,
  max 2 attacchi sullo stesso tavolo in 10', scudo non cumulabile che scade a fine manche, Caos 1/serata, puntata
  finale ≤ min(25% saldo, 250), scelta finale 100/240. Parità: sfide vinte → precisione → spareggio identico 45".
- Nomi squadra: scritti dagli utenti, filtrati (lista parole + lunghezza) e approvati dallo staff; **la voce non li
  pronuncia mai**: le battute usano `{TAVOLO_A}` («il tavolo 3») e `{MASCOTTE_A}` (nome della mascotte, curato).
- Energia Caos: si guadagna partecipando (invio puntuale), con esiti, con sfide accettate; soglie Livello 2 e 3
  configurabili; nessun effetto sui punti.
- 3D: una sola scena «arena» persistente per pagina (TV, player, shell), qualità high/low/2d come GIRAMENTE,
  telecamera regista per fase, HUD sopra. Mascotte: 12 slot con segnaposto 3D dichiaratamente provvisori
  («MASCOTTE IN ARRIVO»), evoluzione con materiali/accessori/effetti finché non arrivano le varianti GLB.
  Presentatori in scena: personaggi esistenti (ruoli dal PDF: Professor Smoke apre e lampo; Victor deduzioni/inganno;
  Zafira bonus/rischi; Don Patrizio finale/classifica; Regina raccordo) — le corrispondenze nome↔modello
  «Professor Smoke = il Professore» e «Victor = l'Investigatore» sono DA CONFERMARE col proprietario.
- MVP di questa iterazione (fasi A+B del PDF + 3D + voci): fondamenta complete, motore minigiochi estendibile,
  catalogo 80 voci con stato reale, ~20 meccaniche implementate e testate da 6–8 componenti base, arena 3D,
  infrastruttura mascotte, Bottone del Caos, libreria vocale dei personaggi esistenti. Fasi C/D (bilanciamento
  avanzato, 80 meccaniche, migliaia di varianti, mascotte reali) in seguito.

## 4. Contratti condivisi (file in questo ramo: non cambiarne la forma senza accordo)
- `src/lib/tig/games/contract.ts` — interfaccia delle meccaniche (server autoritativo, scoring puro).
- `src/lib/tig/voices/schema.ts` — formato del catalogo vocale (categorie, variabili, personaggi).
- `src/features/tig/arena-contract.ts` — props della scena 3D (arena, mascotte, presentatori).

## 5. Lavori paralleli
1. CORE (feat/tig-core): DB `tig_*`, eventi/tavoli/QR/squadre/membri/capitano/convalida, stato e scaletta, timer,
   pausa, ledger e limiti, Energia Caos, voto mascotte, Bottone del Caos, realtime, regia, player, TV (con l'arena),
   runtime delle meccaniche, integrazione piattaforma (catalogo home, proxy, splash, audio guard).
2. GIOCHI (feat/tig-giochi): catalogo 80 meccaniche + ~20 implementate con contenuti adulti verificati, UI player/TV
   per ciascuna, test di scoring.
3. 3D (feat/tig-3d): arena 3D, segnaposto e sistema evoluzione mascotte, presentatori in scena, nuovi personaggi
   ottimizzati da REFERENCE.
4. VOCI: catalogo JSON per personaggio → TXT completo + PERSONAGGI.md (generati da script).
