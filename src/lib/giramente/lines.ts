/**
 * GIRAMENTE! – battute di Don Patrizio (presentatore) e Zafira (la Jolly).
 *
 * - Battute FISSE (nessun segnaposto): clip preregistrati in public/audio/giramente/voci/<id>.mp3
 *   (testi per ElevenLabs in GIRAMENTE_FRASI_ELEVENLABS.txt, con gli audio tag di v3 tra parentesi quadre).
 * - Battute DINAMICHE (con {playerName} {teamName} {points} {roundName}): voce sintetizzata dal server
 *   (/api/giramente/voce, ElevenLabs eleven_v3 in italiano) se ELEVENLABS_VOICE_DONPATRIZIO / ELEVENLABS_VOICE_ZAFIRA
 *   sono configurate. Il presentatore si chiama Don Patrizio; la chiave interna resta «dontralla»
 *   (contratto dei personaggi 3D).
 * - In ogni caso il testo compare come sottotitolo: senza voce il gioco funziona uguale.
 * Le battute non sono mai offensive: prendono in giro la ruota, non le persone.
 */
export type Speaker = "dontralla" | "zafira";

export interface Line {
  id: string;
  who: Speaker;
  /** testo per la voce (con gli audio tag di ElevenLabs v3 tra parentesi quadre) */
  text: string;
}

const L = (id: string, who: Speaker, text: string): Line => ({ id, who, text });

