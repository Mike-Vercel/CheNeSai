# Architettura

## Principi

1. **Server-authoritative.** Il server decide fasi, tempi, validità delle risposte e punteggi. I client mostrano soltanto.
2. **PostgreSQL è la fonte di verità.** Nessuno stato ufficiale vive nella memoria di una Vercel Function; ogni richiesta può essere servita da un'istanza diversa.
3. **Nessun processo sempre attivo.** I timer non "girano" sul server: si salva l'istante di chiusura (`answers_close_at`, orologio del DB) e ogni risposta viene confrontata con esso.
4. **Realtime trasporta, non decide.** Lo stato viene pubblicato con `realtime.send()` **dentro** la stessa transazione che lo modifica: se la transazione fallisce, nessun messaggio parte. Un client che perde messaggi recupera lo snapshot via HTTP.

## Moduli

```
src/
  lib/game-engine/      regole pure, senza dipendenze (testate con Vitest)
    types.ts            fasi, comandi, payload pubblici
    transitions.ts      macchina a stati (tabella comandi per fase)
    scoring.ts          regole effettive, valutazione risposte, punti
    ranking.ts          classifica deterministica, aggregazioni mensili/stagionali
    voting.ts           conteggio voti e spareggi
    nickname.ts         normalizzazione e filtro
  lib/server/           backend (solo server)
    engine.ts           esecuzione comandi di regia (transazioni, idempotenza, audit, broadcast)
    public-state.ts     snapshot pubblico (mai soluzioni prima della rivelazione)
    players.ts          ingresso, autenticazione giocatore, risposte, voti, stato personale
    admin-live.ts       stato completo per la regia
    cms/*               sessioni, domande, media, impostazioni, statistiche
  lib/realtime/         client: snapshot + canale privato + ordinamento per versione + clock sync
  features/display      schermo TV
  features/players      smartphone
  features/admin        regia e CMS
  features/three        intro 3D (React Three Fiber) + fallback 2D
  features/media        motore audio (effetti originali sintetizzati)
supabase/migrations     schema versionato
```

## Macchina a stati

```
DRAFT → READY → LOBBY → INTRO → ROUND_INTRO ─┬→ QUESTION_VISIBLE → OPTIONS_VISIBLE → ANSWERS_LOCKED → ANSWER_REVEAL → SCORE_REVEAL → LEADERBOARD
                                              ├→ CATEGORY_VOTING → CATEGORY_RESULT → QUESTION_VISIBLE …
                                              └→ SPECIAL_EVENT → QUESTION_VISIBLE …
qualsiasi fase attiva ⇄ PAUSED            qualsiasi fase → FINISHED
```

La tabella completa è in `src/lib/game-engine/transitions.ts` ed è applicata dal backend (`INVALID_TRANSITION`) e usata dalla regia per abilitare i pulsanti e suggerire la prossima azione.

Garanzie di ogni comando (`executeCommand`):
- `SELECT … FOR UPDATE` sullo stato della sessione (serializzazione);
- **idempotenza**: `commandId` univoco per comando (`game_events.unique(session_id, command_id)`), un doppio invio restituisce lo stato senza rieseguire;
- **versione attesa** (`expectedVersion`): un doppio clic con stato vecchio riceve `VERSION_CONFLICT`;
- versione incrementata, evento nel log `game_events`, riga in `admin_audit_logs`, broadcast.

Le risposte usano `FOR SHARE` sullo stato: non possono "scavalcare" una chiusura o una rivelazione concorrente.

### Scorrimento automatico

- Decisione pura in `src/lib/game-engine/autoplay.ts` (`planAutoplay`): prossimo comando (lo stesso suggerito alla regia) e
  istante in cui è dovuto (inizio fase + battute del TV + respiro, oppure scadenza di timer/voto/ruota).
