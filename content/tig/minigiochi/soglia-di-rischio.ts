import type { SogliaInput } from "@/lib/tig/games/mechanics/soglia-di-rischio";

/**
 * 69 · SOGLIA DI RISCHIO — tre domande veloci (circa 15 secondi l'una) sullo stesso tema, di ragionamento.
 * Soluzioni verificate con calcolo.
 */
const varianti: SogliaInput[] = [
  {
    id: "trasloco",
    theme: "Il trasloco",
    questions: [
      { id: "q1", prompt: "Il furgone porta 12 scatoloni a viaggio e gli scatoloni sono 40. Quanti viaggi servono?", options: [{ id: "a", text: "3" }, { id: "b", text: "4" }, { id: "c", text: "5" }] },
      { id: "q2", prompt: "Il nuovo affitto è 750 € al mese, diviso in 3 coinquilini. Quanto paga ognuno?", options: [{ id: "a", text: "225 €" }, { id: "b", text: "250 €" }, { id: "c", text: "275 €" }] },
      { id: "q3", prompt: "Si parte alle 9:00 e ogni viaggio dura un'ora e mezza. Con 4 viaggi di fila, a che ora si finisce?", options: [{ id: "a", text: "13:30" }, { id: "b", text: "15:00" }, { id: "c", text: "16:30" }] },
    ],
    solution: { answers: { q1: "b", q2: "b", q3: "b" } },
    explain: "40 scatoloni ÷ 12 = 3 viaggi pieni più uno per gli ultimi 4: 4 viaggi. 750 ÷ 3 = 250 €. Quattro viaggi da un'ora e mezza fanno 6 ore: fine alle 15:00.",
  },
  {
    id: "weekend-fuori",
    theme: "Il weekend fuori",
    questions: [
      { id: "q1", prompt: "Partenza venerdì alle 19:00, ritorno domenica alle 19:00. Quante ore dura il weekend?", options: [{ id: "a", text: "36" }, { id: "b", text: "48" }, { id: "c", text: "52" }] },
      { id: "q2", prompt: "La casa costa 270 € per 2 notti e siete in 6. Quanto spende ognuno per notte?", options: [{ id: "a", text: "22,50 €" }, { id: "b", text: "45 €" }, { id: "c", text: "27 €" }] },
      { id: "q3", prompt: "Il treno di ritorno parte alle 18:40 e dalla casa alla stazione servono 25 minuti. Entro che ora dovete uscire?", options: [{ id: "a", text: "18:05" }, { id: "b", text: "18:15" }, { id: "c", text: "18:25" }] },
    ],
    solution: { answers: { q1: "b", q2: "a", q3: "b" } },
    explain: "Da venerdì alle 19 a domenica alle 19 sono due giorni: 48 ore. 270 € ÷ 2 notti = 135 € a notte, diviso 6 = 22,50 €. 18:40 meno 25 minuti = 18:15.",
  },
  {
    id: "lunedi-ufficio",
    theme: "Lunedì in ufficio",
    questions: [
      { id: "q1", prompt: "La riunione inizia alle 11:00 e dura 75 minuti. A che ora finisce?", options: [{ id: "a", text: "12:05" }, { id: "b", text: "12:15" }, { id: "c", text: "12:45" }] },
      { id: "q2", prompt: "Hai 36 mail non lette e ne smaltisci 9 all'ora. Quante ore ti servono?", options: [{ id: "a", text: "3" }, { id: "b", text: "4" }, { id: "c", text: "5" }] },
      { id: "q3", prompt: "Il collega arriva sempre 10 minuti dopo di te. Oggi arrivi 5 minuti prima delle 9. A che ora arriva lui?", options: [{ id: "a", text: "9:05" }, { id: "b", text: "9:10" }, { id: "c", text: "8:50" }] },
    ],
    solution: { answers: { q1: "b", q2: "b", q3: "a" } },
    explain: "75 minuti sono un'ora e un quarto: fine alle 12:15. 36 ÷ 9 = 4 ore. Tu arrivi alle 8:55, il collega 10 minuti dopo: 9:05.",
  },
  {
    id: "cena-compleanno",
    theme: "La cena di compleanno",
    questions: [
      { id: "q1", prompt: "Il tavolo è prenotato alle 20:30 e volete arrivare con un quarto d'ora di anticipo. A che ora vi trovate?", options: [{ id: "a", text: "20:00" }, { id: "b", text: "20:15" }, { id: "c", text: "20:45" }] },
      { id: "q2", prompt: "Siete in 9 compreso il festeggiato, che non paga. Il regalo costa 72 €: quanto mette ognuno?", options: [{ id: "a", text: "8 €" }, { id: "b", text: "9 €" }, { id: "c", text: "12 €" }] },
      { id: "q3", prompt: "La torta ha 12 fette e siete in 9. Dopo una fetta a testa, quante ne restano?", options: [{ id: "a", text: "3" }, { id: "b", text: "4" }, { id: "c", text: "9" }] },
    ],
    solution: { answers: { q1: "b", q2: "b", q3: "a" } },
    explain: "Un quarto d'ora prima delle 20:30 sono le 20:15. Pagano in 8: 72 ÷ 8 = 9 €. 12 fette meno 9 = 3.",
  },
  {
    id: "palestra",
    theme: "In palestra",
    questions: [
      { id: "q1", prompt: "Fai 3 serie da 12 ripetizioni. Quante ripetizioni in tutto?", options: [{ id: "a", text: "30" }, { id: "b", text: "36" }, { id: "c", text: "42" }] },
      { id: "q2", prompt: "L'abbonamento di 3 mesi costa 105 €. Quanto viene al mese?", options: [{ id: "a", text: "30 €" }, { id: "b", text: "35 €" }, { id: "c", text: "40 €" }] },
      { id: "q3", prompt: "Il tapis roulant va a 6 km/h. Quanti minuti servono per fare 1,5 km?", options: [{ id: "a", text: "10" }, { id: "b", text: "15" }, { id: "c", text: "20" }] },
    ],
    solution: { answers: { q1: "b", q2: "b", q3: "b" } },
    explain: "3 × 12 = 36 ripetizioni. 105 ÷ 3 = 35 € al mese. A 6 km/h si fa 1 km ogni 10 minuti: 1,5 km in 15 minuti.",
  },
  {
    id: "spesa-casa",
    theme: "La spesa della casa",
    questions: [
      { id: "q1", prompt: "Il latte costa 1,20 € al litro. Quanto costano 5 litri?", options: [{ id: "a", text: "5,50 €" }, { id: "b", text: "6 €" }, { id: "c", text: "6,50 €" }] },
      { id: "q2", prompt: "La spesa della settimana è 63 € tra 3 coinquilini. Quanto paga ognuno?", options: [{ id: "a", text: "19 €" }, { id: "b", text: "21 €" }, { id: "c", text: "23 €" }] },
      { id: "q3", prompt: "Il supermercato chiude alle 21:00, sono le 20:35. Servono 10 minuti per arrivare e 20 per fare la spesa. Ce la fai?", options: [{ id: "a", text: "Sì, con 5 minuti di margine" }, { id: "b", text: "No, mancano 5 minuti" }, { id: "c", text: "Sì, giusto allo scadere" }] },
    ],
    solution: { answers: { q1: "b", q2: "b", q3: "b" } },
    explain: "5 × 1,20 = 6 €. 63 ÷ 3 = 21 €. Arrivi alle 20:45 e finiresti alle 21:05: ti mancano 5 minuti.",
  },
];

export default varianti;
