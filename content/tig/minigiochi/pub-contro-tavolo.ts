import type { PubInput } from "@/lib/tig/games/mechanics/pub-contro-tavolo";

/**
 * 38 · PUB CONTRO TAVOLO — quiz lampo di 5 domande di vita quotidiana (conti, orari, quantità): niente cultura
 * scolastica, solo ragionamento veloce. Ogni risposta è verificabile con un calcolo spiegato nella nota.
 */
const varianti: PubInput[] = [
  {
    id: "conto-del-pub",
    difficulty: "facile",
    theme: "Il conto del pub",
    questions: [
      { id: "romana", prompt: "Quattro amici, conto da 68 euro diviso alla romana. Quanto a testa?", options: [{ id: "a", text: "16 euro" }, { id: "b", text: "17 euro" }, { id: "c", text: "18 euro" }] },
      { id: "resto", prompt: "Un giro di 5 birre a 6 euro l'una, paghi con 50 euro. Quanto resto?", options: [{ id: "a", text: "15 euro" }, { id: "b", text: "20 euro" }, { id: "c", text: "25 euro" }] },
      { id: "chiusura", prompt: "Il locale chiude all'1:30 e sono le 23:50. Quanto manca alla chiusura?", options: [{ id: "a", text: "1 ora e 30 minuti" }, { id: "b", text: "1 ora e 40 minuti" }, { id: "c", text: "2 ore e 10 minuti" }] },
      { id: "patatine", prompt: "Tre porzioni di patatine costano 12 euro. Quanto ne costano cinque?", options: [{ id: "a", text: "18 euro" }, { id: "b", text: "20 euro" }, { id: "c", text: "24 euro" }] },
      { id: "brindisi", prompt: "Siete in 6 e ognuno brinda una volta con ciascuno degli altri. Quanti brindisi in tutto?", options: [{ id: "a", text: "12" }, { id: "b", text: "15" }, { id: "c", text: "30" }] },
    ],
    solution: {
      answers: { romana: "b", resto: "b", chiusura: "b", patatine: "b", brindisi: "b" },
      notes: {
        romana: "68 diviso 4 fa 17.",
        resto: "5 per 6 fa 30 euro: da 50 restano 20.",
        chiusura: "Dalle 23:50 a mezzanotte 10 minuti, poi un'ora e mezza: 1 ora e 40.",
        patatine: "Una porzione costa 4 euro, cinque costano 20.",
        brindisi: "Ogni brindisi unisce due persone: 6 per 5 diviso 2 fa 15.",
      },
    },
    explain: "Il tranello è l'ultima: contare 6 per 5 dimentica che ogni brindisi vale per due persone. Le altre sono conti da tavolo che si fanno ogni sera, ma con il timer in TV sbagliano anche i migliori.",
  },
  {
    id: "trasloco",
    difficulty: "media",
    theme: "Il trasloco del coinquilino",
    questions: [
      { id: "viaggi", prompt: "Servono 18 scatole e ogni viaggio in auto ne porta 4. Quanti viaggi servono almeno?", options: [{ id: "a", text: "4" }, { id: "b", text: "5" }, { id: "c", text: "6" }] },
      { id: "furgone", prompt: "Il furgone costa 15 euro l'ora più 20 euro fissi. Quanto per 3 ore?", options: [{ id: "a", text: "45 euro" }, { id: "b", text: "65 euro" }, { id: "c", text: "80 euro" }] },
      { id: "gradini", prompt: "Terzo piano senza ascensore, 16 gradini per piano. Dal piano terra, quanti gradini?", options: [{ id: "a", text: "32" }, { id: "b", text: "48" }, { id: "c", text: "64" }] },
      { id: "fine", prompt: "Si inizia alle 9:15 e il trasloco dura 4 ore e 50 minuti. A che ora si finisce?", options: [{ id: "a", text: "13:55" }, { id: "b", text: "14:05" }, { id: "c", text: "14:15" }] },
      { id: "pizze", prompt: "Pizza da 7 euro per te e i tre amici che aiutano: offri tu. Quanto spendi?", options: [{ id: "a", text: "21 euro" }, { id: "b", text: "28 euro" }, { id: "c", text: "35 euro" }] },
    ],
    solution: {
      answers: { viaggi: "b", furgone: "b", gradini: "b", fine: "b", pizze: "b" },
      notes: {
        viaggi: "Quattro viaggi portano 16 scatole: ne restano 2, serve un quinto viaggio.",
        furgone: "3 ore per 15 fa 45, più i 20 fissi: 65.",
        gradini: "Tre rampe da 16 dal piano terra al terzo: 48.",
        fine: "9:15 più 4 ore fa 13:15, più 50 minuti: 14:05.",
        pizze: "Siete in quattro: 4 per 7 fa 28.",
      },
    },
    explain: "Le trappole del trasloco: i viaggi si arrotondano per eccesso, i piani si contano dal terra al terzo e la pizza la mangia anche chi offre.",
  },
  {
    id: "chat-del-gruppo",
    difficulty: "facile",
    theme: "La chat del gruppo",
    questions: [
      { id: "auguri", prompt: "Nel gruppo siete in 9 e ognuno manda 3 messaggi di auguri. Quanti messaggi in tutto?", options: [{ id: "a", text: "24" }, { id: "b", text: "27" }, { id: "c", text: "30" }] },
      { id: "arretrati", prompt: "Hai 120 messaggi non letti e ne leggi 15 al minuto. Quanti minuti ti servono?", options: [{ id: "a", text: "6" }, { id: "b", text: "8" }, { id: "c", text: "10" }] },
      { id: "vocale", prompt: "Un vocale dura 3 minuti. Ascoltato a velocità doppia, quanto dura?", options: [{ id: "a", text: "1 minuto" }, { id: "b", text: "1 minuto e mezzo" }, { id: "c", text: "2 minuti" }] },
      { id: "sondaggio", prompt: "Sondaggio tra 9 persone: 4 votano sabato, 3 venerdì, gli altri non votano. Quanti non votano?", options: [{ id: "a", text: "1" }, { id: "b", text: "2" }, { id: "c", text: "3" }] },
      { id: "risposta", prompt: "Messaggio inviato alle 22:47, risposta 38 minuti dopo. A che ora arriva?", options: [{ id: "a", text: "23:15" }, { id: "b", text: "23:25" }, { id: "c", text: "23:35" }] },
    ],
    solution: {
      answers: { auguri: "b", arretrati: "b", vocale: "b", sondaggio: "b", risposta: "b" },
      notes: {
        auguri: "9 per 3 fa 27.",
        arretrati: "120 diviso 15 fa 8.",
        vocale: "Doppia velocità, metà tempo: un minuto e mezzo.",
        sondaggio: "4 più 3 fa 7: su 9 ne mancano 2.",
        risposta: "22:47 più 13 minuti fa 23:00, più altri 25: 23:25.",
      },
    },
    explain: "Domande da chat di tutti i giorni: l'unico pericolo è la fretta. Sull'orario della risposta il trucco è passare dall'ora piena.",
  },
  {
    id: "palestra",
    difficulty: "media",
    theme: "Buoni propositi in palestra",
    questions: [
      { id: "abbonamento", prompt: "Abbonamento: 45 euro al mese oppure 390 euro all'anno. Quanto risparmi con l'annuale?", options: [{ id: "a", text: "120 euro" }, { id: "b", text: "150 euro" }, { id: "c", text: "180 euro" }] },
      { id: "passo", prompt: "Corri 5 chilometri in 30 minuti. A che passo al chilometro?", options: [{ id: "a", text: "5 minuti" }, { id: "b", text: "6 minuti" }, { id: "c", text: "7 minuti" }] },
      { id: "ripetizioni", prompt: "3 serie da 12 ripetizioni più 2 serie da 15. Quante ripetizioni in tutto?", options: [{ id: "a", text: "60" }, { id: "b", text: "66" }, { id: "c", text: "72" }] },
      { id: "volte", prompt: "Vai in palestra lunedì, mercoledì e venerdì. In 4 settimane quante volte ci vai?", options: [{ id: "a", text: "10" }, { id: "b", text: "12" }, { id: "c", text: "16" }] },
      { id: "lezione", prompt: "La lezione inizia alle 19:10 e dura 55 minuti. A che ora finisce?", options: [{ id: "a", text: "19:55" }, { id: "b", text: "20:05" }, { id: "c", text: "20:15" }] },
    ],
    solution: {
      answers: { abbonamento: "b", passo: "b", ripetizioni: "b", volte: "b", lezione: "b" },
      notes: {
        abbonamento: "45 per 12 fa 540: meno 390 fa 150.",
        passo: "30 minuti diviso 5 chilometri: 6 minuti al chilometro.",
        ripetizioni: "36 più 30 fa 66.",
        volte: "3 volte a settimana per 4 settimane: 12.",
        lezione: "19:10 più 50 minuti fa 20:00, più 5: 20:05.",
      },
    },
    explain: "L'abbonamento annuale conviene sulla carta: 150 euro di risparmio, a patto di andarci davvero. Tutte le altre sono moltiplicazioni da spogliatoio.",
  },
  {
    id: "aperitivo",
    difficulty: "difficile",
    theme: "L'aperitivo che sfugge di mano",
    questions: [
      { id: "spritz", prompt: "Uno spritz e un tagliere costano 14 euro. Il tagliere costa 8 euro più dello spritz. Quanto costa lo spritz?", options: [{ id: "a", text: "3 euro" }, { id: "b", text: "6 euro" }, { id: "c", text: "8 euro" }] },
      { id: "camerieri", prompt: "3 camerieri servono 3 tavoli in 3 minuti. Quanto ci mettono 6 camerieri a servire 6 tavoli?", options: [{ id: "a", text: "3 minuti" }, { id: "b", text: "6 minuti" }, { id: "c", text: "12 minuti" }] },
      { id: "prezzo", prompt: "Un cocktail aumenta del 10% e poi cala del 10%. Rispetto al prezzo iniziale costa…", options: [{ id: "a", text: "uguale" }, { id: "b", text: "meno" }, { id: "c", text: "di più" }] },
      { id: "giri", prompt: "Siete in 5 e prendete due analcolici a testa da 4 euro. Quanto viene il conto?", options: [{ id: "a", text: "20 euro" }, { id: "b", text: "40 euro" }, { id: "c", text: "50 euro" }] },
      { id: "olive", prompt: "Nella ciotola ci sono 5 olive verdi e 7 nere. Al buio, quante ne prendi per averne di sicuro due dello stesso colore?", options: [{ id: "a", text: "2" }, { id: "b", text: "3" }, { id: "c", text: "6" }] },
    ],
    solution: {
      answers: { spritz: "a", camerieri: "a", prezzo: "b", giri: "b", olive: "b" },
      notes: {
        spritz: "Spritz 3, tagliere 11: insieme 14 e la differenza è 8. Con 6 il tagliere costerebbe 14 da solo.",
        camerieri: "Ogni cameriere serve un tavolo in 3 minuti: in 6 servono 6 tavoli sempre in 3 minuti.",
        prezzo: "Da 10 euro a 11, poi meno il 10% di 11: 9,90. Costa meno.",
        giri: "5 persone per 2 analcolici per 4 euro: 40.",
        olive: "Con due olive puoi averne una per colore: la terza fa sicuramente coppia.",
      },
    },
    explain: "È il giro dei tranelli: l'istinto dice spritz a 6 euro e 6 minuti per i camerieri, ma i conti dicono 3 e 3. Il 10% in su e poi in giù non si annulla mai.",
  },
  {
    id: "weekend-in-treno",
    difficulty: "media",
    theme: "Il weekend in treno",
    questions: [
      { id: "durata", prompt: "Il treno parte alle 7:42 e arriva alle 10:15. Quanto dura il viaggio?", options: [{ id: "a", text: "2 ore e 27 minuti" }, { id: "b", text: "2 ore e 33 minuti" }, { id: "c", text: "3 ore e 33 minuti" }] },
      { id: "biglietti", prompt: "Biglietto da 29 euro a tratta, andata e ritorno, in quattro. Totale?", options: [{ id: "a", text: "116 euro" }, { id: "b", text: "232 euro" }, { id: "c", text: "264 euro" }] },
      { id: "coincidenza", prompt: "Arrivi con 30 minuti di ritardo; la coincidenza partiva 20 minuti dopo l'arrivo previsto. Per quanti minuti la perdi?", options: [{ id: "a", text: "10" }, { id: "b", text: "20" }, { id: "c", text: "50" }] },
      { id: "posto", prompt: "Carrozza con posti da 1 a 80: i numeri pari sono al finestrino. Il posto 43 è…", options: [{ id: "a", text: "al finestrino" }, { id: "b", text: "sul corridoio" }, { id: "c", text: "non esiste" }] },
      { id: "valigia", prompt: "Valigia massimo 23 kg, ne pesa 19,5. Quanti barattoli di sugo da 750 grammi ci stanno ancora?", options: [{ id: "a", text: "3" }, { id: "b", text: "4" }, { id: "c", text: "5" }] },
    ],
    solution: {
      answers: { durata: "b", biglietti: "b", coincidenza: "a", posto: "b", valigia: "b" },
      notes: {
        durata: "Dalle 7:42 alle 8:00 sono 18 minuti, poi 2 ore e 15: in tutto 2 ore e 33.",
        biglietti: "29 per 2 tratte per 4 persone: 232.",
        coincidenza: "Partiva 20 minuti dopo il tuo arrivo previsto, tu arrivi 30 minuti dopo: è partita da 10 minuti.",
        posto: "43 è dispari, quindi è sul corridoio.",
        valigia: "Restano 3,5 kg: 4 barattoli fanno 3 kg, il quinto supererebbe il limite.",
      },
    },
    explain: "Orari e pesi: il treno insegna a passare per l'ora piena e la valigia ad arrotondare per difetto. Sulla coincidenza conta solo la differenza tra 30 e 20.",
  },
  {
    id: "cena-a-casa",
    difficulty: "facile",
    theme: "Cena a casa",
    questions: [
      { id: "pasta", prompt: "La pasta cuoce 11 minuti e la butti alle 20:52. A che ora la scoli?", options: [{ id: "a", text: "21:01" }, { id: "b", text: "21:03" }, { id: "c", text: "21:13" }] },
      { id: "dosi", prompt: "La ricetta per 4 persone vuole 320 grammi di pasta. Siete in 6: quanta ne serve?", options: [{ id: "a", text: "400 grammi" }, { id: "b", text: "480 grammi" }, { id: "c", text: "520 grammi" }] },
      { id: "vino", prompt: "Sei bottiglie da 75 centilitri: quanti litri in tutto?", options: [{ id: "a", text: "4,5 litri" }, { id: "b", text: "45 litri" }, { id: "c", text: "7,5 litri" }] },
      { id: "torta", prompt: "La torta cuoce 35 minuti e va girata a metà cottura. Dopo quanto la giri?", options: [{ id: "a", text: "15 minuti" }, { id: "b", text: "17 minuti e mezzo" }, { id: "c", text: "20 minuti" }] },
      { id: "lavastoviglie", prompt: "In 8 a tavola, 2 bicchieri sporchi a testa. La lavastoviglie ne tiene 12: quanti lavaggi?", options: [{ id: "a", text: "1" }, { id: "b", text: "2" }, { id: "c", text: "3" }] },
    ],
    solution: {
      answers: { pasta: "b", dosi: "b", vino: "a", torta: "b", lavastoviglie: "b" },
      notes: {
        pasta: "20:52 più 8 minuti fa 21:00, più 3: 21:03.",
        dosi: "80 grammi a testa: per 6 fanno 480.",
        vino: "6 per 0,75 litri fa 4,5 litri.",
        torta: "Metà di 35 è 17 e mezzo.",
        lavastoviglie: "16 bicchieri: un giro da 12 e un secondo per i 4 rimasti.",
      },
    },
    explain: "Cucina e matematica vanno d'accordo: basta ricordare che 75 centilitri sono tre quarti di litro e che l'ultimo bicchiere si lava sempre a parte.",
  },
  {
    id: "lunedi-in-ufficio",
    difficulty: "media",
    theme: "Lunedì in ufficio",
    questions: [
      { id: "riunione", prompt: "Riunione dalle 9:30 alle 11:05. Quanto è durata?", options: [{ id: "a", text: "1 ora e 25 minuti" }, { id: "b", text: "1 ora e 35 minuti" }, { id: "c", text: "1 ora e 45 minuti" }] },
      { id: "email", prompt: "Hai 37 email e ne smaltisci 5 ogni 10 minuti. Dopo un'ora quante ne restano?", options: [{ id: "a", text: "5" }, { id: "b", text: "7" }, { id: "c", text: "12" }] },
      { id: "presenze", prompt: "Lavori da casa martedì e giovedì. In 4 settimane, quanti giorni in ufficio (dal lunedì al venerdì)?", options: [{ id: "a", text: "8" }, { id: "b", text: "12" }, { id: "c", text: "16" }] },
      { id: "ferie", prompt: "Il collega è in ferie dal 12 al 23 del mese, estremi compresi. Quanti giorni di calendario?", options: [{ id: "a", text: "11" }, { id: "b", text: "12" }, { id: "c", text: "13" }] },
      { id: "macchinetta", prompt: "Il caffè della macchinetta costa 60 centesimi e hai 2 euro. Quanti caffè al massimo e quanto resto?", options: [{ id: "a", text: "3 caffè, resto 20 centesimi" }, { id: "b", text: "3 caffè, resto 40 centesimi" }, { id: "c", text: "2 caffè, resto 80 centesimi" }] },
    ],
    solution: {
      answers: { riunione: "b", email: "b", presenze: "b", ferie: "b", macchinetta: "a" },
      notes: {
        riunione: "Dalle 9:30 alle 11:00 un'ora e mezza, più 5 minuti: 1 ora e 35.",
        email: "In un'ora 6 blocchi da 5: 30 email. 37 meno 30 fa 7.",
        presenze: "Lunedì, mercoledì e venerdì: 3 giorni per 4 settimane, 12.",
        ferie: "Dal 12 al 23 compresi: 23 meno 12 più 1, cioè 12 giorni.",
        macchinetta: "Tre caffè costano 1,80: da 2 euro restano 20 centesimi.",
      },
    },
    explain: "Il classico errore del lunedì è sulle ferie: contando 23 meno 12 si perde un giorno, perché gli estremi sono compresi.",
  },
  {
    id: "festa-a-sorpresa",
    difficulty: "difficile",
    theme: "La festa a sorpresa",
    questions: [
      { id: "torta", prompt: "Invitati alle 20:30, festeggiato 45 minuti dopo, torta 20 minuti dopo il suo arrivo. A che ora la torta?", options: [{ id: "a", text: "21:25" }, { id: "b", text: "21:35" }, { id: "c", text: "21:45" }] },
      { id: "colletta", prompt: "Regalo da 84 euro, siete in 7 ma chi organizza non paga. Quanto a testa?", options: [{ id: "a", text: "12 euro" }, { id: "b", text: "14 euro" }, { id: "c", text: "16 euro" }] },
      { id: "palloncini", prompt: "Servono 50 palloncini e ogni confezione ne ha 12. Quante confezioni compri?", options: [{ id: "a", text: "4" }, { id: "b", text: "5" }, { id: "c", text: "6" }] },
      { id: "candeline", prompt: "Il festeggiato compie 27 anni, le candeline sono in confezioni da 10. Quante ne avanzano?", options: [{ id: "a", text: "3" }, { id: "b", text: "7" }, { id: "c", text: "13" }] },
      { id: "tragitto", prompt: "Di solito ci mette 25 minuti; stasera ci mette il 20% in meno. Quanti minuti impiega?", options: [{ id: "a", text: "15" }, { id: "b", text: "20" }, { id: "c", text: "22" }] },
    ],
    solution: {
      answers: { torta: "b", colletta: "b", palloncini: "b", candeline: "a", tragitto: "b" },
      notes: {
        torta: "20:30 più 45 minuti fa 21:15, più 20: 21:35.",
        colletta: "Pagano in 6: 84 diviso 6 fa 14.",
        palloncini: "4 confezioni fanno 48 palloncini: ne serve una quinta.",
        candeline: "Tre confezioni fanno 30 candeline: ne avanzano 3.",
        tragitto: "Il 20% di 25 è 5: ci mette 20 minuti.",
      },
    },
    explain: "Organizzare una festa a sorpresa è un esercizio di aritmetica: chi organizza non paga, i palloncini si comprano a confezioni intere e le candeline avanzano sempre.",
  },
  {
    id: "vacanza-in-gruppo",
    difficulty: "difficile",
    theme: "La vacanza in gruppo",
    questions: [
      { id: "affitto", prompt: "Casa da 840 euro per 7 notti, in quattro. Quanto a testa per notte?", options: [{ id: "a", text: "25 euro" }, { id: "b", text: "30 euro" }, { id: "c", text: "35 euro" }] },
      { id: "ritorno", prompt: "Partite venerdì e tornate dopo 9 notti. Che giorno tornate?", options: [{ id: "a", text: "Sabato" }, { id: "b", text: "Domenica" }, { id: "c", text: "Lunedì" }] },
      { id: "benzina", prompt: "600 km, l'auto fa 15 km con un litro e il litro costa 1,80 euro. Quanto di benzina?", options: [{ id: "a", text: "60 euro" }, { id: "b", text: "72 euro" }, { id: "c", text: "90 euro" }] },
      { id: "spesa", prompt: "Spesa da 20 euro al giorno per tutti, per 7 giorni, in quattro. Quanto a testa?", options: [{ id: "a", text: "28 euro" }, { id: "b", text: "35 euro" }, { id: "c", text: "140 euro" }] },
      { id: "lavatrice", prompt: "Tre asciugamani a testa, in quattro; la lavatrice ne lava 5 per volta. Quanti lavaggi?", options: [{ id: "a", text: "2" }, { id: "b", text: "3" }, { id: "c", text: "4" }] },
    ],
    solution: {
      answers: { affitto: "b", ritorno: "b", benzina: "b", spesa: "b", lavatrice: "b" },
      notes: {
        affitto: "840 diviso 7 fa 120 a notte, diviso 4 fa 30.",
        ritorno: "Dopo 7 notti è di nuovo venerdì, altre 2 notti: domenica.",
        benzina: "600 diviso 15 fa 40 litri, per 1,80 fa 72 euro.",
        spesa: "20 per 7 fa 140, diviso 4 fa 35.",
        lavatrice: "12 asciugamani: due lavaggi ne fanno 10, serve il terzo.",
      },
    },
    explain: "La vacanza di gruppo si regge sui conti divisi: prima il totale, poi la divisione per persone. E i giorni si contano a settimane intere più il resto.",
  },
];

export default varianti;
