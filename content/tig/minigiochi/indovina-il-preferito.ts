import type { PreferitoInput } from "@/lib/tig/games/mechanics/indovina-il-preferito";

/**
 * 41 · INDOVINA IL PREFERITO — quattro scenari di vita adulta per variante, illustrati con le icone del kit.
 * Temi neutri: vacanze, lavoro, amici, casa. Nessuna risposta giusta: decide il pubblico.
 */
const varianti: PreferitoInput[] = [
  {
    id: "weekend-lungo",
    difficulty: "facile",
    prompt: "Ponte di tre giorni, nessun impegno. Lo scenario perfetto è…",
    scenarios: [
      { id: "mare", text: "Mare fuori stagione con gli amici", icon: "valigia", tone: "cyan" },
      { id: "citta", text: "Una capitale europea in volo low cost", icon: "biglietto", tone: "amber" },
      { id: "divano", text: "Casa, serie tv e pizza a domicilio", icon: "pizza", tone: "red" },
      { id: "montagna", text: "Baita in montagna senza connessione", icon: "zaino", tone: "lime" },
    ],
    explain: "Il volo low cost per una capitale vince spesso tra i venticinquenni, ma il divano con la pizza ha un elettorato fedele che non si vergogna più di dichiararsi.",
  },
  {
    id: "lavoro-ideale",
    difficulty: "media",
    prompt: "Il lavoro ideale, a parità di stipendio, è quello…",
    scenarios: [
      { id: "remoto", text: "Tutto da remoto, anche dalla spiaggia", icon: "laptop", tone: "cyan" },
      { id: "settimana-corta", text: "In ufficio, ma solo quattro giorni a settimana", icon: "calendario", tone: "lime" },
      { id: "colleghi", text: "Con colleghi che diventano amici", icon: "tazza", tone: "amber" },
      { id: "orari", text: "Con orari liberi, inizi quando vuoi", icon: "orologio", tone: "violet" },
    ],
    explain: "La settimana corta è la grande favorita del momento, ma il lavoro da remoto e gli orari liberi si rubano voti a vicenda. Lo snobbato di solito sono i colleghi, anche se poi tutti li rimpiangono.",
  },
  {
    id: "serata-amici",
    difficulty: "facile",
    prompt: "Sabato sera con il gruppo. Il programma migliore è…",
    scenarios: [
      { id: "cena-casa", text: "Cena a casa di qualcuno", icon: "torta", tone: "amber" },
      { id: "pub", text: "Pub con quiz, proprio come stasera", icon: "biglietto", tone: "lime" },
      { id: "concerto", text: "Concerto di una band dal vivo", icon: "cuffie", tone: "violet" },
      { id: "giochi", text: "Serata giochi da tavolo", icon: "calendario", tone: "cyan" },
    ],
    explain: "In un pub il pub vince facile: il pubblico vota dove si trova. La cena a casa resta però la seconda forza di ogni gruppo, i giochi da tavolo sono spesso lo snobbato.",
  },
  {
    id: "casa-ideale",
    difficulty: "media",
    prompt: "Se poteste scegliere dove vivere nei prossimi due anni…",
    scenarios: [
      { id: "centro", text: "Monolocale in pieno centro", icon: "chiavi", tone: "amber" },
      { id: "coinquilini", text: "Casa grande con tre coinquilini simpatici", icon: "lampada", tone: "lime" },
      { id: "campagna", text: "Casetta fuori città con giardino", icon: "pianta", tone: "cyan" },
      { id: "estero", text: "Un appartamento all'estero", icon: "valigia", tone: "violet" },
    ],
    explain: "Il monolocale in centro e l'estero si contendono il primo posto; la casa con tre coinquilini, anche simpatici, raccoglie meno voti di quanto si pensi: chi li ha avuti lo sa.",
  },
  {
    id: "vacanza-estate",
    difficulty: "media",
    prompt: "Due settimane di ferie ad agosto. Il pubblico sceglie…",
    scenarios: [
      { id: "isola", text: "Isola greca con gli amici", icon: "ombrello", tone: "cyan" },
      { id: "roadtrip", text: "Viaggio in auto, una tappa al giorno", icon: "chiavi", tone: "amber" },
      { id: "festival", text: "Festival musicale all'estero", icon: "cuffie", tone: "violet" },
      { id: "famiglia", text: "Casa al mare dei parenti, gratis", icon: "portafoglio", tone: "lime" },
    ],
    explain: "L'isola con gli amici è il sogno più votato, ma la casa dei parenti gratis ha più fan di quanti lo ammettano: il portafoglio a fine luglio pesa.",
  },
  {
    id: "regalo-compleanno",
    difficulty: "difficile",
    prompt: "Il regalo di compleanno che vi farebbe più felici…",
    scenarios: [
      { id: "esperienza", text: "Un'esperienza da fare insieme", icon: "biglietto", tone: "lime" },
      { id: "tecnologia", text: "Un oggetto tecnologico nuovo", icon: "telefono", tone: "cyan" },
      { id: "cena", text: "Una cena in un posto elegante", icon: "candela", tone: "amber" },
      { id: "festa", text: "Una festa a sorpresa", icon: "palloncino", tone: "red" },
    ],
    explain: "L'esperienza insieme vince quasi sempre a quest'età; la festa a sorpresa divide, perché metà del locale la teme. Difficile indovinare lo snobbato: oggetto e cena se la giocano.",
  },
  {
    id: "mattina-perfetta",
    difficulty: "facile",
    prompt: "La mattina perfetta di una domenica comincia con…",
    scenarios: [
      { id: "sveglia-tardi", text: "Sveglia dopo le undici", icon: "orologio", tone: "violet" },
      { id: "colazione-bar", text: "Colazione lunga al bar", icon: "tazza", tone: "amber" },
      { id: "corsa", text: "Una corsa al parco", icon: "scarpe", tone: "lime" },
      { id: "mercato", text: "Giro al mercato", icon: "portafoglio", tone: "cyan" },
    ],
    explain: "Dormire fino a tardi stravince la sera prima, quando si vota dal pub. La corsa al parco è lo snobbato più comune, anche tra chi la fa davvero.",
  },
  {
    id: "spesa-folle",
    difficulty: "difficile",
    prompt: "Vi arrivano 1.000 euro inaspettati da spendere subito. Scegliete…",
    scenarios: [
      { id: "viaggio", text: "Un viaggio last minute", icon: "valigia", tone: "cyan" },
      { id: "risparmio", text: "Li metto da parte, non si sa mai", icon: "portafoglio", tone: "lime" },
      { id: "casa", text: "Qualcosa per la casa", icon: "lampada", tone: "amber" },
      { id: "amici", text: "Una cena enorme per tutti gli amici", icon: "pizza", tone: "red" },
    ],
    explain: "Il viaggio last minute è il preferito annunciato, ma la parola «subito» non ferma i risparmiatori: il loro voto sorprende sempre. La casa di solito chiude ultima.",
  },
  {
    id: "animale-coinquilino",
    difficulty: "media",
    prompt: "Il coinquilino ideale, se proprio deve essere un animale…",
    scenarios: [
      { id: "gatto", text: "Un gatto indipendente", icon: "gatto", tone: "amber" },
      { id: "cane", text: "Un cane che vuole uscire tre volte al giorno", icon: "chiavi", tone: "lime" },
      { id: "pesce", text: "Un pesce rosso che non chiede niente", icon: "borraccia", tone: "cyan" },
      { id: "pianta", text: "Una pianta, che almeno non scappa", icon: "pianta", tone: "violet" },
    ],
    explain: "Gatto e cane si giocano il primo posto in ogni locale; il pesce rosso è lo snobbato classico. La pianta raccoglie i voti di chi viaggia spesso.",
  },
  {
    id: "lunedi-sera",
    difficulty: "difficile",
    prompt: "Il lunedì sera, dopo il lavoro, il pubblico preferisce…",
    scenarios: [
      { id: "palestra", text: "Palestra per scaricare la tensione", icon: "borraccia", tone: "lime" },
      { id: "cucina", text: "Cucinare qualcosa con calma", icon: "torta", tone: "amber" },
      { id: "libro", text: "Un libro e a letto presto", icon: "libro", tone: "violet" },
      { id: "aperitivo", text: "Aperitivo veloce con un amico", icon: "tazza", tone: "cyan" },
    ],
    explain: "L'aperitivo veloce vince in un pub, ma il lunedì è un giorno strano: il libro e il letto presto raccolgono più voti di quanto ci si aspetti, la palestra spesso resta ultima.",
  },
];

export default varianti;