- Dopo **ogni** comando, nella stessa transazione, `src/lib/server/autoplay.ts` scrive il piano in `game_state`
  (`auto_next_at`, `auto_command`, `auto_version`, `auto_waiting`; `auto_mode` = scelta live della regia, null = impostazione
  della serata `settings.advanceMode`). La durata delle battute viene dallo stesso copione del TV (`speechFor`) e dalla
  dimensione delle clip in `tts_clips` (16 byte/ms), con stima dal testo se la clip manca.
- Lo stato pubblico contiene solo `auto: { nextAt, version }`. TV e regia chiamano `POST /api/display/:id/tick?k=…` /
  `POST /api/admin/sessions/:id/tick` all'orario; `autoTick` controlla senza lock, poi esegue il comando con lo stesso
  `executeCommand` (lock `FOR UPDATE`, verifica ripetuta sotto lock: automatico attivo, stessa versione, stesso comando,
  orario passato) e un `commandId` deterministico per (sessione, versione): più client insieme → un solo passo.
- Errori del passo (es. `TIE_NEEDS_ADMIN`) fermano l'automatico con un motivo mostrato in regia.

### Ruota di Palmino

Ogni tanto, fra una domanda e l'altra, Palmino gira una ruota che sceglie la categoria della domanda
successiva (partite libere: sempre; serate della regia: opzione «Ruota di Palmino» nelle regole, spenta di default).

- **Piano** (puro, `src/lib/game-engine/palmino-wheel.ts`, seme = id della serata): mai prima della 5ª domanda,
  mai sulla prima di un round né sull'ultima della serata, al massimo una per round e 2 per serata (3 da 20
  domande), mai due di fila, ~25% per domanda ammessa, solo nei round normali.
- **Alla pubblicazione** (`publishSessionTx` → `planPalminoWheelsTx`, serata ancora in bozza): per ogni posto
  6–8 categorie con UNA domanda candidata ciascuna, scelta con le regole del compositore (prima le mai viste da
  questo host / mai giocate, fascia di difficoltà del segnaposto), inserite nel round come riserve
  `wheel_candidate`. Così hanno la loro copia congelata come tutte le altre: dopo la pubblicazione non si
  inserisce mai nulla (il blocco `SESSION_FROZEN` vieta INSERT/DELETE di domande e round). Piano in
  `game_rounds.palmino_wheel`.
