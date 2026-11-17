import type { FraseInput } from "@/lib/tig/games/mechanics/la-frase-a-meta";

/**
 * 63 · LA FRASE A METÀ — «regole della casa» inventate, spezzate in due. Ogni frase nasce da quattro coppie
 * inizio/finale che si incastrano solo tra loro (accordi: lo/la/li/le, riferimenti, logica); una coppia è
 * quella vera. Chi vede l'inizio deve trovare il finale tra quattro, e viceversa: basta la coerenza.
 */

type Frase = FraseInput["sentences"][number];
type Sol = FraseInput["solution"]["sentences"][string];

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

/** Quattro coppie [inizio, finale] che si incastrano a due a due; `vera` = indice della coppia vera. */
function frase(id: string, topic: string, coppie: [string, string][], vera: number, why: string): { f: Frase; s: Sol } {
  const starts = coppie.map(([a]) => ({ id: slug(a), text: a }));
  const ends = coppie.map(([, b]) => ({ id: slug(b), text: b }));
  return { f: { id, topic, starts, ends }, s: { start: starts[vera].id, end: ends[vera].id, why } };
}

function variante(id: string, difficulty: FraseInput["difficulty"], fs: { f: Frase; s: Sol }[], explain: string): FraseInput {
  return { id, difficulty, sentences: fs.map((x) => x.f), solution: { sentences: Object.fromEntries(fs.map((x) => [x.f.id, x.s])) }, explain };
}

