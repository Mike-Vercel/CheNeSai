# Avanzamento – CHE NE SAI?!

Legenda: ✅ fatto e verificato · 🟡 fatto, verifica parziale · ⏳ da fare · 🔑 richiede credenziali/risorse esterne

## Fase A – Analisi
- ✅ Analisi cartella e asset (3 personaggi + mockup), scontorno personaggi (rembg, webp trasparenti)
- ✅ Architettura, macchina a stati, schema dati (`docs/ARCHITECTURE.md`)

## Fase B – Fondamenta
- ✅ Next.js 16 + TypeScript strict + Tailwind 4, tema grafico, font (Lilita One + Nunito)
- ✅ Schema PostgreSQL versionato (2 migrazioni), RLS su tutte le tabelle, trigger append-only, congelamento sessioni pubblicate
- ✅ Auth admin (Supabase Auth) con ruoli super_admin / admin / operatore applicati dal backend
- ✅ Componenti UI condivisi (pulsanti, pannelli, dialoghi di conferma, notifiche)

## Fase C – Motore
- ✅ Comandi di regia transazionali, idempotenti, versionati, con audit e broadcast nella stessa transazione
- ✅ Timer autorevole (orologio DB), tolleranza configurabile, pausa/ripresa con tempo residuo
- ✅ Punteggi server-side con eventi verificabili, punteggio parziale, bonus velocità, non-negatività opzionale
- ✅ Classifica deterministica con spareggi espliciti
- ✅ Realtime su canali privati (ricezione sì, falsificazione no — verificato)
- ✅ Riconnessione con backoff, snapshot, ordinamento per versione, sincronizzazione orologio

## Fase D – Esperienza
- ✅ Schermo TV (lobby con QR, round, domanda, risposte, rivelazione, punteggi, classifica, eventi, votazione, podio, pausa)
- ✅ Smartphone (ingresso con nickname, codice giocatore, domanda, risposte singole/multiple con CONFERMA, esito, classifica personale, storico risposte)
- ✅ Regia live (comandi grandi, prossima azione, domanda con soluzione, prossima domanda, timer, risposte ricevute, giocatori, avvisi, anteprima TV, eventi, ingressi, audio)
- ✅ Effetti sonori originali sintetizzati (Web Audio), coriandoli, animazioni

## Fase E – Funzioni avanzate
- ✅ Domande multiple, immagini, audio (manche musicale con controlli dalla regia), video
- ✅ Votazione categoria con risultati live, spareggio (casuale registrato / regia / ordine)
- ✅ Eventi di Palmino che modificano davvero le regole (8 tipi), limiti di frequenza, programmati o manuali, PALMINO DECIDE verificabile
- ✅ Classifiche mensili e stagionali per identità persistente
- ✅ Statistiche, audit log, anomalie
- (stato CMS: vedi sezione verifiche)

## Fase F – Produzione 3D
- ✅ Studio virtuale R3F, luci, camera, personaggi 2.5D fedeli, logo 3D estruso, countdown, colonna sonora originale
- ✅ Fallback 2D, gestione perdita contesto WebGL, precaricamento, prestazioni misurate
- 🔑 Personaggi 3D riggati (opzione B): predisposto il caricatore GLB, servono i modelli (vedi `docs/OPERATIONS.md`)

## Fase G – QA e rilascio
- ✅ Test unitari, integrazione, Realtime
- (E2E, carico, build: vedi verifiche)
- 🔑 Deploy Vercel/Supabase: codice e istruzioni pronti, servono gli account autorizzati

## Verifiche eseguite
(aggiornate a fine lavoro)
