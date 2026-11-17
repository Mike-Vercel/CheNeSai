import type { SoundKind } from "@/lib/tig/games/mechanics/m1/synth";
import type { RumoreInput } from "@/lib/tig/games/mechanics/rumore-di-fondo";

/**
 * 12 · RUMORE DI FONDO — varianti. Suoni sintetizzati in codice (src/lib/tig/games/mechanics/m1/synth.ts).
 * Sei «estraneo»: due suoni della stessa scena + uno fuori posto, con volumi simili; la risposta assente è
 * ANCH'ESSA fuori posto, così senza ascoltare si tira a indovinare. Sei «dominante»: uno strato almeno 1,8
 * volte più forte degli altri due. La versione testuale descrive i suoni a parole, senza nominarli.
 */

const NOME: Record<SoundKind, string> = {
  campanello: "Il campanello di casa",
  telefono: "Un telefono che squilla",
  sveglia: "Una sveglia che suona",
  bollitore: "Il fischio del bollitore",
  sirena: "Una sirena",
  clacson: "Un clacson",
  pioggia: "La pioggia",
  tictac: "Il tic-tac di un orologio",
  cuore: "Un battito di cuore",
  tastiera: "Qualcuno che scrive alla tastiera",
  notifica: "Una notifica sul telefono",
  uccellini: "Uccellini che cinguettano",
  grilli: "I grilli",
  tuono: "Un tuono",
  onde: "Le onde del mare",
  vento: "Il vento",
  applausi: "Un applauso",
  tamburo: "Una batteria che suona",
  monete: "Monete che tintinnano",
  sfrigolio: "Qualcosa che frigge in padella",
  gocce: "Un rubinetto che gocciola",
  aspirapolvere: "Un aspirapolvere",
  fischietto: "Il fischietto dell'arbitro",
  carillon: "Un carillon",
  gabbiano: "Un gabbiano",
};

/** Descrizioni a parole (versione testuale): suono, ritmo, timbro. Mai il nome. */
const DESCRIVI: Record<SoundKind, string> = {
  campanello: "un «din-don» a due note, ogni due secondi e mezzo",
  telefono: "un trillo elettronico tremolante, un secondo acceso e uno spento",
  sveglia: "quattro «bip» acuti e rapidi, ripetuti ogni secondo",
  bollitore: "un fischio continuo che sale sempre più acuto, con un soffio sotto",
  sirena: "un ululato che sale e scende senza sosta",
  clacson: "due suoni rauchi e insistenti, uno breve e uno lungo",
  pioggia: "un fruscio continuo con tanti piccoli ticchettii sparsi",
  tictac: "uno scatto secco e regolare, due volte al secondo",
  cuore: "un tonfo grave doppio, «tu-tum», regolare",
  tastiera: "tanti piccoli clic irregolari, fitti, con qualche pausa",
  notifica: "due note brevi e dolci, la seconda più acuta",
  uccellini: "brevi fischietti acuti a gruppetti di due o tre",
  grilli: "un «cri-cri» acutissimo e regolare",
  tuono: "un brontolio cupo che cresce e si spegne lentamente",
  onde: "un soffio che cresce e si ritira, come un respiro lungo",
  vento: "un sibilo morbido che sale e poi cala",
  applausi: "un crepitio fitto di tanti colpi secchi insieme",
  tamburo: "un colpo grave e un colpo secco che si alternano a tempo",
  monete: "tintinnii metallici acuti, sparsi qua e là",
  sfrigolio: "un soffio acuto continuo pieno di piccoli scoppiettii",
  gocce: "un «plic» che scende di tono, regolare, poco meno di un secondo",
  aspirapolvere: "un ronzio grave e continuo con un soffio sopra",
  fischietto: "fischi trillati: due brevi e uno lungo",
  carillon: "quattro note cristalline che salgono e si ripetono",
  gabbiano: "versi rauchi che scendono di tono, a coppie",
};

const ESTRANEO = "Tre suoni insieme: due vanno d'accordo, uno no. Quale c'era, ma non c'entrava?";
const DOMINANTE = "Quale suono si sentiva più forte di tutti?";

