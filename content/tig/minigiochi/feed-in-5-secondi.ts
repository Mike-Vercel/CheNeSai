import type { IconKind, Tone } from "@/lib/tig/games/components/art";
import type { FeedInput } from "@/lib/tig/games/mechanics/feed-in-5-secondi";
import type { ArtInput, ShapeInput } from "@/lib/tig/games/mechanics/m1/draw";

/**
 * 13 · FEED IN 5 SECONDI — varianti. Feed INVENTATI: account di fantasia, luoghi generici, foto disegnate
 * in codice (sfondi semplici + icone del kit), didascalie brevi. La domanda è su un particolare grande
 * (account, luogo, «mi piace», quanto tempo fa) di un post riconoscibile dalla foto, e lo schema verifica
 * che la risposta giusta sia proprio quella del post. Le risposte sbagliate sono spesso valori di ALTRI post.
 */

type It = { kind: IconKind; x?: number; y?: number; s?: number; tone?: Tone; label?: string; flip?: boolean; rot?: number };
type Post = FeedInput["posts"][number];

const icon = (i: It): ShapeInput => ({ k: "icon", x: 50, y: 56, s: 46, tone: "white", ...i });

// --- sfondi delle foto (tela 100×100) ----------------------------------------

const SFONDI = {
  mare: [
    { k: "rect", x: 0, y: 0, w: 100, h: 52, c: "cielo" },
    { k: "ell", x: 78, y: 18, rx: 9, ry: 9, c: "giallo" },
    { k: "rect", x: 0, y: 52, w: 100, h: 18, c: "mare2" },
    { k: "rect", x: 0, y: 70, w: 100, h: 30, c: "sabbia" },
  ],
  tavola: [
    { k: "rect", x: 0, y: 0, w: 100, h: 62, c: "acciaio" },
    { k: "rect", x: 0, y: 62, w: 100, h: 38, c: "legno" },
    { k: "rect", x: 0, y: 62, w: 100, h: 2, c: "legno2" },
  ],
  prato: [
    { k: "rect", x: 0, y: 0, w: 100, h: 60, c: "cielo2" },
    { k: "ell", x: 20, y: 40, rx: 16, ry: 14, c: "prato2" },
    { k: "rect", x: 18, y: 50, w: 4, h: 14, c: "marrone" },
    { k: "rect", x: 0, y: 60, w: 100, h: 40, c: "prato" },
  ],
  notte: [
    { k: "rect", x: 0, y: 0, w: 100, h: 100, c: "notte" },
    { k: "ell", x: 80, y: 18, rx: 8, ry: 8, c: "panna" },
    { k: "ell", x: 84, y: 15, rx: 7, ry: 7, c: "notte" },
    { k: "ell", x: 20, y: 14, rx: 0.9, ry: 0.9, c: "bianco" },
    { k: "ell", x: 44, y: 24, rx: 0.8, ry: 0.8, c: "bianco" },
    { k: "ell", x: 62, y: 10, rx: 0.9, ry: 0.9, c: "bianco" },
    { k: "rect", x: 0, y: 76, w: 100, h: 24, c: "acciaio" },
  ],
  stanza: [
    { k: "rect", x: 0, y: 0, w: 100, h: 72, c: "grafite" },
    { k: "rect", x: 64, y: 10, w: 26, h: 22, r: 1, c: "cielo" },
    { k: "rect", x: 76, y: 10, w: 2, h: 22, c: "bianco" },
    { k: "rect", x: 0, y: 72, w: 100, h: 28, c: "legno2" },
  ],
  neve: [
    { k: "rect", x: 0, y: 0, w: 100, h: 100, c: "cielo2" },
    { k: "poly", p: [0, 70, 30, 30, 55, 70], c: "grigio" },
    { k: "poly", p: [30, 70, 66, 20, 100, 70], c: "grigio2" },
    { k: "poly", p: [58, 31, 66, 20, 74, 31], c: "neve" },
    { k: "rect", x: 0, y: 70, w: 100, h: 30, c: "neve" },
  ],
  citta: [
    { k: "rect", x: 0, y: 0, w: 100, h: 100, c: "tramonto" },
    { k: "rect", x: 4, y: 40, w: 18, h: 60, c: "grafite" },
    { k: "rect", x: 26, y: 26, w: 16, h: 74, c: "acciaio" },
    { k: "rect", x: 70, y: 34, w: 24, h: 66, c: "grafite" },
    { k: "rect", x: 8, y: 48, w: 4, h: 4, c: "giallo" },
    { k: "rect", x: 30, y: 34, w: 4, h: 4, c: "giallo" },
    { k: "rect", x: 76, y: 44, w: 4, h: 4, c: "giallo" },
    { k: "rect", x: 84, y: 56, w: 4, h: 4, c: "giallo" },
  ],
  ufficio: [
    { k: "rect", x: 0, y: 0, w: 100, h: 66, c: "acciaio" },
    { k: "rect", x: 8, y: 8, w: 30, h: 20, r: 1, c: "grafite" },
    { k: "rect", x: 0, y: 66, w: 100, h: 34, c: "grigio2" },
  ],
} satisfies Record<string, ShapeInput[]>;

