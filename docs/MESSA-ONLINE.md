# Messa online (Supabase + Vercel)

Tutto è preparato in **un comando**, da lanciare nella cartella del progetto:

```
npm run deploy:setup
```

(equivale a `node scripts/deploy/setup-production.mjs`). È riprendibile: se si interrompe, rilancialo.

## Cosa fa

0. Aggiorna GitHub (`Mike-Vercel/CheNeSai`, branch `main`). Se si apre la finestra di accesso di GitHub, accedi.
1. Crea (o ritrova) il progetto Supabase **che-ne-sai** nell'organizzazione "Mike", regione **eu-central-1** (Francoforte), piano gratuito.
   La password del database è generata a caso e salvata solo in `.env.production.local` (escluso da git).
2. Applica tutte le migrazioni (struttura, sicurezza RLS, Realtime privato, bucket `media` e `tts`).
   Verificato: le 11 migrazioni si applicano in ordine su un database vuoto.
3. Copia dal Supabase locale: impostazioni (voci, tempi, regia automatica), le battute dei presentatori,
   le domande (no demo/test) con i brani, le voci già generate (risparmio crediti ElevenLabs) e le
   **560 domande pilota verificate** (`content/domande/verificate`, vedi il REPORT.md lì dentro).
4. Crea il tuo account admin (email e password le scrivi tu nel terminale; non vengono salvate).
5. Imposta le variabili d'ambiente di produzione su Vercel (progetto `che-ne-sai`, team MG Production):
   Supabase (URL, chiavi), `DATABASE_URL` (pooler porta 6543), ElevenLabs (chiave e voci), modelli 3D.
6. Pubblica in produzione (regione `fra1`) e controlla `/api/health`.

Al termine stampa l'indirizzo del sito e della regia (`/admin`).

## Prerequisiti (già fatti su questo PC)

- `npx supabase login` (fatto)
- Vercel CLI collegata come `mikegiglio` e progetto collegato (`.vercel/project.json`)

## Note

- **Pubblicazione automatica a ogni push**: il piano gratuito di Vercel non collega repository privati di
  un'organizzazione GitHub. Per ripubblicare dopo una modifica: `npx vercel deploy --prod`.
  In alternativa: rendere pubblico il repository, spostarlo sul tuo account GitHub personale, o Vercel Pro.
- **QR code**: in produzione punta automaticamente all'indirizzo del sito da cui è aperto il TV.
- **Voci**: dalla regia, quando apri la lobby, le voci della serata vengono preparate a lotti (barra
  "Voci della serata"); il budget mensile delle voci resta il limite (Admin → Voci).
