# Effetti sonori dell'introduzione 3D di PSYCO

Generati con **ElevenLabs Sound Effects** (`POST /v1/sound-generation`, account del progetto) dallo script
`npm run psyco:sfx` (`scripts/psyco/sfx.mjs`, dove ci sono i testi esatti delle richieste), poi passati da
ffmpeg (taglio del silenzio iniziale, loudnorm, mp3 128 kbps). Uso commerciale consentito dal piano
ElevenLabs a pagamento dell'account; nessun campione di terze parti.

| file | contenuto | dove si usa |
| --- | --- | --- |
| `passo.mp3` | un passo singolo (scarpa di cuoio su parquet, stanza vuota) | a ogni appoggio del piede nella camminata (tono e volume variati di poco a ogni passo) |
| `sedia.mp3` | sedia di legno che scricchiola quando ci si siede | quando l'Investigatore si siede |
| `lampada.mp3` | click dell'interruttore della lampada + ronzio | accensione della lampada |
| `pioggia.mp3` | pioggia sul vetro, tuono lontano (10 s, in loop) | sottofondo dell'intro, volume basso |

Rigenerare (costa crediti): `npm run psyco:sfx -- --force`. Se un file manca l'intro funziona lo stesso, muta.
