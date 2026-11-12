# PSYCO dentro CHE NE SAI?!

«Tutti conoscono la regola. Tranne te.» Brief completo: [BRIEF.md](BRIEF.md). Voce narrante: [VOCI.md](VOCI.md). Limiti reali e prove con 50/100 giocatori: [LIMITI.md](LIMITI.md).

## Rotte

| Rotta | Chi | Cosa |
|---|---|---|
| `/psyco` | tutti | home del gioco: CREA PARTITA, ENTRA IN PARTITA, UN SOLO DISPOSITIVO, COME SI GIOCA, «Riprendi» |
| `/psyco/come-si-gioca` | tutti | regole |
| `/psyco/nuova?modo=personale\|condiviso` | account | creazione (senza account → `/accedi?next=…` e ritorno qui) |
| `/psyco/entra` | tutti | si scrive il codice |
| `/psyco/entra/[CODICE]` | account | link del QR/invito: senza account → login/registrazione → ritorno QUI |
| `/psyco/stanza/[id]` | account partecipante o host | partita sul proprio dispositivo |
| `/psyco/un-dispositivo/[id]` | solo il proprietario | partita su un solo dispositivo |
| `/psyco/schermo/[chiave]` | nessun account | schermo pubblico TV/PC (chiave casuale di 32 caratteri) |
| `/tv` (esistente) | TV | codice di 4 cifre: l'host lo scrive nel pannello «Schermo per tutti» → il TV apre lo schermo PSYCO |
| `/admin/psyco` | admin | archivio regole: attiva/disattiva, modifica, aggiungi |

API (`src/app/api/psyco/…`): `POST/GET rooms`, `GET rooms/[id]?as=`, `POST rooms/[id]/action`, `GET rooms/[id]/schermo` (chiave dello schermo, solo host), `POST rooms/[id]/tv` (abbinamento /tv), `GET/POST join`, `GET schermo/[key]`; admin: `GET/POST /api/admin/psyco/rules`, `PATCH /api/admin/psyco/rules/[id]`. Cron esistente `api/cron/chiudi-partite` esteso: chiude anche le stanze PSYCO senza attività da 24 h.

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
- `tests/integration/psyco.test.ts`: tutto il motore contro il database locale (minimo 3, un posto per account, ruoli, automatica/libera, spareggi, timer, uscite, un solo dispositivo, segreti mai nello stato pubblico, pulizia). `tests/integration/psyco-scale.test.ts`: 50 e 100 partecipanti (vedi LIMITI.md).
- e2e: `psyco-shared.spec.ts` (un telefono, 5 nickname, 2 manche, clip della voce), `psyco-multi.spec.ts` (PC host + TV senza account + QR con registrazione e ritorno + 4 telefoni, minimo 3, timer/pausa/refresh, tentativi, manche libera, traffico HTTP e realtime dello PSYCO e della TV senza segreti), `psyco-pages.spec.ts` (catalogo, home del gioco, accesso richiesto), `psyco-intro.spec.ts` (intro: «SALTA INTRO», fine da sola, effetti e modelli presenti). Con `PSYCO_SHOTS_DIR=…` salvano gli screenshot.

## Pubblicazione

1. `npm run deploy:migrate` (applica `20261112130000_psyco.sql`).
2. Deploy su Vercel (nessuna variabile d'ambiente nuova; il cron esistente usa `CRON_SECRET`).
3. Facoltativo: `npm run psyco:voci` se cambiano i file in `REFERENCE/GIOCHI/PSYCO`.
