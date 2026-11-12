# PSYCO dentro CHE NE SAI?!

«Tutti conoscono la regola. Tranne te.» Brief completo: [BRIEF.md](BRIEF.md). Voce narrante: [VOCI.md](VOCI.md). Limiti reali e prove con 50/100 giocatori: [LIMITI.md](LIMITI.md).

## Rotte

| Rotta | Chi | Cosa |
|---|---|---|
| `/psyco` | tutti | home del gioco: CREA PARTITA, ENTRA IN PARTITA, UN SOLO DISPOSITIVO, COME SI GIOCA, «Riprendi» |
| `/psyco/come-si-gioca` | tutti | regole |
| `/psyco/nuova?modo=personale\|condiviso` | account | creazione (senza account → `/accedi?next=…` e ritorno qui). Da PC la scelta predefinita è **Schermo + telefoni** |
| `/psyco/entra` | tutti | si scrive il codice |
| `/psyco/entra/[CODICE]` | account | link del QR/invito: senza account → login/registrazione → ritorno QUI |
| `/psyco/stanza/[id]` | account partecipante o host | partita sul proprio dispositivo |
| `/psyco/un-dispositivo/[id]` | solo il proprietario | partita su un solo dispositivo |
| `/psyco/schermo/[chiave]` | nessun account | schermo pubblico TV/PC (chiave casuale di 32 caratteri); se lo guarda l'host autenticato compaiono i comandi che non rivelano nulla |
| `/psyco/schermo/apri/[id]` | host | riapre lo schermo pubblico della stanza (da «Riprendi» sul PC) |
| `/tv` (esistente) | TV | codice di 4 cifre: l'host lo scrive nel pannello «Schermo per tutti» → il TV apre lo schermo PSYCO |
| `/admin/psyco` | admin | archivio regole: attiva/disattiva, modifica, aggiungi |

API (`src/app/api/psyco/…`): `POST/GET rooms`, `GET rooms/[id]?as=`, `POST rooms/[id]/action`, `GET rooms/[id]/schermo` (chiave dello schermo, solo host), `POST rooms/[id]/tv` (abbinamento /tv), `GET/POST join`, `GET schermo/[key]`, `GET/POST schermo/[key]/comandi` (sì/no «sei l'host?» e comandi dello schermo, risposta SOLO pubblica); admin: `GET/POST /api/admin/psyco/rules`, `PATCH /api/admin/psyco/rules/[id]` (anche i 3 indizi). Cron esistente `api/cron/chiudi-partite` esteso: chiude anche le stanze PSYCO senza attività da 24 h.

## Da PC: «Schermo + telefoni» (migrazione `20261112170000_psyco_pc_aiuto.sql`)

- `/psyco/nuova` riconosce il dispositivo (`useDeviceKind`, la stessa regola di `/gioca`): da **PC** propone **SCHERMO + TELEFONI** (consigliata, predefinita); «Gioco da questo PC» e «Un solo dispositivo» (tablet/portatile che passa di mano) restano sotto «Altri modi di giocare». Dal telefono tutto come prima.
- Schermo + telefoni = stanza `personal` con `screen_mode = true`; l'host ha un posto da giocatore (se «Gioco anch'io») ma il PC **va allo schermo pubblico** (`/psyco/schermo/[chiave]`), mai alla stanza: riceve solo lo stato pubblico, come un televisore. L'host inquadra il QR col telefono con lo stesso account → `joinRoom` lo riconosce (già dentro) → stanza da host (avvio, impostazioni, pausa, chiusura votazioni, PSYCO a scelta).
- Comandi sul PC (`screenControl` / `runScreenAction` in `rooms.ts`): solo se l'account del PC è l'host, solo `start_game`, `start_round`, `pause`, `resume`, `next_round`, ricostruiti dal server senza altri campi (niente `psycoId`, niente impostazioni); la risposta è `getDisplayState` (pubblico). Con lo PSYCO scelto a mano lo schermo dice «Scegli lo PSYCO dal tuo telefono». Più: schermo intero, audio, «Esci» (la partita continua).
- Se l'host apre la stanza su un computer, un avviso propone di aprire lo schermo pubblico; «Riprendi» nella home ha «📺 Schermo» per queste partite.
- Un solo dispositivo su PC/portatile: «TOCCA A MIKE — gli altri non guardino lo schermo» (mai «PASSA IL TELEFONO»), voce `tocca-al-prossimo`.

