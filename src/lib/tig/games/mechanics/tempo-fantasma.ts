import { z } from "zod";
import type { MechanicDef } from "../contract";
import { formatSeconds, stopPoints } from "../components/estimate";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, text, variantId } from "./_shared";

/**
 * 04 · TEMPO FANTASMA (manche 1) — dopo il VIA nessun cronometro a schermo: il tavolo tocca STOP quando
 * pensa che sia passato il tempo bersaglio. Conta lo scarto assoluto, misurato dal SERVER (mai dal telefono).
 * In TV un segnale luminoso pulsa a un ritmo sbagliato apposta, per confondere chi conta.
 */

/** 3-2-1 prima del VIA (ms dall'inizio della prova). */
export const LEAD_IN_MS = 3000;
/** scarto a cui i punti arrivano a zero */
export const ZERO_AT_MS = 3000;
/** scarto entro cui l'esito è «centro» (Energia Caos in più) */
export const BULLSEYE_MS = 300;

export const tempoFantasmaContent = z.object({
  id: variantId,
  /** situazione, es. «Il vocale che dura 12 secondi» */
  theme: text(60),
  /** una riga di contesto */
  flavor: text(140),
  targetSec: z.number().int().min(8).max(16),
  /** ritmo del segnale di disturbo in TV (battiti al minuto, volutamente ≠ 60) */
  distractorBpm: z.number().int().min(36).max(150).refine((b) => Math.abs(b - 60) >= 8, "il disturbo non deve battere i secondi"),
  explain: explainSchema,
});
export type TempoFantasmaContent = z.infer<typeof tempoFantasmaContent>;
export type TempoFantasmaInput = z.input<typeof tempoFantasmaContent>;

export const tempoFantasmaSubmission = z.object({ stop: z.literal(true) });
export type TempoFantasmaSubmission = z.infer<typeof tempoFantasmaSubmission>;

export interface TempoFantasmaView extends BaseView {
  theme: string;
  flavor: string;
  targetSec: number;
  leadInMs: number;
  distractorBpm: number;
}

export interface TempoFantasmaReveal {
  theme: string;
  targetSec: number;
  explain: string;
}

/** Scarto in ms (negativo = in anticipo) dato l'istante del tocco sul server. */
export function deviationMs(elapsedMs: number, targetSec: number): number {
  return elapsedMs - LEAD_IN_MS - targetSec * 1000;
}

const def: MechanicDef<TempoFantasmaContent, TempoFantasmaSubmission> = {
  code: "tempo-fantasma",
  number: 4,
  manche: 1,
  title: "Tempo fantasma",
  input: "team",
  timerSec: 25,
  oneDeviceOk: true,
  needs: [],
  rule: "Al VIA il tempo scorre senza cronometro. Toccate STOP quando pensate sia passato il tempo bersaglio. Vince chi ci va più vicino.",
  contentSchema: tempoFantasmaContent,
  submissionSchema: tempoFantasmaSubmission,
  publicView: (c, ctx): TempoFantasmaView => ({
    ...baseView(def, ctx),
    theme: c.theme,
    flavor: c.flavor,
    targetSec: c.targetSec,
    leadInMs: LEAD_IN_MS,
    distractorBpm: c.distractorBpm,
  }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId, "Nessuno ha fermato il tempo");
        const dev = deviationMs(s.elapsedMs, content.targetSec);
        const { points, accuracy } = stopPoints(dev, ZERO_AT_MS);
        const falseStart = s.elapsedMs < LEAD_IN_MS;
        const bull = Math.abs(dev) <= BULLSEYE_MS;
        return outcome(t.teamId, {
          points: falseStart ? 0 : points,
          chaos: CHAOS.partecipa + (bull ? CHAOS.centro : 0),
          correct: null,
          accuracy: falseStart ? 0 : accuracy,
          label: falseStart ? "Partenza anticipata" : `Scarto ${formatSeconds(dev)} ${dev < 0 ? "in anticipo" : dev > 0 ? "in ritardo" : "esatto"}`,
        });
      }),
    };
  },
  reveal: (c): TempoFantasmaReveal => ({ theme: c.theme, targetSec: c.targetSec, explain: c.explain }),
};

export const tempoFantasma: MechanicModule<TempoFantasmaContent, TempoFantasmaSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) => {
      // tempi plausibili: attorno al bersaglio con scarti diversi per tavolo
      const subs = demoPerTeam(ctx, seed, () => ({ stop: true as const }));
      return subs.map((s, i) => ({ ...s, elapsedMs: LEAD_IN_MS + c.targetSec * 1000 + [180, -900, 1700, -2600, 600][i % 5] }));
    },
  },
};
