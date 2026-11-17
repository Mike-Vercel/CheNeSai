import type { AlibiInput } from "@/lib/tig/games/mechanics/alibi-impossibile";

/**
 * 59 · L'ALIBI IMPOSSIBILE — racconti ora per ora di personaggi inventati. Tragitti e orari dei luoghi
 * sono fatti certi; il validatore dello schema trova esattamente UNA tappa impossibile (quella indicata).
 * Regola di lettura: si arriva a una tappa non prima di (orario della tappa precedente + permanenza + tragitto).
 */
const varianti: AlibiInput[] = [
  {
    id: "portafoglio-sparito",
    title: "La sera del portafoglio sparito",
    suspect: "Matteo",
    places: [
      { id: "casa", name: "Casa di Matteo" },
      { id: "palestra", name: "Palestra di quartiere", opens: "07:00", closes: "22:00" },
      { id: "bar", name: "Bar della piazza", closes: "23:00" },
      { id: "stazione", name: "Stazione" },
    ],
    legs: [
      { from: "casa", to: "palestra", minutes: 15, how: "a piedi" },
      { from: "palestra", to: "bar", minutes: 10, how: "a piedi" },
      { from: "bar", to: "stazione", minutes: 25, how: "a piedi" },
      { from: "stazione", to: "casa", minutes: 20, how: "in bici" },
    ],
    steps: [
      { id: "s1", time: "19:00", place: "casa", stayMin: 10, text: "Mi preparo ed esco con il borsone." },
      { id: "s2", time: "19:25", place: "palestra", stayMin: 60, text: "Un'ora di allenamento, chiedete pure all'istruttore." },
      { id: "s3", time: "20:35", place: "bar", stayMin: 30, text: "Toast e chiacchiere con Luca." },
      { id: "s4", time: "21:20", place: "stazione", text: "Accompagno Luca al treno delle 21:25." },
      { id: "s5", time: "22:00", place: "casa", text: "Torno a casa in bici e crollo sul divano." },
    ],
    solution: { stepId: "s4" },
    explain: "Dal bar Matteo esce alle 21:05 (20:35 + 30 minuti) e alla stazione servono 25 minuti a piedi: arriva alle 21:30, non alle 21:20. Il treno delle 21:25 l'ha visto partire solo nel racconto.",
  },
  {
    id: "pacco-allo-sportello",
    title: "Il pacco ritirato in pausa pranzo",
    suspect: "Serena",
    places: [
      { id: "ufficio", name: "Ufficio" },
      { id: "mercato", name: "Mercato coperto", closes: "14:30" },
      { id: "posta", name: "Ufficio postale", opens: "08:30", closes: "13:30" },
    ],
    legs: [
      { from: "ufficio", to: "mercato", minutes: 18, how: "a piedi" },
      { from: "mercato", to: "posta", minutes: 8, how: "a piedi" },
      { from: "posta", to: "ufficio", minutes: 12, how: "a piedi" },
    ],
    steps: [
      { id: "s1", time: "12:50", place: "ufficio", stayMin: 10, text: "Finisco una call e scendo." },
      { id: "s2", time: "13:20", place: "mercato", stayMin: 10, text: "Prendo un'insalata al banco del mercato." },
      { id: "s3", time: "13:40", place: "posta", stayMin: 15, text: "Faccio la fila e ritiro finalmente il pacco allo sportello." },
      { id: "s4", time: "14:10", place: "ufficio", text: "Rientro in ufficio con il pacco sotto il braccio." },
    ],
    solution: { stepId: "s3" },
    explain: "Il tragitto torna (13:20 + 10 + 8 = 13:38), ma l'ufficio postale chiude alle 13:30: alle 13:40 nessuno sportello era aperto.",
  },
  {
    id: "festa-a-sorpresa",
    title: "La festa a sorpresa rovinata",
    suspect: "Tommaso",
    places: [
      { id: "casa", name: "Casa di Tommaso" },
      { id: "pasticceria", name: "Pasticceria", opens: "08:00", closes: "19:30" },
      { id: "parco", name: "Parco" },
      { id: "anna", name: "Casa di Anna" },
    ],
    legs: [
      { from: "casa", to: "pasticceria", minutes: 20, how: "in bici" },
      { from: "pasticceria", to: "parco", minutes: 15, how: "a piedi" },
      { from: "parco", to: "anna", minutes: 25, how: "a piedi" },
      { from: "pasticceria", to: "anna", minutes: 30, how: "a piedi" },
    ],
    steps: [
      { id: "s1", time: "17:30", place: "casa", stayMin: 10, text: "Esco in bici per ritirare la torta." },
      { id: "s2", time: "18:00", place: "pasticceria", stayMin: 15, text: "Ritiro la torta e pago." },
      { id: "s3", time: "18:30", place: "parco", stayMin: 30, text: "Aspetto gli altri al parco, con la torta in mano." },
      { id: "s4", time: "19:20", place: "anna", text: "Arriviamo tutti da Anna per la sorpresa." },
      { id: "s5", time: "19:40", place: "anna", text: "Anna apre la porta: aveva già visto tutto nelle storie." },
    ],
    solution: { stepId: "s4" },
    explain: "Dal parco si riparte alle 19:00 (18:30 + 30 minuti) e da Anna servono 25 minuti a piedi: si arriva alle 19:25, non alle 19:20.",
  },
  {
    id: "mattina-del-colloquio",
    title: "La mattina del colloquio",
    suspect: "Giorgia",
    places: [
      { id: "casa", name: "Casa di Giorgia" },
      { id: "bar", name: "Bar sotto casa", opens: "06:30" },
      { id: "copisteria", name: "Copisteria", opens: "09:00", closes: "19:00" },
      { id: "sede", name: "Sede del colloquio" },
    ],
    legs: [
      { from: "casa", to: "bar", minutes: 2, how: "a piedi" },
      { from: "bar", to: "copisteria", minutes: 10, how: "a piedi" },
      { from: "copisteria", to: "sede", minutes: 20, how: "in metro" },
    ],
    steps: [
      { id: "s1", time: "08:00", place: "casa", stayMin: 15, text: "Mi preparo e ripasso il curriculum." },
      { id: "s2", time: "08:20", place: "bar", stayMin: 15, text: "Colazione al volo." },
      { id: "s3", time: "08:50", place: "copisteria", stayMin: 10, text: "Stampo tre copie del curriculum." },
      { id: "s4", time: "09:25", place: "sede", text: "Arrivo al colloquio con cinque minuti di anticipo." },
    ],
    solution: { stepId: "s3" },
    explain: "I tempi tornerebbero (08:20 + 15 + 10 = 08:45), ma la copisteria apre alle 9: alle 08:50 la serranda era ancora abbassata.",
  },
  {
    id: "trasloco-di-federico",
    title: "Il trasloco della coinquilina",
    suspect: "Federico",
    places: [
      { id: "noleggio", name: "Noleggio furgoni", opens: "08:00", closes: "12:30" },
      { id: "vecchia", name: "Casa vecchia" },
      { id: "nuova", name: "Casa nuova" },
      { id: "ferramenta", name: "Ferramenta", opens: "08:30", closes: "12:30" },
    ],
    legs: [
      { from: "noleggio", to: "vecchia", minutes: 25, how: "in furgone" },
      { from: "vecchia", to: "nuova", minutes: 30, how: "in furgone" },
      { from: "nuova", to: "ferramenta", minutes: 10, how: "a piedi" },
      { from: "nuova", to: "noleggio", minutes: 20, how: "in furgone" },
    ],
    steps: [
      { id: "s1", time: "08:10", place: "noleggio", stayMin: 15, text: "Ritiro il furgone." },
      { id: "s2", time: "08:50", place: "vecchia", stayMin: 60, text: "Carichiamo tutti gli scatoloni." },
      { id: "s3", time: "10:20", place: "nuova", stayMin: 45, text: "Scarichiamo tutto al terzo piano." },
      { id: "s4", time: "11:10", place: "ferramenta", stayMin: 10, text: "Compro le viti che mancano per il letto." },
      { id: "s5", time: "11:40", place: "nuova", stayMin: 20, text: "Monto il letto." },
      { id: "s6", time: "12:20", place: "noleggio", text: "Riconsegno il furgone, appena in tempo." },
    ],
    solution: { stepId: "s4" },
    explain: "Lo scarico nella casa nuova finisce alle 11:05 (10:20 + 45 minuti) e la ferramenta è a 10 minuti a piedi: Federico ci arriva alle 11:15, non alle 11:10.",
  },
  {
    id: "serata-al-cinema",
    title: "La serata al cinema",
    suspect: "Lisa",
    places: [
      { id: "ufficio", name: "Ufficio" },
      { id: "cinema", name: "Cinema Aurora" },
      { id: "pizzeria", name: "Pizzeria al taglio", closes: "23:00" },
      { id: "casa", name: "Casa di Lisa" },
    ],
    legs: [
      { from: "ufficio", to: "cinema", minutes: 30, how: "in metro" },
      { from: "cinema", to: "pizzeria", minutes: 5, how: "a piedi" },
      { from: "pizzeria", to: "casa", minutes: 15, how: "a piedi" },
    ],
    steps: [
      { id: "s1", time: "18:30", place: "ufficio", stayMin: 10, text: "Chiudo il computer ed esco." },
      { id: "s2", time: "19:10", place: "cinema", stayMin: 125, text: "Spettacolo delle 19:15, due ore di film." },
      { id: "s3", time: "21:20", place: "pizzeria", stayMin: 30, text: "Pizza al taglio con Marta." },
      { id: "s4", time: "21:55", place: "casa", text: "Rientro a casa e scrivo nel gruppo che sono arrivata." },
    ],
    solution: { stepId: "s4" },
    explain: "Dalla pizzeria Lisa esce alle 21:50 (21:20 + 30 minuti) e a casa servono 15 minuti a piedi: arriva alle 22:05, non alle 21:55.",
  },
];

export default varianti;
