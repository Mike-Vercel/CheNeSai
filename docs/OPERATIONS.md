# Operatività

## 1. Ambienti

| Ambiente | Dove | Database |
|---|---|---|
| Sviluppo | `npm run dev` | Supabase locale (`npm run db:start`) |
| Staging | Vercel *Preview* (ogni branch) | progetto Supabase separato "quizzone-staging" |
| Produzione | Vercel *Production* + dominio | progetto Supabase "quizzone-prod" (piano Pro consigliato: backup giornalieri, PITR) |

Ogni ambiente ha le proprie variabili (`.env.example`). Le migrazioni si applicano prima allo staging:

```bash
npx supabase link --project-ref <ref-staging>
npx supabase db push            # applica supabase/migrations/*
npx supabase link --project-ref <ref-produzione>
npx supabase db push
```

Credenziali necessarie (non incluse nel repository): account Vercel, account Supabase, password del database, dominio.

## 2. Primo avvio in produzione

1. `db push` delle migrazioni.
2. Crea il super admin puntando al progetto (in un terminale con le variabili di produzione):
   `npm run admin:create -- tua@email.it "PasswordMoltoLunga!" "Nome" super_admin`
3. Da *Impostazioni* crea gli altri admin/operatori e assegna agli operatori le serate.
4. Verifica `https://<dominio>/api/health` → `{"status":"ok"}`.

## 3. La settimana tipo

| Giorno | Attività | Dove |
|---|---|---|
| Martedì | Crea la serata (o **duplica** quella precedente), aggiungi round, domande, media, eventi, categorie votabili | Serate, Domande, Media |
| Mercoledì | Revisione: conferma le risposte importate, anteprima TV/telefono | Domande → anteprima |
| Giovedì | **Verifica e pubblica** → **Prova generale** (regia + TV + telefoni simulati, bot, audio, intro) → *Reset simulazione* | Sessione → Prova generale |
| Venerdì | Apri lobby, intro, gioco, finale, podio | Regia live |
| Dopo | Statistiche, classifica mensile, archiviazione, backup | Statistiche, Classifiche |

Per la prova generale si consiglia una **copia di prova** della serata (Duplica → "Prova generale"): le sessioni di prova non entrano nelle classifiche.

## 4. Serata: checklist tecnica