function estraneo(id: string, difficulty: "facile" | "media" | "difficile", coppia: [SoundKind, SoundKind], fuori: SoundKind, assente: SoundKind, explain: string): RumoreInput {
  const layers = [
    { sound: coppia[0], gain: 0.5 },
    { sound: fuori, gain: 0.45 },
    { sound: coppia[1], gain: 0.5 },
  ];
  return {
    id,
    difficulty,
    mode: "estraneo",
    layers,
    prompt: ESTRANEO,
    options: [coppia[0], coppia[1], fuori, assente].map((s) => ({ id: s, text: NOME[s], sound: s })),
    descriptions: layers.map((l) => `Si sente ${DESCRIVI[l.sound]}.`),
    solution: { optionId: fuori },
    explain,
  };
}

function dominante(id: string, difficulty: "facile" | "media" | "difficile", forte: SoundKind, piano: [SoundKind, SoundKind], assente: SoundKind, explain: string): RumoreInput {
  const layers = [
    { sound: piano[0], gain: 0.35 },
    { sound: forte, gain: 1 },
    { sound: piano[1], gain: 0.4 },
  ];
  return {
    id,
    difficulty,
    mode: "dominante",
    layers,
    prompt: DOMINANTE,
    options: [forte, piano[0], piano[1], assente].map((s) => ({ id: s, text: NOME[s], sound: s })),
    descriptions: layers.map((l) => `${l.gain >= 1 ? "Fortissimo" : "Piano, in sottofondo"}: ${DESCRIVI[l.sound]}.`),
    solution: { optionId: forte },
    explain,
  };
}

const varianti: RumoreInput[] = [
  estraneo("temporale-e-fischietto", "facile", ["pioggia", "tuono"], "fischietto", "carillon", "Pioggia e tuono fanno un temporale; il fischietto dell'arbitro, con i suoi due fischi brevi e uno lungo, non c'entra. Il carillon non si sentiva proprio."),
  estraneo("cucina-con-grilli", "media", ["sfrigolio", "bollitore"], "grilli", "gabbiano", "Padella che frigge e bollitore che fischia sono la cucina; il «cri-cri» acutissimo dei grilli è fuori posto. Il gabbiano non c'era."),
  estraneo("ufficio-al-mare", "media", ["tastiera", "telefono"], "onde", "uccellini", "Tastiera e telefono che squilla sono l'ufficio; il soffio lungo delle onde non c'entra. Gli uccellini non si sentivano."),
  estraneo("spiaggia-con-sveglia", "facile", ["onde", "gabbiano"], "sveglia", "clacson", "Onde e gabbiano sono la spiaggia; i quattro «bip» della sveglia sono di troppo. Il clacson non c'era."),
  estraneo("campagna-con-aspirapolvere", "difficile", ["grilli", "vento"], "aspirapolvere", "campanello", "Grilli e vento sono una notte in campagna; il ronzio grave dell'aspirapolvere non c'entra. Il campanello non suonava."),
  estraneo("stadio-con-carillon", "difficile", ["applausi", "fischietto"], "carillon", "gocce", "Applausi e fischietto sono lo stadio; le quattro note cristalline del carillon non c'entrano. Il rubinetto che gocciola non c'era."),
  dominante("campanello-sotto-la-pioggia", "facile", "campanello", ["pioggia", "tictac"], "sirena", "Il «din-don» del campanello copriva tutto; pioggia e tic-tac erano in sottofondo. La sirena non c'era."),
  dominante("sveglia-al-mattino", "media", "sveglia", ["uccellini", "gocce"], "notifica", "I quattro «bip» della sveglia erano fortissimi; uccellini e rubinetto si sentivano appena. Nessuna notifica."),
  dominante("concerto-in-piazza", "media", "tamburo", ["monete", "applausi"], "clacson", "La batteria dominava; monete e applausi erano sotto. Il clacson non c'era."),
  dominante("squillo-in-ufficio", "difficile", "telefono", ["vento", "tastiera"], "campanello", "Lo squillo tremolante del telefono era il più forte; vento e tastiera erano in sottofondo. Il campanello, con il suo «din-don», non suonava."),
  dominante("pulizie-di-casa", "difficile", "aspirapolvere", ["telefono", "cuore"], "vento", "Il ronzio dell'aspirapolvere copriva il telefono e il battito di cuore. Il vento, che soffia in modo simile, non c'era."),
  dominante("sirena-nel-traffico", "facile", "sirena", ["clacson", "uccellini"], "sveglia", "La sirena che sale e scende copriva tutto; clacson e uccellini erano piano. La sveglia non suonava."),
];

export default varianti;
