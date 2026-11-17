import type { DoppioInput } from "@/lib/tig/games/mechanics/doppio-rischio";

/**
 * 24 · DOPPIO RISCHIO — domande di ragionamento con una trappola plausibile: la tariffa ALTA è una vera
 * scommessa. Soluzioni verificate con calcolo.
 */
const varianti: DoppioInput[] = [
  {
    id: "volo-fuso",
    prompt: "Un volo parte da Roma alle 23:40 e atterra a Londra all'1:10 ora di Londra. Londra è un'ora indietro rispetto a Roma. Quanto dura il volo?",
    options: [
      { id: "a", text: "1 ora e 30 minuti" },
      { id: "b", text: "2 ore e 30 minuti" },
      { id: "c", text: "3 ore e 30 minuti" },
      { id: "d", text: "2 ore" },
    ],
    solution: { optionId: "b" },
    explain: "Le 23:40 di Roma sono le 22:40 di Londra. Dalle 22:40 all'1:10 passano 2 ore e 30 minuti.",
  },
  {
    id: "messaggi-privati",
    prompt: "In un gruppo di 6 amici ognuno manda un messaggio privato a ciascuno degli altri. Quanti messaggi privati partono in tutto?",
    options: [
      { id: "a", text: "15" },
      { id: "b", text: "30" },
      { id: "c", text: "36" },
      { id: "d", text: "12" },
    ],
    solution: { optionId: "b" },
    explain: "Ognuno dei 6 ne manda 5: 6 × 5 = 30. Il 15 conta le coppie, ma ogni coppia si scambia due messaggi.",
  },
  {
    id: "felpa-sconto",
    prompt: "Una felpa costa 40 €. Prima viene scontata del 25%, poi sul nuovo prezzo arriva un aumento del 25%. Quanto costa adesso?",
    options: [
      { id: "a", text: "40 €" },
      { id: "b", text: "37,50 €" },
      { id: "c", text: "35 €" },
      { id: "d", text: "42,50 €" },
    ],
    solution: { optionId: "b" },
    explain: "Con lo sconto passa a 30 €. Il 25% di 30 è 7,50 €: il prezzo finale è 37,50 €, non torna a 40.",
  },
  {
    id: "libro-gara",
    prompt: "Lucia legge 20 pagine al giorno, Tommaso 30. Lucia ha iniziato lo stesso libro 2 giorni prima di lui. Dopo quanti giorni di lettura di Tommaso sono alla stessa pagina?",
    options: [
      { id: "a", text: "2" },
      { id: "b", text: "3" },
      { id: "c", text: "4" },
      { id: "d", text: "6" },
    ],
    solution: { optionId: "c" },
    explain: "Lucia parte con 40 pagine di vantaggio e Tommaso ne recupera 10 al giorno: servono 4 giorni (120 pagine entrambi).",
  },
  {
    id: "yogurt-frigo",
    prompt: "Tre coinquilini comprano 4 yogurt a testa. Ognuno mangia 2 dei suoi e 1 di ciascuno degli altri due. Quanti yogurt restano in frigo?",
    options: [
      { id: "a", text: "0" },
      { id: "b", text: "3" },
      { id: "c", text: "6" },
      { id: "d", text: "4" },
    ],
    solution: { optionId: "a" },
    explain: "Ognuno mangia 4 yogurt (2 suoi e 2 degli altri): 12 in tutto, cioè tutti. Infatti ogni scorta perde 2 + 1 + 1 = 4 yogurt.",
  },
  {
    id: "palestra-annuale",
    prompt: "La palestra costa 35 € al mese oppure 360 € per un anno pagato subito. Da quanti mesi di frequenza in su l'annuale costa meno dei mensili?",
    options: [
      { id: "a", text: "9" },
      { id: "b", text: "10" },
      { id: "c", text: "11" },
      { id: "d", text: "12" },
    ],
    solution: { optionId: "c" },
    explain: "Dieci mesi costano 350 €, ancora meno dell'annuale. Con 11 mesi si arriva a 385 €: da lì l'annuale conviene.",
  },
  {
    id: "sveglia-avanti",
    prompt: "La sveglia è avanti di 7 minuti e segna 7:52. Il treno parte alle 8:05 e la stazione è a 15 minuti a piedi. Se esci subito?",
    options: [
      { id: "a", text: "Arrivi 5 minuti prima" },
      { id: "b", text: "Arrivi 12 minuti prima" },
      { id: "c", text: "Perdi il treno di 2 minuti" },
      { id: "d", text: "Arrivi giusto alle 8:05" },
    ],
    solution: { optionId: "a" },
    explain: "In realtà sono le 7:45. Con 15 minuti di cammino arrivi alle 8:00: 5 minuti prima della partenza.",
  },
  {
    id: "casa-ultimo-arrivato",
    prompt: "Casa affittata per 4 notti a 560 € in tutto. Siete in 6; un amico arriva solo per le ultime 2 notti. Ogni notte si divide alla pari tra i presenti. Quanto paga lui?",
    options: [
      { id: "a", text: "40 €" },
      { id: "b", text: "70 €" },
      { id: "c", text: "80 €" },
      { id: "d", text: "35 €" },
    ],
    solution: { optionId: "a" },
    explain: "Ogni notte costa 140 €. Nelle ultime due si divide in 7: 20 € a notte. Per due notti l'ultimo arrivato paga 40 €.",
  },
  {
    id: "cani-gatti",
    prompt: "Su 5 amici, 3 hanno un gatto e 2 un cane; uno solo ha sia il cane sia il gatto. Quanti non hanno né cane né gatto?",
    options: [
      { id: "a", text: "0" },
      { id: "b", text: "1" },
      { id: "c", text: "2" },
      { id: "d", text: "3" },
    ],
    solution: { optionId: "b" },
    explain: "Chi ha almeno un animale: 3 + 2 − 1 (contato due volte) = 4. Su 5 amici ne resta 1 senza.",
  },
];

export default varianti;