- TV: browser Chrome/Edge a schermo intero, apri il link "Schermo TV" dalla regia, premi **ATTIVA AUDIO E AVVIA SCHERMO** (necessario per l'audio), collega l'uscita audio all'impianto.
- Doppio clic sul TV: volume musica/effetti, muto, movimento ridotto, prestazioni ridotte.
- In regia: **Prova volume sul TV** prima di aprire la lobby.
- Wi-Fi del pub: i telefoni devono raggiungere Internet; il sistema tollera disconnessioni brevi (riconnessione automatica, recupero dello stato).
- Se il TV o la regia si ricaricano, riprendono lo stato corrente dal server.
- Manche musicale: il TV riproduce l'estratto alla comparsa della domanda; dalla regia **Riproduci sul TV** / **Stop**. Se il browser blocca l'audio, usare il pulsante in regia o riprodurre manualmente dall'impianto (fallback).

## 4-bis. Voci ElevenLabs: prepararle prima della serata

Facoltativo (serve `ELEVENLABS_API_KEY`); senza, il TV usa la voce gratuita del browser.

1. **Una volta sola**: admin → **Voci**. Assegna una voce a Professore, Regina, Palmino e Annunciatore (lista delle voci dell'account con ricerca e anteprima gratuita ▶), regola stabilità/somiglianza/stile/velocità, premi **Prova** (frase breve, ~50 caratteri, poi resta in cache) e **Salva voci**. Nel riquadro **Frasi generiche** premi **Prepara voci**: battute a rotazione, "Domanda numero 1…60", lobby, voto, pausa, finale ed eventi (155 battute comiche con audio tag, ~7 150 caratteri ≈ 1 560 crediti con Eleven v4, valgono per sempre). Con Eleven v4 contano solo **stabilità** (Creativa / Naturale / Robusta: più bassa = più teatrale) e **somiglianza**; stile e velocità valgono solo per i modelli v2/flash.
2. **Per ogni serata**, dopo aver composto domande e riserve: nella pagina della serata riquadro **Voci della serata: 38/40 pronte · stima X caratteri** → **Prepara voci** (viene proposto anche subito dopo la pubblicazione). Conferma la stima: le voci si generano a piccoli lotti con la barra di avanzamento (si può interrompere e riprendere: si ripaga solo ciò che manca). In alternativa, dall'archivio **Domande** → **Genera voci** sulle domande selezionate o su tutte le approvate del filtro.
3. Il giorno della serata il riquadro deve mostrare tutte le battute pronte. Le battute con i nickname (in testa, classifica, podio) si generano dal vivo con il modello veloce: il server le prepara subito dopo il comando di regia, così di solito il TV le trova già pronte.

**Quanto costa** (si paga una volta sola: ogni battuta resta nel bucket `tts` e vale in tutte le serate). Le stime del pannello sono in **caratteri di testo** (prudenziali); l'app registra i **crediti effettivi** dichiarati da ElevenLabs (`character-cost` per Eleven v4). Misurato a novembre 2026 con `eleven_v4`: circa **0,22 crediti per carattere** (7 149 caratteri di frasi generiche → 1 564 crediti).

| Voce | Caratteri di testo | Crediti v4 (circa) |
|---|---|---|
| Una domanda (testo + lettura risposte + rivelazione) | ~200 (da 120 a 300) | ~45 |
| Serata tipo da 30 domande + 5 riserve + round ed eventi | ~7 000 la prima volta, quasi 0 se le domande sono già state usate | ~1 500 |
| Frasi generiche (una tantum, 155 battute) | ~7 150 | ~1 560 |
| Battute live di una serata (punteggio, classifiche, podio) | ~1 500–3 000 | ~300–700 |
| Prova di una voce | ~70–95 | ~15–20 |

- Il **budget mensile dell'app** (predefinito 50 000 caratteri, in Voci) blocca nuove generazioni quando è superato: le clip già pronte continuano a suonare, il resto usa la voce del browser. La pagina Voci mostra anche l'uso dell'abbonamento ElevenLabs (usati / limite / rinnovo).
- Cambiare voce o modello rende necessarie nuove clip (la chiave include voce e modello): rilancia **Prepara voci**. Cambiare solo le regolazioni (stabilità, stile…) vale per le battute generate da quel momento; quelle già in archivio restano come sono.
- Un solo PC TV per serata: le clip sono servite con URL firmati temporanei, la chiave API non lascia mai il server.

## 4-ter. Scorrimento: manuale o automatico

Ogni serata ha l'impostazione **Scorrimento** (alla creazione e in *Regole della serata*):

- **Manuale** (predefinito, come sempre): la regia preme ogni passo.
- **Automatico**: la serata va da sola con la stessa sequenza di pulsanti della regia —
  INIZIA ROUND → (AVVIA/CHIUDI VOTAZIONE o GIRA LA RUOTA) → MOSTRA DOMANDA → MOSTRA RISPOSTE → timer intero →
  RIVELA SOLUZIONE → ASSEGNA PUNTEGGI → domanda successiva … → MOSTRA CLASSIFICA a fine round → round successivo … →
  TERMINA PARTITA (podio). Ogni passo parte quando il presentatore ha finito di parlare sul TV (durata vera delle
  clip ElevenLabs già in archivio, altrimenti una stima prudente dal testo) più una pausa di respiro; l'intro con le
  regole dura ~1 min 45 s, l'audio delle manche musicali e i video vengono aspettati, nella manche *Scommetti tutto*
  ci sono 10 s in più per puntare.

In regia il riquadro **Scorrimento della serata** mostra lo stato ("AUTOMATICO — prossimo passo tra 7 s: Mostra risposte")
e il selettore **Manuale / Automatico**, che si può cambiare in qualsiasi momento (il valore in diretta vive nello
stato di gioco: l'impostazione della serata pubblicata resta quella di partenza).

- Anche in automatico **la regia vince sempre**: ogni pulsante funziona e il piano riparte dalla nuova fase.
- **PAUSA** ferma l'automatico finché non premi RIPRENDI; passare a **Manuale** annulla il passo in programma.
- L'automatico parte quando la regia avvia la serata (AVVIA INTRO o INIZIA ROUND): la lobby resta aperta finché
  non decidi tu. Si ferma e mostra "In attesa della regia: …" quando serve una decisione umana (es. parità nella
  votazione con *Decide la regia*, o un passo rifiutato dal motore).
- Non c'è nessun processo sul server (Vercel): a far scattare i passi sono il **TV** e la **regia** aperti, che chiamano
  `/tick` quando è l'ora; il server esegue il passo solo se è davvero dovuto, una volta sola anche con più schermi.
  Se TV e regia sono entrambi chiusi la serata resta ferma finché uno dei due non si riapre.

## 5. Backup e ripristino

- **Automatico**: backup giornalieri Supabase (piano Pro) + Point-in-Time Recovery (opzionale).
- **Per serata**: in regia/sessione → *Backup JSON* (`GET /api/admin/sessions/<id>/backup`).
- **Logico completo**: `npm run db:backup` → `backups/quizzone-<data>.json`.
- **Dump SQL**: `npx supabase db dump --db-url "$DATABASE_URL" -f schema.sql` e `--data-only -f data.sql`.

Ripristino:
1. Ripristino completo: dal pannello Supabase (Database → Backups → Restore) oppure `psql "$DATABASE_URL" -f data.sql` su un database con lo schema applicato (`db push`).
2. Le tabelle `score_events`, `game_events`, `admin_audit_logs` sono append-only: per un ripristino manuale eseguire nella stessa transazione `set local qz.allow_reset = 'on';`.
3. Dopo il ripristino verificare `/api/health` e aprire la regia della serata.

## 6. Monitoraggio

- `/api/health`: database raggiungibile e latenza.
- Log di Vercel (errori server) e Supabase (Database, Realtime).
- In regia: avvisi tecnici (giocatori offline, anomalie, audio, ingressi bloccati).
- *Registro attività*: ogni comando e modifica con autore e orario.

## 7. Modelli 3D riggati (facoltativo, opzione B)

L'intro funziona con i personaggi 2.5D ricavati dalle illustrazioni ufficiali. Per personaggi completamente tridimensionali servono file **GLB** realizzati da un modellatore 3D:
- glTF 2.0, asse Y in alto, metri, fronte verso +Z, origine ai piedi (o al taglio vita per i presentatori);
- scheletro con skinning, < 40k triangoli, texture ≤ 2048 px;
- clip: `IDLE` (obbligatoria), `INTRO`, `TALK`, `WAVE`, `CELEBRATE`, `SURPRISED`.
Copiare i file in `public/models/` e impostare `NEXT_PUBLIC_QZ_GLB_PROFESSORE`, `…_REGINA`, `…_PALMINO`.
