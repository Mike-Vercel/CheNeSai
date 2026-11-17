import type { CrediciInput } from "@/lib/tig/games/mechanics/credici-o-no";

/**
 * 49 · CREDICI O NO — ogni variante ha tre mini-casi indipendenti. Con gli indizi pubblici ogni caso si
 * risolve anche da soli (per esclusione), ma serve qualche secondo di ragionamento: fidarsi è una scorciatoia.
 * Personaggi tutti inventati.
 */
const varianti: CrediciInput[] = [
  {
    id: "casa-condivisa",
    cases: [
      {
        id: "latte",
        title: "Il latte d'avena",
        question: "Chi ha finito il latte d'avena?",
        facts: [
          "Il cartone era pieno a mezzanotte e vuoto alle 7.",
          "Teo e Nora hanno dormito fuori e sono rientrati alle 9.",
          "Bruno è allergico all'avena e non la tocca mai.",
        ],
        options: [
          { id: "lia", text: "Lia" },
          { id: "teo", text: "Teo" },
          { id: "bruno", text: "Bruno" },
          { id: "nora", text: "Nora" },
        ],
      },
      {
        id: "bici",
        title: "La bici davanti al portone",
        question: "Di chi è la bici lasciata davanti al portone?",
        facts: [
          "La bici ha un cestino davanti e il campanello rotto.",
          "Sara e Omar hanno bici senza cestino.",
          "Il campanello della bici di Pietro funziona benissimo.",
        ],
        options: [
          { id: "sara", text: "Sara" },
          { id: "pietro", text: "Pietro" },
          { id: "gaia", text: "Gaia" },
          { id: "omar", text: "Omar" },
        ],
      },
      {
        id: "pacco",
        title: "Il pacco sul pianerottolo",
        question: "Chi ha ordinato la lampada arrivata stamattina?",
        facts: [
          "Il pacco è indirizzato all'interno 4.",
          "All'interno 4 vivono solo Marco ed Elena.",
          "Elena non compra mai online: odia aspettare il corriere.",
        ],
        options: [
          { id: "ilaria", text: "Ilaria" },
          { id: "marco", text: "Marco" },
          { id: "dario", text: "Dario" },
          { id: "elena", text: "Elena" },
        ],
      },
    ],
    solution: {
      cases: {
        latte: { optionId: "lia", why: "Teo e Nora erano fuori fino alle 9, Bruno non tocca l'avena: resta solo Lia." },
        bici: { optionId: "gaia", why: "Sara e Omar non hanno il cestino, la bici di Pietro ha il campanello funzionante: è di Gaia." },
        pacco: { optionId: "marco", why: "All'interno 4 vivono solo Marco ed Elena, ed Elena non compra online: l'ha ordinata Marco." },
      },
    },
    explain: "Tre casi di condominio risolvibili per esclusione. Chi si è fidato ha risparmiato tempo, ma solo se chi suggeriva diceva il vero.",
  },
  {
    id: "ufficio-open-space",
    cases: [
      {
        id: "sala",
        title: "La sala riunioni",
        question: "Chi ha prenotato la sala riunioni alle 15?",
        facts: [
          "Chi ha prenotato lavora al terzo piano, dove ci sono Greta, Ivo e Luana.",
          "Ivo è in ferie tutta la settimana.",
          "Luana ha già prenotato la sala alle 10, e si può avere una sola prenotazione al giorno.",
        ],
        options: [
          { id: "fabio", text: "Fabio" },
          { id: "greta", text: "Greta" },
          { id: "ivo", text: "Ivo" },
          { id: "luana", text: "Luana" },
        ],
      },
      {
        id: "torta",
        title: "La torta in cucina",
        question: "Chi ha portato la torta lasciata in cucina?",
        facts: [
          "La torta era in cucina già prima delle 9.",
          "Rocco e Tina entrano in ufficio alle 10.",
          "Il biglietto sulla torta è scritto in verde, e Bea usa solo penne nere.",
        ],
        options: [
          { id: "rocco", text: "Rocco" },
          { id: "bea", text: "Bea" },
          { id: "tina", text: "Tina" },
          { id: "ugo", text: "Ugo" },
        ],
      },
      {
        id: "mail",
        title: "Rispondi a tutti",
        question: "Chi ha risposto «a tutti» per sbaglio?",
        facts: [
          "La risposta è partita alle 18:40 da un telefono.",
          "Alle 18:40 Alba e Sergio erano in metro, senza campo.",
          "Pia legge la posta solo dal computer.",
        ],
        options: [
          { id: "mirko", text: "Mirko" },
          { id: "alba", text: "Alba" },
          { id: "sergio", text: "Sergio" },
          { id: "pia", text: "Pia" },
        ],
      },
    ],
    solution: {
      cases: {
        sala: { optionId: "greta", why: "Fabio non è al terzo piano, Ivo è in ferie e Luana ha già la sua prenotazione: è stata Greta." },
        torta: { optionId: "ugo", why: "Rocco e Tina arrivano alle 10, Bea non scrive in verde: la torta l'ha portata Ugo." },
        mail: { optionId: "mirko", why: "Alba e Sergio erano senza campo, Pia non usa il telefono per la posta: è stato Mirko." },
      },
    },
    explain: "Piccoli misteri d'ufficio con una sola soluzione per esclusione. Il bluff funzionava solo su chi si fidava a occhi chiusi.",
  },
  {
    id: "weekend-fuori",
    cases: [
      {
        id: "guida",
        title: "Chi guida all'andata",
        question: "Chi guida all'andata della gita?",
        facts: [
          "Guida solo chi ha la patente da più di tre anni.",
          "Leo ha preso la patente l'anno scorso.",
          "Ada e Vale non hanno la patente.",
        ],
        options: [
          { id: "ada", text: "Ada" },
          { id: "leo", text: "Leo" },
          { id: "ciro", text: "Ciro" },
          { id: "vale", text: "Vale" },
        ],
      },
      {
        id: "singola",
        title: "La camera singola",
        question: "Chi dorme nella camera singola del B&B?",
        facts: [
          "Siete in tre (Noemi, Elia e Sandro) con una camera doppia e una singola.",
          "Elia russa forte e Noemi ha il sonno leggerissimo.",
          "Noemi e Sandro hanno litigato e non dividono la stanza.",
        ],
        options: [
          { id: "noemi", text: "Noemi" },
          { id: "elia", text: "Elia" },
          { id: "sandro", text: "Sandro" },
          { id: "sorte", text: "Si tira a sorte" },
        ],
      },
      {
        id: "treno",
        title: "Il treno del ritorno",
        question: "Quale treno prende il gruppo per tornare?",
        facts: [
          "Restano nel B&B fino al check-out delle 16:30, poi 20 minuti a piedi fino alla stazione.",
          "Il treno delle 20:05 arriva dopo l'ultima metro.",
          "Sul treno delle 18:40 non ci sono più posti.",
        ],
        options: [
          { id: "t1610", text: "16:10" },
          { id: "t1725", text: "17:25" },
          { id: "t1840", text: "18:40" },
          { id: "t2005", text: "20:05" },
        ],
      },
    ],
    solution: {
      cases: {
        guida: { optionId: "ciro", why: "Ada e Vale non hanno la patente e Leo ce l'ha da un anno: l'unico che può guidare è Ciro." },
        singola: { optionId: "noemi", why: "Noemi non può dormire con Elia (russa) né con Sandro (hanno litigato): la singola è sua, Elia e Sandro in doppia." },
        treno: { optionId: "t1725", why: "In stazione si arriva alle 16:50: il 16:10 è già partito, il 18:40 è pieno, il 20:05 è troppo tardi. Resta il 17:25." },
      },
    },
    explain: "Logistica da weekend: tre casi con una sola soluzione. La singola era il più insidioso: bisognava combinare due indizi.",
  },
  {
    id: "vita-social",
    cases: [
      {
        id: "commento",
        title: "Il commento sotto la foto",
        question: "Quale profilo ha scritto il commento sotto la foto della gita?",
        facts: [
          "Possono commentare solo i profili che seguono la pagina della gita.",
          "@zeta_ok e @ventisette non la seguono.",
          "@gattomatto è sospeso da una settimana e non può scrivere.",
        ],
        options: [
          { id: "lunapiena", text: "@lunapiena" },
          { id: "zeta-ok", text: "@zeta_ok" },
          { id: "gattomatto", text: "@gattomatto" },
          { id: "ventisette", text: "@ventisette" },
        ],
      },
      {
        id: "storia",
        title: "La storia cancellata",
        question: "Chi ha pubblicato e poi cancellato la storia della cena?",
        facts: [
          "La storia era girata dal posto vicino alla finestra.",
          "Vicino alla finestra sedevano solo Viola e Remo.",
          "Remo quella sera aveva il telefono scarico.",
        ],
        options: [
          { id: "viola", text: "Viola" },
          { id: "nico", text: "Nico" },
          { id: "remo", text: "Remo" },
          { id: "asia", text: "Asia" },
        ],
      },
      {
        id: "foto",
        title: "La foto di gruppo",
        question: "Chi ha scattato la foto di gruppo al compleanno?",
        facts: [
          "Nella foto si vedono Lapo, Gino e Dora.",
          "La foto non è un autoscatto: chi scatta non compare.",
        ],
        options: [
          { id: "lapo", text: "Lapo" },
          { id: "ines", text: "Ines" },
          { id: "gino", text: "Gino" },
          { id: "dora", text: "Dora" },
        ],
      },
    ],
    solution: {
      cases: {
        commento: { optionId: "lunapiena", why: "@zeta_ok e @ventisette non seguono la pagina, @gattomatto è sospeso: il commento è di @lunapiena." },
        storia: { optionId: "viola", why: "Alla finestra c'erano solo Viola e Remo, e Remo aveva il telefono scarico: è stata Viola." },
        foto: { optionId: "ines", why: "Lapo, Gino e Dora sono nella foto e chi scatta non compare: l'ha scattata Ines." },
      },
    },
    explain: "Misteri da social, tutti risolvibili con gli indizi. Il suggerimento del tavolo vicino poteva essere vero o un bluff ben piazzato.",
  },
  {
    id: "primo-appuntamento",
    cases: [
      {
        id: "locale",
        title: "Il locale del primo incontro",
        question: "In quale locale si sono visti Marta e il suo appuntamento, di lunedì?",
        facts: [
          "La Trattoria La Corte e la Pizzeria Fumo il lunedì sono chiuse.",
          "Marta aveva scritto: «basta che non sia ramen, ci sono stata ieri».",
        ],
        options: [
          { id: "ottavo", text: "Bistrot Ottavo" },
          { id: "corte", text: "Trattoria La Corte" },
          { id: "ramen", text: "Ramen Hikari" },
          { id: "fumo", text: "Pizzeria Fumo" },
        ],
      },
      {
        id: "conto",
        title: "Il conto",
        question: "Chi ha pagato il conto al primo appuntamento?",
        facts: [
          "Lo scontrino è uno solo, pagato con una sola carta.",
          "Giulio aveva dimenticato il portafoglio e non paga mai col telefono.",
          "Il locale non offre mai la cena.",
        ],
        options: [
          { id: "giulio", text: "Giulio" },
          { id: "chiara", text: "Chiara" },
          { id: "meta", text: "Metà a testa" },
          { id: "offerto", text: "Ha offerto il locale" },
        ],
      },
      {
        id: "film",
        title: "Il film",
        question: "Quale film hanno visto allo spettacolo delle 21?",
        facts: [
          "Alle 21 danno solo «Il faro», «Notte a Lisbona» e «Ultima fermata».",
          "Lui non guarda horror, e «Il faro» è un horror.",
          "Lei ha messo il veto sui film oltre le due ore: «Ultima fermata» ne dura tre.",
        ],
        options: [
          { id: "faro", text: "Il faro" },
          { id: "ultima", text: "Ultima fermata" },
          { id: "lisbona", text: "Notte a Lisbona" },
          { id: "garage", text: "Due cuori, un garage" },
        ],
      },
    ],
    solution: {
      cases: {
        locale: { optionId: "ottavo", why: "La Corte e Fumo chiudono il lunedì e Marta non voleva il ramen: Bistrot Ottavo." },
        conto: { optionId: "chiara", why: "Una sola carta, Giulio senza portafoglio e senza pagamenti col telefono, niente cene offerte: ha pagato Chiara." },
        film: { optionId: "lisbona", why: "Alle 21 «Due cuori, un garage» non c'è, «Il faro» è horror, «Ultima fermata» è troppo lungo: Notte a Lisbona." },
      },
    },
    explain: "Primo appuntamento in tre misteri. Tutti risolvibili, ma con il timer che corre fidarsi del tavolo vicino era tentante.",
  },
  {
    id: "giorno-del-trasloco",
    cases: [
      {
        id: "scatole",
        title: "Lo scatolone dei piatti",
        question: "In quale scatolone sono finiti i piatti?",
        facts: [
          "Le scatole con il numero pari sono piene di libri.",
          "La scatola 3 è leggerissima.",
          "I piatti pesano parecchio.",
        ],
        options: [
          { id: "s1", text: "Scatola 1" },
          { id: "s2", text: "Scatola 2" },
          { id: "s3", text: "Scatola 3" },
          { id: "s4", text: "Scatola 4" },
        ],
      },
      {
        id: "chiavi",
        title: "Le chiavi nuove",
        question: "A quale coinquilino è andata la copia delle chiavi nuove?",
        facts: [
          "Tano è il proprietario di casa, non un coinquilino.",
          "Mila e Lori stanno ancora aspettando la loro copia.",
        ],
        options: [
          { id: "enzo", text: "Enzo" },
          { id: "mila", text: "Mila" },
          { id: "tano", text: "Tano" },
          { id: "lori", text: "Lori" },
        ],
      },
      {
        id: "furgone",
        title: "Il furgone",
        question: "Quale furgone hanno noleggiato?",
        facts: [
          "Il divano è lungo 2,4 metri: serve un vano di almeno 2,5 metri.",
          "Vano di carico: piccolo 1,8 m, medio 2,6 m, grande 3,2 m, extra 4 m.",
          "Hanno preso il più economico che basta, e il prezzo cresce con la misura.",
        ],
        options: [
          { id: "piccolo", text: "Piccolo" },
          { id: "medio", text: "Medio" },
          { id: "grande", text: "Grande" },
          { id: "extra", text: "Extra" },
        ],
      },
    ],
    solution: {
      cases: {
        scatole: { optionId: "s1", why: "La 2 e la 4 sono piene di libri, la 3 è leggerissima: i piatti pesanti sono nella scatola 1." },
        chiavi: { optionId: "enzo", why: "Tano è il proprietario e Mila e Lori aspettano ancora la copia: le chiavi le ha Enzo." },
        furgone: { optionId: "medio", why: "Serve almeno 2,5 m: il piccolo non basta e il medio (2,6 m) è il più economico tra quelli che bastano." },
      },
    },
    explain: "Il trasloco perfetto in tre casi. Ogni soluzione si trovava per esclusione: il bluff colpiva solo chi non controllava.",
  },
];

export default varianti;