## «CHIAMA L'INVESTIGATORE» (aiuto per lo PSYCO)

- Impostazione `settings.calls` 0–3 (predefinita 2; assente nelle stanze vecchie = 2), scelta alla creazione e tra le manche. Copiata in `psyco_rounds.calls_max` all'inizio della manche; `calls_used` conta le chiamate.
- Azione `call_investigator { requestId }`: solo il partecipante PSYCO della manche (nel dispositivo condiviso: il proprietario «come» lo PSYCO, `as`), solo in PLAYING dopo il via e non in pausa (mai durante la verifica), entro il limite (`NO_CALLS_LEFT`). Idempotente: stesso `requestId` = nessun consumo (`psyco_calls` unique per manche). **RIFIUTA non chiama il server**: la suoneria è locale, si consuma solo rispondendo.
- Livello = numero della chiamata (1 → 3), `pickHint` in `src/lib/psyco/hints.ts`: regola d'archivio → `psyco_rules.hint_1/2/3`; regola libera → chiamata 1 = indizio del gruppo (`psyco_candidates.hint` della proposta vincente, copiato in `psyco_rounds.rule_hint`), poi indizi generici della categoria (`rule_category`), in ultima istanza «Altro». Registro in `psyco_calls` (numero, livello, origine, testo, istante): pronto per i punteggi futuri.
- Segreti: l'indizio esce SOLO in `buildPrivateView` → `view.investigator.messages` del partecipante PSYCO (PLAYING, GUESS_VOTE, ROUND_END). Stato pubblico/realtime: solo `round.calls {max, used, lastAt}` e l'evento `investigator_call {no, max}`; `secretRev` non cambia (gli altri non rileggono nulla). Categoria e indizio delle proposte: solo a chi conosce la regola, mai pubblici, mai nell'archivio.
- Esperienza (`InvestigatorCall.tsx`): chiamata in arrivo a tutto schermo (suoneria, vibrazione, RISPONDI/RIFIUTA, persa dopo 30 s o se la manche non è più in gioco) → voce con sottotitolo → «riattacca» → «sta scrivendo…» → messaggio con l'indizio (notifica) → «📩 Messaggi» per tutta la manche. TV e altri telefoni: «📞 Lo PSYCO ha chiamato l'investigatore! (1/2)» + squillo breve; chip «📞 1/2» durante la manche.
- **Il timer non si ferma** durante la chiamata: chiamare costa tempo (scelta di gioco: altrimenti l'aiuto sarebbe gratis e allungherebbe le manche; con un tempo stretto lo PSYCO deve decidere se gli conviene).

## Account e dispositivi

- **Stesso login del sito** (Supabase Auth, email/password e Google, sessione lunga): `requirePsycoUser()` verifica la sessione col server Auth a ogni richiesta. Nessun secondo sistema di login.
- **Dispositivi personali**: ogni partecipante = `psyco_participants.kind='account'` con `user_id`; indice unico `(room_id, user_id)` → un account, un posto (rientrare dallo stesso account riprende lo stesso posto).
- **Un solo dispositivo**: partecipanti `kind='local'` (solo nickname, `user_id` nullo, `owner_user_id` = chi ha creato). La stanza rifiuta ingressi da altri dispositivi (`SHARED_ROOM`). L'eccezione vale solo qui: il proprietario agisce «come» un giocatore locale con `as=<id>`, verificato dal server (stanza condivisa + partecipante locale della stanza).
- **Schermo TV/PC**: non è un partecipante, nessuna riga nel database; legge solo lo stato pubblico con la chiave.

## Macchina a stati (server)

`LOBBY → ROLE_REVEAL → (automatica) DIFFICULTY_VOTE → RULE_VOTE ↺ | (libera) RULE_PROPOSALS → PROPOSAL_VOTE (spareggio, poi sorteggio) → RULE_CONFIRMED → PLAYING ⇄ GUESS_VOTE → ROUND_END → ROLE_REVEAL …`

- Ogni azione è una transazione con lucchetto sulla stanza (`FOR UPDATE`, `lock_timeout` 4 s, `statement_timeout` 10 s), solo `tx` dentro la transazione (mai il pool), versione +1, stato pubblico inviato in realtime **dentro** la transazione. Errori di lucchetto → `BUSY` (503), il client ritenta.
- Votazioni: un voto per partecipante e votazione (chiave primaria); si può cambiare finché è aperta. Sì/no: maggioranza degli aventi diritto (decisione anticipata quando è certa). Parità sulla regola dell'archivio = un'altra regola; parità sulle proposte = spareggio, poi sorteggio trasparente; parità sul tentativo = si rivota una volta, poi vale «no». L'host può sempre chiudere una votazione o continuare senza aspettare chi è offline: la partita non si blocca mai.
- Timer: `started_at` (dopo un conto alla rovescia di 3,5 s che non consuma il tempo), `paused_at`, `paused_ms`; tutti i client calcolano dal riferimento del server (`serverNow` + stima NTP). La scadenza è controllata dal server a ogni azione/lettura (anche dallo schermo).
- Rotazione: prima chi è stato PSYCO meno volte, poi chi da più tempo, poi a caso. Oppure scelta manuale dell'host.
- Uscite: l'host che esce passa la gestione al giocatore con account entrato prima; se l'host non risponde da 60 s un giocatore può «prendere la gestione». Lo PSYCO che esce chiude la manche (`psyco_left`). Chi entra a manche iniziata gioca dalla successiva.

## Sicurezza (segreti)

- `buildPublicState` non legge mai testo della regola/proposte finché la manche non è finita; lo stato pubblico va a tutti (telefoni, TV, realtime).
- Durante la rivelazione dei ruoli neanche CHI è lo PSYCO è pubblico (`psycoId` nullo, conteggi corretti): lo sa solo chi è nella manche, dalla propria vista privata. Dopo, il nome è pubblico (serve: «Mike, non guardare!»).
- `buildPrivateView` dà la regola, il candidato e le proposte SOLO a chi ha ruolo `knower` nella manche (doppio controllo: mai al partecipante PSYCO).
- Realtime: topic privato `qz:game:psyco-<id>` (policy RLS esistente: i client ricevono soltanto) con il solo stato pubblico; quando `secretRev` cambia, i client rileggono la loro vista dall'endpoint autenticato.
- Codici stanza: 6 simboli casuali (31^6), limiti di frequenza su ricerca/ingresso (per account e per rete) e sulla creazione. Testi liberi: puliti da caratteri invisibili, 8–280 caratteri, mostrati sempre come testo (React fa l'escape). Le regole dei giocatori non entrano nell'archivio.
- Con un solo dispositivo la segretezza dipende anche dall'uso fisico: la regola appare solo dopo «SONO …» e sparisce alla conferma, con schermate di copertura.

## Database (migrazione `20261112130000_psyco.sql`, additiva e idempotente)

`psyco_rules` (60 regole: 20 facili, 20 medie, 20 difficili; fonte `content/psyco/regole.json`), `psyco_rooms`, `psyco_participants`, `psyco_rounds` (registro: PSYCO, regola, difficoltà, esito, tempo, tentativi, partecipanti), `psyco_round_members`, `psyco_candidates`, `psyco_votes`, `psyco_guesses`; colonna `tv_pairings.psyco_room_id`. Nessun punteggio: i dati per calcolarne in futuro ci sono tutti.

Migrazione `20261112170000_psyco_pc_aiuto.sql` (additiva, idempotente): `psyco_rooms.screen_mode`; `psyco_rules.hint_1/2/3` (+ UPDATE dei 60 indizi solo sulle righe col testo originale e senza indizi: le regole modificate dal pannello restano come sono); `psyco_candidates.category/hint`; `psyco_rounds.rule_category/rule_hint/calls_max/calls_used`; tabella `psyco_calls`. Gli UPDATE si rigenerano con `node scripts/psyco/regole-sql.mjs --indizi`.

## File principali

- `src/lib/psyco/` tipi condivisi e logica pura (timer, voti, rotazione, validazioni)
- `src/lib/server/psyco/` motore (`engine.ts`), stanze/ingresso/schermo (`rooms.ts`), stato pubblico e privato (`state.ts`), realtime, regole admin
- `src/features/psyco/` interfacce: `RoomApp` (dispositivo personale), `SharedApp` (un solo dispositivo), `DisplayApp` (TV), `CreateForm`, `JoinFlow`, `SettingsForm`, `HostControls`, `panels`, `ui`, `audio`, `narrator`, `NarratorSlot`, `investigatore/` (busto 3D del narratore), `intro/` (introduzione 3D)
- `src/app/psyco/` pagine, `layout.tsx` (caratteri Rubik Dirt + Special Elite, OFL), `psyco.css` (identità noir)

## Il narratore 3D (l'Investigatore) e l'introduzione

Vedi [INVESTIGATORE.md](INVESTIGATORE.md): varianti A/B del modello (si cambia in `src/features/three/characters/investigatore.ts`),
`<PsycoNarratorSlot size="xs|sm|md|lg|tv" />` (TV in basso a sinistra) e `<PsycoNarratorDock compact? />` (telefono dell'host senza TV
e dispositivo condiviso: ritratto + fumetto), labbra a tempo sulla voce (`getNarrator().getAnalyser()`), introduzione 3D una volta per
stanza con «SALTA INTRO», anteprime `/preview/investigatore`. Attributi DOM `data-psyco-narrator`, `data-speaking`, `data-voice-id`, `data-mode="3d|2d"`.

## Test

- `tests/unit/psyco.test.ts`, `tests/unit/psyco-narrator.test.ts`: timer libero, riferimento al server, rotazione, votazioni, input, archivio, momenti della voce.
- `tests/integration/psyco.test.ts`: tutto il motore contro il database locale (minimo 3, un posto per account, ruoli, automatica/libera, spareggi, timer, uscite, un solo dispositivo, segreti mai nello stato pubblico, pulizia). `tests/integration/psyco-scale.test.ts`: 50 e 100 partecipanti (vedi LIMITI.md). `tests/integration/psyco-aiuto.test.ts`: schermo del PC (comandi solo dell'host, solo quelli ammessi, risposta pubblica) e chiamate all'Investigatore (solo lo PSYCO, livelli, limite, idempotenza, pausa/verifica, indizio mai pubblico; regola libera con indizio del gruppo e categoria sul dispositivo condiviso).
- e2e `psyco-pc.spec.ts`: PC in «Schermo + telefoni» con 4 telefoni (host compreso), comandi dal PC, chiamata (rifiuto che non consuma, risposta, voce, messaggio di livello 1 e 2, limite), avviso su TV e altri telefoni, traffico di PC/TV/altro telefono senza ruoli, viste private o indizi; un solo dispositivo su PC («TOCCA A»).
- e2e: `psyco-shared.spec.ts` (un telefono, 5 nickname, 2 manche, clip della voce), `psyco-multi.spec.ts` (PC host + TV senza account + QR con registrazione e ritorno + 4 telefoni, minimo 3, timer/pausa/refresh, tentativi, manche libera, traffico HTTP e realtime dello PSYCO e della TV senza segreti), `psyco-pages.spec.ts` (catalogo, home del gioco, accesso richiesto), `psyco-intro.spec.ts` (intro: «SALTA INTRO», fine da sola, effetti e modelli presenti). Con `PSYCO_SHOTS_DIR=…` salvano gli screenshot.

## Pubblicazione

1. `npm run deploy:migrate` (applica `20261112130000_psyco.sql` e `20261112170000_psyco_pc_aiuto.sql`).
2. Deploy su Vercel (nessuna variabile d'ambiente nuova; il cron esistente usa `CRON_SECRET`).
3. Facoltativo: `npm run psyco:voci` se cambiano i file in `REFERENCE/GIOCHI/PSYCO`.