function foto(sfondo: keyof typeof SFONDI, items: It[]): ArtInput {
  return { w: 100, h: 100, bg: "grafite", shapes: [...SFONDI[sfondo], ...items.map(icon)] };
}

function post(author: string, place: string, ago: string, likes: number, caption: string, art: ArtInput, alt: string): Post {
  return { author, place, ago, likes, caption, art, alt };
}

const varianti: FeedInput[] = [
  {
    id: "gatto-sul-divano",
    difficulty: "facile",
    posts: [
      post("@giuli.cucina", "Bologna", "2 h", 1204, "Primo tiramisù della mia vita, non giudicate", foto("tavola", [{ kind: "torta", label: "TIRAMISÙ", tone: "amber", s: 52 }]), "Un tiramisù su un tavolo di legno."),
      post("@marco_corre", "Parco Nord", "5 h", 87, "10 km prima di colazione. Poi ho dormito.", foto("prato", [{ kind: "scarpe", tone: "lime", x: 58, y: 70, s: 44 }]), "Scarpe da corsa sull'erba del parco."),
      post("@casa.di.fede", "Sul divano", "ieri", 3410, "Ha deciso che il divano è suo", foto("stanza", [{ kind: "gatto", tone: "amber", x: 46, y: 58, s: 56 }]), "Un gatto rosso seduto in salotto."),
      post("@ale.viaggia", "Lisbona", "2 g", 512, "Valigia chiusa al terzo tentativo", foto("citta", [{ kind: "valigia", label: "LISBONA", tone: "violet", x: 52, y: 62, s: 50 }]), "Una valigia con l'etichetta «Lisbona» davanti ai palazzi al tramonto."),
      post("@bea.ufficio", "Ufficio", "3 min", 45, "Lunedì, terzo caffè e sono le 9", foto("ufficio", [{ kind: "tazza", label: "3°", tone: "red", x: 50, y: 60, s: 44 }]), "Una tazza con scritto «3°» sulla scrivania dell'ufficio."),
    ],
    prompt: "Chi aveva pubblicato la foto del gatto?",
    options: [
      { id: "fede", text: "@casa.di.fede" },
      { id: "giuli", text: "@giuli.cucina" },
      { id: "bea", text: "@bea.ufficio" },
      { id: "marta", text: "@casa.di.marta" },
    ],
    check: { k: "di", kind: "gatto", field: "author" },
    solution: { optionId: "fede" },
    explain: "Il gatto era nel terzo post, quello di @casa.di.fede, «sul divano». @casa.di.marta non c'era proprio: suonava solo familiare.",
  },
  {
    id: "pizza-del-sabato",
    difficulty: "media",
    posts: [
      post("@tommi.in.bici", "Lungomare", "1 h", 230, "Vento contro all'andata E al ritorno", foto("mare", [{ kind: "occhiali", tone: "white", x: 50, y: 82, s: 36 }]), "Occhiali da sole appoggiati sulla sabbia, mare e sole dietro."),
      post("@la.vale.legge", "Biblioteca", "3 h", 76, "Capitolo 1 di 54. Ci sentiamo a Natale", foto("stanza", [{ kind: "libro", label: "54 CAPITOLI", tone: "cyan", x: 44, y: 56, s: 48 }]), "Un libro con scritto «54 capitoli» in una stanza."),
      post("@pizza.e.amici", "Da Gino", "4 h", 1890, "Sabato sera, quattro stagioni per quattro amici", foto("tavola", [{ kind: "pizza", label: "4 STAGIONI", tone: "red", s: 56 }]), "Un cartone di pizza «4 stagioni» su un tavolo."),
      post("@nico.studia", "Camera mia", "6 h", 1980, "Sessione d'esame, giorno 12", foto("notte", [{ kind: "lampada", tone: "amber", x: 40, y: 58, s: 44 }]), "Una lampada accesa di notte."),
      post("@sara.piante", "Balcone", "ieri", 402, "Il basilico è sopravvissuto alla settimana", foto("prato", [{ kind: "pianta", tone: "lime", x: 60, y: 62, s: 48 }]), "Una piantina di basilico all'aperto."),
    ],
    prompt: "Quanti «mi piace» aveva il post della pizza?",
    options: [
      { id: "1890", text: "1.890" },
      { id: "1980", text: "1.980" },
      { id: "1089", text: "1.089" },
      { id: "189", text: "189" },
    ],
    check: { k: "di", kind: "pizza", field: "likes" },
    solution: { optionId: "1890" },
    explain: "La pizza di @pizza.e.amici aveva 1.890 mi piace. 1.980 erano quelli della lampada di @nico.studia, il post subito dopo.",
  },
  {
    id: "valigia-in-partenza",
    difficulty: "media",
    posts: [
      post("@luca.cammina", "Dolomiti", "1 h", 640, "Quota 2000, gambe a quota zero", foto("neve", [{ kind: "zaino", tone: "red", x: 48, y: 74, s: 40 }]), "Uno zaino rosso sulla neve con le montagne dietro."),
      post("@ire.e.basta", "Napoli", "2 h", 1312, "Il caffè qui è un'altra cosa", foto("tavola", [{ kind: "tazza", label: "CAFFÈ", tone: "white", s: 44 }]), "Una tazzina di caffè su un tavolo."),
      post("@weekend.lungo", "Aeroporto", "4 h", 288, "Gate cambiato due volte, valigia ancora con me", foto("citta", [{ kind: "valigia", label: "AMSTERDAM", tone: "cyan", x: 52, y: 62, s: 52 }]), "Una valigia «Amsterdam» davanti ai palazzi al tramonto."),
      post("@chef.per.caso", "Torino", "5 h", 97, "Risotto venuto. Cucina meno", foto("tavola", [{ kind: "pizza", label: "RISOTTO", tone: "amber", s: 52 }]), "Una vaschetta con scritto «Risotto» su un tavolo."),
      post("@giada.ride", "Rimini", "ieri", 2201, "Ultimo bagno della stagione (forse)", foto("mare", [{ kind: "ombrello", tone: "red", x: 32, y: 66, s: 46 }]), "Un ombrellone rosso sulla spiaggia."),
    ],
    prompt: "Dove era stata scattata la foto della valigia?",
    options: [
      { id: "aeroporto", text: "Aeroporto" },
      { id: "amsterdam", text: "Amsterdam" },
      { id: "napoli", text: "Napoli" },
      { id: "torino", text: "Torino" },
    ],
    check: { k: "di", kind: "valigia", field: "place" },
    solution: { optionId: "aeroporto" },
    explain: "Il luogo del post della valigia era «Aeroporto». «Amsterdam» era scritto sull'etichetta della valigia: la destinazione, non il posto della foto.",
  },
  {
    id: "cuffie-in-treno",
    difficulty: "difficile",
    posts: [
      post("@sofi.suona", "Sala prove", "20 min", 154, "Prima prova con la band nuova", foto("stanza", [{ kind: "cuffie", tone: "violet", x: 44, y: 56, s: 50 }]), "Delle cuffie viola in una stanza."),
      post("@pendolare.zen", "Treno delle 7:40", "2 h", 66, "Mezz'ora di ritardo, playlist finita", foto("citta", [{ kind: "telefono", label: "RITARDO", tone: "red", x: 50, y: 60, s: 40 }]), "Un telefono con scritto «Ritardo» davanti alla città."),
      post("@dani.torte", "Pasticceria", "1 h", 830, "Ordine speciale: 40 anni e 40 candeline", foto("tavola", [{ kind: "torta", label: "40", tone: "violet", s: 52 }]), "Una torta con il numero 40."),
      post("@mare.dentro", "Liguria", "3 h", 1420, "Acqua fredda, sole caldo, pace", foto("mare", [{ kind: "borraccia", tone: "cyan", x: 66, y: 80, s: 30 }]), "Una borraccia sulla spiaggia ligure."),
      post("@giorgio.gioca", "Salotto", "20 h", 503, "Livello finito alle 3 di notte", foto("notte", [{ kind: "monitor", label: "VINTO!", tone: "lime", x: 50, y: 58, s: 54 }]), "Uno schermo con scritto «Vinto!» di notte."),
    ],
    prompt: "Quanto tempo fa era stato pubblicato il post delle cuffie?",
    options: [
      { id: "20min", text: "20 min" },
      { id: "20h", text: "20 h" },
      { id: "2h", text: "2 h" },
      { id: "1h", text: "1 h" },
    ],
    check: { k: "di", kind: "cuffie", field: "ago" },
    solution: { optionId: "20min" },
    explain: "Le cuffie erano nel primo post, di 20 minuti fa. «20 h» era il post dello schermo «Vinto!», l'ultimo: stesso numero, unità diversa.",
  },
  {
    id: "torta-di-compleanno",
    difficulty: "facile",
    posts: [
      post("@chiara.corre", "Pista di atletica", "1 h", 120, "Nuovo record sui 5 km", foto("prato", [{ kind: "orologio", label: "24:58", tone: "lime", x: 56, y: 62, s: 44 }]), "Un cronometro che segna 24:58 sul prato."),
      post("@festa.di.leo", "Casa di Leo", "2 h", 950, "Trent'anni e non sentirli (li sento)", foto("tavola", [{ kind: "torta", label: "30", tone: "red", s: 54 }]), "Una torta con il numero 30."),
      post("@mattia.cucina", "Cucina", "3 h", 61, "La pasta al pesto più verde di sempre", foto("tavola", [{ kind: "pianta", tone: "lime", s: 44 }]), "Un vaso di basilico su un tavolo."),
      post("@viaggi.di.ele", "Parigi", "ieri", 1702, "Arrivati, finalmente", foto("citta", [{ kind: "biglietto", label: "PARIGI", tone: "amber", x: 52, y: 62, s: 50 }]), "Un biglietto «Parigi» davanti ai palazzi."),
      post("@gatti.di.casa", "Salotto", "2 g", 2890, "Ancora lui. Sempre lui.", foto("stanza", [{ kind: "gatto", tone: "white", x: 46, y: 58, s: 54 }]), "Un gatto bianco in salotto."),
    ],
    prompt: "Chi aveva pubblicato la foto della torta?",
    options: [
      { id: "leo", text: "@festa.di.leo" },
      { id: "mattia", text: "@mattia.cucina" },
      { id: "chiara", text: "@chiara.corre" },
      { id: "dani", text: "@dani.torte" },
    ],
    check: { k: "di", kind: "torta", field: "author" },
    solution: { optionId: "leo" },
    explain: "La torta col 30 era di @festa.di.leo, secondo post. @dani.torte suona perfetto per una torta, ma in questo feed non c'era.",
  },
  {
    id: "mi-piace-simili",
    difficulty: "difficile",
    posts: [
      post("@ricky.palestra", "Palestra", "1 h", 1240, "Giorno delle gambe: domani non cammino", foto("stanza", [{ kind: "borraccia", tone: "lime", x: 44, y: 60, s: 46 }]), "Una borraccia verde in una stanza."),
      post("@elena.dipinge", "Studio", "2 h", 1420, "Quadro finito dopo tre mesi", foto("stanza", [{ kind: "poster", label: "TRAMONTO", tone: "amber", x: 42, y: 52, s: 50 }]), "Un quadro intitolato «Tramonto» appeso al muro."),
      post("@spesa.smart", "Supermercato", "3 h", 214, "Andato per il latte, uscito con 12 cose", foto("tavola", [{ kind: "portafoglio", tone: "red", s: 46 }]), "Un portafoglio rosso su un tavolo."),
      post("@lorenzo.legge", "Treno", "5 h", 1024, "Ho finito il libro prima della mia fermata", foto("citta", [{ kind: "libro", label: "FINE", tone: "cyan", x: 50, y: 62, s: 46 }]), "Un libro con scritto «Fine» davanti alla città."),
      post("@ombrelli.persi", "Fermata del bus", "ieri", 4102, "Terzo ombrello perso a novembre", foto("citta", [{ kind: "ombrello", tone: "violet", x: 50, y: 60, s: 50 }]), "Un ombrello viola davanti ai palazzi."),
    ],
    prompt: "Quanti «mi piace» aveva il post del quadro?",
    options: [
      { id: "1420", text: "1.420" },
      { id: "1240", text: "1.240" },
      { id: "1024", text: "1.024" },
      { id: "4102", text: "4.102" },
    ],
    check: { k: "di", kind: "poster", field: "likes" },
    solution: { optionId: "1420" },
    explain: "Il quadro «Tramonto» di @elena.dipinge aveva 1.420 mi piace. Tutte le altre risposte erano like veri, ma di altri post con le stesse cifre.",
  },
  {
    id: "palloncino-al-parco",
    difficulty: "media",
    posts: [
      post("@marta.e.figli", "Parco comunale", "30 min", 312, "Domenica, palloncino perso dopo 4 minuti", foto("prato", [{ kind: "palloncino", tone: "red", x: 64, y: 30, s: 44 }]), "Un palloncino rosso che vola sopra il prato."),
      post("@caffe.bar.sport", "Piazza Garibaldi", "1 h", 58, "Il cornetto è finito alle 8:05", foto("tavola", [{ kind: "tazza", label: "BAR", tone: "white", s: 44 }]), "Una tazza con scritto «Bar» su un bancone."),
      post("@alpinista.pigro", "Rifugio", "2 h", 744, "Salito in funivia, conta lo stesso", foto("neve", [{ kind: "zaino", tone: "amber", x: 50, y: 76, s: 40 }]), "Uno zaino arancione sulla neve."),
      post("@notte.fonda", "Lungofiume", "4 h", 199, "Luna piena e nessuno in giro", foto("notte", [{ kind: "chiavi", tone: "amber", x: 50, y: 82, s: 30 }]), "Delle chiavi su un muretto di notte."),
      post("@cucina.di.nonna", "Casa della nonna", "ieri", 3075, "Lasagne della domenica, voto 11", foto("tavola", [{ kind: "pizza", label: "LASAGNE", tone: "red", s: 54 }]), "Una teglia con scritto «Lasagne»."),
    ],
    prompt: "Dove era stata scattata la foto del palloncino?",
    options: [
      { id: "parco", text: "Parco comunale" },
      { id: "piazza", text: "Piazza Garibaldi" },
      { id: "fiume", text: "Lungofiume" },
      { id: "giardini", text: "Giardini pubblici" },
    ],
    check: { k: "di", kind: "palloncino", field: "place" },
    solution: { optionId: "parco" },
    explain: "Il palloncino perso era al «Parco comunale», primo post. Piazza Garibaldi era il bar, il lungofiume la foto notturna.",
  },
  {
    id: "quarto-post",
    difficulty: "difficile",
    posts: [
      post("@laura.in.giro", "Firenze", "1 h", 880, "Un gelato prima del treno", foto("citta", [{ kind: "biglietto", label: "FIRENZE", tone: "lime", x: 52, y: 62, s: 48 }]), "Un biglietto «Firenze» davanti ai palazzi."),
      post("@paolo.e.paolo", "Spiaggia libera", "2 h", 1544, "Castello di sabbia: crollato", foto("mare", [{ kind: "borraccia", tone: "amber", x: 36, y: 80, s: 30 }]), "Una borraccia arancione sulla sabbia."),
      post("@studio.legale.no", "Ufficio", "3 h", 32, "Riunione che poteva essere una mail", foto("ufficio", [{ kind: "laptop", label: "47 MAIL", tone: "cyan", x: 50, y: 62, s: 52 }]), "Un portatile con scritto «47 mail» in ufficio."),
      post("@paola.e.basta", "Casa", "5 h", 2600, "Il letto oggi vince 3 a 0", foto("stanza", [{ kind: "lampada", tone: "violet", x: 34, y: 58, s: 44 }]), "Una lampada viola in camera."),
      post("@giro.in.moto", "Passo dello Stelvio", "ieri", 1999, "Quarantotto tornanti, zero rimpianti", foto("neve", [{ kind: "chiavi", tone: "amber", x: 50, y: 82, s: 32 }]), "Delle chiavi sulla neve, montagne dietro."),
    ],
    prompt: "Chi aveva pubblicato il quarto post del feed?",
    options: [
      { id: "paola", text: "@paola.e.basta" },
      { id: "paolo", text: "@paolo.e.paolo" },
      { id: "laura", text: "@laura.in.giro" },
      { id: "moto", text: "@giro.in.moto" },
    ],
    check: { k: "post", post: 3, field: "author" },
    solution: { optionId: "paola" },
    explain: "Il quarto post era la lampada viola di @paola.e.basta («il letto oggi vince 3 a 0»). @paolo.e.paolo era il secondo: nome quasi uguale, post diverso.",
  },
  {
    id: "biglietto-del-concerto",
    difficulty: "facile",
    posts: [
      post("@musica.ovunque", "Palazzetto", "15 min", 702, "Prima fila, voce già finita", foto("notte", [{ kind: "biglietto", label: "CONCERTO", tone: "violet", x: 50, y: 58, s: 54 }]), "Un biglietto «Concerto» di notte."),
      post("@colazione.lenta", "Bar sotto casa", "1 h", 133, "Cappuccino e brioche, non disturbare", foto("tavola", [{ kind: "tazza", label: "CAPPUCCINO", tone: "white", s: 46 }]), "Una tazza «Cappuccino» su un tavolo."),
      post("@giardino.segreto", "Orto", "3 h", 260, "Prima zucchina del raccolto", foto("prato", [{ kind: "pianta", tone: "lime", x: 60, y: 64, s: 46 }]), "Una pianta nell'orto."),
      post("@cane.no.gatto.si", "Divano", "6 h", 3999, "Non si sposta. Mai.", foto("stanza", [{ kind: "gatto", tone: "amber", x: 48, y: 58, s: 54 }]), "Un gatto rosso in salotto."),
      post("@viaggio.low.cost", "Stazione", "ieri", 54, "Il treno più lento d'Italia, ma economico", foto("citta", [{ kind: "zaino", tone: "cyan", x: 50, y: 66, s: 44 }]), "Uno zaino azzurro davanti ai palazzi."),
    ],
    prompt: "Quanto tempo fa era stato pubblicato il post del biglietto del concerto?",
    options: [
      { id: "15min", text: "15 min" },
      { id: "1h", text: "1 h" },
      { id: "ieri", text: "ieri" },
      { id: "6h", text: "6 h" },
    ],
    check: { k: "di", kind: "biglietto", field: "ago" },
    solution: { optionId: "15min" },
    explain: "Il biglietto del concerto era il primo post, pubblicato 15 minuti fa. «Ieri» era lo zaino della stazione, l'ultimo.",
  },
  {
    id: "pianta-sul-balcone",
    difficulty: "media",
    posts: [
      post("@verde.in.citta", "Balcone", "2 h", 618, "La mia giungla da tre metri quadri", foto("citta", [{ kind: "pianta", tone: "lime", x: 50, y: 66, s: 50 }]), "Una pianta sul balcone davanti ai palazzi."),
      post("@corsa.al.mattino", "Lungolago", "3 h", 186, "Il lago alle 6 è tutto mio", foto("mare", [{ kind: "scarpe", tone: "red", x: 50, y: 82, s: 36 }]), "Scarpe da corsa rosse sulla riva."),
      post("@ufficio.open", "Coworking", "4 h", 861, "Scrivania nuova, stesse mail", foto("ufficio", [{ kind: "monitor", label: "BENVENUTA", tone: "cyan", x: 52, y: 58, s: 52 }]), "Uno schermo con scritto «Benvenuta» in un ufficio."),
      post("@la.cena.perfetta", "Trattoria", "8 h", 1186, "Ci hanno portato il dolce senza chiederlo", foto("tavola", [{ kind: "torta", label: "OMAGGIO", tone: "amber", s: 50 }]), "Una torta con scritto «Omaggio»."),
      post("@pigiama.party", "Casa di Ale", "ieri", 452, "Film horror, nessuno ha dormito", foto("notte", [{ kind: "candela", tone: "amber", x: 50, y: 60, s: 40 }]), "Una candela accesa di notte."),
    ],
    prompt: "Quanti «mi piace» aveva il post della pianta?",
    options: [
      { id: "618", text: "618" },
      { id: "861", text: "861" },
      { id: "186", text: "186" },
      { id: "1186", text: "1.186" },
    ],
    check: { k: "di", kind: "pianta", field: "likes" },
    solution: { optionId: "618" },
    explain: "La pianta di @verde.in.citta aveva 618 mi piace. Gli altri numeri erano gli stessi tre cifre rimescolati, presi da altri post.",
  },
  {
    id: "secondo-post",
    difficulty: "difficile",
    posts: [
      post("@ste.cucina", "Cucina", "1 h", 340, "Pane fatto in casa: forma discutibile", foto("tavola", [{ kind: "pizza", label: "PANE", tone: "amber", s: 50 }]), "Una teglia con scritto «Pane»."),
      post("@gita.fuori.porta", "Lago di Como", "2 h", 1777, "Battello perso per un minuto", foto("mare", [{ kind: "orologio", label: "14:01", tone: "white", x: 50, y: 62, s: 40 }]), "Un orologio che segna 14:01 sulla riva del lago."),
      post("@lavoro.da.casa", "Salotto", "3 h", 95, "Riunione in pigiama, nessuno se n'è accorto", foto("stanza", [{ kind: "laptop", label: "CALL", tone: "cyan", x: 46, y: 62, s: 50 }]), "Un portatile con scritto «Call» in salotto."),
      post("@lago.mio", "Lago di Garda", "5 h", 2310, "Tramonto senza filtri", foto("mare", [{ kind: "occhiali", tone: "amber", x: 50, y: 84, s: 32 }]), "Occhiali da sole sulla riva al tramonto."),
      post("@bici.sempre", "Ciclabile", "ieri", 410, "60 km e una foratura", foto("prato", [{ kind: "borraccia", tone: "cyan", x: 58, y: 70, s: 34 }]), "Una borraccia azzurra sul prato."),
    ],
    prompt: "Dove era stato scattato il secondo post del feed?",
    options: [
      { id: "como", text: "Lago di Como" },
      { id: "garda", text: "Lago di Garda" },
      { id: "maggiore", text: "Lago Maggiore" },
      { id: "salotto", text: "Salotto" },
    ],
    check: { k: "post", post: 1, field: "place" },
    solution: { optionId: "como" },
    explain: "Il secondo post, il battello perso alle 14:01, era sul Lago di Como. Il Lago di Garda era il quarto; il Lago Maggiore non c'era.",
  },
];

export default varianti;
