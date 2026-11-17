import type { SicuroInput } from "@/lib/tig/games/mechanics/sicuro-o-rischio";

/**
 * 71 · SICURO O RISCHIO — stesso tema per le due prove: SICURA (3 opzioni) e RISCHIOSA (numero esatto da
 * digitare, calcolo in più passaggi). Risultati verificati con calcolo.
 */
const varianti: SicuroInput[] = [
  {
    id: "viaggio-treno",
    theme: "Il viaggio in treno",
    safe: {
      prompt: "Il treno parte alle 7:40 e il viaggio dura 2 ore e 35 minuti. A che ora arrivi?",
      options: [
        { id: "a", text: "10:05" },
        { id: "b", text: "10:15" },
        { id: "c", text: "10:25" },
      ],
    },
    risky: {
      prompt: "Il biglietto costa 38 € a persona; con la carta gruppo, da 4 persone in su, ognuno ha il 25% di sconto. Siete in 6: quanti euro spendete in tutto?",
      unit: "euro",
      maxDigits: 3,
    },
    solution: { safe: "b", risky: 171, riskyWhy: "Con lo sconto del 25% un biglietto costa 38 × 0,75 = 28,50 €. In 6: 28,50 × 6 = 171 €." },
    explain: "Sicura: 7:40 + 2 ore e 35 minuti = 10:15. Rischiosa: 28,50 € a testa con lo sconto, per 6 persone = 171 €.",
  },
  {
    id: "casa-mare",
    theme: "La casa al mare",
    safe: {
      prompt: "La casa costa 882 € a settimana e siete in 7. Quanto paga ognuno?",
      options: [
        { id: "a", text: "116 €" },
        { id: "b", text: "126 €" },
        { id: "c", text: "136 €" },
      ],
    },
    risky: {
      prompt: "Stessa casa, 882 € per 7 notti. Siete in 7, ma per le ultime 3 notti arrivano 2 amici. Ogni notte si divide alla pari tra i presenti. Quanti euro paga in tutto uno dei 7?",
      unit: "euro",
      maxDigits: 3,
    },
    solution: {
      safe: "b",
      risky: 114,
      riskyWhy: "Una notte costa 882 ÷ 7 = 126 €. Prime 4 notti in 7: 18 € a notte (72 €). Ultime 3 notti in 9: 14 € a notte (42 €). Totale 114 €.",
    },
    explain: "Sicura: 882 ÷ 7 = 126 €. Rischiosa: 4 notti da 18 € più 3 notti da 14 € = 114 €; i due amici pagano 42 € a testa e i conti tornano (7 × 114 + 2 × 42 = 882).",
  },
  {
    id: "conto-sushi",
    theme: "Il conto del sushi",
    safe: {
      prompt: "Menu fisso a 25 € a testa e siete in 6. Quanto spendete in tutto?",
      options: [
        { id: "a", text: "125 €" },
        { id: "b", text: "150 €" },
        { id: "c", text: "175 €" },
      ],
    },
    risky: {
      prompt: "Il conto è 188 €. Marta e Luca hanno preso solo il menu da 22 € a testa; gli altri 4 dividono il resto in parti uguali. Quanti euro paga ognuno dei 4?",
      unit: "euro",
      maxDigits: 3,
    },
    solution: { safe: "b", risky: 36, riskyWhy: "Marta e Luca pagano 44 € in due. Restano 188 − 44 = 144 €, divisi in 4: 36 € a testa." },
    explain: "Sicura: 25 × 6 = 150 €. Rischiosa: 188 − 44 = 144 €, diviso 4 = 36 €.",
  },
  {
    id: "turni-lavoro",
    theme: "Turni al lavoro",
    safe: {
      prompt: "Turno dalle 14:00 alle 22:00 con mezz'ora di pausa non pagata. Quante ore lavori davvero?",
      options: [
        { id: "a", text: "7 ore" },
        { id: "b", text: "7 ore e mezza" },
        { id: "c", text: "8 ore" },
      ],
    },
    risky: {
      prompt: "Paga 9 € l'ora, la domenica +50%. Questa settimana fai 3 turni feriali da 6 ore e una domenica da 4 ore. Quanti euro guadagni?",
      unit: "euro",
      maxDigits: 3,
    },
    solution: { safe: "b", risky: 216, riskyWhy: "Feriali: 18 ore × 9 € = 162 €. Domenica: 9 € + 50% = 13,50 € l'ora × 4 = 54 €. Totale 216 €." },
    explain: "Sicura: 8 ore meno mezz'ora di pausa = 7 ore e mezza. Rischiosa: 162 € nei giorni feriali più 54 € la domenica = 216 €.",
  },
  {
    id: "sondaggio-vacanza",
    theme: "Il sondaggio della vacanza",
    safe: {
      prompt: "Nel gruppo da 20 persone il 40% vota «mare». Quante persone sono?",
      options: [
        { id: "a", text: "6" },
        { id: "b", text: "8" },
        { id: "c", text: "10" },
      ],
    },
    risky: {
      prompt: "Votano tutti e 20, una scelta a testa tra mare, montagna e città. «Mare» prende 2 voti più di «montagna», «città» 3 voti meno di «montagna». Quanti voti prende «mare»?",
      unit: "voti",
      maxDigits: 2,
    },
    solution: { safe: "b", risky: 9, riskyWhy: "Se la montagna ha M voti: M + 2 + M + M − 3 = 20, quindi 3M = 21 e M = 7. Mare 9, montagna 7, città 4." },
    explain: "Sicura: il 40% di 20 è 8. Rischiosa: montagna 7, quindi mare 9 e città 4 (9 + 7 + 4 = 20).",
  },
  {
    id: "consegna-domicilio",
    theme: "La consegna a domicilio",
    safe: {
      prompt: "Il rider è a 3 km da casa tua e va a 15 km/h. Tra quanti minuti arriva?",
      options: [
        { id: "a", text: "10" },
        { id: "b", text: "12" },
        { id: "c", text: "15" },
      ],
    },
    risky: {
      prompt: "Ordinate 3 pizze da 7,50 €, 2 bibite da 2,50 € e la consegna costa 3 €. Il codice sconto del 20% vale solo sulle pizze. Quanti euro pagate in tutto?",
      unit: "euro",
      maxDigits: 3,
    },
    solution: { safe: "b", risky: 26, riskyWhy: "Pizze: 22,50 € − 20% = 18 €. Bibite 5 €, consegna 3 €. Totale 18 + 5 + 3 = 26 €." },
    explain: "Sicura: a 15 km/h si fanno 3 km in un quinto d'ora, cioè 12 minuti. Rischiosa: 18 € di pizze scontate più 5 € di bibite e 3 € di consegna = 26 €.",
  },
  {
    id: "trasloco-furgone",
    theme: "Il trasloco col furgone",
    safe: {
      prompt: "Ci sono 40 scatoloni e il furgone ne porta 15 a viaggio. Quanti viaggi servono?",
      options: [
        { id: "a", text: "2" },
        { id: "b", text: "3" },
        { id: "c", text: "4" },
      ],
    },
    risky: {
      prompt: "Il furgone a noleggio costa 30 € l'ora più 0,50 € a km. Lo tenete 5 ore e fate 64 km. Quanti euro spendete?",
      unit: "euro",
      maxDigits: 3,
    },
    solution: { safe: "b", risky: 182, riskyWhy: "5 ore × 30 € = 150 €; 64 km × 0,50 € = 32 €. Totale 182 €." },
    explain: "Sicura: due viaggi pieni portano 30 scatoloni, ne serve un terzo per gli ultimi 10. Rischiosa: 150 € di noleggio più 32 € di chilometri = 182 €.",
  },
];

export default varianti;
