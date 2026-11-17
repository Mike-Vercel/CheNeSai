import type { ScreenshotInput } from "@/lib/tig/games/mechanics/screenshot-traditore";

/**
 * 03 · SCREENSHOT TRADITORE — varianti. `chat` è lo screenshot INOLTRATO (ritoccato); `solution.before`
 * contiene solo i valori originali del dettaglio cambiato. Un solo cambiamento, piccolo ma decisivo.
 */
const varianti: ScreenshotInput[] = [
  {
    id: "calcetto-orario",
    context: "Luca è arrivato mezz'ora dopo gli altri e gira lo screenshot per difendersi. Un orario è stato ritoccato.",
    chat: {
      title: "Calcetto del giovedì",
      subtitle: "10 partecipanti",
      messages: [
        { id: "m1", from: "Ste", text: "Campo prenotato per giovedì!", time: "18:02" },
        { id: "m2", from: "Luca", text: "Che ora?", time: "18:05" },
        { id: "m3", from: "Ste", text: "Alle 21:30, siamo in dieci giusti", time: "18:06" },
        { id: "m4", from: "Tu", mine: true, text: "Ci sono, porto io il pallone", time: "18:10" },
        { id: "m5", from: "Pietro", text: "Io arrivo un quarto d'ora prima per scaldarmi", time: "18:12" },
      ],
    },
    solution: { regionId: "m3", before: { text: "Alle 21:00, siamo in dieci giusti" } },
    explain: "Nell'originale Ste aveva scritto «alle 21:00». Nello screenshot di Luca è diventato «alle 21:30»: proprio la mezz'ora del suo ritardo.",
  },
  {
    id: "caparra-mensilita",
    context: "Alla firma il proprietario chiede una caparra più alta e mostra la chat come prova. Ma è stata modificata.",
    chat: {
      title: "Bruno (proprietario)",
      subtitle: "online",
      messages: [
        { id: "m1", from: "Bruno", text: "L'affitto è 600 € al mese, spese escluse", time: "10:14" },
        { id: "m2", from: "Tu", mine: true, text: "E per la caparra come facciamo?", time: "10:20" },
        { id: "m3", from: "Bruno", text: "Tre mensilità, da dare alla firma", time: "10:22" },
        { id: "m4", from: "Tu", mine: true, text: "Perfetto, preparo il bonifico", time: "10:25" },
        { id: "m5", from: "Bruno", text: "Firmiamo lunedì alle 18 in agenzia", time: "10:31" },
      ],
    },
    solution: { regionId: "m3", before: { text: "Due mensilità, da dare alla firma" } },
    explain: "Bruno aveva scritto «due mensilità» (1.200 €). Nello screenshot che mostra alla firma è diventato «tre mensilità»: 600 € in più a suo favore.",
  },
  {
    id: "regalo-quota",
    context: "Fede chiede cinque euro in più a testa per il regalo e manda la chat come prova: un numero non torna.",
    chat: {
      title: "Regalo per Sonia",
      subtitle: "8 partecipanti",
      messages: [
        { id: "m1", from: "Fede", text: "Raccolgo io i soldi: 20 € a testa", time: "12:30" },
        { id: "m2", from: "Anna", text: "Ok, te li do domani in pausa pranzo", time: "12:34" },
        { id: "m3", from: "Tu", mine: true, text: "Io ci sono", time: "12:35" },
        { id: "m4", from: "Marco", text: "Il biglietto lo scriviamo tutti insieme?", time: "12:41" },
        { id: "m5", from: "Fede", text: "Sì, lo porto venerdì in ufficio", time: "12:43" },
      ],
    },
    solution: { regionId: "m1", before: { text: "Raccolgo io i soldi: 15 € a testa" } },
    explain: "La quota concordata era 15 € a testa. Nello screenshot di Fede è diventata 20 €: ecco i cinque euro in più.",
  },
  {
    id: "finestra-bagno",
    context: "Tommaso gira lo screenshot per dimostrare che la finestra del bagno l'ha lasciata aperta qualcun altro.",
    chat: {
      title: "Casa via dei Glicini",
      subtitle: "4 partecipanti",
      messages: [
        { id: "m1", from: "Irene", text: "Chi ha lasciato aperta la finestra del bagno? Il pavimento è un lago", time: "08:12" },
        { id: "m2", from: "Nadia", text: "Ieri sono rientrata tardi, non ci ho fatto caso", time: "08:15" },
        { id: "m3", from: "Nadia", text: "Scusate, colpa mia: doccia veloce e poi di corsa al lavoro", time: "08:20" },
        { id: "m4", from: "Irene", text: "Almeno asciuga quando torni, grazie", time: "08:22" },
        { id: "m5", from: "Tu", mine: true, text: "Prendo io lo straccio, tranquilli", time: "08:25" },
      ],
    },
    solution: { regionId: "m3", before: { from: "Tommaso" } },
    explain: "La confessione «colpa mia: doccia veloce» nell'originale l'aveva scritta Tommaso. Nello screenshot il mittente è diventato Nadia, che due minuti prima diceva di non essersene accorta.",
  },
  {
    id: "baita-partecipanti",
    context: "Simone giura di non essere mai stato nel gruppo del weekend in baita. Guardate bene lo screenshot che ha girato.",
    chat: {
      title: "Weekend in baita",
      subtitle: "5 partecipanti",
      messages: [
        { id: "m1", from: "Bea", text: "Baita prenotata per sei persone, 45 € a testa", time: "21:02" },
        { id: "m2", from: "Leo", text: "Grande! Partiamo venerdì alle 17?", time: "21:05" },
        { id: "m3", from: "Carla", text: "Io esco dal lavoro alle 18, facciamo 18:30", time: "21:09" },
        { id: "m4", from: "Bea", text: "Ok, alle 18:30 sotto casa mia", time: "21:10" },
        { id: "m5", from: "Tu", mine: true, text: "Porto io le catene per la neve", time: "21:15" },
      ],
    },
    solution: { regionId: "intestazione", before: { subtitle: "6 partecipanti" } },
    explain: "Il gruppo aveva 6 partecipanti, come i sei posti prenotati da Bea. Nello screenshot di Simone l'intestazione dice 5: lo hanno tolto dal conto.",
  },
  {
    id: "festa-giorno",
    context: "Paolo si è presentato con la torta il giorno dopo la festa a sorpresa. Mostra lo screenshot: qualcosa è stato cambiato.",
    chat: {
      title: "Sorpresa per Ale",
      subtitle: "12 partecipanti",
      messages: [
        { id: "m1", from: "Giulia", text: "Festa a sorpresa per Ale sabato alle 20:30, da me", time: "19:00" },
        { id: "m2", from: "Paolo", text: "Porto io la torta!", time: "19:04" },
        { id: "m3", from: "Tu", mine: true, text: "Ci sono, arrivo con Marti", time: "19:06" },
        { id: "m4", from: "Sara", text: "Acqua in bocca con Ale, mi raccomando", time: "19:07" },
        { id: "m5", from: "Giulia", text: "Citofonate piano, abito al secondo piano", time: "19:10" },
      ],
    },
    solution: { regionId: "m1", before: { text: "Festa a sorpresa per Ale venerdì alle 20:30, da me" } },
    explain: "Giulia aveva scritto «venerdì». Nello screenshot di Paolo c'è «sabato»: il giorno in cui si è presentato con la torta, a festa finita.",
  },
  {
    id: "pizza-ritrovo",
    context: "Ilaria ha aspettato mezz'ora nel posto sbagliato e gira lo screenshot: il punto d'incontro è stato cambiato.",
    chat: {
      title: "Pizza venerdì",
      subtitle: "7 partecipanti",
      messages: [
        { id: "m1", from: "Rocco", text: "Pizza venerdì? Ho prenotato per le 20:15", time: "17:40" },
        { id: "m2", from: "Ilaria", text: "Sì! Dove ci troviamo?", time: "17:42" },
        { id: "m3", from: "Rocco", text: "Davanti al cinema, poi andiamo a piedi", time: "17:43" },
        { id: "m4", from: "Tu", mine: true, text: "Perfetto, arrivo col treno delle 19:50", time: "17:50" },
        { id: "m5", from: "Ilaria", text: "Io vengo in bici", time: "17:51" },
      ],
    },
    solution: { regionId: "m3", before: { text: "Davanti alla stazione, poi andiamo a piedi" } },
    explain: "Rocco aveva scritto «davanti alla stazione» (infatti c'è chi arriva col treno). Nello screenshot è diventato «davanti al cinema»: il posto dove Ilaria ha aspettato.",
  },
  {
    id: "benzina-meta",
    context: "Vale dice che le devi quattro euro in più per la benzina e manda lo screenshot: un numero non torna.",
    chat: {
      title: "Vale",
      subtitle: "ultimo accesso alle 23:10",
      messages: [
        { id: "m1", from: "Vale", text: "Ti ho anticipato la benzina del viaggio", time: "23:01" },
        { id: "m2", from: "Tu", mine: true, text: "Grazie! Quanto ti devo?", time: "23:03" },
        { id: "m3", from: "Vale", text: "Abbiamo speso 64 €, metà a testa: 36 €", time: "23:04" },
        { id: "m4", from: "Tu", mine: true, text: "Te li mando domani mattina", time: "23:05" },
        { id: "m5", from: "Vale", text: "Tranquillo, quando vuoi", time: "23:06" },
      ],
    },
    solution: { regionId: "m3", before: { text: "Abbiamo speso 64 €, metà a testa: 32 €" } },
    explain: "La metà di 64 € è 32 €, come nell'originale. Nello screenshot di Vale la quota è diventata 36 €: quattro euro in più, e il conto non torna.",
  },
];

export default varianti;
