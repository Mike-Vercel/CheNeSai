# GIRAMENTE! — personaggi 3D, ruota e Tabellone Segreto (livello visivo)

Codice: `src/features/giramente/three/` (contratto in `index.ts`). Anteprima: `/preview/giramente` (noindex).
Modelli: `public/models/giramente/`. Originali in `REFERENCE/GIOCHI/GIRAMENTE/MODELLI-3D/` (mai modificati).

## Personaggi

| personaggio | ruolo | file sorgente |
| --- | --- | --- |
| **DonTrallà** | presentatore | `RAPPRESENTANTE.glb`, `RAPPRESENTANTE_PARLANTE.glb` |
| **Zafira** | la Jolly | `JOLLY.glb`, `JOLLY_PARLANTE.glb` |

Rig (verificato con `gltf-transform inspect` e lettura del JSON dei GLB): armatura `SmartRigArmature`, 66 ossa
`mixamorig:*` (in three.js senza i due punti: `mixamorigHips`, …), una mesh `output_unwrapped` (~31 000 triangoli),
materiale unico `BakedMaterial` (base color + normal + metallic/roughness). Altezza 1,70 m, piedi a y = 0, guarda +Z.

### Clip di animazione presenti nei file (tutte e quattro le varianti)

| clip | durata | uso in GIRAMENTE! |
| --- | --- | --- |
| `Idle_3` | 10 s | riposo (base di quasi tutte le azioni) |
| `Talk_Passionately` | 10 s | parlata (alternata a ogni battuta) |
| `Talk_with_Hands_Open` | 4 s | parlata e azione **presentazione** |
| `Walking` | 1 s | **ingresso**, **uscita**, Zafira che esce dal portale |
| `Running` | 1 s | non usata |

Nessun file ha clip di saluto, indicazione, applauso, risata, sorpresa, delusione, pensiero o vittoria.

### Azioni (`CharacterAction`) — clip vere e movimenti procedurali

Tabella anche nel codice: `ACTION_PLAN` in `characters.ts`; pose in `character-model.tsx` (`POSES`).
"Procedurale" = rotazioni additive sulle ossa (braccia, busto, collo, testa) sopra la clip, sfumate in ~0,3 s.

| azione | base | cosa è procedurale |
| --- | --- | --- |
| `idle` | clip `Idle_3` | — |
| `presentazione` | clip `Talk_with_Hands_Open` | — |
| `saluto` | `Idle_3` | **procedurale**: braccio destro alzato, avambraccio che oscilla, palmo verso il pubblico |
| `indica` | `Idle_3` | **procedurale**: braccio teso verso la ruota, busto e testa girati (`pointSide` = lato dello schermo, predefinito sinistra) |
| `applauso` | `Idle_3` | **procedurale**: braccia avanti, mani che si avvicinano e si allontanano a 3 Hz |
| `risata` | `Idle_3` | **procedurale**: testa indietro, spalle che sussultano, mani sulla pancia, bocca a scatti |
| `sorpresa` | `Idle_3` | **procedurale**: busto indietro, avambracci su, sopracciglia su, bocca aperta |
| `delusione` | `Idle_3` | **procedurale**: spalle e testa giù, piccolo «no» con la testa |
| `pensiero` | `Idle_3` | **procedurale**: mano al mento, testa inclinata, altra mano sulla pancia |
| `vittoria` | `Idle_3` | **procedurale**: braccia avanti e avambracci in su (pugni sopra la testa) che pompano dal gomito, piccolo saltello |
| `spinta` | `Idle_3` | **procedurale**: carica il braccio verso il bordo della ruota e la spinge con uno strappo verso il basso (studio 3D, inizio del giro) |
| `ingresso` | clip `Walking` | spostamento della radice (entra di lato in 1,9 s e si gira verso il pubblico) |
| `uscita` | clip `Walking` | spostamento della radice (si gira ed esce di lato) |

