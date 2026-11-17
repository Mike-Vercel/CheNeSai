import type { CifraInput } from "@/lib/tig/games/mechanics/cifra-improbabile";

/**
 * 11 · LA CIFRA IMPROBABILE — varianti. Tra 60 e 170 sagome da stimare in 7 secondi (impossibile
 * contarle), più 14–30 intrusi di forma diversa da NON contare. Le domande non citano mai i colori:
 * bersagli e intrusi si distinguono per forma.
 */
const varianti: CifraInput[] = [
  {
    id: "candeline-festa",
    prompt: "Quante candeline sulla torta gigante della festa a sorpresa?",
    unit: "candeline",
    glyph: "candelina",
    decoyGlyph: "stella",
    decoyUnit: "stelline decorative",
    decoys: 24,
    solution: { count: 87 },
    explain: "Le candeline erano 87; le 24 stelline erano decorazioni da non contare. Ogni 5% di scarto costava 10 punti: con 80 o 95 si prendevano comunque più di 80 punti.",
  },
  {
    id: "monete-salvadanaio",
    prompt: "Avete svuotato il salvadanaio del viaggio di gruppo: quante monete?",
    unit: "monete",
    glyph: "moneta",
    decoyGlyph: "biglietto",
    decoyUnit: "biglietti del treno",
    decoys: 18,
    solution: { count: 132 },
    explain: "Le monete erano 132; i 18 biglietti del treno non contavano. Ogni 5% di scarto costava 10 punti: oltre il 50% di errore non restava nulla.",
  },
  {
    id: "postit-monitor",
    prompt: "Quanti post-it ha attaccato la collega intorno al monitor in una settimana?",
    unit: "post-it",
    glyph: "postit",
    decoyGlyph: "goccia",
    decoyUnit: "macchie di caffè",
    decoys: 16,
    solution: { count: 64 },
    explain: "I post-it erano 64; le 16 macchie di caffè a forma di goccia erano intrusi. Ogni 5% di scarto costava 10 punti.",
  },
  {
    id: "notifiche-gita",
    prompt: "Un'ora senza guardare il gruppo della gita: quante notifiche?",
    unit: "notifiche",
    glyph: "notifica",
    decoyGlyph: "cuore",
    decoyUnit: "reazioni a cuore",
    decoys: 28,
    solution: { count: 148 },
    explain: "Le notifiche erano 148; i 28 cuori erano reazioni, da non contare. Ogni 5% di scarto costava 10 punti.",
  },
  {
    id: "cuori-cane",
    prompt: "Quanti cuori ha preso la foto del cane del coinquilino?",
    unit: "cuori",
    glyph: "cuore",
    decoyGlyph: "notifica",
    decoyUnit: "commenti",
    decoys: 22,
    solution: { count: 119 },
    explain: "I cuori erano 119; i 22 fumetti erano commenti, da non contare. Ogni 5% di scarto costava 10 punti.",
  },
  {
    id: "biglietti-lotteria",
    prompt: "Quanti biglietti della lotteria della festa di quartiere sono stati venduti?",
    unit: "biglietti",
    glyph: "biglietto",
    decoyGlyph: "moneta",
    decoyUnit: "monete del resto",
    decoys: 20,
    solution: { count: 73 },
    explain: "I biglietti erano 73; le 20 monete del resto erano intrusi. Ogni 5% di scarto costava 10 punti.",
  },
  {
    id: "gocce-idraulico",
    prompt: "Quante gocce sono cadute dal soffitto del bagno prima che arrivasse l'idraulico?",
    unit: "gocce",
    glyph: "goccia",
    decoyGlyph: "notifica",
    decoyUnit: "messaggi all'idraulico",
    decoys: 30,
    solution: { count: 95 },
    explain: "Le gocce erano 95; i 30 fumetti erano i messaggi mandati all'idraulico, da non contare. Ogni 5% di scarto costava 10 punti.",
  },
  {
    id: "stelline-soffitto",
    prompt: "Quante stelline adesive sul soffitto della camera appena presa in affitto?",
    unit: "stelline",
    glyph: "stella",
    decoyGlyph: "cuore",
    decoyUnit: "adesivi a cuore",
    decoys: 14,
    solution: { count: 168 },
    explain: "Le stelline erano 168; i 14 adesivi a cuore non contavano. Ogni 5% di scarto costava 10 punti.",
  },
];

export default varianti;
