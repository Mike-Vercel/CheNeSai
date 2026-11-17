import type { DettaglioInput } from "@/lib/tig/games/mechanics/solo-un-dettaglio";

/**
 * 68 · SOLO UN DETTAGLIO — clip ORIGINALI disegnate in codice: sfondo e oggetti del kit (le stesse icone di
 * Memoria lampo) animati a fotogrammi chiave (posizione, scala, rotazione, opacità), con i sottotitoli
 * dell'azione principale. La domanda riguarda sempre un dettaglio di contorno, mai l'azione raccontata, e mai
 * solo un colore (accessibilità): scritte, oggetti, direzioni, conteggi.
 * Coordinate in percentuale della tela 16:9; `solution.focus` = fermo immagine e cerchio del reveal.
 */
const varianti: DettaglioInput[] = [
  {
    id: "regionale-delle-18-40",
    difficulty: "facile",
    title: "Il regionale delle 18:40",
    clipMs: 10000,
    clip: {
      backdrop: "stazione",
      props: [
        { kind: "orologio", x: 50, y: 17, scale: 0.9, tone: "white", label: "18:37" },
        { kind: "poster", x: 14, y: 34, scale: 1.1, tone: "amber", label: "BINARIO 3" },
        { kind: "zaino", x: 30, y: 79, scale: 0.8, tone: "red" },
        { kind: "borraccia", x: 71, y: 82, scale: 0.6, tone: "cyan" },
      ],
      actors: [
        { kind: "valigia", tone: "lime", label: "FRAGILE", track: [{ at: 800, x: -12, y: 74, s: 1.2 }, { at: 6500, x: 112, y: 74, s: 1.2 }] },
        { kind: "palloncino", tone: "violet", label: "AUGURI", track: [{ at: 2000, x: 84, y: 72, s: 0.85 }, { at: 5000, x: 86, y: 42, s: 0.85 }, { at: 9500, x: 90, y: -12, s: 0.85 }] },
        { kind: "telefono", tone: "red", label: "IN RITARDO", track: [{ at: 6500, x: 63, y: 32, s: 0.9, o: 0 }, { at: 7000, x: 63, y: 32, s: 0.9, o: 1 }, { at: 10000, x: 63, y: 32, s: 0.9, o: 1 }] },
      ],
      captions: [
        { from: 400, to: 3500, text: "Binario 3: il regionale delle 18:40 è in arrivo" },
        { from: 3500, to: 7000, text: "Qualcuno corre con la valigia, come sempre" },
        { from: 7000, to: 10000, text: "Avviso: il treno viaggia in ritardo" },
      ],
    },
    alt: "Stazione, binario 3. In alto un grande orologio segna le 18:37, a sinistra un cartello «BINARIO 3», a terra uno zaino e una borraccia. Una valigia con la scritta «FRAGILE» attraversa la scena da sinistra a destra. Sullo sfondo, a destra, un palloncino con scritto «AUGURI» sale lentamente fino a sparire in alto. Alla fine compare un telefono con l'avviso «IN RITARDO».",
    prompt: "Cosa c'era scritto sul palloncino che saliva sullo sfondo?",
    options: [
      { id: "a", text: "AUGURI" },
      { id: "b", text: "SALDI" },
      { id: "c", text: "30 ANNI" },
      { id: "d", text: "BENVENUTI" },
    ],
    solution: { optionId: "a", focus: { at: 5000, x: 86, y: 42, r: 11 } },
    explain:
      "Il palloncino è comparso a destra dopo due secondi, mentre tutti guardavano la valigia, ed è salito fino a sparire: c'era scritto AUGURI. SALDI e BENVENUTI non sono mai comparsi, e IN RITARDO era sul telefono.",
  },
  {
    id: "valigia-della-domenica",
    difficulty: "facile",
    title: "La valigia della domenica",
    clipMs: 10000,
    clip: {
      backdrop: "camera",
      props: [
        { kind: "valigia", x: 50, y: 74, scale: 1.4, tone: "cyan", label: "WEEKEND" },
        { kind: "orologio", x: 20, y: 22, scale: 0.8, tone: "white", label: "07:15" },
        { kind: "lampada", x: 9, y: 56, scale: 0.9, tone: "amber" },
      ],
      actors: [
        { kind: "scarpe", tone: "red", track: [{ at: 500, x: 12, y: 42, s: 0.9 }, { at: 2200, x: 50, y: 70, s: 0.4, o: 0 }] },
        { kind: "libro", tone: "lime", label: "ROMANZO", track: [{ at: 2500, x: 88, y: 46, s: 0.8 }, { at: 4200, x: 50, y: 70, s: 0.4, o: 0 }] },
        { kind: "gatto", tone: "white", track: [{ at: 4500, x: 106, y: 60, s: 1 }, { at: 5200, x: 93, y: 60, s: 1 }, { at: 6200, x: 93, y: 60, s: 1 }, { at: 7000, x: 106, y: 60, s: 1 }] },
        { kind: "cuffie", tone: "violet", track: [{ at: 6500, x: 16, y: 32, s: 0.8 }, { at: 8200, x: 50, y: 70, s: 0.4, o: 0 }] },
      ],
      captions: [
        { from: 300, to: 3000, text: "Domenica: valigia da fare in cinque minuti" },
        { from: 3000, to: 6500, text: "Dentro tutto, senza piegare niente" },
        { from: 6500, to: 9800, text: "Le cuffie: ultime, ma fondamentali" },
      ],
    },
    alt: "Camera da letto con una finestra a destra, una lampada a sinistra e una sveglia che segna le 07:15. Al centro una valigia «WEEKEND». Volano dentro, una dopo l'altra, un paio di scarpe, un libro «ROMANZO» e delle cuffie. A metà clip un gatto fa capolino dal bordo destro e si ritira.",
    prompt: "Chi ha fatto capolino dal bordo destro della scena?",
    options: [
      { id: "a", text: "Un gatto" },
      { id: "b", text: "Un palloncino" },
      { id: "c", text: "Un ombrello" },
      { id: "d", text: "Nessuno" },
    ],
    solution: { optionId: "a", focus: { at: 5800, x: 93, y: 60, r: 12 } },
    explain:
      "Mentre il libro finiva in valigia, dal bordo destro è spuntato un gatto, è rimasto un secondo a guardare ed è tornato indietro. Nessun palloncino né ombrello in questa clip.",
  },
  {
    id: "festa-a-sorpresa-telefono",
    difficulty: "facile",
    title: "Sorpresa!",
    clipMs: 10000,
    clip: {
      backdrop: "festa",
      props: [
        { kind: "poster", x: 50, y: 26, scale: 1.2, tone: "lime", label: "AUGURI GIULIA" },
        { kind: "lampada", x: 8, y: 56, scale: 0.9, tone: "amber" },
        { kind: "pianta", x: 92, y: 72, scale: 0.9, tone: "lime" },
      ],
      actors: [
        { kind: "torta", tone: "violet", label: "SORPRESA!", track: [{ at: 600, x: 112, y: 67, s: 1.3 }, { at: 3500, x: 52, y: 67, s: 1.3 }, { at: 10000, x: 52, y: 67, s: 1.3 }] },
        { kind: "palloncino", tone: "red", label: "30", track: [{ at: 2000, x: 20, y: 96, s: 0.9 }, { at: 9800, x: 24, y: 6, s: 0.9 }] },
        { kind: "palloncino", tone: "cyan", track: [{ at: 3000, x: 78, y: 96, s: 0.8 }, { at: 9800, x: 74, y: 10, s: 0.8 }] },
        { kind: "telefono", tone: "cyan", label: "MAMMA", track: [{ at: 4000, x: 30, y: 70, s: 0.9, o: 0 }, { at: 4400, x: 30, y: 70, s: 0.9, o: 1 }, { at: 7000, x: 30, y: 70, s: 0.9, o: 1 }, { at: 7400, x: 30, y: 70, s: 0.9, o: 0 }] },
      ],
      captions: [
        { from: 300, to: 3500, text: "Luci spente, tutti zitti: arriva la torta!" },
        { from: 3500, to: 7000, text: "Tanti auguri a te, tanti auguri a te…" },
        { from: 7000, to: 9800, text: "E ora i palloncini, fino al soffitto" },
      ],
    },
    alt: "Sala addobbata con festoni, un poster «AUGURI GIULIA», una lampada e una pianta. Da destra entra una torta con scritto «SORPRESA!» e si ferma al centro. Due palloncini salgono verso il soffitto, uno con il numero 30. Sul tavolo, a sinistra, per qualche secondo si illumina un telefono: sta chiamando «MAMMA».",
    prompt: "Chi stava chiamando sul telefono appoggiato al tavolo?",
    options: [
      { id: "a", text: "Mamma" },
      { id: "b", text: "Papà" },
      { id: "c", text: "Il capo" },
      { id: "d", text: "Giulia" },
    ],
    solution: { optionId: "a", focus: { at: 5500, x: 30, y: 70, r: 10 } },
    explain:
      "Mentre tutti cantavano davanti alla torta, il telefono sul tavolo si è illuminato per tre secondi con la chiamata di MAMMA. Giulia era il nome sul poster, non sul telefono.",
  },
  {
    id: "smart-working-lunedi",
    difficulty: "media",
    title: "Smart working del lunedì",
    clipMs: 10000,
    clip: {
      backdrop: "ufficio",
      props: [
        { kind: "monitor", x: 50, y: 47, scale: 1.5, tone: "cyan", label: "RIUNIONE 9:00" },
        { kind: "tazza", x: 28, y: 63, scale: 0.7, tone: "amber", label: "LUNEDÌ" },
        { kind: "lampada", x: 72, y: 42, scale: 0.8, tone: "white" },
        { kind: "pianta", x: 88, y: 60, scale: 0.9, tone: "lime" },
      ],
      actors: [
        { kind: "postit", tone: "amber", label: "PAGARE AFFITTO", track: [{ at: 0, x: 62, y: 30, s: 0.6, r: -8 }, { at: 3500, x: 62, y: 30, s: 0.6, r: -8 }, { at: 5000, x: 65, y: 86, s: 0.6, r: 30 }, { at: 10000, x: 65, y: 86, s: 0.6, r: 30 }] },
        { kind: "cuffie", tone: "lime", track: [{ at: 600, x: 22, y: -15, s: 1 }, { at: 2500, x: 38, y: 52, s: 1 }, { at: 10000, x: 38, y: 52, s: 1 }] },
        { kind: "telefono", tone: "red", label: "SEI MUTO", track: [{ at: 6000, x: 20, y: 72, s: 0.8, o: 0 }, { at: 6400, x: 20, y: 72, s: 0.8, o: 1 }, { at: 10000, x: 20, y: 72, s: 0.8, o: 1 }] },
      ],
      captions: [
        { from: 400, to: 3200, text: "Lunedì, ore 9: si parte con la riunione" },
        { from: 3200, to: 6500, text: "«Mi sentite? Vi vedo a scatti»" },
        { from: 6500, to: 9800, text: "Il collega scrive: sei muto da dieci minuti" },
      ],
    },
    alt: "Scrivania di casa: un grande monitor mostra «RIUNIONE 9:00», con un post-it attaccato in alto a destra con scritto «PAGARE AFFITTO». Accanto una tazza «LUNEDÌ», una lampada e una pianta. Scendono delle cuffie sulla scrivania. Dopo qualche secondo il post-it si stacca e cade a terra. Compare un telefono con il messaggio «SEI MUTO».",
    prompt: "Cosa c'era scritto sul post-it caduto dallo schermo?",
    options: [
      { id: "a", text: "PAGARE AFFITTO" },
      { id: "b", text: "PAGARE BOLLETTA" },
      { id: "c", text: "CHIAMARE MAMMA" },
      { id: "d", text: "COMPRARE LATTE" },
    ],
    solution: { optionId: "a", focus: { at: 2000, x: 62, y: 30, r: 9 } },
    explain:
      "Il post-it era attaccato all'angolo del monitor fin dall'inizio e dopo tre secondi e mezzo è caduto a terra: diceva PAGARE AFFITTO. PAGARE BOLLETTA è la trappola per chi ricordava solo metà della scritta.",
  },
  {
    id: "gatto-della-coinquilina",
    difficulty: "media",
    title: "Il gatto della coinquilina",
    clipMs: 10000,
    clip: {
      backdrop: "soggiorno",
      props: [
        { kind: "calendario", x: 80, y: 22, scale: 1, tone: "red", label: "VENERDÌ 17" },
        { kind: "lampada", x: 93, y: 58, scale: 0.9, tone: "amber" },
        { kind: "libro", x: 30, y: 73, scale: 0.6, tone: "cyan", label: "RICETTE" },
        { kind: "pianta", x: 8, y: 60, scale: 1, tone: "lime" },
      ],
      actors: [
        { kind: "gatto", tone: "amber", track: [{ at: 500, x: -10, y: 68, s: 1.1 }, { at: 4000, x: 42, y: 68, s: 1.1 }, { at: 5500, x: 42, y: 68, s: 1.1 }, { at: 7000, x: 54, y: 62, s: 1.1 }, { at: 10000, x: 54, y: 62, s: 1.1 }] },
        { kind: "tazza", tone: "lime", label: "CAFFÈ", track: [{ at: 0, x: 60, y: 63, s: 0.7 }, { at: 7000, x: 60, y: 63, s: 0.7, r: 0 }, { at: 8000, x: 68, y: 85, s: 0.7, r: 90 }, { at: 10000, x: 68, y: 85, s: 0.7, r: 90 }] },
      ],
      captions: [
        { from: 400, to: 3800, text: "Il gatto della coinquilina entra in salotto" },
        { from: 3800, to: 7000, text: "Punta la tazza di caffè sul tavolino…" },
        { from: 7000, to: 9800, text: "…e la butta giù. Ovviamente." },
      ],
    },
    alt: "Salotto con un divano, una pianta a sinistra, una lampada a destra e un calendario appeso al muro che segna «VENERDÌ 17». Sul tavolino una tazza «CAFFÈ» e un libro «RICETTE». Un gatto entra da sinistra, si ferma, punta la tazza e con una zampata la fa cadere a terra.",
    prompt: "Che giorno segnava il calendario appeso al muro?",
    options: [
      { id: "a", text: "VENERDÌ 17" },
      { id: "b", text: "VENERDÌ 13" },
      { id: "c", text: "MARTEDÌ 17" },
      { id: "d", text: "SABATO 17" },
    ],
    solution: { optionId: "a", focus: { at: 3000, x: 80, y: 22, r: 11 } },
    explain:
      "Il calendario è rimasto in alto a destra per tutta la clip, mentre il gatto preparava il disastro: segnava VENERDÌ 17. Le altre opzioni cambiano solo il giorno o solo il numero, per chi se lo ricordava a metà.",
  },
  {
    id: "treno-della-notte",
    difficulty: "media",
    title: "Il treno della notte",
    clipMs: 10000,
    clip: {
      backdrop: "stazione",
      props: [
        { kind: "orologio", x: 50, y: 17, scale: 0.9, tone: "white", label: "23:58" },
        { kind: "poster", x: 86, y: 32, scale: 1.1, tone: "cyan", label: "BINARIO 5" },
        { kind: "borraccia", x: 12, y: 83, scale: 0.6, tone: "lime" },
      ],
      actors: [
        { kind: "zaino", tone: "lime", track: [{ at: 500, x: -10, y: 70, s: 1.1 }, { at: 3000, x: 40, y: 70, s: 1.1 }, { at: 7000, x: 112, y: 70, s: 1.1 }] },
        { kind: "biglietto", tone: "amber", label: "CARROZZA 7", track: [{ at: 3000, x: 40, y: 70, s: 0.75, r: 0 }, { at: 4200, x: 44, y: 87, s: 0.75, r: -15 }, { at: 10000, x: 44, y: 87, s: 0.75, r: -15 }] },
        { kind: "valigia", tone: "red", track: [{ at: 5000, x: -12, y: 72, s: 1.2 }, { at: 10000, x: 62, y: 72, s: 1.2 }] },
      ],
      captions: [
        { from: 300, to: 3000, text: "Ultimo treno della notte, binario 5" },
        { from: 3000, to: 6500, text: "Corsa disperata con lo zaino in spalla" },
        { from: 6500, to: 9800, text: "Arriva anche la valigia. Ce la faranno?" },
      ],
    },
    alt: "Stazione di notte: l'orologio segna le 23:58, a destra il cartello «BINARIO 5», a terra una borraccia. Uno zaino attraversa di corsa la scena da sinistra a destra e a metà strada perde un biglietto, che cade a terra e resta lì: c'è scritto «CARROZZA 7». Poi da sinistra arriva una valigia.",
    prompt: "Cosa c'era scritto sul biglietto caduto a terra?",
    options: [
      { id: "a", text: "CARROZZA 7" },
      { id: "b", text: "CARROZZA 9" },
      { id: "c", text: "BINARIO 7" },
      { id: "d", text: "POSTO 7" },
    ],
    solution: { optionId: "a", focus: { at: 6000, x: 44, y: 87, r: 10 } },
    explain:
      "Il biglietto è scivolato dallo zaino dopo tre secondi ed è rimasto a terra fino alla fine: diceva CARROZZA 7. BINARIO era il cartello (5, non 7) e il posto non era scritto da nessuna parte.",
  },
  {
    id: "pausa-caffe-ombrello",
    difficulty: "media",
    title: "La pausa caffè",
    clipMs: 10000,
    clip: {
      backdrop: "ufficio",
      props: [
        { kind: "monitor", x: 70, y: 46, scale: 1.2, tone: "cyan", label: "ORE 11:00" },
        { kind: "lampada", x: 92, y: 46, scale: 0.8, tone: "white" },
        { kind: "pianta", x: 48, y: 58, scale: 0.8, tone: "lime" },
      ],
      actors: [
        { kind: "tazza", tone: "amber", label: "CAFFÈ", track: [{ at: 500, x: 110, y: 62, s: 0.9 }, { at: 3500, x: 57, y: 62, s: 0.9 }, { at: 10000, x: 57, y: 62, s: 0.9 }] },
        { kind: "ombrello", tone: "cyan", track: [{ at: 3500, x: 36, y: 22, s: 0.8, o: 0 }, { at: 4000, x: 33, y: 22, s: 0.8, o: 1 }, { at: 7500, x: 3, y: 22, s: 0.8, o: 1 }, { at: 8000, x: 0, y: 22, s: 0.8, o: 0 }] },
        { kind: "telefono", tone: "red", label: "PAUSA FINITA", track: [{ at: 7000, x: 82, y: 74, s: 0.8, o: 0 }, { at: 7400, x: 82, y: 74, s: 0.8, o: 1 }, { at: 10000, x: 82, y: 74, s: 0.8, o: 1 }] },
      ],
      captions: [
        { from: 300, to: 3500, text: "Pausa caffè: arriva il pettegolezzo del giorno" },
        { from: 3500, to: 7000, text: "«Hai sentito chi lascia il progetto?»" },
        { from: 7000, to: 9800, text: "Il capo scrive in chat. Tutti al lavoro!" },
      ],
    },
    alt: "Ufficio con una finestra in alto a sinistra, un monitor che segna «ORE 11:00», una lampada e una pianta. Da destra arriva una tazza «CAFFÈ» che si ferma sulla scrivania. Intanto, davanti alla finestra, passa un ombrello da destra verso sinistra. Alla fine compare un telefono con il messaggio «PAUSA FINITA».",
    prompt: "In che direzione è passato l'ombrello davanti alla finestra?",
    options: [
      { id: "a", text: "Da destra a sinistra" },
      { id: "b", text: "Da sinistra a destra" },
      { id: "c", text: "Dall'alto in basso" },
      { id: "d", text: "Non è passato nessun ombrello" },
    ],
    solution: { optionId: "a", focus: { at: 5500, x: 22, y: 22, r: 10 } },
    explain:
      "Mentre la tazza si fermava sulla scrivania e partiva il pettegolezzo, un ombrello è comparso sul lato destro della finestra ed è uscito dal lato sinistro: da destra a sinistra.",
  },
  {
    id: "aperitivo-in-terrazza",
    difficulty: "difficile",
    title: "Aperitivo in terrazza",
    clipMs: 11000,
    clip: {
      backdrop: "festa",
      props: [
        { kind: "poster", x: 84, y: 30, scale: 1, tone: "violet", label: "KARAOKE GIOVEDÌ" },
        { kind: "lampada", x: 9, y: 58, scale: 0.9, tone: "amber" },
        { kind: "pianta", x: 93, y: 74, scale: 0.9, tone: "lime" },
        { kind: "tazza", x: 30, y: 64, scale: 0.6, tone: "white" },
      ],
      actors: [
        { kind: "pizza", tone: "amber", label: "4 STAGIONI", track: [{ at: 500, x: 50, y: -15, s: 1.3 }, { at: 2500, x: 52, y: 63, s: 1.3 }, { at: 11000, x: 52, y: 63, s: 1.3 }] },
        { kind: "telefono", tone: "cyan", label: "FOTO!", track: [{ at: 4000, x: 30, y: 46, s: 0.9, o: 0 }, { at: 4400, x: 30, y: 46, s: 0.9, o: 1 }, { at: 7000, x: 30, y: 46, s: 0.9, o: 1 }, { at: 7400, x: 30, y: 46, s: 0.9, o: 0 }] },
        { kind: "palloncino", tone: "lime", label: "30", track: [{ at: 5000, x: -10, y: 22, s: 0.7 }, { at: 10500, x: 110, y: 14, s: 0.7 }] },
      ],
      captions: [
        { from: 300, to: 3000, text: "Arriva la pizza gigante per il tavolo" },
        { from: 3000, to: 7000, text: "Foto di gruppo prima che si raffreddi" },
        { from: 7000, to: 10800, text: "Chi prende l'ultima fetta?" },
      ],
    },
    alt: "Terrazza addobbata a festa. Sul muro a destra un poster con scritto «KARAOKE GIOVEDÌ», a sinistra una lampada, a destra una pianta, sul tavolo una tazza. Dall'alto scende una pizza gigante «4 STAGIONI» che si posa sul tavolo. Compare un telefono con la scritta «FOTO!» e un palloncino con il numero 30 attraversa il cielo da sinistra a destra.",
    prompt: "Che serata pubblicizzava il poster appeso al muro?",
    options: [
      { id: "a", text: "KARAOKE GIOVEDÌ" },
      { id: "b", text: "KARAOKE VENERDÌ" },
      { id: "c", text: "QUIZ GIOVEDÌ" },
      { id: "d", text: "DJ SET SABATO" },
    ],
    solution: { optionId: "a", focus: { at: 6000, x: 84, y: 30, r: 12 } },
    explain:
      "Il poster è rimasto appeso a destra per tutta la clip, ma l'occhio era sulla pizza e sul telefono: diceva KARAOKE GIOVEDÌ. Il venerdì e il quiz sono trappole costruite sulle due metà della scritta.",
  },
  {
    id: "candele-sulla-mensola",
    difficulty: "difficile",
    title: "La cena è servita",
    clipMs: 10000,
    clip: {
      backdrop: "cucina",
      props: [
        { kind: "candela", x: 68, y: 27, scale: 0.55, tone: "amber" },
        { kind: "candela", x: 75, y: 27, scale: 0.55, tone: "amber" },
        { kind: "candela", x: 82, y: 27, scale: 0.55, tone: "amber" },
        { kind: "tazza", x: 89, y: 27, scale: 0.55, tone: "white" },
        { kind: "libro", x: 60, y: 27, scale: 0.55, tone: "cyan" },
        { kind: "lampada", x: 12, y: 54, scale: 0.9, tone: "white" },
        { kind: "pianta", x: 93, y: 66, scale: 0.9, tone: "lime" },
      ],
      actors: [
        { kind: "pizza", tone: "amber", label: "MARGHERITA", track: [{ at: 500, x: -15, y: 70, s: 1.3 }, { at: 3000, x: 42, y: 70, s: 1.3 }, { at: 10000, x: 42, y: 70, s: 1.3 }] },
        { kind: "torta", tone: "violet", label: "TIRAMISÙ", track: [{ at: 6000, x: 112, y: 72, s: 1.1 }, { at: 8000, x: 72, y: 72, s: 1.1 }, { at: 10000, x: 72, y: 72, s: 1.1 }] },
        { kind: "borraccia", tone: "cyan", track: [{ at: 3500, x: 25, y: 70, s: 0.7, o: 0 }, { at: 4000, x: 25, y: 70, s: 0.7, o: 1 }, { at: 10000, x: 25, y: 70, s: 0.7, o: 1 }] },
      ],
      captions: [
        { from: 300, to: 3000, text: "La pizza esce dal forno" },
        { from: 3000, to: 6000, text: "Tutti a tavola, si mangia" },
        { from: 6000, to: 9800, text: "E per dolce… il tiramisù della casa" },
      ],
    },
    alt: "Cucina con una mensola in alto a destra: sopra ci sono un libro, tre candele e una tazza. Più in basso una lampada a sinistra e una pianta a destra. Da sinistra scivola sul tavolo una pizza «MARGHERITA», compare una borraccia, poi da destra arriva una torta «TIRAMISÙ».",
    prompt: "Quante candele c'erano sulla mensola in alto?",
    options: [
      { id: "a", text: "Tre" },
      { id: "b", text: "Due" },
      { id: "c", text: "Quattro" },
      { id: "d", text: "Cinque" },
    ],
    solution: { optionId: "a", focus: { at: 4000, x: 75, y: 27, r: 12 } },
    explain:
      "Sulla mensola in alto a destra, tra un libro e una tazza, c'erano tre candele, ferme per tutta la clip. La pizza e il tiramisù rubavano la scena, ma sulla mensola non è cambiato nulla.",
  },
  {
    id: "domenica-di-pioggia",
    difficulty: "difficile",
    title: "Domenica di pioggia",
    clipMs: 10000,
    clip: {
      backdrop: "camera",
      props: [
        { kind: "lampada", x: 10, y: 52, scale: 0.9, tone: "amber" },
        { kind: "pianta", x: 93, y: 66, scale: 0.9, tone: "lime" },
        { kind: "occhiali", x: 42, y: 82, scale: 0.6, tone: "white" },
        { kind: "ombrello", x: 82, y: 72, scale: 0.8, tone: "cyan" },
      ],
      actors: [
        { kind: "laptop", tone: "cyan", label: "EPISODIO 4", track: [{ at: 0, x: 56, y: 64, s: 1.4 }, { at: 5000, x: 56, y: 64, s: 1.4 }] },
        { kind: "laptop", tone: "violet", label: "EPISODIO 5", track: [{ at: 5000, x: 56, y: 64, s: 1.4 }, { at: 10000, x: 56, y: 64, s: 1.4 }] },
        {
          kind: "telefono",
          tone: "lime",
          label: "NOTIFICA",
          track: [
            { at: 1500, x: 25, y: 62, s: 0.8, o: 0 },
            { at: 1700, x: 25, y: 62, s: 0.8, o: 1 },
            { at: 2700, x: 25, y: 62, s: 0.8, o: 0 },
            { at: 4900, x: 25, y: 62, s: 0.8, o: 0 },
            { at: 5100, x: 25, y: 62, s: 0.8, o: 1 },
            { at: 6100, x: 25, y: 62, s: 0.8, o: 0 },
            { at: 8100, x: 25, y: 62, s: 0.8, o: 0 },
            { at: 8300, x: 25, y: 62, s: 0.8, o: 1 },
            { at: 9300, x: 25, y: 62, s: 0.8, o: 0 },
          ],
        },
      ],
      captions: [
        { from: 300, to: 4800, text: "Domenica di pioggia: maratona di serie" },
        { from: 5000, to: 9800, text: "«Ancora un episodio e poi basta». Certo." },
      ],
    },
    alt: "Camera da letto in un giorno di pioggia: una lampada a sinistra, una pianta e un ombrello a destra, un paio di occhiali sul pavimento. Al centro un portatile mostra «EPISODIO 4» e poi passa a «EPISODIO 5». A sinistra un telefono «NOTIFICA» si illumina tre volte e si spegne.",
    prompt: "Quante volte si è illuminato il telefono a sinistra?",
    options: [
      { id: "a", text: "Tre volte" },
      { id: "b", text: "Due volte" },
      { id: "c", text: "Quattro volte" },
      { id: "d", text: "Una volta" },
    ],
    solution: { optionId: "a", focus: { at: 5200, x: 25, y: 62, r: 10 } },
    explain:
      "Il telefono si è acceso tre volte: verso i 2 secondi, a metà clip proprio mentre partiva l'episodio 5, e verso gli 8 secondi. Chi guardava il portatile di solito ne conta due.",
  },
];

export default varianti;