Parlata: con `speaking` il personaggio passa alle clip `Talk_*`; la bocca segue `mouthRef` (0..1, RMS della voce:
`createAnalyserMouth(analyser)` in `mouth.ts`, stessa formula dell'Investigatore) con pseudo-visemi
`jawOpen` / `mouthO` / `mouthE`; senza `mouthRef` la bocca è simulata. Palpebre (`blink`) ogni 2–6 s, sopracciglia
(`browsUp`) sugli accenti e nelle espressioni. Se il 3D non va (qualità `2d`, WebGL assente o file non caricato) compare
un ritratto 2D **dichiarato** (sagoma + nome + barre della voce), mai spacciato per il personaggio riggato.

Quando arriveranno clip vere (Mixamo, senza skin, stesso scheletro): assegnarle all'armatura in Blender, esportare,
ottimizzare come sotto e mappare l'azione sulla clip in `character-model.tsx` (oggi `prepare()` cerca idle, talk, walk).

### Bocca: varianti A e B (DA SCEGLIERE)

| variante | file | origine |
| --- | --- | --- |
| **A** (attiva) | `dontralla.glb`, `zafira.glb` (+ `-low`) | i file `_PARLANTE` dell'utente |
| **B** | `dontralla-b.glb`, `zafira-b.glb` (+ `-low`) | file senza bocca + la nostra bocca (`src/features/three/tools/blender_add_mouth.py` con `mouth_dontralla.json` / `mouth_zafira.json`) |

Entrambe hanno i 5 morph `jawOpen, mouthO, mouthE, blink, browsUp` (nella A anche sull'interno bocca). Nei render
frontali di prova (Blender, bocca tutta aperta) la A apre un ovale scuro al centro delle labbra, la B apre lungo la
linea delle labbra (in DonTrallà restano due piccole schegge chiare agli angoli a bocca spalancata, sotto i baffi).

**Cambiare variante**: `BOCCA_DEFAULT` in `src/features/giramente/three/characters.ts` (per personaggio), oppure senza
toccare il codice `NEXT_PUBLIC_QZ_BOCCA_DONTRALLA=b` / `NEXT_PUBLIC_QZ_BOCCA_ZAFIRA=b` (serve una nuova build).
Confronto: `/preview/giramente?solo=personaggi&variant=ab` (pulsante «Parla (voce vera)» = clip audio di prova con
lip-sync; `&mouth=0.9` = bocca ferma aperta per confrontare).

Rifare la B (Blender 5.2 headless; i punti di labbra/occhi/sopracciglia sono presi dal render frontale):

```
blender --background --python src/features/three/tools/blender_render_face.py -- REFERENCE/.../RAPPRESENTANTE.glb face.png 0.4
blender --background --python src/features/three/tools/blender_add_mouth.py -- REFERENCE/.../RAPPRESENTANTE.glb DONTRALLA_B.glb src/features/three/tools/mouth_dontralla.json
blender --background --python src/features/three/tools/blender_add_mouth.py -- REFERENCE/.../JOLLY.glb ZAFIRA_B.glb src/features/three/tools/mouth_zafira.json
```

### Ottimizzazione e pesi

Come gli altri GLB del sito (`@gltf-transform/cli` 4.5): PRIMA `resize --pattern "normal*"` e `"*metallic*"`
(1024, o 512 per la `-low`), POI `optimize --compress meshopt --texture-compress webp --texture-size 2048|1024 --simplify false`.
Morph target e `targetNames` restano (verificati dopo l'ottimizzazione).

| file | MB | | file | MB |
| --- | --- | --- | --- | --- |
| dontralla.glb | 1,46 | | dontralla-low.glb | 1,11 |
| dontralla-b.glb | 1,45 | | dontralla-b-low.glb | 1,11 |
| zafira.glb | 1,98 | | zafira-low.glb | 1,43 |
| zafira-b.glb | 1,98 | | zafira-b-low.glb | 1,44 |
| supporto.glb (da RUOTA_GIRAMENTE.glb, 14 MB) | 1,10 | | supporto-low.glb | 0,67 |
| logo-g.webp (da logo_G.png) | 0,02 | | | |

Originali: 15–20 MB ciascuno.

## La ruota

- `GiramenteWheel` (3D in `Wheel3D.tsx`, SVG in `Wheel2D.tsx`): porting di `ruota.js` dell'utente (disco disegnato su
  canvas, anello con lampadine, puntatore, arresto sullo spicchio deciso dal server) montato sul supporto Meshy
  (perno a 1,768 dal fondo, misure di `ruota.html`). Spicchi verde / rosso / avorio, cerchione in acciaio, 24 lampadine
  (corrono più veloci durante il giro, a giro finito lampeggiano verde/rosso), pioli sui separatori, puntatore che scatta
  su ogni piolo (`onTick`, al massimo uno ogni 45 ms), spicchio vincente evidenziato (`highlight`).
- **Giro deterministico** (`wheel-math.ts`, testato): l'angolo dipende solo da `{spinId, targetIndex, startedAt,
  durationMs}` e da `now()` (orologio del server). Attivazione (piccolo strappo indietro), accelerazione, rallentamento
  progressivo, arresto esatto su `restAngle(targetIndex)`. Chi entra o si riconnette a metà giro calcola lo stesso angolo;
  chi stava mostrando un altro spicchio si raccorda alla curva comune nei primi 600 ms. Nessun risultato scelto dal client.
- **Centro: cervello o logo (DA SCEGLIERE)**: `WHEEL_CENTER_DEFAULT = "brain"` in `Wheel3D.tsx` (cervello 3D luminoso
  costruito in codice, come brief e mockup) oppure `"logo"` (il `logo_G.png` dell'utente). Il componente accetta anche
  la prop facoltativa `center`. Nell'anteprima: pulsanti «Centro: cervello / logo G!» (`&center=logo`).
- Qualità: `high` (dpr ≤ 2, ombre, riflessi da ambiente generato in codice, aloni additivi al posto del bloom),
  `low` (dpr ≤ 1,25, niente ombre né aloni, `supporto-low.glb`, texture del disco 1024), `2d` (SVG, stesso giro).
  Canvas "a richiesta": 60 fps solo mentre gira, 30 con lo spicchio evidenziato, 10 da ferma, 0 con movimento ridotto.
  `detectVisualQuality()` (`quality.ts`): `?q=high|low|2d` forza; niente WebGL / renderer software / movimento ridotto → `2d`;
  ≤ 4 core o ≤ 3 GB → `low`.

## Il portale della Jolly (`JollyPortal`)

Velo di luce verde/rosso sulla scena, portale ellittico al neon con vortice (shader) e scintille (calcolate nello shader),
Zafira che attraversa il portale camminando (clip `Walking`), poi `Idle_3`/parlata. `play=false` = si gira, rientra,
il portale si chiude, poi `onDone`. `onEntered` (facoltativo) quando è ferma davanti. 2D / movimento ridotto: portale CSS
e ritratto 2D dichiarato.

## Il Tabellone Segreto (`SecretBoard`)

Disegno originale GIRAMENTE! (CSS 3D, niente WebGL): pannello grafite con filo verde in alto e rosso in basso, caselle in
rilievo che si girano con una lama di luce, accensione progressiva, parole intere mandate a capo e righe bilanciate
(`layoutBoard`, testato), punteggiatura sempre scoperta, categoria sopra, movimento ridotto rispettato. Riceve solo
caselle mascherate (`char: null` = coperta). `maskPhrase()` serve al server o alle anteprime.

## Limiti delle pose (giacca)

I pesi della pelle dei modelli (Meshy + rig Mixamo) reggono la spalla solo fino a ~60–65° di alzata del braccio: oltre,
collo e busto della giacca si tirano dietro il braccio (stiramenti e strappi all'ascella). Le pose procedurali tengono
quindi il braccio (`Arm`) entro ~1 rad dal riposo, distribuiscono un filo sulla clavicola (`Shoulder` ≤ 0,12) e danno
il resto dell'altezza con il gomito (`ForeArm`). Verifica: `/preview/giramente/pose?who=…&variant=a|b&action=…&t=…&view=front|side|back`
(posa ferma al culmine) e `node scripts/giramente/pose-shots.mjs http://localhost:PORTA cartella`.

## Lo studio 3D (`three/studio/`)

Con qualità `high` o `low` la pagina del gioco (PC, telefono, dispositivo condiviso) e lo schermo TV/LIVE diventano uno
STUDIO televisivo: UN canvas fisso montato una volta per tutta la partita (`StudioBackdrop` in `studio.tsx`), con l'HUD
di gioco sopra (`StudioHud.tsx`). Con qualità `2d`, `?studio=0` o se il 3D si rompe resta l'impaginazione 2D di prima.

- **Set** (`StudioSet.tsx`): pavimento lucido (riflesso vero `MeshReflectorMaterial` solo in `high`), podio con neon e
  lampadine da casinò, americane con 8 fari e coni di luce additivi, colonne al neon, torri LED, pulviscolo, coriandoli.
  Le luci seguono l'atmosfera (`Mood`): giro, giusto, sbagliato, Jolly, classifica, vittoria.
- **Ruota**: la stessa `WheelRig` di `Wheel3D` (giro deterministico dall'ora del server, scatti con `onTick`), montata sul
  podio con `WheelAssembly`.
- **Don Patrizio** a figura intera accanto alla ruota (segni sul palco in `studio-layout.ts`), azioni dalla regia
  (`studio-director.ts`, pura e testata): si avvicina e indica prima del giro, `spinta` sincronizzata con la partenza,
  indica lo spicchio, applaude/si dispera, sorpresa sulla Jolly, vittoria. Cammina tra i segni con la clip `Walking`.
- **Zafira** esce dal portale sul palco (`PortalRig` di `JollyPortal3D`) quando esce la Jolly e rientra dopo.
- **Schermo LED** (`led-texture.ts`): logo, nome della manche, esito, Tabellone Segreto, classifica, vincitore. Solo dati
  pubblici: mai il codice della partita, mai soluzioni prima della rivelazione.
- **Regia di camera** (`studio-camera.ts`): inquadrature per fase, smorzate (stacchi netti sulle reazioni), carrellata
  sulla ruota per tutta la durata del giro, orbita sul vincitore. L'HUD segna con `StudioWindow` la parte di schermo
  libera: la camera calcola distanza e *lens shift* perché ruota e presentatore stiano lì dentro (varianti compatte per
  le finestre strette del telefono). Movimento ridotto: camera ferma.
- **Prestazioni**: disegno a richiesta (60 fps in `high`, 45/30 in `low`, niente a scheda nascosta), dpr che scende da solo se i fotogrammi sono lenti, `low` senza ombre né riflessi veri, modelli `-low`.
- Anteprima con stati finti: `/preview/giramente/studio?phase=…&device=pc|tel|tv&q=high|low`;
  foto: `node scripts/giramente/studio-shots.mjs http://localhost:PORTA cartella`.

## Limiti onesti

- Verificato solo nel Chromium headless (WebGL software) e con screenshot: nessuna prova su telefoni, tablet o TV veri.
- Le azioni procedurali sono pose additive, non animazioni registrate: leggibili ma meno ricche di clip Mixamo vere.
- Nessun effetto sonoro della ruota nei file: l'anteprima sintetizza lo scatto; il gioco usa `onTick`.
