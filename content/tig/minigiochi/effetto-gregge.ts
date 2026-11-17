import type { GreggeInput } from "@/lib/tig/games/mechanics/effetto-gregge";

/**
 * 47 · EFFETTO GREGGE — domande trabocchetto con una sola risposta giusta, verificabile in una frase: la risposta
 * «d'istinto» è spesso quella sbagliata, quindi il voto popolare non è garanzia di niente.
 */
const varianti: GreggeInput[] = [
  {
    id: "caffe-cornetto",
    difficulty: "difficile",
    prompt: "Un caffè e un cornetto costano insieme 2,20 euro. Il cornetto costa 2 euro più del caffè. Quanto costa il caffè?",
    options: [
      { id: "a", text: "20 centesimi" },
      { id: "b", text: "10 centesimi" },
      { id: "c", text: "1,10 euro" },
    ],
    solution: { optionId: "b" },
    explain: "Caffè 0,10 e cornetto 2,10: insieme fanno 2,20 e la differenza è 2 euro. Con il caffè a 20 centesimi il cornetto costerebbe 2,20 da solo.",
  },
  {
    id: "muffa-in-frigo",
    difficulty: "media",
    prompt: "Una muffa in frigo raddoppia ogni giorno e copre tutto il barattolo in 20 giorni. In quanti giorni ne copriva metà?",
    options: [
      { id: "a", text: "10 giorni" },
      { id: "b", text: "19 giorni" },
      { id: "c", text: "15 giorni" },
    ],
    solution: { optionId: "b" },
    explain: "Se raddoppia ogni giorno, il giorno prima di coprire tutto ne copriva metà: il diciannovesimo. Dieci è la risposta di pancia.",
  },
  {
    id: "palloncini",
    difficulty: "media",
    prompt: "Cinque amici gonfiano cinque palloncini in cinque minuti. Quanti minuti servono a cinquanta amici per cinquanta palloncini?",
    options: [
      { id: "a", text: "50 minuti" },
      { id: "b", text: "5 minuti" },
      { id: "c", text: "10 minuti" },
    ],
    solution: { optionId: "b" },
    explain: "Ogni amico gonfia un palloncino in cinque minuti: cinquanta amici ne gonfiano cinquanta sempre in cinque minuti.",
  },
  {
    id: "palazzo",
    difficulty: "difficile",
    prompt: "Nel palazzo il tuo coinquilino è il quindicesimo più alto e anche il quindicesimo più basso. Quanti abitanti ci sono?",
    options: [
      { id: "a", text: "30" },
      { id: "b", text: "29" },
      { id: "c", text: "31" },
    ],
    solution: { optionId: "b" },
    explain: "Ha 14 persone più alte e 14 più basse: 14 + 14 + lui fa 29. Il 30 conta il coinquilino due volte.",
  },
  {
    id: "gara-di-corsa",
    difficulty: "facile",
    prompt: "Durante una gara di corsa superi chi è secondo. In che posizione sei adesso?",
    options: [
      { id: "a", text: "Primo" },
      { id: "b", text: "Secondo" },
      { id: "c", text: "Terzo" },
    ],
    solution: { optionId: "b" },
    explain: "Prendi il posto di chi hai superato: eri dietro al secondo, ora sei secondo. Il primo è ancora davanti.",
  },
  {
    id: "mesi-28-giorni",
    difficulty: "facile",
    prompt: "Quanti mesi dell'anno hanno 28 giorni?",
    options: [
      { id: "a", text: "Solo febbraio" },
      { id: "b", text: "Tutti e dodici" },
      { id: "c", text: "Nessuno, febbraio ne ha 29" },
    ],
    solution: { optionId: "b" },
    explain: "Tutti i mesi hanno almeno 28 giorni: la domanda non dice «solo 28». Il gregge di solito risponde febbraio.",
  },
  {
    id: "orologio",
    difficulty: "difficile",
    prompt: "Un orologio a pendolo batte 6 colpi alle sei e ci mette 5 secondi. Quanti secondi ci mette per i 12 colpi di mezzogiorno?",
    options: [
      { id: "a", text: "10 secondi" },
      { id: "b", text: "11 secondi" },
      { id: "c", text: "12 secondi" },
    ],
    solution: { optionId: "b" },
    explain: "Contano le pause tra un colpo e l'altro: 6 colpi hanno 5 pause da un secondo, 12 colpi ne hanno 11. Undici secondi.",
  },
  {
    id: "tronco",
    difficulty: "media",
    prompt: "Per tagliare un tronco in 2 pezzi servono 10 minuti. Quanto serve per tagliarlo in 4 pezzi?",
    options: [
      { id: "a", text: "20 minuti" },
      { id: "b", text: "30 minuti" },
      { id: "c", text: "40 minuti" },
    ],
    solution: { optionId: "b" },
    explain: "Due pezzi vogliono un taglio, quattro pezzi ne vogliono tre: 3 tagli da 10 minuti fanno 30.",
  },
  {
    id: "mele",
    difficulty: "facile",
    prompt: "Sul tavolo ci sono 3 mele. Tu ne prendi 2. Quante mele hai tu?",
    options: [
      { id: "a", text: "1" },
      { id: "b", text: "2" },
      { id: "c", text: "3" },
    ],
    solution: { optionId: "b" },
    explain: "Ne hai prese due, quindi ne hai due. Quella che resta è del tavolo, non tua.",
  },
  {
    id: "lumaca",
    difficulty: "difficile",
    prompt: "Una lumaca sale su un muro alto 10 metri: di giorno sale di 3 metri, di notte scivola giù di 2. In quanti giorni arriva in cima?",
    options: [
      { id: "a", text: "10 giorni" },
      { id: "b", text: "8 giorni" },
      { id: "c", text: "7 giorni" },
    ],
    solution: { optionId: "b" },
    explain: "Dopo 7 giorni e 7 notti è a 7 metri; l'ottavo giorno sale di 3 e arriva in cima prima di scivolare. Otto giorni.",
  },
];

export default varianti;
