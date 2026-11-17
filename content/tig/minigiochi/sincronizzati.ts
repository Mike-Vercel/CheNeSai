import type { SincroInput } from "@/lib/tig/games/mechanics/sincronizzati";

/**
 * 35 · SINCRONIZZATI — quattro opzioni tutte plausibili: vince chi conosce i propri amici.
 * Nessuna risposta giusta: conta solo quanto il tavolo converge.
 */
const varianti: SincroInput[] = [
  {
    id: "cena-venerdi",
    prompt: "Il posto per la cena improvvisata del venerdì",
    options: [
      { id: "pizzeria", text: "Pizzeria sotto casa" },
      { id: "sushi", text: "Sushi" },
      { id: "kebab", text: "Kebab da asporto" },
      { id: "casa", text: "Si cucina a casa di qualcuno" },
    ],
    explain: "Non c'era una risposta giusta: contava solo pensarla tutti allo stesso modo.",
  },
  {
    id: "viaggio-gruppo",
    prompt: "La prossima gita di un giorno tutti insieme",
    options: [
      { id: "lago", text: "Lago" },
      { id: "terme", text: "Terme" },
      { id: "borgo", text: "Borgo in collina" },
      { id: "parco", text: "Parco divertimenti" },
    ],
    explain: "Quattro gite tutte valide: vinceva chi conosce i gusti del proprio tavolo.",
  },
  {
    id: "colonna-sonora",
    prompt: "Il genere musicale che mette d'accordo il vostro gruppo in macchina",
    options: [
      { id: "pop", text: "Pop italiano" },
      { id: "rap", text: "Rap" },
      { id: "anni-ottanta", text: "Anni Ottanta" },
      { id: "indie", text: "Indie" },
    ],
    explain: "In macchina vince chi ha il telefono collegato, ma qui vinceva chi la pensava come gli altri.",
  },
  {
    id: "superpotere",
    prompt: "Il superpotere più utile in una settimana di lavoro",
    options: [
      { id: "teletrasporto", text: "Teletrasporto" },
      { id: "niente-sonno", text: "Non aver bisogno di dormire" },
      { id: "mute", text: "Mettere in muto le persone" },
      { id: "pausa", text: "Fermare il tempo" },
    ],
    explain: "Nessun superpotere era sbagliato: contava sceglierne uno insieme senza parlarsi.",
  },
  {
    id: "domenica",
    prompt: "La domenica perfetta",
    options: [
      { id: "brunch", text: "Brunch lungo" },
      { id: "camminata", text: "Camminata fuori città" },
      { id: "maratona", text: "Maratona di serie" },
      { id: "dormire", text: "Dormire fino a mezzogiorno" },
    ],
    explain: "Tutte domeniche rispettabili: vinceva l'accordo del tavolo.",
  },
  {
    id: "regalo-collega",
    prompt: "Il regalo di gruppo per il collega che cambia lavoro",
    options: [
      { id: "piante", text: "Una pianta da ufficio" },
      { id: "esperienza", text: "Un buono esperienza" },
      { id: "tazza", text: "Una tazza personalizzata" },
      { id: "cena", text: "Una cena offerta da tutti" },
    ],
    explain: "Ogni regalo andava bene: contava che il tavolo scegliesse lo stesso.",
  },
  {
    id: "animale-gruppo",
    prompt: "L'animale che rappresenta meglio il vostro gruppo di amici",
    options: [
      { id: "gatti", text: "Gatti" },
      { id: "pinguini", text: "Pinguini" },
      { id: "lupi", text: "Lupi" },
      { id: "procioni", text: "Procioni" },
    ],
    explain: "Nessun animale era giusto o sbagliato: vinceva chi si conosce davvero.",
  },
  {
    id: "serata-giochi",
    prompt: "Il gioco della serata a casa",
    options: [
      { id: "carte", text: "Carte" },
      { id: "tavolo", text: "Gioco da tavolo" },
      { id: "videogioco", text: "Videogioco in compagnia" },
      { id: "quiz", text: "Quiz fatti in casa" },
    ],
    explain: "Quattro serate possibili: contava convergere sulla stessa senza accordarsi a voce.",
  },
  {
    id: "vacanza-sogno",
    prompt: "La vacanza dei sogni del vostro tavolo",
    options: [
      { id: "isola", text: "Isola tropicale" },
      { id: "road-trip", text: "Road trip in macchina" },
      { id: "capitale", text: "Capitale europea" },
      { id: "neve", text: "Baita sulla neve" },
    ],
    explain: "Ogni destinazione era plausibile: premiato solo l'accordo.",
  },
];

export default varianti;
