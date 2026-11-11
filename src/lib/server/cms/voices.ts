import "server-only";
import { z } from "zod";
import { getSql } from "@/lib/database/db";
import { TTS_ROLES, type TtsRole } from "@/features/game/script";
import { audit } from "../audit";
import type { Actor } from "../engine";
import {
  appUsage,
  cachedKeys,
  ensureClip,
  envVoiceId,
  invalidateVoiceConfig,
  loadVoiceConfig,
  modelFor,
  modelSupportsTags,
  NAMES_MODES,
  planClip,
  signedClipUrl,
  subscriptionInfo,
  TtsError,
  ttsConfigured,
  type VoiceConfig,
} from "../tts";
import { namesArchiveStats } from "../tts-names";

/** Frase fissa di prova per ogni voce (breve: costa pochi caratteri ed è in cache). */
export const SAMPLE_TEXT: Record<TtsRole, string> = {
  professore: "[clears throat] Buonasera! Sono il Professore e stasera, con estrema modestia, saprò tutto io.",
  regina: "[laughs] Ciao a tutti! Stasera vi giudico tutti. Con amore, si intende.",
  palmino: "[giggles] Eccomi, sono Palmino! [shouts] Sorpresaaa! Qualcuno ha visto la mia noce di cocco?",
  annunciatore: "[shouts] Signore e signori… il quiz più pazzo del pub: Che ne sai!!!",
};

const roleSchema = z.object({
  voiceId: z.string().trim().max(80),
  voiceName: z.string().trim().max(120).nullable().optional(),
  stability: z.number().min(0).max(1),
  similarity: z.number().min(0).max(1),
  style: z.number().min(0).max(1),
  speed: z.number().min(0.7).max(1.2),
});

export const voiceConfigSchema = z.object({
  monthlyBudgetChars: z.number().int().min(0).max(10_000_000),
  /** "spliced" = nomi salvati (risparmio), "whole" = frase intera (più naturale) */
  namesMode: z.enum(NAMES_MODES).default("spliced"),
  roles: z.object({ professore: roleSchema, regina: roleSchema, palmino: roleSchema, annunciatore: roleSchema }),
});

export interface VoicePanelData {
  configured: boolean;
  config: VoiceConfig;
  envVoices: Record<TtsRole, boolean>;
  models: { pregen: string; live: string };
  /** Modelli v3/v4: audio tag sì, solo stabilità e somiglianza (stile e velocità ignorati). */
  tagModels: { pregen: boolean; live: boolean };
  samples: Record<TtsRole, { text: string; chars: number; cached: boolean }>;
}

function sampleSalt(cfg: VoiceConfig, role: TtsRole): string {
  const r = cfg.roles[role];
  return `sample:${r.stability}:${r.similarity}:${r.style}:${r.speed}`;
}

export async function voicePanelData(): Promise<VoicePanelData> {
  const sql = getSql();
  const config = await loadVoiceConfig(sql);
  const plans = TTS_ROLES.map((r) => planClip(config, { who: r, text: SAMPLE_TEXT[r] }, { sampleSalt: sampleSalt(config, r) }));
  const cached = await cachedKeys(
    sql,
    plans.filter((p) => p !== null).map((p) => p.key),
  );
  const samples = {} as VoicePanelData["samples"];
  TTS_ROLES.forEach((r, i) => {
    samples[r] = { text: SAMPLE_TEXT[r], chars: plans[i]?.chars ?? SAMPLE_TEXT[r].length, cached: !!plans[i] && cached.has(plans[i].key) };
  });
  const envVoices = {} as Record<TtsRole, boolean>;
  for (const r of TTS_ROLES) envVoices[r] = !!envVoiceId(r);
  return { configured: ttsConfigured(), config, envVoices, models: { pregen: modelFor(false), live: modelFor(true) }, tagModels: { pregen: modelSupportsTags(modelFor(false)), live: modelSupportsTags(modelFor(true)) }, samples };
}

export async function saveVoiceConfig(raw: unknown, actor: Actor): Promise<VoicePanelData> {
  const d = voiceConfigSchema.parse(raw);
  const sql = getSql();
  await sql.begin(async (tx) => {
    await tx`
      insert into application_settings (key, value, description, updated_by, updated_at)
      values ('voices', ${tx.json(d)}, 'Voci ElevenLabs dei presentatori e budget mensile di caratteri', ${actor.userId}, now())
      on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`;
    await audit(tx, actor, "voices.update", { type: "settings", details: { monthlyBudgetChars: d.monthlyBudgetChars, namesMode: d.namesMode, voices: Object.fromEntries(TTS_ROLES.map((r) => [r, d.roles[r].voiceId])) } });
  });
  invalidateVoiceConfig();
  return voicePanelData();
}

/** Genera (o recupera dalla cache) la frase di prova di un ruolo. */
export async function generateSample(role: TtsRole): Promise<{ url: string; chars: number; billedChars: number; cached: boolean; text: string }> {
  const sql = getSql();
  const cfg = await loadVoiceConfig(sql);
  const plan = planClip(cfg, { who: role, text: SAMPLE_TEXT[role] }, { sampleSalt: sampleSalt(cfg, role) });
  if (!plan) throw new TtsError("TTS_NO_VOICE", "Nessuna voce assegnata a questo ruolo");
  const clip = await ensureClip(sql, plan, "sample", cfg);
  return { url: await signedClipUrl(clip.path, 600), chars: plan.chars, billedChars: clip.billedChars, cached: clip.cached, text: plan.text };
}

export async function usageData() {
  const app = await appUsage(getSql());
  const names = await namesArchiveStats(getSql());
  let subscription: Awaited<ReturnType<typeof subscriptionInfo>> | null = null;
  let subscriptionError: string | null = null;
  if (ttsConfigured()) {
    try {
      subscription = await subscriptionInfo();
    } catch (e) {
      subscriptionError = e instanceof Error ? e.message : "Abbonamento non disponibile";
    }
  } else subscriptionError = "ELEVENLABS_API_KEY non configurata";
  return { app, names, subscription, subscriptionError };
}
