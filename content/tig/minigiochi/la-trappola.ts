import type { TrappolaInput } from "@/lib/tig/games/mechanics/la-trappola";

/**
 * 26 · LA TRAPPOLA — tre «trappole di logica» per variante: mini enigmi a 3 opzioni con una risposta istintiva
 * sbagliata e una giusta verificabile in una frase. La difficoltà è quella del terzetto.
 */
const varianti: TrappolaInput[] = [
  {
    id: "gara-se-valigia",
    difficulty: "media",
    traps: [
      {
        name: "La gara",
        prompt: "Alla corsa del parco superi chi è terzo. In che posizione sei adesso?",
        options: [
          { id: "a", text: "Secondo" },
          { id: "b", text: "Terzo" },
          { id: "c", text: "Quarto" },
        ],
      },
      {
        name: "Il «se»",
        prompt: "Ogni volta che Giulia va in palestra, poi ordina la pizza. Stasera Giulia ha ordinato la pizza. Allora…",
        options: [
          { id: "a", text: "È andata in palestra" },
          { id: "b", text: "Non è andata in palestra" },
          { id: "c", text: "Non si può sapere" },
        ],
      },
      {
        name: "La valigia",
        prompt: "La valigia pesa 10 kg più metà del suo peso. Quanto pesa?",
        options: [
          { id: "a", text: "10 kg" },
          { id: "b", text: "15 kg" },
          { id: "c", text: "20 kg" },
        ],
      },
    ],
    solution: { traps: ["b", "c", "c"] },
    explain: "Gara: prendi il posto di chi superi, quindi sei terzo. Il «se»: la pizza può arrivare anche senza palestra, non si può sapere. Valigia: se 10 kg sono l'altra metà, il totale è 20 kg.",
  },
  {
    id: "staccionata-rincaro-barista",
    difficulty: "media",
    traps: [
      {
        name: "La staccionata",
        prompt: "Una staccionata lunga 10 metri ha un paletto ogni 2 metri, compresi quelli alle due estremità. Quanti paletti?",
        options: [
          { id: "a", text: "4" },
          { id: "b", text: "5" },
          { id: "c", text: "6" },
        ],
      },
      {
        name: "Il rincaro",
        prompt: "Il prezzo del brunch passa da 50 a 75 €. Di quanto è aumentato?",
        options: [
          { id: "a", text: "Del 25%" },
          { id: "b", text: "Del 33%" },
          { id: "c", text: "Del 50%" },
        ],
      },
      {
        name: "Il barista",
        prompt: "Tutti i baristi del locale sanno fare lo spritz. Luca sa fare lo spritz. Allora…",
        options: [
          { id: "a", text: "Luca è un barista del locale" },
          { id: "b", text: "Luca non è un barista del locale" },
          { id: "c", text: "Luca può essere barista oppure no" },
        ],
      },
    ],
    solution: { traps: ["c", "c", "c"] },
    explain: "Staccionata: 5 tratti da 2 metri hanno 6 paletti. Rincaro: 25 € in più su 50 è il 50%. Barista: lo spritz lo sanno fare anche altri, quindi Luca può essere barista oppure no.",
  },
  {
    id: "pagine-treno-pizza",
    difficulty: "facile",
    traps: [
      {
        name: "Le pagine",
        prompt: "Leggi dalla pagina 10 alla pagina 20, comprese. Quante pagine hai letto?",
        options: [
          { id: "a", text: "10" },
          { id: "b", text: "11" },
          { id: "c", text: "12" },
        ],
      },
      {
        name: "Il treno di notte",
        prompt: "Il treno parte sabato alle 23:40 e il viaggio dura 50 minuti. Quando arriva?",
        options: [
          { id: "a", text: "Sabato alle 0:30" },
          { id: "b", text: "Domenica alle 0:30" },
          { id: "c", text: "Domenica alle 1:30" },
        ],
      },
      {
        name: "Doppio no",
        prompt: "«Non è vero che non mi piace la pizza» vuol dire che…",
        options: [
          { id: "a", text: "Non mi piace la pizza" },
          { id: "b", text: "Mi piace la pizza" },
          { id: "c", text: "Non si capisce" },
        ],
      },
    ],
    solution: { traps: ["b", "b", "b"] },
    explain: "Pagine: da 10 a 20 comprese sono 20 − 10 + 1 = 11. Treno: 50 minuti dopo le 23:40 è passata la mezzanotte, domenica alle 0:30. Doppio no: due negazioni si annullano, la pizza piace.",
  },
  {
    id: "torta-bevuto-doppio",
    difficulty: "facile",
    traps: [
      {
        name: "La torta",
        prompt: "Hai 3 fette di torta e mangi metà di una fetta. Quante fette INTERE restano?",
        options: [
          { id: "a", text: "1" },
          { id: "b", text: "2" },
          { id: "c", text: "2 e mezza" },
        ],
      },
      {
        name: "Chi ha bevuto",
        prompt: "«Non è vero che nessuno al tavolo ha bevuto.» Quindi…",
        options: [
          { id: "a", text: "Nessuno ha bevuto" },
          { id: "b", text: "Almeno uno ha bevuto" },
          { id: "c", text: "Hanno bevuto tutti" },
        ],
      },
      {
        name: "Metà del doppio",
        prompt: "La metà del doppio di 18 è…",
        options: [
          { id: "a", text: "9" },
          { id: "b", text: "18" },
          { id: "c", text: "36" },
        ],
      },
    ],
    solution: { traps: ["b", "b", "b"] },
    explain: "Torta: resta mezza fetta più 2 fette intere. Chi ha bevuto: il contrario di «nessuno» è «almeno uno», non «tutti». Metà del doppio: raddoppiare e dimezzare riporta a 18.",
  },
  {
    id: "fratelli-media-sconti",
    difficulty: "difficile",
    traps: [
      {
        name: "I fratelli",
        prompt: "Sara ha 3 fratelli maschi e ognuno di loro ha una sola sorella. Quante figlie femmine hanno i genitori?",
        options: [
          { id: "a", text: "1" },
          { id: "b", text: "3" },
          { id: "c", text: "4" },
        ],
      },
      {
        name: "La media",
        prompt: "Hai preso 6 e 8 nei primi due esami. Quanto ti serve al terzo per avere la media del 7?",
        options: [
          { id: "a", text: "6" },
          { id: "b", text: "7" },
          { id: "c", text: "8" },
        ],
      },
      {
        name: "Doppio sconto",
        prompt: "Sullo stesso articolo si applicano due sconti del 50%, uno dopo l'altro. Alla fine…",
        options: [
          { id: "a", text: "È gratis" },
          { id: "b", text: "Paghi un quarto del prezzo" },
          { id: "c", text: "Paghi metà prezzo" },
        ],
      },
    ],
    solution: { traps: ["a", "b", "b"] },
    explain: "Fratelli: la sola sorella di tutti è Sara, quindi una figlia. Media: 6 + 8 + 7 = 21, diviso 3 fa 7. Sconti: metà della metà è un quarto, non zero.",
  },
  {
    id: "moneta-nastro-calendario",
    difficulty: "media",
    traps: [
      {
        name: "La moneta",
        prompt: "Lanci una moneta normale tre volte ed esce sempre testa. Al quarto lancio, testa è…",
        options: [
          { id: "a", text: "Più probabile di croce" },
          { id: "b", text: "Meno probabile di croce" },
          { id: "c", text: "Probabile quanto croce" },
        ],
      },
      {
        name: "Il nastro",
        prompt: "Un nastro lungo 1 metro va diviso in 4 pezzi uguali. Quanti tagli servono?",
        options: [
          { id: "a", text: "2" },
          { id: "b", text: "3" },
          { id: "c", text: "4" },
        ],
      },
      {
        name: "Il calendario",
        prompt: "Se il 1° del mese è lunedì, che giorno è il 29?",
        options: [
          { id: "a", text: "Domenica" },
          { id: "b", text: "Lunedì" },
          { id: "c", text: "Martedì" },
        ],
      },
    ],
    solution: { traps: ["c", "b", "b"] },
    explain: "Moneta: non ha memoria, ogni lancio è 50 e 50. Nastro: 3 tagli fanno 4 pezzi. Calendario: il 29 è 28 giorni dopo, cioè esattamente 4 settimane: ancora lunedì.",
  },
  {
    id: "resto-decimali-uova",
    difficulty: "facile",
    traps: [
      {
        name: "Il resto",
        prompt: "Paghi un conto di 8,70 € con una banconota da 10 €. Il resto è…",
        options: [
          { id: "a", text: "1,30 €" },
          { id: "b", text: "1,70 €" },
          { id: "c", text: "2,30 €" },
        ],
      },
      {
        name: "Il più grande",
        prompt: "Qual è il numero più grande?",
        options: [
          { id: "a", text: "0,45" },
          { id: "b", text: "0,456" },
          { id: "c", text: "0,5" },
        ],
      },
      {
        name: "Le uova",
        prompt: "La ricetta per 4 persone vuole 3 uova. Per 8 persone quante ne servono?",
        options: [
          { id: "a", text: "6" },
          { id: "b", text: "7" },
          { id: "c", text: "12" },
        ],
      },
    ],
    solution: { traps: ["a", "c", "a"] },
    explain: "Resto: 10 − 8,70 = 1,30 €. Più grande: 0,5 vale 0,500, più di 0,456 anche se ha meno cifre. Uova: il doppio delle persone, il doppio delle uova, 6.",
  },
  {
    id: "orologio-caramelle-sabati",
    difficulty: "media",
    traps: [
      {
        name: "L'orologio",
        prompt: "Il tuo orologio va AVANTI di 10 minuti e segna le 20:05. Che ore sono davvero?",
        options: [
          { id: "a", text: "19:55" },
          { id: "b", text: "20:05" },
          { id: "c", text: "20:15" },
        ],
      },
      {
        name: "Le caramelle",
        prompt: "Nel sacchetto, al buio, ci sono 5 caramelle rosse e 5 verdi. Quante ne prendi, al minimo, per averne di sicuro due dello stesso colore?",
        options: [
          { id: "a", text: "2" },
          { id: "b", text: "3" },
          { id: "c", text: "6" },
        ],
      },
      {
        name: "I sabati",
        prompt: "Lavori un sabato sì e uno no, e il primo sabato del mese lavori. In un mese con 5 sabati, quanti ne lavori?",
        options: [
          { id: "a", text: "2" },
          { id: "b", text: "3" },
          { id: "c", text: "5" },
        ],
      },
    ],
    solution: { traps: ["a", "b", "b"] },
    explain: "Orologio: se va avanti, l'ora vera è prima: 19:55. Caramelle: con due puoi averne una per colore, la terza fa per forza coppia. Sabati: il 1°, il 3° e il 5°.",
  },
  {
    id: "chilo-coda-ascensore",
    difficulty: "facile",
    traps: [
      {
        name: "Il chilo",
        prompt: "Cosa pesa di più: un chilo di patatine o mille grammi di cuscini?",
        options: [
          { id: "a", text: "Le patatine" },
          { id: "b", text: "I cuscini" },
          { id: "c", text: "Pesano uguale" },
        ],
      },
      {
        name: "La coda",
        prompt: "In coda alla cassa hai 4 persone davanti e 4 dietro. Quante persone ci sono in coda, te compreso?",
        options: [
          { id: "a", text: "8" },
          { id: "b", text: "9" },
          { id: "c", text: "10" },
        ],
      },
      {
        name: "L'ascensore",
        prompt: "L'ascensore porta al massimo 4 persone. Siete in 10 e dovete salire tutti. Quanti viaggi in salita servono, al minimo?",
        options: [
          { id: "a", text: "2" },
          { id: "b", text: "3" },
          { id: "c", text: "4" },
        ],
      },
    ],
    solution: { traps: ["c", "b", "b"] },
    explain: "Chilo: mille grammi sono un chilo, pesano uguale. Coda: 4 + 4 più te fa 9. Ascensore: 4 + 4 + 2, quindi 3 viaggi.",
  },
  {
    id: "cane-bicchiere-prestito",
    difficulty: "difficile",
    traps: [
      {
        name: "Il cane",
        prompt: "Tra 3 anni il cane avrà il doppio degli anni che aveva 3 anni fa. Quanti anni ha oggi?",
        options: [
          { id: "a", text: "6" },
          { id: "b", text: "9" },
          { id: "c", text: "12" },
        ],
      },
      {
        name: "Il bicchiere",
        prompt: "Il bicchiere è pieno a metà e ne bevi la metà. Quanto ne resta, rispetto al bicchiere pieno?",
        options: [
          { id: "a", text: "Un quarto" },
          { id: "b", text: "Un terzo" },
          { id: "c", text: "Metà" },
        ],
      },
      {
        name: "Il prestito",
        prompt: "Presti 10 € a un amico. Lui te ne ridà 5, poi tu ti fai prestare 5 € da lui. Come siete messi?",
        options: [
          { id: "a", text: "Lui ti deve 5 €" },
          { id: "b", text: "Siete pari" },
          { id: "c", text: "Tu gli devi 5 €" },
        ],
      },
    ],
    solution: { traps: ["b", "a", "b"] },
    explain: "Cane: con 9 anni, tra 3 ne avrà 12, il doppio dei 6 di tre anni fa. Bicchiere: metà di metà è un quarto. Prestito: lui ti doveva 5 € e ora tu ne devi 5 a lui: siete pari.",
  },
  {
    id: "gambe-parcheggio-festival",
    difficulty: "difficile",
    traps: [
      {
        name: "Le gambe",
        prompt: "Al tavolo 4 persone sono sedute su 4 sedie, e ci sono altre 2 sedie libere. Contando le gambe di persone e sedie, quante sono?",
        options: [
          { id: "a", text: "24" },
          { id: "b", text: "32" },
          { id: "c", text: "40" },
        ],
      },
      {
        name: "Il parcheggio",
        prompt: "Il parcheggio costa 2 € la prima ora e 1 € per ogni ora successiva, anche solo iniziata. Resti 3 ore e 10 minuti. Quanto paghi?",
        options: [
          { id: "a", text: "4 €" },
          { id: "b", text: "5 €" },
          { id: "c", text: "6 €" },
        ],
      },
      {
        name: "Il festival",
        prompt: "Il festival dura dal 12 al 15 luglio, compresi. Quanti giorni dura?",
        options: [
          { id: "a", text: "3" },
          { id: "b", text: "4" },
          { id: "c", text: "5" },
        ],
      },
    ],
    solution: { traps: ["b", "b", "b"] },
    explain: "Gambe: 4 persone × 2 = 8, più 6 sedie × 4 = 24: 32 in tutto. Parcheggio: 2 € per la prima ora, poi la seconda, la terza e la quarta iniziata: 5 €. Festival: 12, 13, 14 e 15, quattro giorni.",
  },
  {
    id: "numeri-pizze-gemelli",
    difficulty: "media",
    traps: [
      {
        name: "Tra 3 e 9",
        prompt: "Quanti numeri interi ci sono tra 3 e 9, esclusi il 3 e il 9?",
        options: [
          { id: "a", text: "5" },
          { id: "b", text: "6" },
          { id: "c", text: "7" },
        ],
      },
      {
        name: "Le pizze",
        prompt: "In tre dividete due pizze in parti uguali. Quanta pizza a testa?",
        options: [
          { id: "a", text: "Un terzo di pizza" },
          { id: "b", text: "Mezza pizza" },
          { id: "c", text: "Due terzi di pizza" },
        ],
      },
      {
        name: "I gemelli",
        prompt: "Due gemelli nascono a 10 minuti di distanza: il primo il 31 dicembre alle 23:55. Quando festeggia il compleanno il secondo?",
        options: [
          { id: "a", text: "Il 30 dicembre" },
          { id: "b", text: "Il 31 dicembre" },
          { id: "c", text: "Il 1° gennaio" },
        ],
      },
    ],
    solution: { traps: ["a", "c", "c"] },
    explain: "Tra 3 e 9: 4, 5, 6, 7 e 8, cioè 5 numeri. Pizze: 2 diviso 3 fa due terzi a testa. Gemelli: 10 minuti dopo le 23:55 è già il 1° gennaio.",
  },
];

export default varianti;