const varianti: FraseInput[] = [
  variante(
    "frigo-bagno",
    "facile",
    [
      frase(
        "frigo",
        "La regola del frigo",
        [
          ["Chi finisce il latte", "lo ricompra prima di cena."],
          ["Chi finisce la pasta", "la ricompra prima di cena."],
          ["Chi finisce i biscotti", "li ricompra prima di cena."],
          ["Chi finisce le uova", "le ricompra prima di cena."],
        ],
        0,
        "«Lo» si accorda solo con «il latte»: la pasta vorrebbe «la», i biscotti «li», le uova «le».",
      ),
      frase(
        "bagno",
        "La regola del bagno",
        [
          ["Chi fa la doccia dopo le 23", "deve farla in silenzio: gli altri dormono."],
          ["Chi fa la doccia nel pomeriggio", "può cantare quanto vuole."],
          ["Chi usa l'ultimo rotolo", "ne mette subito uno nuovo."],
          ["Chi lascia i capelli nel lavandino", "li raccoglie e pulisce lo scarico."],
        ],
        2,
        "«Ne mette subito uno nuovo» parla di qualcosa che si finisce: il rotolo. La doccia vorrebbe «farla», i capelli «li».",
      ),
    ],
    "Bastava guardare i pronomi: ogni finale si aggancia a un solo inizio. Chi ha condiviso ha regalato 70 punti all'altro tavolo; chi ha ingannato ha scommesso sulla sua grammatica.",
  ),
  variante(
    "gruppo-pub",
    "facile",
    [
      frase(
        "gruppo",
        "La regola della chat di gruppo",
        [
          ["Chi crea un sondaggio nel gruppo", "deve anche votarlo per primo."],
          ["Chi manda un vocale di cinque minuti", "deve allegare il riassunto scritto."],
          ["Chi esce dal gruppo", "non può rientrare prima di una settimana."],
          ["Chi cambia la foto del gruppo", "deve rimetterla com'era entro sera."],
        ],
        1,
        "Il riassunto scritto ha senso solo per un vocale lunghissimo; «votarlo» va col sondaggio, «rientrare» con chi esce, «rimetterla» con la foto.",
      ),
      frase(
        "pub",
        "La regola del pub",
        [
          ["Chi perde a freccette", "offre il giro a chi ha vinto."],
          ["Chi arriva per ultimo", "si siede nel posto vicino alla porta."],
          ["Chi propone il brindisi", "deve finirlo senza ridere."],
          ["Chi rovescia la birra", "la asciuga e ne ordina un'altra."],
        ],
        3,
        "«La asciuga e ne ordina un'altra» parla di una cosa femminile che si rovescia: la birra. Il brindisi vorrebbe «lo», e «chi ha vinto» serve a chi ha perso.",
      ),
    ],
    "Riferimenti chiari: un vocale ha bisogno di un riassunto, una birra rovesciata si asciuga. Il patto conveniva a tutti e due, il tradimento solo a chi lo faceva per primo.",
  ),
  variante(
    "ufficio-calcetto",
    "media",
    [
      frase(
        "ufficio",
        "La regola dell'ufficio",
        [
          ["Chi prende l'ultima tazza pulita", "la lava prima di rimetterla a posto."],
          ["Chi finisce le cialde del caffè", "ne ordina subito una scatola nuova."],
          ["Chi stampa cento pagine", "ricarica il cassetto della carta."],
          ["Chi prenota la sala riunioni", "la libera se la riunione salta."],
        ],
        3,
        "«La libera se la riunione salta» si aggancia solo a qualcosa che si prenota per una riunione: la sala. La tazza si lava, le cialde si riordinano.",
      ),
      frase(
        "calcetto",
        "La regola del calcetto",
        [
          ["Chi segna un autogol", "festeggia con gli avversari, che ringraziano."],
          ["Chi dimentica il pallone", "lo ricompra per la prossima partita."],
          ["Chi arriva senza scarpe", "le chiede in prestito a chi è in panchina."],
          ["Chi si fa male", "si siede in panchina con il ghiaccio."],
        ],
        0,
        "Un gol che fa felici gli avversari è un autogol. «Lo ricompra» va col pallone, «le chiede» con le scarpe, il ghiaccio con chi si fa male.",
      ),
    ],
    "Qui serviva un po' di logica oltre agli accordi: chi festeggia con gli avversari ha segnato nella propria porta.",
  ),
  variante(
    "viaggio-compleanno",
    "media",
    [
      frase(
        "viaggio",
        "La regola del viaggio in auto",
        [
          ["Chi prenota il volo", "sceglie anche i posti per tutti."],
          ["Chi guida all'andata", "al ritorno si riposa e guida un altro."],
          ["Chi dimentica il passaporto", "torna a casa a prenderlo, da solo."],
          ["Chi porta la cassa bluetooth", "deve averla carica prima di partire."],
        ],
        1,
        "«Al ritorno si riposa e guida un altro» ha senso solo per chi ha guidato all'andata. «Prenderlo» va col passaporto, «averla carica» con la cassa.",
      ),
      frase(
        "compleanno",
        "La regola del compleanno",
        [
          ["Chi compie gli anni", "spegne le candeline per primo."],
          ["Chi organizza la festa", "manda l'invito a tutti entro venerdì."],
          ["Chi porta la torta", "la tiene in frigo fino al momento giusto."],
          ["Chi arriva in ritardo", "canta da solo «tanti auguri» come penitenza."],
        ],
        2,
        "«La tiene in frigo» richiede qualcosa di femminile che va al fresco: la torta. La festa non si mette in frigo.",
      ),
    ],
    "Ogni finale aveva un solo inizio possibile. Chi ha ingannato ha consegnato all'altro un finale falso ma grammaticalmente sbagliato: un tavolo attento se ne accorgeva comunque.",
  ),
  variante(
    "palestra-cinema",
    "facile",
    [
      frase(
        "palestra",
        "La regola della palestra",
        [
          ["Chi usa il tappetino", "lo arrotola e lo rimette a posto."],
          ["Chi usa i manubri", "li rimette sulla rastrelliera."],
          ["Chi usa la panca", "la pulisce con lo spray."],
          ["Chi esce dallo spogliatoio per ultimo", "spegne le luci uscendo."],
        ],
        1,
        "«Li rimette» è plurale maschile: i manubri. Il tappetino vorrebbe «lo», la panca «la».",
      ),
      frase(
        "cinema",
        "La regola della serata film",
        [
          ["Chi sceglie il film", "non può lamentarsi se è brutto."],
          ["Chi prepara i popcorn", "li divide in ciotole uguali."],
          ["Chi si addormenta", "si perde il finale e nessuno glielo racconta."],
          ["Chi parla ad alta voce", "viene zittito a cuscinate."],
        ],
        0,
        "«Se è brutto» ha bisogno di qualcosa di maschile singolare da giudicare: il film. I popcorn vogliono «li».",
      ),
    ],
    "Accordi da scuola elementare, ma sotto pressione. Il vero gioco era la scelta: fidarsi dell'altro tavolo o fregarlo.",
  ),
  variante(
    "spesa-lavoro",
    "media",
    [
      frase(
        "spesa",
        "La regola della spesa insieme",
        [
          ["Chi spinge il carrello", "lo riporta al suo posto alla fine."],
          ["Chi tiene la lista", "la legge ad alta voce, voce per voce."],
          ["Chi paga alla cassa", "conserva lo scontrino per fare i conti."],
          ["Chi sceglie la frutta", "la pesa e ci attacca l'etichetta."],
        ],
        3,
        "Si pesa e si etichetta la frutta, non la lista. «Lo riporta» è il carrello, lo scontrino serve a chi paga.",
      ),
      frase(
        "lavoro",
        "La regola della chat di lavoro",
        [
          ["Chi fissa una riunione", "la conferma un giorno prima."],
          ["Chi manda un file", "lo rinomina con la data di oggi."],
          ["Chi va in ferie", "mette lo stato «fuori ufficio»."],
          ["Chi scrive dopo le 20", "non si aspetta risposte prima di domattina."],
        ],
        2,
        "Lo stato «fuori ufficio» è per chi va in ferie. La riunione si conferma («la»), il file si rinomina («lo»).",
      ),
    ],
    "Due frasi in cui conta il senso più dei pronomi: due «la» nella stessa frase, ma solo la frutta si pesa.",
  ),
  variante(
    "vacanze-concerto",
    "media",
    [
      frase(
        "vacanze",
        "La regola della casa vacanze",
        [
          ["Chi prenota la casa", "riceve i soldi degli altri entro una settimana."],
          ["Chi cucina la sera", "non lava i piatti."],
          ["Chi si sveglia per primo", "va a prendere i cornetti per tutti."],
          ["Chi perde le chiavi", "paga il fabbro, se serve."],
        ],
        3,
        "Il fabbro serve a chi ha perso le chiavi. Chi prenota anticipa i soldi, chi cucina non lava, chi si alza presto va a prendere i cornetti.",
      ),
      frase(
        "concerto",
        "La regola del concerto",
        [
          ["Chi tiene i biglietti", "li stampa anche su carta, per sicurezza."],
          ["Chi guida", "non beve per tutta la sera."],
          ["Chi si perde nella folla", "aspetta all'uscita numero 3."],
          ["Chi vuole stare sotto il palco", "ci va da solo: gli altri restano in fondo."],
        ],
        1,
        "Chi guida non beve. «Li stampa» va coi biglietti, «ci va» con un posto (sotto il palco), l'uscita 3 con chi si perde.",
      ),
    ],
    "Le frasi si chiudevano col buon senso. Il patto conveniva a entrambi; ingannare pagava solo se l'altro condivideva davvero.",
  ),
  variante(
    "trasloco-vicinato",
    "difficile",
    [
      frase(
        "trasloco",
        "La regola del trasloco",
        [
          ["Chi porta il divano", "lo solleva sempre in due."],
          ["Chi incarta i bicchieri", "li avvolge uno per uno nel giornale."],
          ["Chi scrive sugli scatoloni", "usa il pennarello indelebile."],
          ["Chi guida il furgone", "parcheggia in doppia fila solo cinque minuti."],
        ],
        0,
        "«Lo solleva sempre in due» è maschile singolare e pesante: il divano. I bicchieri vogliono «li», il furgone non si solleva.",
      ),
      frase(
        "vicinato",
        "La regola del condominio",
        [
          ["Chi ha un cane", "lo porta fuori lontano dalle aiuole."],
          ["Chi dà una festa", "avvisa il palazzo con un biglietto."],
          ["Chi ritira un pacco per un altro", "lascia un avviso sulla porta del destinatario."],
          ["Chi parcheggia in cortile", "lascia libero il passo carrabile."],
        ],
        2,
        "Il «destinatario» esiste solo se c'è un pacco ritirato per un altro. Il cane si porta fuori, la festa si annuncia.",
      ),
    ],
    "Due frasi dove ogni finale ha un solo aggancio possibile, ma va letto tutto: «destinatario» e «sollevare in due» fanno il lavoro.",
  ),
  variante(
    "cucina-treno",
    "difficile",
    [
      frase(
        "cucina",
        "La regola della cucina condivisa",
        [
          ["Chi usa la padella", "la lava appena si raffredda."],
          ["Chi apre una bottiglia", "la richiude con il tappo giusto."],
          ["Chi accende il forno", "lo spegne prima di uscire di casa."],
          ["Chi fa il caffè", "ne offre una tazzina a chi passa."],
        ],
        1,
        "Due inizi femminili (padella e bottiglia): ma solo la bottiglia si richiude col tappo. La padella si lava quando si raffredda.",
      ),
      frase(
        "treno",
        "La regola del treno",
        [
          ["Chi ha il posto al finestrino", "abbassa la tendina se c'è il sole."],
          ["Chi ha la valigia grande", "la mette sopra, sul portabagagli."],
          ["Chi scende per primo", "si avvicina alla porta una fermata prima."],
          ["Chi ha i biglietti", "li mostra al controllore per tutti."],
        ],
        3,
        "«Li mostra al controllore» è plurale: i biglietti. La valigia vorrebbe «la», la tendina è di chi sta al finestrino.",
      ),
    ],
    "Qui gli accordi da soli non bastavano (due «la» nella stessa frase): serviva capire cosa si richiude e cosa si lava.",
  ),
  variante(
    "foto-brindisi",
    "difficile",
    [
      frase(
        "foto",
        "La regola della foto di gruppo",
        [
          ["Chi fa da fotografo", "conta fino a tre ad alta voce."],
          ["Chi chiude gli occhi", "se la rifà finché non vengono aperti."],
          ["Chi pubblica la foto", "la mette online solo col permesso di tutti."],
          ["Chi non vuole comparire", "si mette dietro chi è più alto."],
        ],
        2,
        "«La mette online» ha bisogno della foto nella prima metà: solo «chi pubblica la foto». «Vengono aperti» parla degli occhi.",
      ),
      frase(
        "brindisi",
        "La regola del brindisi",
        [
          ["Chi propone il brindisi", "lo fa breve: una frase e via."],
          ["Chi ha il bicchiere vuoto", "se lo fa riempire prima di alzarlo."],
          ["Chi arriva dopo il brindisi", "deve recuperarlo da solo, in piedi sulla sedia."],
          ["Chi beve analcolico", "brinda lo stesso, con l'acqua frizzante."],
        ],
        1,
        "«Se lo fa riempire prima di alzarlo» parla di un bicchiere: solo chi ce l'ha vuoto. Il brindisi si fa breve o si recupera.",
      ),
    ],
    "Riferimenti nascosti: «vengono aperti» rimanda agli occhi, «riempire» al bicchiere. Chi ha condiviso ha fatto vincere anche l'altro tavolo; chi ha tradito l'ha fatto a carte scoperte.",
  ),
];

export default varianti;
