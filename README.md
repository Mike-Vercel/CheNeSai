# CHE NE SAI?!

Game show multiplayer dal vivo per le serate quiz al pub.
I clienti giocano dallo smartphone (senza account), il televisore mostra lo spettacolo, la regia controlla ogni fase.

| Schermo | Route | Chi lo usa |
|---|---|---|
| Smartphone giocatore | `/play/<CODICE>` (dal QR sul TV) | clienti |
| TV 16:9 (Full HD / 4K) | `/display/<sessionId>?k=<chiave>` | televisore del pub |
| Regia live | `/admin/sessions/<id>/live` | operatore |
| Prova generale (regia + TV + 3 telefoni) | `/admin/sessions/<id>/rehearsal` | admin |
| CMS (serate, domande, media, eventi, classifiche, statistiche) | `/admin` | admin |
| Classifica mensile pubblica | `/classifica` | tutti |
| Anteprima intro 3D | `/preview/intro` | admin |

Personaggi ufficiali: **Il Professore**, **La Regina**, **Palmino** (immagini originali scontornate in `public/characters/`, modelli 3D procedurali in `src/features/three/characters/`).

> Il progetto è nato con il nome provvisorio "Il Quizzone": alcuni identificatori tecnici (cartella, formato di importazione `quizzone-questions`, prefissi `qz`) lo conservano di proposito per compatibilità.

## Voce e musica

- **Voce dei presentatori** (solo sul TV): sintesi vocale italiana del browser, una voce diversa per personaggio; legge domande, risposte, soluzioni, classifiche, eventi e le battute dell'intro, con la bocca dei personaggi animata. **Usare Microsoft Edge sul PC del TV**: include gratuitamente le voci neurali italiane "Natural" (Isabella, Diego, Giuseppe), di qualità molto superiore. Impostazioni sul TV (doppio clic): voce sì/no, lettura delle risposte, prova voci.
- **Voce professionale (ElevenLabs, facoltativa)**: impostare `ELEVENLABS_API_KEY` (solo sul server, mai nel browser). Le voci dei quattro ruoli (Professore, Regina, Palmino e l'**Annunciatore** fuori campo) si scelgono nella pagina admin **Voci**, con stabilità/somiglianza/stile/velocità per ruolo, un pulsante **Prova** e i consumi (abbonamento ElevenLabs e caratteri spesi dall'app nel mese); gli ID in `ELEVENLABS_VOICE_*` restano come valori di riserva. Il TV usa le voci generate con lip-sync reale dal volume dell'audio; se una clip non è pronta entro ~2,5 s, se il budget è esaurito o in caso di errore si torna alla voce del browser.
  - **Pre-generazione**: ogni domanda (testo, avviso risposte multiple, lettura delle risposte, rivelazione), le presentazioni dei round, le categorie votabili, gli eventi e le frasi fisse si generano **una volta sola** con `ELEVENLABS_MODEL` (qualità, predefinito `eleven_v4`) e restano nel bucket privato `tts` (tabella `tts_clips`, chiave `sha256(voce|modello|testo)`): la stessa domanda vale in tutte le serate. "Domanda numero N" è una battuta separata dell'annunciatore. Dalla serata: riquadro **Voci della serata · Prepara voci** (proposto anche subito dopo la pubblicazione); dall'archivio Domande: **Genera voci** sulle selezionate o sulle approvate del filtro. Sempre con stima dei caratteri, budget residuo e conferma; nulla parte da solo.
  - **Battute live** (nickname e punteggi: in testa, classifica, podio): generate al volo con `ELEVENLABS_MODEL_LIVE` (veloce, predefinito `eleven_v4_turbo`, ~1 s per battuta) e **pre-riscaldate dal server** subito dopo il comando di regia, così di solito sono pronte quando il TV le chiede.
  - **Copione comico**: Professore pomposo e saccente, Regina diva ironica, Palmino iperattivo, Annunciatore da varietà TV. Le battute usano gli **audio tag** di Eleven v4 (`[excited]`, `[laughs]`, `[shouts]`, `[giggles]`, `[whispers]`, `[sighs]`, `[sarcastic]`…) che guidano l'interpretazione: non compaiono mai a schermo né nella voce del browser; i testi delle domande e la lettura delle risposte restano puliti. Il copione è in `src/features/game/script.ts` e `lines.ts`.
  - **Spesa sotto controllo**: budget mensile dell'app (predefinito 50 000 caratteri, modificabile in Voci) oltre il quale non si genera più nulla; al massimo 2 richieste parallele a ElevenLabs per istanza, con retry su 429/5xx; richieste uguali concorrenti unificate.
