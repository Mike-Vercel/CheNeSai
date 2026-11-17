import type { PenultimaInput } from "@/lib/tig/games/mechanics/la-penultima-mossa";

/**
 * 78 · LA PENULTIMA MOSSA — due colpi per variante: la PENULTIMA (si vede subito) e l'ULTIMA (dai 20 secondi).
 * Le due domande hanno difficoltà simile ma non identica e la più insidiosa cambia da variante a variante,
 * così giocare la difesa sulla penultima non è mai una scelta ovvia. Soluzioni verificate con calcolo.
 */
const varianti: PenultimaInput[] = [
  // ---------------------------------------------------------------- facili
  {
    // più insidiosa: l'ultima (chi dimentica di contare se stesso)
    id: "spesa-del-sabato",
    difficulty: "facile",
    title: "La spesa del sabato",
    rounds: [
      {
        id: "resto",
        prompt: "Pane 2,40 €, latte 1,30 € e uova 2,80 €. Paghi con una banconota da 10 €: quanto ti danno di resto?",
        options: [
          { id: "a", text: "3,50 €" },
          { id: "b", text: "4,50 €" },
          { id: "c", text: "3,30 €" },
          { id: "d", text: "2,50 €" },
        ],
      },
      {
        id: "fila",
        prompt: "Alla cassa, davanti a te ci sono 4 persone e dietro di te 3. Quante persone ci sono in fila, te compreso?",
        options: [
          { id: "a", text: "8" },
          { id: "b", text: "7" },
          { id: "c", text: "9" },
        ],
      },
    ],
    solution: { answers: { resto: "a", fila: "a" } },
    explain: "Penultima: 2,40 + 1,30 + 2,80 = 6,50 €, di resto 10 − 6,50 = 3,50 €. Ultima: 4 davanti, 3 dietro e tu in mezzo: 8 persone.",
  },
  {
    // più insidiosa: la penultima (gli spicchi sono di due pizze)
    id: "pizza-tra-coinquilini",
    difficulty: "facile",
    title: "Pizza tra coinquilini",
    rounds: [
      {
        id: "spicchi",
        prompt: "Due pizze tagliate in 8 spicchi ciascuna. Siete in 4 e dividete in parti uguali: quanti spicchi a testa?",
        options: [
          { id: "a", text: "4" },
          { id: "b", text: "2" },
          { id: "c", text: "8" },
          { id: "d", text: "3" },
        ],
      },
      {
        id: "arrivi",
        prompt: "Ada arriva dopo Bruno e Carla arriva prima di Bruno. Chi arriva per primo?",
        options: [
          { id: "carla", text: "Carla" },
          { id: "bruno", text: "Bruno" },
          { id: "ada", text: "Ada" },
        ],
      },
    ],
    solution: { answers: { spicchi: "a", arrivi: "carla" } },
    explain: "Penultima: 2 × 8 = 16 spicchi, diviso 4 = 4 a testa. Ultima: l'ordine è Carla, Bruno, Ada: la prima è Carla.",
  },
  {
    // più insidiosa: la penultima (la mezz'ora)
    id: "giro-in-bici",
    difficulty: "facile",
    title: "Il giro in bici",
    rounds: [
      {
        id: "chilometri",
        prompt: "Pedali a 15 km all'ora per 2 ore e mezza. Quanti chilometri fai?",
        options: [
          { id: "a", text: "37,5 km" },
          { id: "b", text: "35 km" },
          { id: "c", text: "30 km" },
          { id: "d", text: "40 km" },
        ],
      },
      {
        id: "ruote",
        prompt: "Nel parcheggio ci sono 5 bici e 4 tricicli. Quante ruote in tutto?",
        options: [
          { id: "a", text: "22" },
          { id: "b", text: "20" },
          { id: "c", text: "27" },
          { id: "d", text: "24" },
        ],
      },
    ],
    solution: { answers: { chilometri: "a", ruote: "a" } },
    explain: "Penultima: 15 × 2 = 30 km, più mezz'ora a 15 km/h = 7,5 km: 37,5 km. Ultima: 5 bici × 2 ruote = 10, 4 tricicli × 3 ruote = 12: 22 ruote.",
  },
  {
    // più insidiosa: l'ultima (si moltiplica tutto per 3)
    id: "serata-al-cinema",
    difficulty: "facile",
    title: "Serata al cinema",
    rounds: [
      {
        id: "fine-film",
        prompt: "Il film inizia alle 20:45 e dura 1 ora e 55 minuti. A che ora finisce?",
        options: [
          { id: "a", text: "22:40" },
          { id: "b", text: "22:30" },
          { id: "c", text: "22:50" },
          { id: "d", text: "21:40" },
        ],
      },
      {
        id: "popcorn",
        prompt: "Biglietto da 8,50 € e popcorn da 4,50 €. Siete in 3 e prendete tutto a testa: quanto spendete in totale?",
        options: [
          { id: "a", text: "39 €" },
          { id: "b", text: "36 €" },
          { id: "c", text: "42 €" },
          { id: "d", text: "37,50 €" },
        ],
      },
    ],
    solution: { answers: { "fine-film": "a", popcorn: "a" } },
    explain: "Penultima: 20:45 più 2 ore fa 22:45, meno 5 minuti = 22:40. Ultima: 8,50 + 4,50 = 13 € a testa, per 3 = 39 €.",
  },
  // ---------------------------------------------------------------- medie
  {
    // più insidiosa: la penultima (tassa a testa e a notte)
    id: "weekend-citta-d-arte",
    difficulty: "media",
    title: "Weekend in città d'arte",
    rounds: [
      {
        id: "stanza",
        prompt: "La stanza costa 64 € a notte. Siete in 2 per 3 notti e la tassa di soggiorno è di 2 € a testa per notte. Quanto spendete in tutto?",
        options: [
          { id: "a", text: "204 €" },
          { id: "b", text: "198 €" },
          { id: "c", text: "196 €" },
          { id: "d", text: "216 €" },
        ],
      },
      {
        id: "museo",
        prompt: "Il museo è chiuso il lunedì. Arrivate sabato 30 settembre e ripartite il 4 ottobre. In che data lo trovate chiuso?",
        options: [
          { id: "a", text: "2 ottobre" },
          { id: "b", text: "1° ottobre" },
          { id: "c", text: "3 ottobre" },
          { id: "d", text: "30 settembre" },
        ],
      },
    ],
    solution: { answers: { stanza: "a", museo: "a" } },
    explain: "Penultima: 64 × 3 = 192 € di stanza, più la tassa 2 € × 2 persone × 3 notti = 12 €: 204 €. Ultima: settembre ha 30 giorni, quindi dopo sabato 30 settembre vengono domenica 1° e lunedì 2 ottobre.",
  },
  {
    // più insidiosa: l'ultima (multiplo comune di 4 e 7)
    id: "turni-al-bar",
    difficulty: "media",
    title: "Turni al bar",
    rounds: [
      {
        id: "ore-pagate",
        prompt: "Lavori dalle 17:30 all'1:15 di notte con mezz'ora di pausa non pagata. Quante ore ti pagano?",
        options: [
          { id: "a", text: "7 ore e 15 minuti" },
          { id: "b", text: "7 ore e 45 minuti" },
          { id: "c", text: "8 ore e 15 minuti" },
          { id: "d", text: "6 ore e 45 minuti" },
        ],
      },
      {
        id: "chiusure",
        prompt: "Fai la chiusura ogni 4 giorni e l'ultima volta era di lunedì. Tra quante settimane ti ricapita di nuovo di lunedì?",
        options: [
          { id: "a", text: "Tra 4 settimane" },
          { id: "b", text: "Tra 7 settimane" },
          { id: "c", text: "Tra 2 settimane" },
          { id: "d", text: "Tra 3 settimane" },
        ],
      },
    ],
    solution: { answers: { "ore-pagate": "a", chiusure: "a" } },
    explain: "Penultima: dalle 17:30 all'1:15 sono 7 ore e 45 minuti, meno la mezz'ora di pausa = 7 ore e 15. Ultima: serve un numero di giorni multiplo sia di 4 sia di 7: il primo è 28, cioè 4 settimane.",
  },
  {
    // più insidiosa: l'ultima (chi pensa alle coppie sbaglia: i messaggi vanno in tutte e due le direzioni)
    id: "chat-del-regalo",
    difficulty: "media",
    title: "La chat del regalo",
    rounds: [
      {
        id: "quote",
        prompt: "Regalo da 150 € per Giulia, in 7. Marco mette 24 € e gli altri 6 dividono il resto in parti uguali. Quanto mette ognuno dei 6?",
        options: [
          { id: "a", text: "21 €" },
          { id: "b", text: "18 €" },
          { id: "c", text: "25 €" },
          { id: "d", text: "22 €" },
        ],
      },
      {
        id: "auguri",
        prompt: "Nel gruppo siete in 7 e ognuno manda un messaggio privato a ciascuno degli altri. Quanti messaggi privati partono in tutto?",
        options: [
          { id: "a", text: "42" },
          { id: "b", text: "21" },
          { id: "c", text: "49" },
          { id: "d", text: "36" },
        ],
      },
    ],
    solution: { answers: { quote: "a", auguri: "a" } },
    explain: "Penultima: 150 − 24 = 126 €, diviso 6 = 21 €. Ultima: ognuno dei 7 scrive a 6 persone, 7 × 6 = 42 messaggi (21 sarebbero le coppie, ma ogni coppia si scrive in due direzioni).",
  },
  {
    // più insidiosa: la penultima (più persone, meno tempo)
    id: "trasloco-di-bea",
    difficulty: "media",
    title: "Il trasloco di Bea",
    rounds: [
      {
        id: "ritmo",
        prompt: "In 3 caricate il furgone in 2 ore. Allo stesso ritmo, quanto ci mettereste in 4?",
        options: [
          { id: "a", text: "1 ora e 30 minuti" },
          { id: "b", text: "1 ora e 20 minuti" },
          { id: "c", text: "2 ore e 40 minuti" },
          { id: "d", text: "1 ora e 45 minuti" },
        ],
      },
      {
        id: "piatti",
        prompt: "In una scatola ci sono 6 piatti blu e 4 bianchi. Al buio, quanti ne devi prendere per essere sicuri di averne 2 dello stesso colore?",
        options: [
          { id: "a", text: "3" },
          { id: "b", text: "2" },
          { id: "c", text: "7" },
          { id: "d", text: "5" },
        ],
      },
    ],
    solution: { answers: { ritmo: "a", piatti: "a" } },
    explain: "Penultima: il lavoro vale 3 × 2 = 6 ore di una persona, in 4 sono 6 ÷ 4 = 1,5 ore, cioè 1 ora e 30 minuti. Ultima: i colori sono due, quindi con 2 piatti puoi averne uno per colore, ma il terzo fa coppia per forza.",
  },
  // ---------------------------------------------------------------- difficili
  {
    // più insidiosa: l'ultima (i bagni lavorano in parallelo)
    id: "settimana-bianca",
    difficulty: "difficile",
    title: "La settimana bianca",
    rounds: [
      {
        id: "skipass",
        prompt: "Skipass: 52 € al giorno oppure 250 € per 6 giorni. Da quanti giorni di sci in su conviene il pacchetto?",
        options: [
          { id: "a", text: "Da 5 giorni" },
          { id: "b", text: "Da 4 giorni" },
          { id: "c", text: "Da 6 giorni" },
          { id: "d", text: "Da 3 giorni" },
        ],
      },
      {
        id: "bagni",
        prompt: "Siete in 5 nello chalet con 2 bagni. Ognuno ci mette 12 minuti, una persona per bagno alla volta. Quanto serve, come minimo, perché siate tutti pronti?",
        options: [
          { id: "a", text: "36 minuti" },
          { id: "b", text: "30 minuti" },
          { id: "c", text: "60 minuti" },
          { id: "d", text: "24 minuti" },
        ],
      },
    ],
    solution: { answers: { skipass: "a", bagni: "a" } },
    explain: "Penultima: 4 giorni a 52 € fanno 208 € (meno del pacchetto), 5 giorni fanno 260 € (più di 250): conviene da 5 giorni. Ultima: si va a turni di due, 5 persone richiedono 3 turni da 12 minuti = 36 minuti.",
  },
  {
    // più insidiosa: la penultima (prima la mancia, poi l'arrotondamento)
    id: "cena-di-fine-progetto",
    difficulty: "difficile",
    title: "Cena di fine progetto",
    rounds: [
      {
        id: "mancia",
        prompt: "Il conto è 247 €. Aggiungete il 10% di mancia e poi arrotondate il totale alla decina superiore. Quanto lasciate in tutto?",
        options: [
          { id: "a", text: "280 €" },
          { id: "b", text: "270 €" },
          { id: "c", text: "272 €" },
          { id: "d", text: "275 €" },
        ],
      },
      {
        id: "strette",
        prompt: "Siete in 9 e ognuno stringe la mano a ciascun altro una volta sola. Quante strette di mano in tutto?",
        options: [
          { id: "a", text: "36" },
          { id: "b", text: "72" },
          { id: "c", text: "81" },
          { id: "d", text: "45" },
        ],
      },
    ],
    solution: { answers: { mancia: "a", strette: "a" } },
    explain: "Penultima: 247 + 24,70 = 271,70 €, e la decina superiore è 280 €. Ultima: ognuno stringe 8 mani, 9 × 8 = 72, ma ogni stretta coinvolge due persone ed è contata due volte: 72 ÷ 2 = 36.",
  },
  {
    // più insidiosa: l'ultima (59 giorni da contare)
    id: "calendario-delle-ferie",
    difficulty: "difficile",
    title: "Il calendario delle ferie",
    rounds: [
      {
        id: "giorni-ferie",
        prompt: "Ferie da lunedì 7 a venerdì 25 luglio, estremi compresi. Quanti giorni di ferie ti servono, contando solo dal lunedì al venerdì?",
        options: [
          { id: "a", text: "15" },
          { id: "b", text: "19" },
          { id: "c", text: "14" },
          { id: "d", text: "18" },
        ],
      },
      {
        id: "primo-marzo",
        prompt: "Quest'anno non è bisestile e il 1° gennaio era un mercoledì. Che giorno della settimana è il 1° marzo?",
        options: [
          { id: "sabato", text: "Sabato" },
          { id: "venerdi", text: "Venerdì" },
          { id: "domenica", text: "Domenica" },
          { id: "mercoledi", text: "Mercoledì" },
        ],
      },
    ],
    solution: { answers: { "giorni-ferie": "a", "primo-marzo": "sabato" } },
    explain: "Penultima: tre settimane piene, dal 7 all'11, dal 14 al 18 e dal 21 al 25 luglio: 3 × 5 = 15 giorni. Ultima: gennaio (31) più febbraio (28) fanno 59 giorni, cioè 8 settimane e 3 giorni: mercoledì più 3 = sabato.",
  },
  {
    // più insidiosa: la penultima (le sbagliate tolgono punti)
    id: "serata-quiz",
    difficulty: "difficile",
    title: "La serata quiz",
    rounds: [
      {
        id: "punteggio",
        prompt: "Quiz da 8 domande: giusta +10, sbagliata −5, nessuna saltata. La vostra squadra ha fatto 50 punti. Quante risposte giuste avete dato?",
        options: [
          { id: "a", text: "6" },
          { id: "b", text: "5" },
          { id: "c", text: "7" },
          { id: "d", text: "4" },
        ],
      },
      {
        id: "sfide",
        prompt: "Ci sono 6 squadre e ognuna sfida ogni altra una volta sola. Quante sfide si giocano in tutto?",
        options: [
          { id: "a", text: "15" },
          { id: "b", text: "30" },
          { id: "c", text: "36" },
          { id: "d", text: "12" },
        ],
      },
    ],
    solution: { answers: { punteggio: "a", sfide: "a" } },
    explain: "Penultima: con 6 giuste e 2 sbagliate fate 60 − 10 = 50 punti (con 5 giuste sarebbero 35, con 7 sarebbero 65). Ultima: ogni squadra ne sfida 5, 6 × 5 = 30, ma ogni sfida è contata due volte: 15.",
  },
];

export default varianti;
