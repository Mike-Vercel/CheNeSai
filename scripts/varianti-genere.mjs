/**
 * Varianti per GENERE delle battute rivolte a un giocatore nominato (con accordi di genere).
 * Il testo ufficiale (maschile) resta parola per parola nella libreria; qui le versioni:
 *   f = femminile ("Brava!", "addormentata", "sei arrivata ultima"…);
 *   n = neutra, per chi non ha indicato il genere e per le squadre (senza accordi).
 * Modifica minima rispetto al testo dell'utente. Usato da build-libreria-ufficiale.mjs (libreria
 * ufficiale) e per content/show/battute.json (libreria di sempre: `node scripts/varianti-genere.mjs`).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const VARIANTS = {
  // ---------------- libreria ufficiale ----------------
  "uff-regina-nomi-41": {
    f: "{nome_ultimo}, amore mio… sei arrivata ultima! Però almeno sei costante!",
    n: "{nome_ultimo}, amore mio… sei in fondo alla classifica! Però almeno sei costante!",
  },
  "uff-regina-nomi-45": {
    f: "{nome_risposta_errata}, amore, eri così convinta! Peccato che la risposta fosse completamente sbagliata!",
    n: "{nome_risposta_errata}, amore, che convinzione! Peccato che la risposta fosse completamente sbagliata!",
  },
  "uff-palmino-nomi-54": {
    f: "{nome_ultimo}, ma sei venuta a giocare o a fare presenza?!",
    n: "{nome_ultimo}, ma sei qui per giocare o per fare presenza?!",
  },
  "uff-palmino-nomi-62": {
    f: "{nome_ultimo}, SEI ULTIMA… MA GUARDA IL LATO POSITIVO: PEGGIO DI COSÌ È DIFFICILE!",
    n: "{nome_ultimo}, SEI IN FONDO… MA GUARDA IL LATO POSITIVO: PEGGIO DI COSÌ È DIFFICILE!",
  },
  "uff-palmino-nomi-63": {
    f: "MA GUARDA {nome_nuovo_primo}! È DIVENTATA LA CAPA DELLA BARACCA!",
    n: "MA GUARDA {nome_nuovo_primo}! ADESSO COMANDA LA BARACCA!",
  },
  "uff-regina-ultimo": {
    f: "{nome_ultimo}, tesoro, sei ultima… ma non disperare! Anche i sudditi hanno un ruolo!",
    n: "{nome_ultimo}, tesoro, sei in fondo alla classifica… ma non disperare! Anche i sudditi hanno un ruolo!",
  },
  "uff-regina-esatta": {
    f: "{nome_risposta_corretta}, amore, sei stata fantastica!",
    n: "{nome_risposta_corretta}, amore, che risposta fantastica!",
  },
  "uff-regina-vittoria": {
    f: "AMOOOORE, {nome_vincitore}! HAI VINTO! SEI UFFICIALMENTE DEGNA DELLA MIA CORONA!",
    n: "AMOOOORE, {nome_vincitore}! HAI VINTO! ORA SEI UFFICIALMENTE ALL'ALTEZZA DELLA MIA CORONA!",
  },
  "uff-professore-silenzio-11": {
    f: "Complimenti, {nome_giocatore}. È riuscita a sbagliare senza neanche rispondere!",
    n: "Complimenti, {nome_giocatore}. Ha sbagliato senza neanche rispondere!",
  },
  "uff-regina-silenzio-01": {
    f: "{nome_giocatore}, AMOOOORE! Ti sei addormentata?!",
    n: "{nome_giocatore}, AMOOOORE! Stai dormendo?!",
  },
  "uff-regina-silenzio-03": {
    f: "{nome_giocatore}, bella mia, il telefono serve per rispondere, non per guardarti allo specchio!",
    n: "{nome_giocatore}, tesoro mio, il telefono serve per rispondere, non per guardarti allo specchio!",
  },
  "uff-regina-silenzio-10": {
    f: "Ma guardatela, {nome_giocatore}! È venuta al quiz per fare presenza!",
    n: "Ma guardate {nome_giocatore}! È qui al quiz solo per fare presenza!",
  },
  "uff-palmino-silenzio-01": {
    f: "MAMMA MIA, {nome_giocatore}! MA TI SEI ADDORMENTATA?!",
    n: "MAMMA MIA, {nome_giocatore}! MA STAI DORMENDO?!",
  },
  "uff-palmino-silenzio-04": {
    f: "{nome_giocatore}, MA SEI VIVA?! BATTI UN COLPO!",
    n: "{nome_giocatore}, MA CI SEI?! BATTI UN COLPO!",
  },
  "uff-palmino-silenzio-08": {
    f: "{nome_giocatore}, MAMMA MIA! MANCO UNA RISPOSTA A CASO SEI RIUSCITA A DARE!",
    n: "{nome_giocatore}, MAMMA MIA! MANCO UNA RISPOSTA A CASO HAI DATO!",
  },
  // "PIANTATO" è Palmino che parla di sé: resta
  "uff-palmino-silenzio-10": {
    f: "{nome_giocatore}, SEI PIÙ FERMA DI ME! E IO SONO PIANTATO PER TERRA!",
    n: "{nome_giocatore}, TI MUOVI MENO DI ME! E IO SONO PIANTATO PER TERRA!",
  },
  "uff-professore-silenzio-primo": {
    f: "{nome_giocatore}, è prima in classifica e decide di non rispondere? Una strategia che meriterebbe una ricerca scientifica.",
    n: "{nome_giocatore}, è in testa alla classifica e decide di non rispondere? Una strategia che meriterebbe una ricerca scientifica.",
  },
  "uff-regina-silenzio-primo": {
    f: "{nome_giocatore}, AMOOOORE! SEI PRIMA E TI METTI A DORMIRE?! GUARDA CHE LA CORONA TE LA TOLGO!",
    n: "{nome_giocatore}, AMOOOORE! SEI IN TESTA E TI METTI A DORMIRE?! GUARDA CHE LA CORONA TE LA TOLGO!",
  },
  "uff-palmino-silenzio-primo": {
    f: "MAMMA MIA, {nome_giocatore}! SEI PRIMA E ORA TI RIPOSI?! MA TI SENTI GIÀ IN VACANZA?!",
    n: "MAMMA MIA, {nome_giocatore}! SEI IN TESTA E ORA TI RIPOSI?! MA TI SENTI GIÀ IN VACANZA?!",
  },
  "uff-regina-silenzio-ultimo": {
    f: "{nome_giocatore}, tesoro, sei ultima e non rispondi nemmeno? Amore mio, così mi rendi il lavoro impossibile!",
    n: "{nome_giocatore}, tesoro, sei in fondo alla classifica e non rispondi nemmeno? Amore mio, così mi rendi il lavoro impossibile!",
  },
  "uff-palmino-silenzio-ultimo": {
    f: "{nome_giocatore}, MA SEI ULTIMA E NON RISPONDI?! MAMMA MIA, MA VUOI FINIRE SOTTO TERRA?!",
    n: "{nome_giocatore}, MA SEI IN FONDO E NON RISPONDI?! MAMMA MIA, MA VUOI FINIRE SOTTO TERRA?!",
  },
  "uff-silenzio-02-2": {
    f: "Professore, allora {nome_giocatore} stasera è milionaria!",
    n: "Professore, allora {nome_giocatore} stasera ha fatto fortuna!",
  },
  // ---------------- libreria di sempre (content/show/battute.json) ----------------
  "palmino-leader-kept-04": {
    f: "Ma chi sei, {nome_primo}, la padrona della classifica? Lasciane un pochino agli altri!",
    n: "Guarda {nome_primo}, comanda sempre la classifica! Lasciane un pochino agli altri!",
  },
  "regina-overtake-02": {
    f: "{nome_superato}, amore mio, non piangere che si rovina il trucco. {nome_sorpasso} ti è appena sfrecciata accanto!",
    n: "{nome_superato}, amore mio, non piangere che si rovina il trucco. {nome_sorpasso} ti ha appena superato in volata!",
  },
  "palmino-new-last-01": {
    f: "{nome_ultimo}, ma sei venuta a giocare o a fare presenza?!",
    n: "{nome_ultimo}, ma sei qui per giocare o per fare presenza?!",
  },
  "palmino-new-last-05": {
    f: "Ma chi sei, {nome_ultimo}, la guardiana della classifica? Tieni la porta a tutti!",
    n: "Guarda {nome_ultimo}, fai la guardia alla classifica? Tieni la porta a tutti!",
  },
  "regina-fastest-correct-03": {
    f: "{nome}, {secondi} secondi e risposta esatta. Velocità e classe: degna di una regina!",
    n: "{nome}, {secondi} secondi e risposta esatta. Velocità e classe: roba da regina!",
  },
  "professore-only-one-correct-03": {
    f: "{nome}, unica custode della verità in questo quesito. Platone ne sarebbe fiero.",
    n: "{nome}, l'unica risposta esatta in questo quesito. Platone ne sarebbe fiero.",
  },
  "palmino-only-one-correct-03": {
    f: "Guarda, guarda! Solo {nome} ha risposto giusto! Ma chi sei, una professoressa travestita?",
    n: "Guarda, guarda! Solo {nome} ha risposto giusto! Ma chi sei, un genio?",
  },
};

/** Aggiunge textF/textN alle righe di un file della libreria (subito dopo `text`). */
export function withVariants(line) {
  const v = VARIANTS[line.id];
  if (!v) return line;
  const out = {};
  for (const [k, val] of Object.entries(line)) {
    if (k === "textF" || k === "textN") continue;
    out[k] = val;
    if (k === "text") {
      out.textF = v.f;
      out.textN = v.n;
    }
  }
  return out;
}

// eseguito da solo: aggiorna content/show/battute.json
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = join(dirname(fileURLToPath(import.meta.url)), "..", "content", "show", "battute.json");
  const raw = JSON.parse(readFileSync(file, "utf8"));
  raw.lines = raw.lines.map(withVariants);
  writeFileSync(file, JSON.stringify(raw, null, 2) + "\n", "utf8");
  console.log(`${raw.lines.filter((l) => l.textF).length} battute con varianti → ${file}`);
}