- **Sigla**: `public/audio/theme.mp3` (brano fornito dal locale, normalizzato a −14 LUFS). Suona sincronizzata nell'intro, in sottofondo in lobby e classifica, piena sul podio; si abbassa automaticamente quando parla un personaggio. Verificare di avere i diritti d'uso pubblico del brano (licenza del servizio che l'ha generato + SIAE/SCF per la diffusione nel locale).

---

## Stack

- **Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind CSS 4**, animazioni con Motion.
- **Three.js / React Three Fiber / Drei** per l'intro cinematografica (solo sul TV), fallback 2D automatico.
- **Supabase**: PostgreSQL (fonte di verità), Auth (solo admin), Realtime Broadcast (canali privati), Storage privato.
- **Vercel** per l'hosting (nessun processo sempre attivo).

Architettura, macchina a stati e modello di sicurezza: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
Operatività (deploy, backup, serata tipo): [`docs/OPERATIONS.md`](docs/OPERATIONS.md).
Stato di avanzamento e verifiche: [`docs/PROGRESS.md`](docs/PROGRESS.md).

---

## Avvio in locale

Requisiti: Node 20+ (testato con 24), Docker Desktop, npm.

```bash
npm install
npm run db:start            # Supabase locale (porte 553xx: API 55321, DB 55322)
cp .env.example .env.local  # poi incolla i valori stampati da `npx supabase status`
npm run admin:create -- admin@chenesai.local "UnaPasswordLunga!" "Regia" super_admin
npm run db:seed-demo        # (facoltativo) domande demo + serata DEMO di prova
npm run dev                 # http://localhost:3000
```

Per provare dai telefoni nella stessa rete apri la regia e il TV usando l'IP del computer (es. `http://192.168.1.20:3000`): il QR code usa l'indirizzo con cui è aperto il TV (oppure `NEXT_PUBLIC_APP_URL`).

> Nota: Next.js 16 consente un solo `next dev` per cartella.

### Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` / `build` / `start` | sviluppo / build di produzione / server di produzione |
| `npm run typecheck` | controllo TypeScript |
| `npm run lint` | ESLint |
| `npm test` | test unitari del motore (punteggi, classifica, votazioni, nickname, transizioni, import) |
| `npm run test:integration` | test di integrazione sul DB reale (serata completa, anti-cheat, Realtime) |
| `npm run test:e2e` | end-to-end Playwright: 1 regia + 1 TV + 3 telefoni |
| `npm run db:reset` | ricrea il DB locale applicando le migrazioni (cancella i dati locali!) |
| `npm run db:seed-demo` | dati dimostrativi (tag `demo`, serata marcata come prova) |
| `npm run admin:create` | crea/aggiorna un amministratore |
| `npm run db:backup` | backup logico JSON (`-- --session <id>` per una sola serata) |
| `npx tsx scripts/load-test.ts --base <url> --players 200` | test di carico |

---

## Variabili d'ambiente

Vedi [`.env.example`](.env.example). Riassunto:

| Variabile | Dove | Note |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client+server | URL progetto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | client+server | chiave pubblica (solo Realtime e login admin) |
| `SUPABASE_SECRET_KEY` | **solo server** | Storage firmato, gestione utenti admin |
| `DATABASE_URL` | **solo server** | pooler Supabase in *transaction mode* (porta 6543) |
| `NEXT_PUBLIC_APP_URL` | client | dominio pubblico usato nel QR code |

---

## Deploy su Vercel + Supabase (sintesi)

1. Crea un progetto Supabase (regione **eu-central-1 / Frankfurt**) e applica le migrazioni:
   `npx supabase link --project-ref <ref>` → `npx supabase db push`.
2. In Supabase → Realtime → Settings lascia abilitati i canali privati (le policy sono nella migrazione 002).
3. In Supabase → Auth: disattiva le registrazioni pubbliche (gli admin si creano con `npm run admin:create` puntando al progetto).
4. Importa il repository su Vercel (regione `fra1` già in `vercel.json`), imposta le variabili d'ambiente per *Preview* (staging) e *Production*.
5. Collega il dominio personalizzato e imposta `NEXT_PUBLIC_APP_URL`.
6. Verifica: `GET /api/health`, login regia, serata di prova con `/admin/sessions/<id>/rehearsal`.

Dettagli, staging e ripristino: [`docs/OPERATIONS.md`](docs/OPERATIONS.md).

---

## Domande generate con ChatGPT

Formato JSON validato (importazione in *Domande → Importa*), sempre come bozza con risposta da confermare:

```json
{
  "format": "quizzone-questions",
  "version": 1,
  "questions": [
    {
      "type": "single",
      "text": "Qual è la capitale dell'Albania?",
      "category": "Geografia",
      "difficulty": 2,
      "presenter": "professore",
      "answers": ["Tirana", "Durazzo", "Valona", "Scutari"],
      "correct": [0],
      "durationSeconds": 20
    }
  ]
}
```

Anche CSV: `tipo;testo;categoria;difficolta;presentatore;A;B;C;D;corrette;durata;tag` (es. `corrette` = `A` oppure `A|C`).
