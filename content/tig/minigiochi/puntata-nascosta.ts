import type { PuntataInput } from "@/lib/tig/games/mechanics/puntata-nascosta";

/**
 * 65 · PUNTATA NASCOSTA — la categoria (visibile mentre si punta) annuncia il tipo di ragionamento; la
 * domanda arriva dopo. Niente `balances`: li inietta il runtime. Soluzioni verificate con calcolo.
 */
const varianti: PuntataInput[] = [
  {
    id: "conti-in-tasca",
    category: "Conti in tasca",
    prompt: "Cena da 96 € in quattro. Due pagano 30 € ciascuno, il terzo 20 €. Quanto deve mettere il quarto per chiudere il conto?",
    options: [
      { id: "a", text: "16 €" },
      { id: "b", text: "24 €" },
      { id: "c", text: "26 €" },
      { id: "d", text: "36 €" },
    ],
    solution: { optionId: "a" },
    explain: "Gli altri tre hanno messo 30 + 30 + 20 = 80 €. Mancano 96 − 80 = 16 €.",
  },
  {
    id: "orari-notte",
    category: "Orari e viaggi notturni",
    prompt: "Parti alle 22:15 per un viaggio in pullman di 9 ore e 50 minuti. A che ora arrivi la mattina dopo?",
    options: [
      { id: "a", text: "07:05" },
      { id: "b", text: "08:05" },
      { id: "c", text: "08:15" },
      { id: "d", text: "07:55" },
    ],
    solution: { optionId: "b" },
    explain: "Alle 22:15 più 9 ore fanno le 7:15; più altri 50 minuti si arriva alle 8:05.",
  },
  {
    id: "turni-bagno",
    category: "Logica da coinquilini",
    prompt: "Il bagno si pulisce una settimana a testa, sempre in questo ordine: Ada, Bruno, Chiara, Dario. Questa settimana tocca a Chiara. A chi tocca tra 6 settimane?",
    options: [
      { id: "ada", text: "Ada" },
      { id: "bruno", text: "Bruno" },
      { id: "chiara", text: "Chiara" },
      { id: "dario", text: "Dario" },
    ],
    solution: { optionId: "ada" },
    explain: "Il giro dura 4 settimane: tra 4 settimane tocca di nuovo a Chiara, poi Dario, poi Ada (6 settimane).",
  },
  {
    id: "aumento-stipendio",
    category: "Percentuali sul lavoro",
    prompt: "Lo stipendio passa da 1.500 € a 1.650 € al mese. Di quanto è aumentato, in percentuale?",
    options: [
      { id: "a", text: "10%" },
      { id: "b", text: "15%" },
      { id: "c", text: "9%" },
      { id: "d", text: "11%" },
    ],
    solution: { optionId: "a" },
    explain: "L'aumento è di 150 €, e 150 su 1.500 è un decimo: il 10%.",
  },
  {
    id: "calendario-mese",
    category: "Calendario",
    prompt: "Il 3 del mese è un lunedì. Che giorno della settimana è il 24 dello stesso mese?",
    options: [
      { id: "lun", text: "Lunedì" },
      { id: "mar", text: "Martedì" },
      { id: "dom", text: "Domenica" },
      { id: "mer", text: "Mercoledì" },
    ],
    solution: { optionId: "lun" },
    explain: "Dal 3 al 24 passano 21 giorni, cioè esattamente 3 settimane: è di nuovo lunedì.",
  },
  {
    id: "sondaggio-gruppo",
    category: "Chat di gruppo",
    prompt: "Nel gruppo ci sono 12 persone. Al sondaggio 7 votano «sì», 3 votano «no», gli altri non votano. Che parte del gruppo non ha votato?",
    options: [
      { id: "a", text: "Un sesto" },
      { id: "b", text: "Un quarto" },
      { id: "c", text: "Un terzo" },
      { id: "d", text: "Metà" },
    ],
    solution: { optionId: "a" },
    explain: "Non hanno votato in 12 − 7 − 3 = 2. Due su dodici sono un sesto.",
  },
  {
    id: "treno-velocita",
    category: "Viaggi in treno",
    prompt: "Un treno viaggia sempre a 120 km/h. Quanti minuti impiega per fare 50 km?",
    options: [
      { id: "a", text: "20 minuti" },
      { id: "b", text: "25 minuti" },
      { id: "c", text: "30 minuti" },
      { id: "d", text: "42 minuti" },
    ],
    solution: { optionId: "b" },
    explain: "A 120 km/h si fanno 2 km al minuto: 50 km richiedono 25 minuti.",
  },
  {
    id: "rotoli-convenienza",
    category: "Spesa condivisa",
    prompt: "La confezione da 6 rotoli di carta costa 4,20 €, quella da 9 rotoli 5,85 €. Quale conviene e quanto costa ogni rotolo?",
    options: [
      { id: "a", text: "Quella da 6: 0,70 € a rotolo" },
      { id: "b", text: "Quella da 9: 0,65 € a rotolo" },
      { id: "c", text: "Quella da 9: 0,70 € a rotolo" },
      { id: "d", text: "Costano uguale al rotolo" },
    ],
    solution: { optionId: "b" },
    explain: "4,20 ÷ 6 = 0,70 € a rotolo; 5,85 ÷ 9 = 0,65 €. Conviene la confezione da 9.",
  },
  {
    id: "corsa-ritmo",
    category: "Sport e allenamento",
    prompt: "Corri 5 km in 30 minuti. Mantenendo lo stesso ritmo, quanto ci metti a correre 8 km?",
    options: [
      { id: "a", text: "45 minuti" },
      { id: "b", text: "48 minuti" },
      { id: "c", text: "50 minuti" },
      { id: "d", text: "54 minuti" },
    ],
    solution: { optionId: "b" },
    explain: "Il ritmo è di 6 minuti al km: 8 km × 6 = 48 minuti.",
  },
];

export default varianti;
