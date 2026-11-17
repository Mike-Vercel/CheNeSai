import type { MaggioranzaInput } from "@/lib/tig/games/mechanics/prevedi-la-maggioranza";

/**
 * 33 · PREVEDI LA MAGGIORANZA — dilemmi leggeri e universali. Nessuna risposta giusta: decide il locale.
 * Le spiegazioni restano neutre (perché un pub si divide), mai giudizi su chi vota cosa.
 */
const varianti: MaggioranzaInput[] = [
  {
    id: "venerdi-sera",
    prompt: "Dopo una settimana pesante, venerdì sera: serata fuori o serie sul divano?",
    options: [
      { id: "fuori", text: "Serata fuori" },
      { id: "divano", text: "Serie sul divano" },
    ],
    explain: "Chi è già al pub stasera tende a sopravvalutare la voglia di uscire degli altri. Ma la stanchezza del venerdì è un argomento serio per tutti.",
  },
  {
    id: "conto-cena",
    prompt: "Cena di gruppo in sei, ognuno ha preso cose diverse. Come si paga?",
    options: [
      { id: "romana", text: "Alla romana, si divide in parti uguali" },
      { id: "ognuno", text: "Ognuno paga quello che ha preso" },
      { id: "uno-paga", text: "Paga uno e poi si fa la richiesta in app" },
    ],
    explain: "Dividere in parti uguali è veloce, pagare il proprio è preciso, l'app è comoda ma lascia sempre qualcuno indietro coi rimborsi. Ogni gruppo ha la sua scuola.",
  },
  {
    id: "vocale-o-testo",
    prompt: "Un amico ti deve raccontare una cosa lunga. Preferisci che te la mandi come…",
    options: [
      { id: "vocale", text: "Vocale" },
      { id: "testo", text: "Messaggio scritto" },
      { id: "chiamata", text: "Chiamata e basta" },
    ],
    explain: "Il vocale è comodo per chi parla, il testo per chi legge, la chiamata per chi vuole chiudere in fretta. Di solito il locale si spacca tra i primi due.",
  },
  {
    id: "weekend-improvvisato",
    prompt: "Weekend libero e budget limitato: dove andate?",
    options: [
      { id: "mare", text: "Mare, anche fuori stagione" },
      { id: "montagna", text: "Montagna e camminata" },
      { id: "citta", text: "Città d'arte in treno" },
      { id: "casa", text: "Si resta in città e si riposa" },
    ],
    explain: "Mare e città d'arte raccolgono spesso più voti, ma il riposo in casa ha più fan di quanti lo ammettano ad alta voce.",
  },
  {
    id: "sveglia",
    prompt: "La sveglia suona. Che tipo di persona sei?",
    options: [
      { id: "subito", text: "Mi alzo al primo squillo" },
      { id: "rimanda-uno", text: "Rimando una volta" },
      { id: "rimanda-tanti", text: "Rimando finché posso" },
    ],
    explain: "Quasi tutti rimandano almeno una volta. La vera sfida è prevedere quanti lo confessano davanti al proprio tavolo.",
  },
  {
    id: "gruppo-silenzioso",
    prompt: "Un gruppo chat con 200 messaggi non letti. Cosa fai?",
    options: [
      { id: "leggo", text: "Leggo tutto dall'inizio" },
      { id: "ultimi", text: "Leggo solo gli ultimi" },
      { id: "chiedo", text: "Scrivo «riassunto?»" },
      { id: "silenzio", text: "Silenzio il gruppo" },
    ],
    explain: "Leggere tutto è da eroi, chiedere un riassunto è da coraggiosi. Gli ultimi messaggi sono il compromesso più votato in quasi ogni locale.",
  },
  {
    id: "vacanza-organizzata",
    prompt: "In un viaggio tra amici, tu di solito sei quello che…",
    options: [
      { id: "organizza", text: "Organizza tutto con un foglio condiviso" },
      { id: "segue", text: "Segue il gruppo e si adatta" },
      { id: "improvvisa", text: "Propone cambi di programma all'ultimo" },
    ],
    explain: "In ogni gruppo c'è almeno un organizzatore, ma la maggioranza si dichiara quasi sempre «quello che si adatta». Comodo, no?",
  },
  {
    id: "colazione",
    prompt: "Colazione della domenica: dolce o salata?",
    options: [
      { id: "dolce", text: "Dolce" },
      { id: "salata", text: "Salata" },
    ],
    explain: "In Italia il dolce parte favorito, ma il brunch salato del weekend ha conquistato parecchi tavoli. Pronostico meno scontato di quanto sembri.",
  },
  {
    id: "arrivo-festa",
    prompt: "Festa a casa di amici, invito alle 21. A che ora arrivi davvero?",
    options: [
      { id: "puntuale", text: "Alle 21 in punto" },
      { id: "mezzora", text: "Verso le 21:30" },
      { id: "ora", text: "Dopo le 22" },
    ],
    explain: "Il «ritardo accettabile» di mezz'ora è la risposta più diffusa, ma chi arriva puntuale spesso si ritrova ad aiutare con le sedie.",
  },
];

export default varianti;
