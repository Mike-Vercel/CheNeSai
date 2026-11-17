import { z } from "zod";
import type { CatalogEntry, MechanicDef, ScoreOutput } from "@/lib/tig/games/contract";
import { validVariants, type ContentVariant, type MechanicWithVariants } from "@/lib/tig/games/variants";

/**
 * Meccanica di PROVA per i test del core («prova-rapida»: risposta di squadra fra 4 opzioni, deterministica).
 * Non fa parte del gioco: i test d'integrazione la installano al posto del registro vero
 * (`setTigRegistryForTests(fixtureRegistry())`) per controllare runtime, punteggi e limiti con risposte note.
 */

interface ProvaRapidaContent {
  question: string;
  options: [string, string, string, string];
  answer: number;
  explain: string;
}
interface ProvaRapidaSubmission {
  choice: number;
}

const contentSchema = z.object({
  question: z.string().min(5).max(200),
  options: z.tuple([z.string().min(1).max(60), z.string().min(1).max(60), z.string().min(1).max(60), z.string().min(1).max(60)]),
  answer: z.number().int().min(0).max(3),
  explain: z.string().max(200),
});
const submissionSchema = z.object({ choice: z.number().int().min(0).max(3) });

const VARIANTS: ContentVariant<ProvaRapidaContent>[] = [
  { key: "pr-01", difficulty: "facile", content: { question: "FIXTURE · Chat del gruppo: «Dove siamo?» Chi arriva per ultimo di solito…", options: ["Ha il telefono scarico", "Porta da bere", "Chiede la posizione", "Prenota il tavolo"], answer: 2, explain: "Domanda di prova del ramo core." } },
  { key: "pr-02", difficulty: "facile", content: { question: "FIXTURE · Weekend improvvisato: treno alle 8:10, coincidenza 9:05. Quanto tempo per il caffè?", options: ["35 minuti", "55 minuti", "45 minuti", "25 minuti"], answer: 1, explain: "9:05 − 8:10 = 55 minuti." } },
  { key: "pr-03", difficulty: "media", content: { question: "FIXTURE · Conto della serata: 4 amici, 92 € in totale. Quota a testa?", options: ["21 €", "23 €", "24 €", "22 €"], answer: 1, explain: "92 / 4 = 23 €." } },
  { key: "pr-04", difficulty: "media", content: { question: "FIXTURE · Coinquilini: chi ha chiuso la porta alle 23:40 se A uscì alle 23:15 e B rientrò alle 23:45?", options: ["A", "B", "Nessuno dei due", "C, l'unico in casa"], answer: 3, explain: "A era fuori, B non era ancora rientrato." } },
  { key: "pr-05", difficulty: "difficile", content: { question: "FIXTURE · Sequenza: 2, 6, 12, 20, 30, ?", options: ["40", "42", "44", "36"], answer: 1, explain: "Differenze +4, +6, +8, +10, +12." } },
  { key: "pr-06", difficulty: "difficile", content: { question: "FIXTURE · Offerta: «2 cocktail a 14 €» o «-30% su 10 € l'uno». Quale conviene per due?", options: ["La prima", "La seconda", "Sono uguali", "Dipende dall'orario"], answer: 2, explain: "14 € contro 7 € × 2 = 14 €." } },
  { key: "pr-07", difficulty: "media", content: { question: "FIXTURE · Aperitivo alle 19:30, ognuno arriva con 20 minuti di ritardo. A che ora si brinda?", options: ["19:50", "20:00", "19:40", "20:10"], answer: 0, explain: "19:30 + 20 minuti." } },
  { key: "pr-08", difficulty: "facile", content: { question: "FIXTURE · Il gruppo vota: 5 per il divano, 3 per uscire. Che percentuale vuole uscire?", options: ["30%", "37,5%", "40%", "62,5%"], answer: 1, explain: "3 su 8 = 37,5%." } },
];

export const provaRapida: MechanicWithVariants<ProvaRapidaContent, ProvaRapidaSubmission> = {
  code: "prova-rapida",
  number: 0,
  manche: 1,
  title: "PROVA RAPIDA (fixture)",
  input: "team",
  timerSec: 30,
  oneDeviceOk: true,
  needs: [],
  rule: "Una domanda, quattro risposte: il capitano invia la scelta della squadra. Giusta = 100, più in fretta = fino a +20.",
  contentSchema,
  submissionSchema,
  publicView: (content) => ({ question: content.question, options: content.options }),
  score: ({ content, ctx, submissions }): ScoreOutput => {
    const total = Math.max(1, ctx.deadlineAt - ctx.startsAt);
    return {
      outcomes: ctx.teams
        .filter((t) => ctx.participants.includes(t.teamId))
        .map((t) => {
          const s = submissions.find((x) => x.teamId === t.teamId);
          if (!s) return { teamId: t.teamId, points: 0, chaos: 0, correct: null, accuracy: 0, label: "Nessuna risposta" };
          const correct = s.payload.choice === content.answer;
          const speed = correct ? Math.round(20 * Math.max(0, 1 - s.elapsedMs / total)) : 0;
          return { teamId: t.teamId, points: correct ? 100 + speed : 0, chaos: 0, correct, accuracy: correct ? 1 : 0, label: correct ? `Esatta${speed ? ` (+${speed} velocità)` : ""}` : "Sbagliata" };
        }),
    };
  },
  reveal: (content) => ({ answer: content.answer, answerText: content.options[content.answer], explain: content.explain }),
  variants: VARIANTS,
};

const FIXTURE_CATALOG: CatalogEntry[] = [
  { number: 0, code: "prova-rapida", manche: 1, title: "PROVA RAPIDA (fixture)", description: "Meccanica di prova dei test del core.", input: "team", timerSec: 30, pointsRule: "100 + bonus velocità fino a 20", status: "implementata" },
];

/** Registro di prova (forma di TigRegistry) con la sola meccanica «prova-rapida». */
export function fixtureRegistry() {
  const mechanics: MechanicDef[] = [provaRapida as unknown as MechanicDef];
  return { mechanics, catalog: FIXTURE_CATALOG, variantsOf: (def: MechanicDef) => validVariants(def), extras: () => undefined };
}