- **Giro** (comando MOSTRA DOMANDA dopo i punti, sotto il lucchetto della partita): se la prossima domanda è il
  segnaposto, il server estrae lo spicchio (casualità crittografica), salva il giro in `wheel_spun_at`/`wheel_spin`
  del round (come la Ruota impazzita, con 4,2 s di anticipo per l'arrivo di Palmino) e SCAMBIA posizione e
  "riserva" fra vincente e segnaposto (UPDATE, consentito). Fase `WHEEL_SPIN` con `wheel.kind = "palmino"`;
  il MOSTRA DOMANDA successivo mostra la domanda scelta come una qualunque: numerazione, conteggi, registro
  `question_plays` (anche per l'host) dal trigger su `shown_at`. Le candidate perdenti restano riserve mai giocate.
- Azzeramento della prova, copia della serata, annullamento della pubblicazione e domanda misteriosa
  conoscono le candidate (`resetPalminoWheelsTx`, `clearPalminoWheelsTx`, filtri `wheel_candidate`).
- Show: `TvPalminoWheel.tsx` (TV 16:9 e verticale): Palmino arriva e dà il colpo (clip 3D `spin`, salto in 2D)
  `PALMINO_SWING_CONTACT_MS` prima della partenza; la ruota usa `useWheelRotor` (tic, frenata, "Tocca a… X!",
  frase fissa per categoria preparata con le voci della serata). Il TV dice "ho finito" (`/spoken`) solo a
  ruota ferma e battuta detta. Anteprima: `/preview/ruota-palmino`.

## Tempo

- `answers_close_at = clock_timestamp() + durata` calcolato dal DB all'apertura.
- Ogni risposta è accettata solo se `clock_timestamp() <= answers_close_at + tolleranza` (impostazione `answerGraceMs`, default 300 ms per la latenza di rete) e la fase è `OPTIONS_VISIBLE`.
- I client stimano lo scarto d'orologio (campione con RTT minimo, stile NTP) e mostrano il countdown sull'ora del server.
- Pausa/ripresa conservano il tempo residuo.

## Punteggi

Regole effettive = snapshot congelato alla pubblicazione (domanda → round → sessione → globale) × moltiplicatori del round × eventi annunciati. Vengono **congelate all'apertura delle risposte** (`session_questions.rules`) e usate per il calcolo: un evento non può cambiare le regole dopo l'apertura.

Ogni giocatore produce un `score_events` per domanda (punti prima, variazione, punti dopo, motivo, dettagli) — tabella append-only (trigger). La classifica è deterministica: punti → risposte corrette → tempo totale sulle corrette → ingresso → nickname.

## Sicurezza

| Minaccia | Contromisura |
|---|---|
| Vedere la soluzione in anticipo | lo snapshot pubblico include `correctPositions` solo dopo `REVEAL`; nessuna soluzione nei bundle o nel DOM; domande future mai inviate |
| Leggere il DB dal browser | RLS attiva su tutte le tabelle, nessuna policy per `anon`; i client non interrogano mai PostgREST |
| Messaggi realtime falsi | canali **privati**: RLS su `realtime.messages` consente solo la ricezione (verificato da test) |
| Rispondere per un altro / modificare risposte | token casuale 256 bit in cookie httpOnly, hash SHA-256 nel DB; vincolo `unique(domanda, giocatore)` |
| Risposte tardive, doppie, replay | controllo orario lato DB, idempotenza per `requestId`, log in `security_events` |
| Comandi admin dai giocatori | ogni endpoint admin verifica la sessione Supabase Auth + ruolo (`requireAdmin`); operatori limitati alle sessioni assegnate |
| Abusi | rate limit condiviso nel DB (`qz_rate_limit`) su ingressi, risposte, voti |
| Media | bucket privato, URL firmati a scadenza, percorsi opachi (uuid), audio mai inviato ai telefoni, immagini solo quando la domanda è visibile |

### Perché i giocatori non usano Supabase Anonymous Auth
Supabase limita gli accessi anonimi a 30/ora **per IP**; in un pub tutti i telefoni condividono l'IP della Wi-Fi. Per questo il giocatore riceve un token proprio, validato dal backend.

### Limiti dichiarati (anti multi-account)
Senza un'autenticazione forte (telefono/documento) **non è possibile impedire in modo assoluto** che una persona usi più dispositivi o più browser. Il sistema riduce il fenomeno (un partecipante per identità-dispositivo, nickname univoci normalizzati, espulsione dalla regia, log anomalie) ma non lo elimina.

## Identità persistente
Al primo ingresso il dispositivo riceve un'identità (cookie httpOnly di lunga durata) e un **codice giocatore** `QZ-XXXX-XXXX` (mostrato una volta, salvato sul telefono) per recuperarla su un nuovo telefono. Le classifiche mensili e stagionali aggregano per identità, non per nickname. I giocatori occasionali non devono fare nulla.

## Intro 3D
`features/three`: studio virtuale R3F (palco, archi di lampadine instanziati, spotlight volumetrici, LED wall, bancone, palme procedurali, particelle) con i tre personaggi **2.5D** dalle immagini ufficiali. La timeline dipende solo da `now() - startedAt` (orario server): un TV che ricarica riprende dal punto giusto; "salta intro" porta al fotogramma finale. Fallback 2D automatico se WebGL manca o si perde il contesto.

Opzione B (personaggi 3D riggati): `features/three/characters/glb-character.tsx` carica GLB con clip IDLE/INTRO/TALK/WAVE/CELEBRATE/SURPRISED quando si impostano `NEXT_PUBLIC_QZ_GLB_*`. **I modelli GLB non sono inclusi**: vanno realizzati da un modellatore 3D partendo dalle illustrazioni (vedi `docs/OPERATIONS.md`).
