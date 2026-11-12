# L'Investigatore (voce narrante di PSYCO) e l'introduzione 3D

## Modello e varianti

Due varianti dello stesso personaggio (scheletro Mixamo, clip `Idle_3`, `Talk_Passionately`,
`Talk_with_Hands_Open`, `Walking`, `Running`; morph `jawOpen`, `mouthO`, `mouthE`, `blink`, `browsUp`):

| variante | file | origine |
| --- | --- | --- |
| **A** (attiva) | `public/models/investigatore.glb` (+ `-low`) | `REFERENCE/GIOCHI/PSYCO/MODELLI-3D/INVESTIGATORE_PARLANTE.glb` (bocca preparata dall'utente) |
| **B** | `public/models/investigatore-b.glb` (+ `-low`) | `INVESTIGATORE.glb` + la nostra bocca: `src/features/three/tools/blender_add_mouth.py` con `mouth_investigatore.json` (punti presi dal render frontale di `blender_render_face.py`, come Palmino e Regina) |

**Cambiare variante**: un solo punto, `src/features/three/characters/investigatore.ts`
(`INVESTIGATORE_DEFAULT = "a" | "b"`), oppure senza toccare il codice `NEXT_PUBLIC_QZ_INVESTIGATORE=b` (serve una
nuova build). Confronto: `/preview/investigatore?variant=ab&speak=1` (voce vera in loop, tocca per l'audio),
`&view=face&face=jawOpen:1` (forme ferme), `?variant=a|b` per una sola.

Ottimizzazione (come gli altri GLB): `gltf-transform resize` delle texture `normal*` e `*metallic*` (1024, o 512
per la -low) **poi** `optimize --compress meshopt --texture-compress webp --texture-size 2048|1024 --simplify false`.
Morph target e `targetNames` restano (verificati). Pesi: ~1.45 MB (alta), ~1.07 MB (-low) per variante.

Rifare la variante B (Blender 5.2, headless; l'originale non viene toccato):

```
blender --background --python src/features/three/tools/blender_render_face.py -- INVESTIGATORE.glb face.png 0.4
blender --background --python src/features/three/tools/blender_add_mouth.py -- INVESTIGATORE.glb OUT.glb src/features/three/tools/mouth_investigatore.json
```

## Nelle schermate

`src/features/psyco/NarratorSlot.tsx`:

- `PsycoNarratorSlot` = ritratto in cornice (`.psy-portrait`) con il busto 3D (`investigatore/InvestigatoreStage.tsx`):
  labbra dalla voce del narratore (AnalyserNode → `investigatore/lipsync.ts` → jawOpen/mouthO/mouthE nel
  sistema GLB dei presentatori, `glb-host.tsx`), battito delle palpebre, Idle quando tace e Talk_* quando parla.
  Luci noir (lampada calda, controluce rosso). Canvas a richiesta: ~24 fps da fermo, ~50 quando parla, fermo
  fuori schermo; dpr ≤ 1.5; file -low e dpr 1 su dispositivi deboli (`investigatore/device.ts`).
  Silhouette finché carica, senza WebGL, col renderer software (`?chars=3d` forza il 3D) o se il 3D si rompe.
- `PsycoNarratorDock` (telefono dell'host senza TV, dispositivo condiviso senza TV): ritratto in alto con il
  sottotitolo nel fumetto accanto (al posto di quello fisso); ridotto (`compact`) nelle schermate segrete
  (ruolo, scelta della regola). È nel flusso della pagina: non copre mai carte, pulsanti o timer.
- TV: ritratto grande in basso a sinistra (`size="tv"`), sottotitolo accanto; in sala d'attesa la griglia
  QR/codice lascia libero lo spazio a sinistra.

## Introduzione 3D (`src/features/psyco/intro/`)

- `timeline.ts`: copione puro (lampada, camminata, giro, seduta, camera, fine) — testato in `tests/unit/psyco-intro.test.ts`.
- `room.tsx`: stanza in codice (nessun asset esterno): parquet, carta da parati, finestra con veneziane, pioggia e
  insegna rossa (shader), bacheca con foto e fili rossi, scrivania, fascicolo «REGOLA SEGRETA», lente, lampada con
  cono di luce e polvere, sedia. Una sola luce con ombre (la lampada).
- `IntroScene3D.tsx`: un canvas; l'Investigatore cammina (`Walking`), si gira, si siede (posa procedurale),
  parla col clip `benvenuti`; i passi si sentono quando un piede tocca terra (`sfx/passo.mp3`).
- `PsycoIntro.tsx`: una volta per stanza (localStorage), solo dove suona la voce (TV/PC, dispositivo condiviso,
  host senza TV), «SALTA INTRO» sempre visibile, fine sicura a 25 s, versione 2D illustrata se il 3D non va
  (o lowPower / movimento ridotto). Durante l'intro le frasi del gioco aspettano (`narrator.hold/release`).
  Audio bloccato (TV appena accesa): tasto «▶ INIZIA», parte muta dopo 6 s. Test automatici: solo con `?intro=1`.
- Anteprima: `/preview/investigatore?intro=1&layout=portrait|landscape` (`&t=7.5` ferma un istante, `&chars=2d`).
- Effetti: `public/audio/psyco/sfx/` (ElevenLabs Sound Effects, vedi `LEGGIMI.md`, `npm run psyco:sfx`).

### Seduta: sostituire la posa procedurale con un'animazione Mixamo

Il GLB non ha una clip di seduta: `glb-host.tsx` (`SIT_POSE`, `SIT_DROP`) piega gambe, busto e braccia sulle ossa
mixamo. Se in `REFERENCE/GIOCHI/PSYCO/MODELLI-3D/` arriva un'animazione Mixamo ("Sitting", "Sitting Idle" o
"Stand To Sit", scaricata **senza skin** sullo stesso personaggio o su uno scheletro Mixamo standard):

1. in Blender importare il GLB dell'Investigatore e l'FBX dell'animazione; le ossa hanno gli stessi nomi
   (`mixamorig:*`), quindi basta assegnare l'azione all'armatura del personaggio (nessun retarget) e rinominarla
   con un nome che contenga `Sit` (es. `Sitting_Idle`);
2. esportare il GLB e ottimizzarlo come sopra (stessi file in `public/models/`);
3. nient'altro: `prepare()` in `glb-host.tsx` cerca una clip `/sit/i` e, se c'è, la usa al posto della posa
   procedurale (stesso `sitRef` 0..1, sfumata con le altre clip). Se la clip abbassa già le anche, mettere
   `SIT_DROP` a 0 per l'Investigatore (o togliere l'abbassamento della scena in `IntroScene3D.tsx`).
