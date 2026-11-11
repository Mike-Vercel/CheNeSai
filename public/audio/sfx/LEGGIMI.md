# Effetti sonori dello show

| File | Uso | Origine |
| --- | --- | --- |
| `applause-light.mp3` (3 s) | applausi leggeri/medi: fine intro, risposte giuste, vincitore del round, ingresso in lobby (appena accennato) | generato per questo progetto con ElevenLabs Sound Effects (novembre 2026), prompt: "Short warm applause from a small live studio audience…" |
| `applause-big.mp3` (6 s) | ovazione al vincitore del podio | ElevenLabs Sound Effects, prompt: "Big enthusiastic studio audience applause with cheering and whistles…" |
| `drumroll.mp3` (3,6 s) | rullo di tamburi: ultima domanda della serata, attesa del vincitore | ElevenLabs Sound Effects, prompt: "Snare drum roll building tension… ending with a single cymbal crash" |

Licenza: suoni generati con l'account ElevenLabs del progetto; secondo i termini di ElevenLabs
l'output appartiene a chi lo genera e con un piano a pagamento è utilizzabile anche
commercialmente senza attribuzione (con il piano gratuito serve citare ElevenLabs).
Nessun campione di terze parti.

Il "tic-tac" dell'orologio delle risposte, i beep, la fanfara e gli applausi di riserva sono
sintetizzati in tempo reale con Web Audio (`src/features/media/audio-engine.ts`): se un file qui
non si carica, lo show usa la versione sintetica. Tutto passa dal motore audio (volume effetti,
muto, applausi abbassati sotto le voci).