export const LINES: Line[] = [
  // ------------------------------------------------------------ Don Patrizio: apertura
  L("benvenuti", "dontralla", "[excited] Benvenuti a GIRAMENTE! La ruota gira… [pause] la mente decide!"),
  L("sala-attesa", "dontralla", "Entrate, entrate! C'è posto per tutti… e per tutti i cervelli."),
  L("inizio-partita", "dontralla", "[cheerful] Signore e signori, si parte! Mettetevi comodi e accendete il cervello."),
  L("presentazione", "dontralla", "Ecco i concorrenti di stasera! [laughs] Un bell'applauso, che poi ve lo dovete meritare."),
  // ------------------------------------------------------------ manche
  L("manche-1", "dontralla", "[excited] Prima manche: SI ACCENDE LA MENTE! Verde per andare sul sicuro, rosso per i coraggiosi."),
  L("manche-2", "dontralla", "Seconda manche: LA FALSA PISTA! [whispers] Uno degli indizi vi sta mentendo."),
  L("manche-3", "dontralla", "Terza manche: GIRA E RISCHIA! Domande più toste, punti più pesanti. E i Jolly finalmente servono."),
  L("manche-4", "dontralla", "Quarta manche: IL COLLEGAMENTO! Tre parole, un solo filo che le lega."),
  L("tabellone", "dontralla", "E adesso… [whispers] il Tabellone Segreto. Una frase nascosta, poche lettere in vista."),
  L("manche-5", "dontralla", "[dramatic] Ultima manche: IL GIRO DECISIVO! Gli indizi si sbloccano, i punti scendono. Qui si vince."),
  L("spareggio", "dontralla", "[gasps] Parità in vetta! Serve uno spareggio. Un enigma, nessuna pietà."),
  // ------------------------------------------------------------ turno alla ruota
  L("scegli", "dontralla", "Verde o rosso? Sicuro… o rischioso?"),
  L("scelta-verde", "dontralla", "Verde! Prudenza, saggezza… e un pizzico di paura."),
  L("scelta-rosso", "dontralla", "[excited] Rosso! Questo sì che è coraggio!"),
  L("gira", "dontralla", "Forza, gira la ruota!"),
  L("settore-intruso", "dontralla", "Intruso! C'è qualcuno che non c'entra niente… trovalo."),
  L("settore-sequenza", "dontralla", "Sequenza! Segui il filo e trova il pezzo mancante."),
  L("settore-indizi", "dontralla", "Indizi! Leggi bene, la risposta è lì."),
  L("settore-prospettiva", "dontralla", "Prospettiva! Guarda bene… e poi guarda meglio."),
  L("settore-mistero", "dontralla", "[mysterious] Mistero! Nemmeno io so cosa c'è dietro."),
  L("settore-bonus", "dontralla", "[excited] Bonus! Se rispondi giusto, cento punti in più!"),
  L("settore-colpo", "dontralla", "Colpo di scena! Sfida lampo: meno tempo, cento punti in più. Accetti?"),
  L("settore-jolly", "dontralla", "[gasps] Jolly! Spegnete le luci… sta arrivando qualcuno."),
  L("domanda", "dontralla", "Ecco l'enigma. Il tempo corre!"),
  L("dieci-secondi", "dontralla", "Dieci secondi!"),
  // ------------------------------------------------------------ esiti
  L("giusta-1", "dontralla", "[cheerful] Esatto! Che testa!"),
  L("giusta-2", "dontralla", "Giusto! La mente decide, e ha deciso bene."),
  L("giusta-3", "dontralla", "[laughs] Perfetto! Ma come fai?"),
  L("sbagliata-1", "dontralla", "[sighs] No, peccato. La ruota stavolta non ti ha aiutato."),
  L("sbagliata-2", "dontralla", "Sbagliato! Ma non ti abbattere, la serata è lunga."),
  L("sbagliata-3", "dontralla", "Ahi ahi… non era quella."),
  L("penalita", "dontralla", "[sighs] Rosso e risposta sbagliata… si paga, ma non si scende sotto zero."),
  L("tempo-scaduto", "dontralla", "Tempo scaduto! L'orologio non perdona."),
  L("bonus-preso", "dontralla", "[excited] E con il bonus i punti volano!"),
  // ------------------------------------------------------------ prove contemporanee
  L("tutti-insieme", "dontralla", "Tutti insieme, ognuno sul suo telefono. Le risposte le scopriamo alla fine!"),
  L("passa-telefono", "dontralla", "Passa il telefono al prossimo concorrente. E niente sbirciate!"),
  L("rivelazione", "dontralla", "Tempo! Vediamo com'è andata…"),
  // ------------------------------------------------------------ classifica e finale
  L("classifica", "dontralla", "Ecco la classifica! Qualcuno sorride… qualcuno un po' meno."),
  L("pausa", "dontralla", "Pausa! Un sorso d'acqua e si riparte."),
  L("ripresa", "dontralla", "Si riprende! Rimettete in moto il cervello."),
  L("vincitore", "dontralla", "[excited] Abbiamo un vincitore! La ruota ha girato, la mente ha deciso!"),
  L("saluti", "dontralla", "Grazie per aver giocato a GIRAMENTE! Alla prossima… e allenate quel cervello!"),
  // ------------------------------------------------------------ Don Patrizio: dinamiche (TTS)
  L("turno-giocatore", "dontralla", "{playerName}, tocca a te! Vediamo se oggi la ruota è dalla tua parte."),
  L("turno-squadra", "dontralla", "{teamName}, tocca a voi! Il capitano ha l'ultima parola."),
  L("punti-giocatore", "dontralla", "Bravo {playerName}! {points} punti in cassaforte."),
  L("vincitore-nome", "dontralla", "[excited] Il vincitore di GIRAMENTE è… {playerName}! Con {points} punti!"),
  L("manche-nome", "dontralla", "Comincia la manche: {roundName}!"),

  // ------------------------------------------------------------ Zafira, la Jolly
  L("zafira-ingresso-1", "zafira", "[mischievously] Ciao ciao! Qualcuno ha chiamato la Jolly?"),
  L("zafira-ingresso-2", "zafira", "[laughs] Luci basse, cuori alti. Sono arrivata io."),
  L("zafira-ingresso-3", "zafira", "Sorpresa! La ruota ha scelto me… e io ho scelto te."),
  L("zafira-offerta", "zafira", "Ti offro due regali. Occhio Furbo o Scudo? [whispers] Scegli bene."),
  L("zafira-occhio", "zafira", "Occhio Furbo! Un indizio in più, quando ti servirà davvero."),
  L("zafira-scudo", "zafira", "Scudo! Se sbagli in rosso, la penalità la cancello io."),
  L("zafira-doppione", "zafira", "[sarcastic] Ancora tu? Un potere ce l'hai già. Prendi cinquanta punti e non lamentarti."),
  L("zafira-usa-occhio", "zafira", "[whispers] Ecco il mio indizio. Non dirlo a nessuno."),
  L("zafira-usa-scudo", "zafira", "Scudo alzato! Penalità cancellata. Mi devi un favore."),
  L("zafira-uscita", "zafira", "Ci vediamo alla prossima… se la ruota vorrà."),
  L("zafira-scadenza", "zafira", "[sighs] I miei poteri finiscono qui. Nel Giro Decisivo ve la cavate da soli!"),
  L("zafira-nome", "zafira", "{playerName}, la fortuna ti ha portato da me."),
];

/**
 * VARIANTI delle battute (id «<base>-N»): stesse occasioni, parole diverse, per non ripetersi.
 * Il gioco sceglie a caso tra la battuta base e le sue varianti (mai la stessa due volte di fila),
 * preferendo quelle che hanno già il clip registrato. Testi IDENTICI al file per ElevenLabs.
 */
