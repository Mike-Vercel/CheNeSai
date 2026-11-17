import type { ArchivioInput } from "@/lib/tig/games/mechanics/archivio-manomesso";

/**
 * 52 · ARCHIVIO MANOMESSO — fascicoli inventati. Ogni fatto importante compare in almeno due documenti;
 * il campo ritoccato contraddice almeno due documenti concordi (lo schema lo verifica con la regola della
 * maggioranza). Valori ritoccati «vicini» al vero (20:30/22:30, 12/21, 482/428) per obbligare a confrontare.
 * Id dei campi: lettera del documento + numero, mai indizi.
 */
const varianti: ArchivioInput[] = [
  {
    id: "cena-classe",
    difficulty: "facile",
    caseTitle: "La cena di classe",
    story: "Il fascicolo della cena di classe di sabato: sul conto qualcosa non quadra. Qualcuno ha ritoccato un documento.",
    docs: [
      {
        id: "prenotazione",
        kind: "agenda",
        title: "Prenotazione Trattoria Marina",
        fields: [
          { id: "a1", label: "Nome", text: "Rossi" },
          { id: "a2", label: "Giorno", text: "Sabato 14 giugno", fact: "data" },
          { id: "a3", label: "Ora", text: "20:30", fact: "ora" },
          { id: "a4", label: "Persone", text: "8", fact: "persone" },
        ],
      },
      {
        id: "sms",
        kind: "messaggio",
        title: "SMS di conferma della trattoria",
        fields: [
          { id: "b1", label: "Giorno", text: "Sabato 14 giugno", fact: "data" },
          { id: "b2", label: "Ora", text: "20:30", fact: "ora" },
          { id: "b3", label: "Coperti", text: "8", fact: "persone" },
        ],
      },
      {
        id: "conto",
        kind: "scontrino",
        title: "Conto Trattoria Marina",
        fields: [
          { id: "c1", label: "Data", text: "14/06", fact: "data", norm: "Sabato 14 giugno" },
          { id: "c2", label: "Coperti", text: "6", fact: "persone" },
          { id: "c3", label: "Totale", text: "186,00 €" },
        ],
      },
    ],
    solution: { fieldId: "c2" },
    explain: "Prenotazione e SMS dicono 8 persone; il conto dice 6 coperti. Due documenti concordi contro uno: è il conto a essere stato ritoccato.",
  },
  {
    id: "volo-marzo",
    difficulty: "media",
    caseTitle: "La trasferta di Elena",
    story: "Elena chiede il rimborso della trasferta di marzo. In uno dei documenti c'è una data ritoccata.",
    docs: [
      {
        id: "imbarco",
        kind: "biglietto",
        title: "Carta d'imbarco",
        fields: [
          { id: "a1", label: "Volo", text: "418", fact: "volo" },
          { id: "a2", label: "Data", text: "13 marzo", fact: "data" },
          { id: "a3", label: "Partenza", text: "07:15", fact: "ora" },
          { id: "a4", label: "Posto", text: "12A" },
        ],
      },
      {
        id: "promemoria",
        kind: "messaggio",
        title: "Promemoria del calendario",
        fields: [
          { id: "b1", label: "Volo", text: "418", fact: "volo" },
          { id: "b2", label: "Partenza", text: "07:15", fact: "ora" },
          { id: "b3", label: "Data", text: "3 marzo", fact: "data" },
        ],
      },
      {
        id: "nota-spese",
        kind: "verbale",
        title: "Nota spese",
        fields: [
          { id: "c1", label: "Volo", text: "418", fact: "volo" },
          { id: "c2", label: "Data", text: "3 marzo", fact: "data" },
          { id: "c3", label: "Partenza", text: "07:15", fact: "ora" },
          { id: "c4", label: "Taxi", text: "38,00 €" },
        ],
      },
    ],
    solution: { fieldId: "a2" },
    explain: "Volo 418 e partenza alle 7:15 coincidono ovunque. La data no: promemoria e nota spese dicono 3 marzo, la carta d'imbarco 13 marzo. Il dettaglio ritoccato è la data sulla carta d'imbarco.",
  },
  {
    id: "pacco-indirizzo",
    difficulty: "media",
    caseTitle: "Il pacco mai arrivato",
    story: "Lucia dice che il pacco non è mai arrivato. Il corriere giura di averlo consegnato. Un documento è stato ritoccato.",
    docs: [
      {
        id: "etichetta",
        kind: "tessera",
        title: "Etichetta del pacco",
        fields: [
          { id: "a1", label: "Destinatario", text: "Lucia Ferri", fact: "nome" },
          { id: "a2", label: "Indirizzo", text: "Via Roma 12", fact: "indirizzo" },
          { id: "a3", label: "Interno", text: "4", fact: "interno" },
        ],
      },
      {
        id: "avviso",
        kind: "messaggio",
        title: "Avviso di consegna del corriere",
        fields: [
          { id: "b1", label: "Consegnato a", text: "Lucia Ferri", fact: "nome" },
          { id: "b2", label: "Indirizzo", text: "Via Roma 21", fact: "indirizzo" },
          { id: "b3", label: "Ora", text: "11:42" },
        ],
      },
      {
        id: "reclamo",
        kind: "verbale",
        title: "Reclamo al servizio clienti",
        fields: [
          { id: "c1", label: "Cliente", text: "Lucia Ferri", fact: "nome" },
          { id: "c2", label: "Indirizzo", text: "Via Roma 12", fact: "indirizzo" },
          { id: "c3", label: "Interno", text: "4", fact: "interno" },
          { id: "c4", label: "Giorno", text: "Venerdì" },
        ],
      },
    ],
    solution: { fieldId: "b2" },
    explain: "Etichetta e reclamo dicono Via Roma 12; l'avviso di consegna dice Via Roma 21. Le cifre invertite sono il ritocco: il pacco risulta consegnato a un altro civico.",
  },
  {
    id: "abbonamento-corso",
    difficulty: "facile",
    caseTitle: "L'abbonamento conteso",
    story: "Marco dice di aver pagato il corso di spinning, la palestra dice pilates. Un documento è stato ritoccato.",
    docs: [
      {
        id: "tessera",
        kind: "tessera",
        title: "Tessera della palestra",
        fields: [
          { id: "a1", label: "Nome", text: "Marco Galli", fact: "nome" },
          { id: "a2", label: "Scadenza", text: "30/09", fact: "scadenza" },
          { id: "a3", label: "Corso", text: "Spinning", fact: "corso" },
        ],
      },
      {
        id: "ricevuta",
        kind: "scontrino",
        title: "Ricevuta di pagamento",
        fields: [
          { id: "b1", label: "Intestata a", text: "Marco Galli", fact: "nome" },
          { id: "b2", label: "Corso", text: "Spinning", fact: "corso" },
          { id: "b3", label: "Valida fino", text: "30/09", fact: "scadenza" },
          { id: "b4", label: "Importo", text: "240,00 €" },
        ],
      },
      {
        id: "modulo",
        kind: "nota",
        title: "Modulo d'iscrizione",
        fields: [
          { id: "c1", label: "Nome", text: "Marco Galli", fact: "nome" },
          { id: "c2", label: "Corso", text: "Pilates", fact: "corso" },
          { id: "c3", label: "Firma", text: "M. Galli" },
        ],
      },
    ],
    solution: { fieldId: "c2" },
    explain: "Tessera e ricevuta dicono Spinning; solo il modulo d'iscrizione dice Pilates. Due contro uno: il campo ritoccato è il corso sul modulo.",
  },
  {
    id: "sala-giovedi",
    difficulty: "media",
    caseTitle: "La sala riunioni prenotata due volte",
    story: "Due team si sono presentati nella stessa sala alla stessa ora. Uno dei documenti è stato corretto a penna.",
    docs: [
      {
        id: "calendario",
        kind: "agenda",
        title: "Calendario condiviso",
        fields: [
          { id: "a1", label: "Sala", text: "Sala Verde", fact: "sala" },
          { id: "a2", label: "Giorno", text: "Giovedì", fact: "giorno" },
          { id: "a3", label: "Orario", text: "15:00–16:00", fact: "orario" },
          { id: "a4", label: "Organizza", text: "Giulia", fact: "chi" },
        ],
      },
      {
        id: "invito",
        kind: "messaggio",
        title: "Invito alla riunione",
        fields: [
          { id: "b1", label: "Sala", text: "Sala Verde", fact: "sala" },
          { id: "b2", label: "Orario", text: "15:00–16:00", fact: "orario" },
          { id: "b3", label: "Partecipanti", text: "7" },
        ],
      },
      {
        id: "cartello",
        kind: "nota",
        title: "Cartello sulla porta",
        fields: [
          { id: "c1", label: "Occupata da", text: "Giulia", fact: "chi" },
          { id: "c2", label: "Giorno", text: "Giovedì", fact: "giorno" },
          { id: "c3", label: "Orario", text: "16:00–17:00", fact: "orario" },
        ],
      },
    ],
    solution: { fieldId: "c3" },
    explain: "Calendario e invito dicono 15–16; il cartello sulla porta dice 16–17. È il cartello a essere stato corretto: per questo l'altro team pensava che alle 15 la sala fosse libera.",
  },
  {
    id: "multa-targa",
    difficulty: "difficile",
    caseTitle: "La multa contestata",
    story: "Paolo contesta una multa: dice che l'auto fotografata non è la sua. Nel fascicolo un documento è stato ritoccato.",
    docs: [
      {
        id: "verbale",
        kind: "verbale",
        title: "Verbale di contravvenzione",
        fields: [
          { id: "a1", label: "Targa", text: "FG 482 KT", fact: "targa" },
          { id: "a2", label: "Via", text: "Via Mazzini" },
          { id: "a3", label: "Ora", text: "09:40", fact: "ora" },
          { id: "a4", label: "Data", text: "12 maggio", fact: "data" },
        ],
      },
      {
        id: "foto",
        kind: "foto",
        title: "Foto dell'auto in sosta",
        icon: "orologio",
        iconLabel: "09:40",
        fields: [
          { id: "b1", label: "Targa", text: "FG 482 KT", fact: "targa" },
          { id: "b2", label: "Ora", text: "09:40", fact: "ora" },
        ],
      },
      {
        id: "libretto",
        kind: "tessera",
        title: "Libretto dell'auto di Paolo",
        fields: [
          { id: "c1", label: "Targa", text: "FG 428 KT", fact: "targa" },
          { id: "c2", label: "Modello", text: "Utilitaria grigia" },
          { id: "c3", label: "Intestatario", text: "Paolo Neri" },
        ],
      },
      {
        id: "app-parcheggi",
        kind: "messaggio",
        title: "Notifica dell'app parcheggi di Paolo",
        fields: [
          { id: "d1", label: "Targa", text: "FG 482 KT", fact: "targa" },
          { id: "d2", label: "Sosta pagata fino", text: "09:30" },
          { id: "d3", label: "Data", text: "12 maggio", fact: "data" },
        ],
      },
    ],
    solution: { fieldId: "c1" },
    explain: "Verbale, foto e perfino l'app parcheggi di Paolo dicono FG 482 KT; solo il libretto dice FG 428 KT. Il ritocco è sul libretto: l'auto multata è proprio la sua, con la sosta scaduta alle 9:30.",
  },
  {
    id: "villa-agosto",
    difficulty: "media",
    caseTitle: "La caparra della casa vacanze",
    story: "Il proprietario non vuole restituire la caparra: dice che gli ospiti sono rimasti più del previsto. Un documento è stato ritoccato.",
    docs: [
      {
        id: "contratto",
        kind: "verbale",
        title: "Contratto d'affitto",
        fields: [
          { id: "a1", label: "Casa", text: "Villa Ulivo" },
          { id: "a2", label: "Arrivo", text: "1 agosto", fact: "arrivo" },
          { id: "a3", label: "Partenza", text: "8 agosto", fact: "partenza" },
          { id: "a4", label: "Caparra", text: "300 €", fact: "caparra" },
        ],
      },
      {
        id: "email",
        kind: "messaggio",
        title: "Email del proprietario",
        fields: [
          { id: "b1", label: "Arrivo", text: "1 agosto", fact: "arrivo" },
          { id: "b2", label: "Partenza", text: "8 agosto", fact: "partenza" },
          { id: "b3", label: "Caparra", text: "300 €", fact: "caparra" },
        ],
      },
      {
        id: "bonifico",
        kind: "scontrino",
        title: "Ricevuta del bonifico",
        fields: [
          { id: "c1", label: "Causale", text: "Caparra Villa Ulivo" },
          { id: "c2", label: "Importo", text: "300,00 €", fact: "caparra", norm: "300 €" },
          { id: "c3", label: "Data", text: "2 luglio" },
        ],
      },
      {
        id: "registro",
        kind: "agenda",
        title: "Registro degli ospiti",
        fields: [
          { id: "d1", label: "Partenza", text: "18 agosto", fact: "partenza" },
          { id: "d2", label: "Chiavi", text: "riconsegnate" },
        ],
      },
    ],
    solution: { fieldId: "d1" },
    explain: "Contratto ed email dicono partenza l'8 agosto; il registro degli ospiti dice 18. Un «1» aggiunto davanti: è il registro a essere stato ritoccato per trattenere la caparra.",
  },
  {
    id: "calcetto-orario",
    difficulty: "facile",
    caseTitle: "Il campo di calcetto",
    story: "Il centro sportivo dice che la squadra si è presentata con un'ora di ritardo. Un documento è stato ritoccato.",
    docs: [
      {
        id: "prenotazione",
        kind: "biglietto",
        title: "Prenotazione del campo",
        fields: [
          { id: "a1", label: "Campo", text: "Campo 3", fact: "campo" },
          { id: "a2", label: "Giorno", text: "Mercoledì", fact: "giorno" },
          { id: "a3", label: "Ora", text: "21:00", fact: "ora" },
        ],
      },
      {
        id: "chat",
        kind: "messaggio",
        title: "Gruppo «I Panchinari»",
        fields: [
          { id: "b1", label: "Campo", text: "Campo 3", fact: "campo" },
          { id: "b2", label: "Ora", text: "21:00", fact: "ora" },
          { id: "b3", label: "Giocatori", text: "10" },
        ],
      },
      {
        id: "ricevuta",
        kind: "scontrino",
        title: "Ricevuta del centro sportivo",
        fields: [
          { id: "c1", label: "Campo", text: "Campo 3", fact: "campo" },
          { id: "c2", label: "Giorno", text: "Mercoledì", fact: "giorno" },
          { id: "c3", label: "Ora", text: "20:00", fact: "ora" },
          { id: "c4", label: "Totale", text: "80,00 €" },
        ],
      },
    ],
    solution: { fieldId: "c3" },
    explain: "Prenotazione e chat della squadra dicono 21:00; solo la ricevuta del centro dice 20:00. Ritoccata la ricevuta: così sembrava che la squadra fosse arrivata in ritardo.",
  },
  {
    id: "biblioteca-tessera",
    difficulty: "difficile",
    caseTitle: "Il libro mai restituito",
    story: "La biblioteca manda un sollecito per un libro mai restituito. Sofia dice che non è suo. Un documento è stato ritoccato.",
    docs: [
      {
        id: "tessera",
        kind: "tessera",
        title: "Tessera della biblioteca",
        fields: [
          { id: "a1", label: "Nome", text: "Sofia Riva" },
          { id: "a2", label: "Numero", text: "00731", fact: "numero" },
        ],
      },
      {
        id: "prestito",
        kind: "scontrino",
        title: "Ricevuta del prestito",
        fields: [
          { id: "b1", label: "Tessera", text: "00731", fact: "numero" },
          { id: "b2", label: "Libro", text: "Il gatto e la luna", fact: "libro" },
          { id: "b3", label: "Restituire entro", text: "20 marzo", fact: "scadenza" },
        ],
      },
      {
        id: "sollecito",
        kind: "messaggio",
        title: "Sollecito via email",
        fields: [
          { id: "c1", label: "Tessera", text: "00713", fact: "numero" },
          { id: "c2", label: "Libro", text: "Il gatto e la luna", fact: "libro" },
          { id: "c3", label: "Scaduto il", text: "20 marzo", fact: "scadenza" },
        ],
      },
    ],
    solution: { fieldId: "c1" },
    explain: "Tessera e ricevuta del prestito riportano il numero 00731; il sollecito riporta 00713. Due cifre scambiate: il ritocco è nel sollecito, che sembra mandato a un'altra tessera.",
  },
  {
    id: "guardaroba",
    difficulty: "difficile",
    caseTitle: "Il cappotto scambiato al guardaroba",
    story: "A fine serata Sara si è vista consegnare il cappotto sbagliato. Il guardaroba dice di aver fatto tutto giusto. Un documento è stato ritoccato.",
    docs: [
      {
        id: "scontrino",
        kind: "biglietto",
        title: "Scontrino del guardaroba",
        fields: [
          { id: "a1", label: "Numero", text: "147", fact: "numero" },
          { id: "a2", label: "Capo", text: "Cappotto blu", fact: "capo" },
          { id: "a3", label: "Consegna", text: "22:10", fact: "arrivo" },
        ],
      },
      {
        id: "foto",
        kind: "foto",
        title: "Foto del gancio 147",
        icon: "biglietto",
        iconLabel: "147",
        fields: [
          { id: "b1", label: "Cartellino", text: "147", fact: "numero" },
          { id: "b2", label: "Capo", text: "Cappotto blu", fact: "capo" },
        ],
      },
      {
        id: "registro",
        kind: "nota",
        title: "Registro del guardaroba",
        fields: [
          { id: "c1", label: "Numero", text: "147", fact: "numero" },
          { id: "c2", label: "Capo", text: "Cappotto nero", fact: "capo" },
          { id: "c3", label: "Ritiro", text: "01:30" },
        ],
      },
      {
        id: "messaggio",
        kind: "messaggio",
        title: "Sara a un'amica",
        fields: [
          { id: "d1", label: "Arrivata alle", text: "22:10", fact: "arrivo" },
          { id: "d2", label: "Dove", text: "In fila al guardaroba" },
        ],
      },
    ],
    solution: { fieldId: "c2" },
    explain: "Scontrino e foto del gancio 147 dicono cappotto blu; il registro del guardaroba dice nero. Ritoccato il registro: così sembrava che a Sara spettasse il cappotto nero.",
  },
];

export default varianti;
