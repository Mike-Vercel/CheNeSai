import type { GiraInput } from "@/lib/tig/games/mechanics/gira-la-scelta";

/**
 * 48 · GIRA LA SCELTA — un evento, tre rischi. Le tre prove di una variante sono dello stesso tipo e della stessa
 * difficoltà (stesse probabilità e ricompense): cambia solo il tema. Ogni risposta si verifica con un conto o
 * una lettura attenta, spiegata al reveal.
 */
const varianti: GiraInput[] = [
  {
    id: "trasloco",
    difficulty: "facile",
    event: "Il trasloco del sabato",
    story: "Sabato mattina, terzo piano senza ascensore, un furgone a noleggio e tre amici convinti con la promessa di una pizza.",
    cards: [
      { id: "divano", title: "Il divano", teaser: "Non passa dalla porta: serve un conto al volo", question: "Il divano è lungo 2 metri e 10, la porta è alta 2 metri e 5. Di quanti centimetri è più lungo?", options: [{ id: "a", text: "5 cm" }, { id: "b", text: "15 cm" }, { id: "c", text: "50 cm" }] },
      { id: "scatole", title: "Le scatole", teaser: "Trenta scatole e pochi viaggi", question: "Trenta scatole, ogni viaggio in auto ne porta 8. Quanti viaggi servono almeno?", options: [{ id: "a", text: "3" }, { id: "b", text: "4" }, { id: "c", text: "5" }] },
      { id: "furgone", title: "Il furgone", teaser: "Il noleggio scade e si paga a ore", question: "Il furgone costa 12 euro l'ora più 15 euro fissi. Quanto per 4 ore?", options: [{ id: "a", text: "48 euro" }, { id: "b", text: "63 euro" }, { id: "c", text: "60 euro" }] },
    ],
    solution: { answers: { divano: "a", scatole: "b", furgone: "b" } },
    explain: "Divano: 210 meno 205 fa 5 centimetri. Scatole: 3 viaggi ne portano 24, ne serve un quarto. Furgone: 4 ore per 12 fa 48, più 15 fissi fa 63.",
  },
  {
    id: "cena-suoceri",
    difficulty: "media",
    event: "La cena dai futuri suoceri",
    story: "Prima cena a casa dei genitori del partner: tre momenti critici, tre modi di uscirne con onore.",
    cards: [
      { id: "orario", title: "L'orario", teaser: "Arrivare puntuali senza sembrare ansiosi", question: "La cena è alle 20:15 e ci vogliono 35 minuti di strada. Vuoi arrivare con 5 minuti di anticipo: a che ora parti?", options: [{ id: "a", text: "19:35" }, { id: "b", text: "19:40" }, { id: "c", text: "19:45" }] },
      { id: "vino", title: "Il vino", teaser: "Una bottiglia da scegliere con il budget giusto", question: "Hai 30 euro: una bottiglia costa 12,50 e i fiori 9,90. Quanto ti resta?", options: [{ id: "a", text: "7,60 euro" }, { id: "b", text: "8,40 euro" }, { id: "c", text: "6,60 euro" }] },
      { id: "posti", title: "I posti a tavola", teaser: "Sei persone e un tavolo rotondo", question: "Sei persone a un tavolo rotondo: ognuno ha due vicini. Quante coppie di vicini ci sono in tutto?", options: [{ id: "a", text: "6" }, { id: "b", text: "12" }, { id: "c", text: "3" }] },
    ],
    solution: { answers: { orario: "a", vino: "a", posti: "a" } },
    explain: "Orario: 20:15 meno 5 minuti fa 20:10, meno 35 di strada fa 19:35. Vino: 12,50 più 9,90 fa 22,40, da 30 restano 7,60. Posti: in cerchio le coppie di vicini sono tante quante le persone, 6.",
  },
  {
    id: "colloquio",
    difficulty: "media",
    event: "Il colloquio di lavoro",
    story: "Il colloquio dei sogni è stamattina. Tre cose possono andare storte prima ancora di sedersi.",
    cards: [
      { id: "treno", title: "Il treno", teaser: "Ritardi e coincidenze", question: "Il colloquio è alle 10:00. Il treno doveva arrivare alle 9:20 ma ha 25 minuti di ritardo, poi servono 10 minuti a piedi. Arrivi in tempo?", options: [{ id: "a", text: "Sì, con 5 minuti di anticipo" }, { id: "b", text: "No, con 5 minuti di ritardo" }, { id: "c", text: "Sì, con 15 minuti di anticipo" }] },
      { id: "cv", title: "Il curriculum", teaser: "Gli anni di esperienza da contare", question: "Hai lavorato da marzo 2021 a febbraio 2024, senza pause. Quanti anni di esperienza sono?", options: [{ id: "a", text: "2 anni" }, { id: "b", text: "3 anni" }, { id: "c", text: "4 anni" }] },
      { id: "stipendio", title: "Lo stipendio", teaser: "Mensile o annuale?", question: "Ti offrono 27.300 euro lordi l'anno in 13 mensilità. Quanto vale una mensilità lorda?", options: [{ id: "a", text: "2.100 euro" }, { id: "b", text: "2.275 euro" }, { id: "c", text: "1.950 euro" }] },
    ],
    solution: { answers: { treno: "a", cv: "b", stipendio: "a" } },
    explain: "Treno: 9:20 più 25 fa 9:45, più 10 a piedi fa 9:55, cinque minuti prima. Curriculum: da marzo 2021 a febbraio 2024 sono 36 mesi, 3 anni. Stipendio: 27.300 diviso 13 fa 2.100.",
  },
  {
    id: "festa-in-casa",
    difficulty: "facile",
    event: "La festa in casa",
    story: "Venti invitati, un appartamento piccolo e tre cose da tenere sotto controllo prima che arrivi il primo.",
    cards: [
      { id: "bicchieri", title: "I bicchieri", teaser: "Ne servono abbastanza per tutti", question: "Venti invitati, due bicchieri a testa, confezioni da 12. Quante confezioni?", options: [{ id: "a", text: "3" }, { id: "b", text: "4" }, { id: "c", text: "2" }] },
      { id: "pizze", title: "Le pizze", teaser: "Ordinare il giusto, senza avanzi", question: "Ogni pizza grande sfama 3 persone. Quante pizze per 20 persone, senza lasciare nessuno a digiuno?", options: [{ id: "a", text: "6" }, { id: "b", text: "7" }, { id: "c", text: "8" }] },
      { id: "musica", title: "La musica", teaser: "La playlist deve durare", question: "La festa dura 4 ore e ogni canzone dura 3 minuti. Quante canzoni servono?", options: [{ id: "a", text: "60" }, { id: "b", text: "80" }, { id: "c", text: "120" }] },
    ],
    solution: { answers: { bicchieri: "b", pizze: "b", musica: "b" } },
    explain: "Bicchieri: 40 bicchieri, tre confezioni fanno 36, ne serve una quarta. Pizze: 6 pizze sfamano 18 persone, ne serve una settima. Musica: 240 minuti diviso 3 fa 80 canzoni.",
  },
  {
    id: "vacanza-campeggio",
    difficulty: "media",
    event: "Il campeggio con gli amici",
    story: "Tre notti in tenda, nessuno ha mai montato una tenda e il meteo è incerto. Cosa può andare storto?",
    cards: [
      { id: "tenda", title: "La tenda", teaser: "Picchetti contati", question: "La tenda vuole 4 picchetti agli angoli e 2 per ogni lato lungo. Quanti picchetti in tutto?", options: [{ id: "a", text: "6" }, { id: "b", text: "8" }, { id: "c", text: "12" }] },
      { id: "acqua", title: "L'acqua", teaser: "Scorte per tutto il weekend", question: "Quattro persone, due litri a testa al giorno, tre giorni. Quanti litri d'acqua servono?", options: [{ id: "a", text: "18" }, { id: "b", text: "24" }, { id: "c", text: "12" }] },
      { id: "falo", title: "Il falò", teaser: "La legna deve bastare", question: "Ogni sera il fuoco brucia 5 ciocchi l'ora e dura 3 ore. Quanti ciocchi per tre sere?", options: [{ id: "a", text: "15" }, { id: "b", text: "45" }, { id: "c", text: "30" }] },
    ],
    solution: { answers: { tenda: "b", acqua: "b", falo: "b" } },
    explain: "Tenda: 4 agli angoli più 2 per ciascuno dei 2 lati lunghi fa 8. Acqua: 4 per 2 per 3 fa 24 litri. Falò: 5 per 3 fa 15 a sera, per tre sere 45.",
  },
  {
    id: "matrimonio",
    difficulty: "difficile",
    event: "Il matrimonio dell'amico",
    story: "Sei il testimone. Tre compiti, tre trappole, e nessuno ti ha dato una lista.",
    cards: [
      { id: "regalo", title: "Il regalo", teaser: "La colletta deve tornare", question: "Il regalo costa 360 euro. Doveva dividersi in 12, ma 3 amici si tirano indietro. Quanto in più paga ognuno degli altri?", options: [{ id: "a", text: "10 euro" }, { id: "b", text: "30 euro" }, { id: "c", text: "40 euro" }] },
      { id: "tavoli", title: "I tavoli", teaser: "Ospiti da sistemare", question: "130 invitati, tavoli da 8. Quanti tavoli servono almeno?", options: [{ id: "a", text: "16" }, { id: "b", text: "17" }, { id: "c", text: "18" }] },
      { id: "discorso", title: "Il discorso", teaser: "Né troppo corto né troppo lungo", question: "Il discorso deve durare 3 minuti e parli a 140 parole al minuto. Quante parole al massimo?", options: [{ id: "a", text: "320" }, { id: "b", text: "420" }, { id: "c", text: "460" }] },
    ],
    solution: { answers: { regalo: "a", tavoli: "b", discorso: "b" } },
    explain: "Regalo: in 12 sarebbero 30 a testa, in 9 sono 40: 10 euro in più. Tavoli: 16 tavoli fanno 128 posti, ne serve un diciassettesimo. Discorso: 3 per 140 fa 420 parole.",
  },
  {
    id: "maratona-serie",
    difficulty: "facile",
    event: "La maratona di serie tv",
    story: "Domenica di pioggia, divano prenotato e una serie intera da finire prima di lunedì.",
    cards: [
      { id: "episodi", title: "Gli episodi", teaser: "Ce la facciamo prima di mezzanotte?", question: "Restano 8 episodi da 45 minuti. Quante ore servono?", options: [{ id: "a", text: "5 ore" }, { id: "b", text: "6 ore" }, { id: "c", text: "8 ore" }] },
      { id: "snack", title: "Gli snack", teaser: "Le scorte del divano", question: "Un sacchetto di patatine ogni 2 episodi. Quanti sacchetti per 8 episodi?", options: [{ id: "a", text: "2" }, { id: "b", text: "4" }, { id: "c", text: "6" }] },
      { id: "pause", title: "Le pause", teaser: "Ogni tanto bisogna alzarsi", question: "Una pausa dopo ogni episodio tranne l'ultimo. Quante pause in 8 episodi?", options: [{ id: "a", text: "6" }, { id: "b", text: "7" }, { id: "c", text: "8" }] },
    ],
    solution: { answers: { episodi: "b", snack: "b", pause: "b" } },
    explain: "Episodi: 8 per 45 fa 360 minuti, cioè 6 ore. Snack: 8 diviso 2 fa 4. Pause: tra 8 episodi ci sono 7 intervalli.",
  },
  {
    id: "esame-patente",
    difficulty: "difficile",
    event: "Il giorno dell'esame di guida",
    story: "L'esame è oggi pomeriggio. Tre incognite: benzina, parcheggio e tempo.",
    cards: [
      { id: "benzina", title: "La benzina", teaser: "Il serbatoio è quasi vuoto", question: "Restano 4 litri e l'auto fa 16 km con un litro. Il tragitto andata e ritorno è di 70 km. Basta?", options: [{ id: "a", text: "Sì, avanzano 6 km" }, { id: "b", text: "No, mancano 6 km" }, { id: "c", text: "Sì, giusto giusto" }] },
      { id: "parcheggio", title: "Il parcheggio", teaser: "Il parchimetro non dà resto", question: "Il parcheggio costa 1,20 euro l'ora e hai solo monete da 50 centesimi. Per 2 ore e mezza, quante monete inserisci almeno?", options: [{ id: "a", text: "5" }, { id: "b", text: "6" }, { id: "c", text: "7" }] },
      { id: "tempo", title: "Il tempo", teaser: "L'istruttore è puntuale", question: "Alle 15:50 iniziano 15 minuti di controlli, poi l'esame di 25 minuti. A che ora finisce tutto?", options: [{ id: "a", text: "16:20" }, { id: "b", text: "16:30" }, { id: "c", text: "16:15" }] },
    ],
    solution: { answers: { benzina: "b", parcheggio: "b", tempo: "b" } },
    explain: "Benzina: 4 per 16 fa 64 km, ne servono 70: mancano 6. Parcheggio: 2 ore e mezza a 1,20 l'ora fanno 3 euro, cioè 6 monete da 50 centesimi. Tempo: 15 più 25 fa 40 minuti, dalle 15:50 si arriva alle 16:30.",
  },
  {
    id: "weekend-montagna",
    difficulty: "media",
    event: "Il weekend in montagna",
    story: "Rifugio prenotato, scarponi nuovi e tre decisioni da prendere prima di partire.",
    cards: [
      { id: "sentiero", title: "Il sentiero", teaser: "Quanto ci si mette davvero", question: "Il sentiero è di 9 km e camminate a 3 km all'ora, con una pausa di mezz'ora. Quanto dura la gita?", options: [{ id: "a", text: "3 ore" }, { id: "b", text: "3 ore e mezza" }, { id: "c", text: "4 ore" }] },
      { id: "quota", title: "La quota", teaser: "Il dislivello da superare", question: "Partite da 1.250 metri e il rifugio è a 2.030 metri. Quanti metri di dislivello?", options: [{ id: "a", text: "780" }, { id: "b", text: "880" }, { id: "c", text: "680" }] },
      { id: "rifugio", title: "Il rifugio", teaser: "Il conto della mezza pensione", question: "Mezza pensione a 55 euro a testa per notte, in 3 per 2 notti. Quanto in tutto?", options: [{ id: "a", text: "220 euro" }, { id: "b", text: "330 euro" }, { id: "c", text: "165 euro" }] },
    ],
    solution: { answers: { sentiero: "b", quota: "a", rifugio: "b" } },
    explain: "Sentiero: 9 km a 3 all'ora fanno 3 ore, più mezz'ora di pausa. Quota: 2.030 meno 1.250 fa 780. Rifugio: 55 per 3 per 2 fa 330.",
  },
  {
    id: "aperitivo-di-lavoro",
    difficulty: "difficile",
    event: "L'aperitivo di fine progetto",
    story: "Il progetto è finito e il capo ha detto «offro io». Ma qualcuno deve organizzare tutto in mezz'ora.",
    cards: [
      { id: "budget", title: "Il budget", teaser: "Quanto si può spendere a testa", question: "Il capo mette 180 euro per 12 colleghi; un aperitivo costa 8 euro. Quanti giri a testa si possono offrire per intero?", options: [{ id: "a", text: "1" }, { id: "b", text: "2" }, { id: "c", text: "3" }] },
      { id: "tavolo", title: "Il tavolo", teaser: "Prenotare i posti giusti", question: "Il locale ha tavoli da 4 e da 6. Siete in 12 e volete usare meno tavoli possibile. Quanti tavoli prenotate?", options: [{ id: "a", text: "2" }, { id: "b", text: "3" }, { id: "c", text: "4" }] },
      { id: "orario", title: "L'orario", teaser: "Tutti devono esserci", question: "Un collega esce alle 18:40, un'altra alle 19:05, il capo alle 18:50. Il locale è a 15 minuti da tutti. Da che ora ci siete tutti?", options: [{ id: "a", text: "19:05" }, { id: "b", text: "19:20" }, { id: "c", text: "19:15" }] },
    ],
    solution: { answers: { budget: "a", tavolo: "a", orario: "b" } },
    explain: "Budget: 12 aperitivi costano 96 euro, due giri 192: ne basta uno intero. Tavolo: due tavoli da 6 fanno 12 posti. Orario: l'ultima esce alle 19:05, più 15 minuti di strada fa 19:20.",
  },
];

export default varianti;