export const VARIANT_LINES: Line[] = [
  L("benvenuti-2", "dontralla", "[cheerful] Buonasera e benvenuti a GIRAMENTE! Stasera decide la ruota… ma vince la testa!"),
  L("benvenuti-3", "dontralla", "[excited] Eccoci qua! Luci accese, ruota pronta… e voi? Pronti a far girare il cervello?"),
  L("sala-attesa-2", "dontralla", "Aspettiamo gli ultimi ritardatari… intanto scaldate i neuroni."),
  L("sala-attesa-3", "dontralla", "[laughs] Più siamo, più si ride. E più si sbaglia!"),
  L("inizio-partita-2", "dontralla", "[excited] Tutto pronto! Cinque manche, una ruota e un solo vincitore."),
  L("presentazione-2", "dontralla", "[cheerful] Eccoli qua, i cervelli della serata! Fatevi vedere, su!"),
  L("tabellone-2", "dontralla", "Il Tabellone Segreto! Svelate, indovinate, risolvete… ma ogni aiuto costa punti."),
  L("spareggio-2", "dontralla", "[gasps] Siamo pari! Un ultimo enigma per decidere tutto."),
  L("scegli-2", "dontralla", "Allora: cuore o cervello? Verde o rosso?"),
  L("scegli-3", "dontralla", "[whispers] Pensaci bene… verde o rosso?"),
  L("scelta-verde-2", "dontralla", "Verde, sul sicuro. Non si sa mai!"),
  L("scelta-verde-3", "dontralla", "Giocata tranquilla. Mi piace la gente prudente."),
  L("scelta-rosso-2", "dontralla", "[gasps] Rosso! O la va o la spacca!"),
  L("scelta-rosso-3", "dontralla", "[laughs] Rosso! Il cuore batte forte, eh?"),
  L("gira-2", "dontralla", "[excited] Via! Fai girare questa ruota!"),
  L("gira-3", "dontralla", "Dai una bella spinta… e vediamo dove ci porta!"),
  L("gira-4", "dontralla", "La ruota aspetta solo te. Gira!"),
  L("settore-intruso-2", "dontralla", "Intruso! Uno di questi è fuori posto. Quale?"),
  L("settore-sequenza-2", "dontralla", "Sequenza! Qual è il prossimo passo?"),
  L("settore-indizi-2", "dontralla", "Indizi! Mettili insieme e la risposta salta fuori."),
  L("settore-prospettiva-2", "dontralla", "Prospettiva! Non fidarti della prima occhiata."),
  L("settore-mistero-2", "dontralla", "[whispers] Mistero… chissà cosa ti aspetta."),
  L("settore-bonus-2", "dontralla", "[cheerful] Bonus! Una risposta giusta e si fa festa doppia."),
  L("settore-colpo-2", "dontralla", "[dramatic] Colpo di scena! Meno tempo, più punti. Te la senti?"),
  L("settore-jolly-2", "dontralla", "[mysterious] Jolly! Le luci cambiano… sapete chi arriva."),
  L("domanda-2", "dontralla", "Ecco a te. Leggi con calma… ma non troppa!"),
  L("domanda-3", "dontralla", "Occhi aperti, cervello acceso. Via!"),
  L("dieci-secondi-2", "dontralla", "[urgent] Ultimi dieci secondi!"),
  L("giusta-4", "dontralla", "[excited] Bingo! Risposta perfetta!"),
  L("giusta-5", "dontralla", "Esatto! Questa sì che è una mente accesa."),
  L("giusta-6", "dontralla", "[laughs] Giusta! E pure con stile."),
  L("giusta-7", "dontralla", "Centro pieno! La ruota ha aiutato, ma il merito è tutto tuo."),
  L("sbagliata-4", "dontralla", "[sighs] Eh no… ci eri quasi."),
  L("sbagliata-5", "dontralla", "Sbagliata! Niente paura, la ruota gira per tutti."),
  L("sbagliata-6", "dontralla", "[laughs] Bella fantasia… ma la risposta era un'altra!"),
  L("sbagliata-7", "dontralla", "Non era quella. La prossima, però, è tua."),
  L("penalita-2", "dontralla", "[gasps] Ahi! Il rosso morde. Qualche punto se ne va."),
  L("tempo-scaduto-2", "dontralla", "Driiin! Tempo finito."),
  L("tempo-scaduto-3", "dontralla", "[sighs] Il tempo è volato via. Peccato!"),
  L("bonus-preso-2", "dontralla", "[cheerful] Cento punti di bonus! Applausi!"),
  L("tutti-insieme-2", "dontralla", "Rispondete tutti, ognuno per conto suo. Niente suggerimenti!"),
  L("passa-telefono-2", "dontralla", "Telefono al prossimo! Gli altri, occhi altrove."),
  L("rivelazione-2", "dontralla", "[dramatic] Tempo scaduto per tutti. Vediamo le risposte!"),
  L("classifica-2", "dontralla", "La classifica parla chiaro… almeno per ora!"),
  L("classifica-3", "dontralla", "[laughs] Guardate qua! Qualcuno vola, qualcuno sta ancora scaldando i motori."),
  L("pausa-2", "dontralla", "Facciamo una pausa. La ruota si riposa… voi no!"),
  L("ripresa-2", "dontralla", "[cheerful] Eccoci di nuovo! Dove eravamo rimasti?"),
  L("vincitore-2", "dontralla", "[excited] Ed ecco chi ha vinto stasera! Applausi!"),
  L("saluti-2", "dontralla", "[cheerful] È stato un piacere! La ruota vi aspetta per la rivincita."),
  L("zafira-ingresso-4", "zafira", "[mischievously] Mi avete chiamata? No? Sono venuta lo stesso."),
  L("zafira-ingresso-5", "zafira", "[laughs] Silenzio in sala… è il momento della Jolly."),
  L("zafira-offerta-2", "zafira", "Due doni, una sola scelta. [whispers] Ti fidi di me?"),
  L("zafira-occhio-2", "zafira", "Occhio Furbo. Vedrai quello che gli altri non vedono."),
  L("zafira-scudo-2", "zafira", "Scudo. Adesso il rischio fa meno paura."),
  L("zafira-doppione-2", "zafira", "[laughs] Un altro Jolly? Non esagerare. Tieni cinquanta punti."),
  L("zafira-usa-occhio-2", "zafira", "Ecco un piccolo aiuto… da parte mia."),
  L("zafira-usa-scudo-2", "zafira", "[mischievously] Sbagliato? Non per me. Lo Scudo ti salva."),
  L("zafira-uscita-2", "zafira", "[laughs] Il mio lavoro qui è finito. Ciao ciao!"),
  L("zafira-uscita-3", "zafira", "Usalo bene… o me lo riprendo."),
];
LINES.push(...VARIANT_LINES);

