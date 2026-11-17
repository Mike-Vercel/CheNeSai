import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { idSchema, publicOptions, type Option } from "../components/choice";
import { seededShuffle } from "../components/rng";
import { baseView, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, text, variantId } from "./_shared";
import { demoSingle, difficultySchema, optionSolution, optionSubmission, scoreSingle, type OptionSubmission } from "./m1/common";
import { compileMix, compileOne, SOUND_KINDS, type SynthEvent } from "./m1/synth";

/**
 * 12 · RUMORE DI FONDO (manche 1) — tre suoni ORIGINALI (sintetizzati in WebAudio, niente file) si
 * sovrappongono per 6 secondi; la TV li fa sentire due volte e ogni telefono può riascoltarli.
 * Due tipi di domanda: «quale suono era il più forte?» (dominante) o «quale c'era, ma non c'entrava con
 * gli altri due?» (estraneo). Quattro risposte: i tre suoni presenti più uno assente, così senza ascoltare
 * si tira a indovinare. Versione testuale per l'accessibilità (descrizioni dei suoni, senza nomi).
 * Ai telefoni arriva il missaggio già compilato in eventi anonimi: né i nomi né i volumi dei singoli strati.
 */

export const MIX_MS = 6000;
/** Quando la TV fa partire il missaggio (ms dall'inizio della prova). */
export const PLAYS_MS = [800, 8600] as const;

const sound = z.enum(SOUND_KINDS);

export const rumoreContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    mode: z.enum(["dominante", "estraneo"]),
    layers: z.array(z.object({ sound, gain: z.number().min(0.05).max(1) })).length(3),
    prompt: text(110),
    /** testo + suono di ogni risposta (il suono serve ai controlli e al riascolto nel reveal) */
    options: z.array(z.object({ id: idSchema, text: text(60), sound })).length(4),
    /** versione testuale: una descrizione per strato (stesso ordine di `layers`), senza nominare il suono */
    descriptions: z.array(text(140)).length(3),
    solution: optionSolution,
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const ids = c.options.map((o) => o.id);
    if (new Set(ids).size !== 4) fail("id delle risposte duplicati");
    if (new Set(c.options.map((o) => o.sound)).size !== 4) fail("suoni delle risposte duplicati");
    const inMix = new Set(c.layers.map((l) => l.sound));
    if (inMix.size !== 3) fail("tre suoni diversi nel missaggio");
    const absent = c.options.filter((o) => !inMix.has(o.sound));
    if (absent.length !== 1) fail("le risposte sono i tre suoni presenti più uno assente");
    const right = c.options.find((o) => o.id === c.solution.optionId);
    if (!right) return fail("soluzione inesistente");
    if (!inMix.has(right.sound)) fail("la risposta giusta deve essere un suono presente");
    if (c.mode === "dominante") {
      const sorted = c.layers.slice().sort((a, b) => b.gain - a.gain);
      if (sorted[0].sound !== right.sound) fail("la risposta giusta deve essere lo strato più forte");
      if (sorted[0].gain < sorted[1].gain * 1.8) fail("lo strato dominante deve essere almeno 1,8 volte più forte degli altri");
    }
  });
export type RumoreContent = z.infer<typeof rumoreContent>;
export type RumoreInput = z.input<typeof rumoreContent>;

export interface RumoreView extends BaseView {
  mode: "dominante" | "estraneo";
  prompt: string;
  options: Option[];
  /** missaggio compilato: durata (s) ed eventi anonimi */
  mix: { d: number; ev: SynthEvent[] };
  /** quando la TV lo suona (ms dall'inizio della prova) */
  plays: number[];
  /** versione testuale, in ordine mescolato */
  descriptions: string[];
}

export interface RumoreReveal {
  mode: "dominante" | "estraneo";
  prompt: string;
  /** risposte con il loro suono da riascoltare da solo */
  options: (Option & { solo: SynthEvent[]; present: boolean; loud: boolean })[];
  solutionId: string;
  explain: string;
}

// La compilazione è pura: si ricorda per non rifarla a ogni lettura dello stato.
const cache = new Map<string, SynthEvent[]>();
function mixOf(c: RumoreContent): SynthEvent[] {
  const key = `${c.id}|${JSON.stringify(c.layers)}`;
  let v = cache.get(key);
  if (!v) {
    v = compileMix(c.layers, MIX_MS / 1000, c.id);
    if (cache.size > 100) cache.clear();
    cache.set(key, v);
  }
  return v;
}

function view(c: RumoreContent, ctx: PhaseCtx): RumoreView {
  return {
    ...baseView(def, ctx),
    mode: c.mode,
    prompt: c.prompt,
    options: publicOptions(c.options, `${ctx.seed}:suoni`),
    mix: { d: MIX_MS / 1000, ev: mixOf(c) },
    plays: [...PLAYS_MS],
    descriptions: seededShuffle(c.descriptions, `${ctx.seed}:descrizioni`),
  };
}

const def: MechanicDef<RumoreContent, OptionSubmission> = {
  code: "rumore-di-fondo",
  number: 12,
  manche: 1,
  title: "Rumore di fondo",
  input: "team",
  timerSec: 30,
  oneDeviceOk: true,
  needs: ["audio"],
  rule: "Tre suoni insieme, due volte. Riconoscete quello che vi chiediamo: il più forte o quello che non c'entra.",
  contentSchema: rumoreContent,
  submissionSchema: optionSubmission,
  publicView: (c, ctx) => view(c, ctx),
  score: ({ content, ctx, submissions }) => scoreSingle(content.solution.optionId, ctx, submissions, { okLabel: "Orecchio fino", koLabel: "Sentito male" }),
  reveal: (c): RumoreReveal => {
    const max = Math.max(...c.layers.map((l) => l.gain));
    return {
      mode: c.mode,
      prompt: c.prompt,
      options: c.options.map((o) => {
        const layer = c.layers.find((l) => l.sound === o.sound);
        return { id: o.id, text: o.text, solo: compileOne(o.sound, 2.5, c.id), present: !!layer, loud: !!layer && layer.gain === max };
      }),
      solutionId: c.solution.optionId,
      explain: c.explain,
    };
  },
};

export const rumoreDiFondo: MechanicModule<RumoreContent, OptionSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) => demoSingle(ctx, seed, c.solution.optionId, c.options.map((o) => o.id), { minMs: 7000 }),
  },
};
