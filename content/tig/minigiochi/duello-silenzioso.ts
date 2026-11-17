import type { DuelloInput } from "@/lib/tig/games/mechanics/duello-silenzioso";

/**
 * 72 · DUELLO SILENZIOSO — enigmi a combinazione con cifre tutte diverse. Ogni riga è un tentativo già fatto
 * con il suo esito (cifre giuste al posto giusto / giuste ma fuori posto). Lo schema verifica per forza bruta
 * che la combinazione compatibile con tutte le righe sia UNA sola e coincida con la soluzione.
 * Facili: 3 cifre e 4 righe; medie: 3 cifre e 5 righe o 4 cifre; difficili: 4 cifre e 5-6 righe.
 */
const varianti: DuelloInput[] = [
  {
    id: "armadietto-palestra",
    difficulty: "facile",
    title: "L'armadietto della palestra",
    story: "Avete dimenticato la combinazione dell'armadietto, e dentro ci sono le chiavi di casa. Per fortuna i tentativi di prima li ricordate tutti.",
    digits: 3,
    rows: [
      { guess: "382", spot: 1, near: 0 },
      { guess: "317", spot: 1, near: 0 },
      { guess: "389", spot: 1, near: 0 },
      { guess: "682", spot: 2, near: 0 },
    ],
    solution: { pin: "687" },
    explain:
      "682 ha una cifra al posto giusto in più di 382: il 6 in testa è giusto e il 3 no. Il 2 in fondo non regge: 317 vorrebbe allora l'1 al centro e 389 resterebbe senza cifre al posto giusto. Quindi l'8 sta al centro e, da 317, il 7 chiude: 687.",
  },
  {
    id: "lucchetto-bici",
    difficulty: "facile",
    title: "Il lucchetto della bici",
    story: "Bici legata davanti al pub, lucchetto a tre rotelle e memoria annebbiata. Sul telefono avete segnato i tentativi andati a vuoto.",
    digits: 3,
    rows: [
      { guess: "703", spot: 0, near: 0 },
      { guess: "612", spot: 0, near: 1 },
      { guess: "350", spot: 0, near: 1 },
      { guess: "812", spot: 1, near: 1 },
    ],
    solution: { pin: "825" },
    explain:
      "703 esclude 7, 0 e 3, quindi da 350 il 5 c'è ma non al centro. 812 ha due cifre giuste e 612 una sola: l'8 c'è e il 6 no. Da 612 non c'è né l'1 al centro né il 2 in fondo, quindi in 812 l'unica al posto giusto è l'8 in testa: poi 2 al centro e 5 in fondo, 825.",
  },
  {
    id: "valigia-trolley",
    difficulty: "facile",
    title: "Il trolley del weekend",
    story: "Il lucchetto del trolley si è chiuso da solo in stazione. Il treno parte tra poco e avete già provato quattro combinazioni.",
    digits: 3,
    rows: [
      { guess: "714", spot: 0, near: 2 },
      { guess: "504", spot: 0, near: 0 },
      { guess: "278", spot: 1, near: 0 },
      { guess: "283", spot: 1, near: 0 },
    ],
    solution: { pin: "173" },
    explain:
      "504 esclude 5, 0 e 4, quindi da 714 ci sono sia il 7 (non in testa) sia l'1 (non al centro). Né il 2 né l'8 reggono: farebbero tornare troppe cifre giuste in 278 o 283. Allora in 283 è giusto il 3 in fondo e in 278 il 7 al centro: resta l'1 in testa, 173.",
  },
  {
    id: "cassetta-chiavi-appartamento",
    difficulty: "facile",
    title: "La cassetta delle chiavi",
    story: "Appartamento per il weekend, cassetta delle chiavi accanto al portone, messaggio del proprietario cancellato per sbaglio. Avete solo i vostri tentativi.",
    digits: 3,
    rows: [
      { guess: "427", spot: 0, near: 1 },
      { guess: "310", spot: 0, near: 1 },
      { guess: "072", spot: 0, near: 0 },
      { guess: "167", spot: 1, near: 0 },
      { guess: "605", spot: 0, near: 1 },
    ],
    solution: { pin: "154" },
    explain:
      "072 esclude 0, 7 e 2: da 427 c'è il 4, ma non in testa. In 167 la cifra giusta è l'1 in testa (col 6 al centro il 4 finirebbe in testa). Il 6 non c'è, altrimenti in 167 conterebbe anche lui: da 605 c'è il 5, ma non in fondo. Resta 154.",
  },
  {
    id: "cassaforte-hotel",
    difficulty: "media",
    title: "La cassaforte dell'hotel",
    story: "Ultima mattina di vacanza: passaporti nella cassaforte della camera, combinazione scelta alle due di notte. Il check-out è tra venti minuti.",
    digits: 3,
    rows: [
      { guess: "504", spot: 0, near: 2 },
      { guess: "623", spot: 0, near: 0 },
      { guess: "340", spot: 0, near: 1 },
      { guess: "018", spot: 0, near: 1 },
      { guess: "147", spot: 0, near: 2 },
    ],
    solution: { pin: "451" },
    explain:
      "623 esclude 6, 2 e 3. Lo 0 non può esserci: in 504, 340 e 018 occupa tutti e tre i posti ed è sempre fuori posto. Quindi da 504 ci sono 5 e 4, e l'unica cifra in comune tra 018 e 147 è l'1. Il 4 non sta né al centro né in fondo, l'1 né in testa né al centro: 451.",
  },
  {
    id: "garage-condominio",
    difficulty: "media",
    title: "Il garage del condominio",
    story: "Il tastierino del garage chiede tre cifre e l'amministratore non risponde. I vicini, gentilissimi, vi hanno detto come sono andati i loro tentativi.",
    digits: 3,
    rows: [
      { guess: "046", spot: 0, near: 1 },
      { guess: "902", spot: 2, near: 0 },
      { guess: "316", spot: 0, near: 0 },
      { guess: "312", spot: 1, near: 0 },
      { guess: "917", spot: 0, near: 1 },
    ],
    solution: { pin: "702" },
    explain:
      "316 esclude 3, 1 e 6, quindi in 312 è giusto il 2 in fondo. In 902 le cifre al posto giusto sono due: il 2 e una tra 9 in testa e 0 al centro. 917 non ha cifre al posto giusto, quindi il 9 non è in testa: lo 0 sta al centro. In testa resta la cifra di 917 fuori posto: il 7. 702.",
  },
  {
    id: "wifi-bed-and-breakfast",
    difficulty: "media",
    title: "Il Wi-Fi del B&B",
    story: "La password del Wi-Fi del B&B finisce con quattro cifre scritte su un biglietto ormai illeggibile. Cinque tentativi, cinque esiti.",
    digits: 4,
    rows: [
      { guess: "8390", spot: 0, near: 2 },
      { guess: "7310", spot: 1, near: 1 },
      { guess: "9527", spot: 0, near: 1 },
      { guess: "2970", spot: 0, near: 0 },
      { guess: "6095", spot: 1, near: 0 },
    ],
    solution: { pin: "3815" },
    explain:
      "2970 esclude 2, 9, 7 e 0. Prova del nove: 8390 ha 8 e 3 fuori posto; 7310 ha l'1 al posto giusto e il 3 fuori posto; 9527 ha il 5 fuori posto; 6095 ha il 5 al posto giusto. Nessun'altra combinazione con cifre diverse rispetta tutte le righe: 3815.",
  },
  {
    id: "tastierino-ufficio",
    difficulty: "media",
    title: "Il tastierino dell'ufficio",
    story: "Lunedì mattina, porta dell'ufficio chiusa e codice cambiato venerdì sera. I colleghi in chat incollano i tentativi falliti.",
    digits: 4,
    rows: [
      { guess: "2967", spot: 1, near: 1 },
      { guess: "6523", spot: 0, near: 1 },
      { guess: "7630", spot: 1, near: 1 },
      { guess: "4813", spot: 0, near: 2 },
      { guess: "2157", spot: 0, near: 1 },
    ],
    solution: { pin: "7468" },
    explain:
      "Prova del nove su 7468: 2967 ha il 6 al posto giusto e il 7 fuori posto; 6523 ha solo il 6 fuori posto; 7630 ha il 7 al posto giusto e il 6 fuori posto; 4813 ha 4 e 8 fuori posto; 2157 ha il 7 fuori posto. Le righe con 7 e 6 dicono che ci sono entrambi: da lì il resto torna solo con 7468.",
  },
  {
    id: "diario-coinquilina",
    difficulty: "difficile",
    title: "La scatola delle bollette",
    story: "La coinquilina ha chiuso le bollette in una scatola col lucchetto e poi è partita. Il gruppo della casa ricostruisce i tentativi della serata.",
    digits: 4,
    rows: [
      { guess: "8350", spot: 1, near: 1 },
      { guess: "0253", spot: 0, near: 1 },
      { guess: "3689", spot: 1, near: 1 },
      { guess: "8416", spot: 1, near: 0 },
      { guess: "2734", spot: 1, near: 0 },
    ],
    solution: { pin: "8709" },
    explain:
      "Prova del nove su 8709: 8350 ha l'8 al posto giusto e lo 0 fuori posto; 0253 ha lo 0 fuori posto; 3689 ha il 9 al posto giusto e l'8 fuori posto; 8416 ha l'8 al posto giusto; 2734 ha il 7 al posto giusto. Tra le 5040 combinazioni con cifre diverse è l'unica che rispetta tutte e cinque le righe.",
  },
  {
    id: "spogliatoio-calcetto",
    difficulty: "difficile",
    title: "Lo spogliatoio del calcetto",
    story: "Partita finita, borse chiuse nello stanzino con il lucchetto a quattro cifre. Il capitano ha scritto i tentativi sul retro della distinta.",
    digits: 4,
    rows: [
      { guess: "4571", spot: 0, near: 2 },
      { guess: "6830", spot: 0, near: 2 },
      { guess: "8562", spot: 1, near: 1 },
      { guess: "6923", spot: 0, near: 2 },
      { guess: "5710", spot: 1, near: 0 },
    ],
    solution: { pin: "5364" },
    explain:
      "Prova del nove su 5364: 4571 ha 4 e 5 fuori posto; 6830 ha 6 e 3 fuori posto; 8562 ha il 6 al posto giusto e il 5 fuori posto; 6923 ha 6 e 3 fuori posto; 5710 ha il 5 al posto giusto. Tra le 5040 combinazioni con cifre diverse è l'unica che rispetta tutte e cinque le righe.",
  },
  {
    id: "box-noleggio-sci",
    difficulty: "difficile",
    title: "Il box degli scarponi",
    story: "Settimana bianca, box degli scarponi con codice a quattro cifre e sei tentativi già bruciati. Gli impianti chiudono tra mezz'ora.",
    digits: 4,
    rows: [
      { guess: "4039", spot: 1, near: 0 },
      { guess: "4578", spot: 0, near: 1 },
      { guess: "6541", spot: 0, near: 2 },
      { guess: "4673", spot: 0, near: 0 },
      { guess: "2315", spot: 1, near: 2 },
      { guess: "4217", spot: 1, near: 1 },
    ],
    solution: { pin: "5012" },
    explain:
      "4673 esclude 4, 6, 7 e 3. Prova del nove su 5012: 4039 ha lo 0 al posto giusto; 4578 ha il 5 fuori posto; 6541 ha 5 e 1 fuori posto; 2315 ha l'1 al posto giusto, 2 e 5 fuori posto; 4217 ha l'1 al posto giusto e il 2 fuori posto. Solo 5012 rispetta tutte e sei le righe.",
  },
  {
    id: "cassetta-mance-bar",
    difficulty: "difficile",
    title: "La cassetta delle mance",
    story: "Fine turno al bar: la cassetta delle mance ha un lucchetto a quattro cifre e il titolare è in ferie. Lo staff ha annotato sei tentativi.",
    digits: 4,
    rows: [
      { guess: "1837", spot: 0, near: 2 },
      { guess: "9013", spot: 1, near: 1 },
      { guess: "5240", spot: 0, near: 1 },
      { guess: "5603", spot: 0, near: 1 },
      { guess: "5198", spot: 0, near: 1 },
      { guess: "8647", spot: 0, near: 1 },
    ],
    solution: { pin: "9372" },
    explain:
      "Prova del nove su 9372: 1837 ha 3 e 7 fuori posto; 9013 ha il 9 al posto giusto e il 3 fuori posto; 5240 ha il 2 fuori posto; 5603 ha il 3 fuori posto; 5198 ha il 9 fuori posto; 8647 ha il 7 fuori posto. Tra le 5040 combinazioni con cifre diverse è l'unica che regge tutte e sei le righe.",
  },
];

export default varianti;