export const LINE_BY_ID: Record<string, Line> = Object.fromEntries(LINES.map((l) => [l.id, l]));

/**
 * Battuta base e sue varianti («gira», «gira-2», «gira-3»…), nell'ordine. Vale anche per le famiglie
 * solo numerate («giusta» → giusta-1 … giusta-7). Solo suffissi numerici: «vincitore-nome» non è
 * una variante di «vincitore».
 */
export function variantsOf(baseId: string): string[] {
  const out = LINE_BY_ID[baseId] ? [baseId] : [];
  for (let n = 1; n < 40; n++) {
    const id = `${baseId}-${n}`;
    if (LINE_BY_ID[id]) out.push(id);
  }
  return out;
}

/**
 * Sceglie una variante: tra quelle col clip registrato se ce ne sono (`available`), mai la stessa
 * dell'ultima volta (`last`) se c'è un'alternativa. `random` in [0, 1).
 */
export function pickVariant(baseId: string, available: ReadonlySet<string> | null, last: string | null, random: () => number = Math.random): string {
  const all = variantsOf(baseId);
  if (all.length === 0) return baseId;
  const recorded = available ? all.filter((id) => available.has(id)) : [];
  let pool = recorded.length ? recorded : all;
  if (pool.length > 1 && last) pool = pool.filter((id) => id !== last);
  return pool[Math.floor(random() * pool.length) % pool.length];
}

const PLACEHOLDER = /\{(playerName|teamName|points|roundName)\}/g;

/** Battuta con segnaposto (serve la voce sintetizzata) o fissa (clip preregistrato). */
export function isDynamic(line: Line): boolean {
  return /\{(playerName|teamName|points|roundName)\}/.test(line.text);
}

export interface LineVars {
  playerName?: string;
  teamName?: string;
  points?: number | string;
  roundName?: string;
}

/** Testo per la voce (con gli audio tag). */
export function fillLine(line: Line, vars: LineVars = {}): string {
  return line.text.replace(PLACEHOLDER, (_, k: keyof LineVars) => {
    const v = vars[k];
    if (v === undefined || v === null || v === "") return k === "points" ? "" : "amici";
    return k === "points" ? String(Math.round(Number(v))).replace(/\B(?=(\d{3})+(?!\d))/g, ".") : String(v);
  });
}

/** Sottotitolo: senza audio tag né spazi doppi. */
export function captionOf(text: string): string {
  return text
    .replace(/\[[^\]]+\]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const SPEAKER_NAME: Record<Speaker, string> = { dontralla: "Don Patrizio", zafira: "Zafira" };

export const lineAudioUrl = (id: string) => `/audio/giramente/voci/${id}.mp3`;
