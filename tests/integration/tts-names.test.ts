import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getSql } from "@/lib/database/db";
import { createSession } from "@/lib/server/cms/sessions";
import { parseMp3 } from "@/lib/server/mp3";
import { downloadClip, planClip, planPart, TtsError, type VoiceConfig } from "@/lib/server/tts";
import { ensureLineClip, namesArchiveStats, prewarmNameClips, sessionSpeechNames } from "@/lib/server/tts-names";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cleanupSession, TEST_ACTOR } from "../support/fixtures";

/**
 * "Nomi salvati" con ElevenLabs SIMULATO: fetch verso api.elevenlabs.io è intercettato
 * (mai una chiamata vera), il resto (database e storage locali) è reale.
 * Voci finte "test-nomi-…": chiavi di cache mai condivise con le clip vere.
 */
const sql = getSql();
const FIXTURES = path.resolve(import.meta.dirname, "../fixtures/audio");
const TONE = readFileSync(path.join(FIXTURES, "tone-440.mp3"));
const run = randomUUID().slice(0, 6);
const VOICE_PREFIX = `test-nomi-${run}`;
// nomi inventati (solo lettere: niente collisioni con parole del copione)
const rnd = () =>
  Array.from({ length: 5 }, () => "bcdfglmnprstvz"[Math.floor(Math.random() * 14)] + "aeiou"[Math.floor(Math.random() * 5)])
    .join("")
    .replace(/^./, (c) => c.toUpperCase());
const GIGI = rnd();
const ANNA = rnd();
const CARLA = rnd();

let sessionId: string;
let cfg: VoiceConfig;
let synthesized: string[] = [];
/** contesto inviato per ogni testo (previous_text / next_text) */
let contexts = new Map<string, { previous?: string; next?: string }>();
/** testi inviati a ElevenLabs (le parti si generano in parallelo: ordine qualsiasi) */
const sent = () => [...synthesized].sort();
let realFetch: typeof fetch;
let realKey: string | undefined;

function config(over: Partial<VoiceConfig> = {}): VoiceConfig {
  const role = (r: string) => ({ voiceId: `${VOICE_PREFIX}-${r}`, voiceName: null, stability: 0.5, similarity: 0.8, style: 0.3, speed: 1 });
  return {
    monthlyBudgetChars: 10_000_000,
    namesMode: "spliced",
    roles: { professore: role("professore"), regina: role("regina"), palmino: role("palmino"), annunciatore: role("annunciatore") },
    ...over,
  };
}

async function clipRow(key: string) {
  const [r] = await sql<{ source: string; billed_chars: number; saved_chars: number; storage_path: string }[]>`
    select source, billed_chars, saved_chars, storage_path from tts_clips where cache_key = ${key}`;
  return r ?? null;
}

beforeAll(async () => {
  realKey = process.env.ELEVENLABS_API_KEY;
  process.env.ELEVENLABS_API_KEY = "test-chiave-finta"; // anche se il mock fallisse, nessuna chiamata vera andrebbe a buon fine
  realFetch = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith("https://api.elevenlabs.io")) return realFetch(input, init);
    const body = JSON.parse(String(init?.body)) as { text: string; previous_text?: string; next_text?: string };
    // "NOCTX": modello che rifiuta il contesto (si deve riprovare senza)
    if (body.text.includes("NOCTX") && (body.previous_text || body.next_text)) {
      return new Response(JSON.stringify({ detail: "next_text is not supported for this model" }), { status: 400 });
    }
    synthesized.push(body.text);
    contexts.set(body.text, { previous: body.previous_text, next: body.next_text });
    // "ROTTO": risposta non mp3 (per provare il ritorno alla frase intera)
    const audio = body.text.includes("ROTTO") ? Buffer.from("questo non è un mp3") : TONE;
    return new Response(new Uint8Array(audio), { status: 200, headers: { "Content-Type": "audio/mpeg", "character-cost": String(body.text.length) } });
  });

  sessionId = await createSession({ title: `Test nomi ${run}`, isTest: true, settings: {} }, TEST_ACTOR);
  for (const nick of [GIGI, ANNA, CARLA]) {
    await sql`insert into participants (session_id, nickname, nickname_key, token_hash)
              values (${sessionId}, ${nick}, ${nick.toLowerCase()}, ${"test:" + randomUUID()})`;
  }
  cfg = config();
});

afterEach(() => {
  synthesized = [];
  contexts = new Map();
});

afterAll(async () => {
  vi.restoreAllMocks();
  process.env.ELEVENLABS_API_KEY = realKey;
  const rows = await sql<{ storage_path: string }[]>`delete from tts_clips where voice_id like ${VOICE_PREFIX + "%"} returning storage_path`;
  if (rows.length) await getSupabaseAdmin().storage.from("tts").remove(rows.map((r) => r.storage_path));
  if (sessionId) await cleanupSession(sessionId);
});

describe("nomi salvati (ElevenLabs simulato)", () => {
  it("nomi della serata: nickname dei giocatori", async () => {
    expect((await sessionSpeechNames(sql, sessionId)).sort()).toEqual([GIGI, ANNA, CARLA].sort());
  });

  it("prima battuta: genera le parti, le unisce e salva la frase intera come 'spliced'", async () => {
    const line = { who: "professore" as const, text: `[sarcastic] ${GIGI}, il suo regno è durato meno di un gelato ad agosto. Ora comanda ${ANNA}.`, live: true };
    const clip = await ensureLineClip(sql, cfg, line, { sessionId });
    expect(sent()).toEqual([`${GIGI},`, "[sarcastic] il suo regno è durato meno di un gelato ad agosto. Ora comanda", `${ANNA}.`].sort());
    expect(clip.cached).toBe(false);
    expect(clip.billedChars).toBe(synthesized.reduce((a, t) => a + t.length, 0));
    // ogni parte conosce il resto della frase (intonazione), senza audio tag
    expect(contexts.get(`${GIGI},`)).toEqual({ next: `il suo regno è durato meno di un gelato ad agosto. Ora comanda ${ANNA}.` });
    expect(contexts.get(`${ANNA}.`)).toEqual({ previous: `${GIGI}, il suo regno è durato meno di un gelato ad agosto. Ora comanda` });

    const whole = planClip(cfg, line)!;
    expect(clip.key).toBe(whole.key);
    const row = await clipRow(whole.key);
    expect(row?.source).toBe("spliced");
    expect(row?.billed_chars).toBe(0); // si pagano le parti, non la frase composta
    // le parti sono in archivio con il loro costo
    const namePart = planPart(cfg, "professore", `${GIGI},`, "name")!;
    expect((await clipRow(namePart.key))?.source).toBe("name");
    expect((await clipRow(namePart.key))?.billed_chars).toBe(`${GIGI},`.length);

    // l'mp3 unito è valido: tre toni, senza tag né frame Info
    const audio = await downloadClip(row!.storage_path);
    const p = parseMp3(audio);
    expect(p.hadInfoFrame).toBe(false);
    expect(p.id3Bytes).toBe(0);
    expect(p.frames.length).toBeGreaterThan(2 * parseMp3(TONE).frames.length);
  });

  it("stessa battuta: hit di cache, nessuna chiamata", async () => {
    const line = { who: "professore" as const, text: `[sarcastic] ${GIGI}, il suo regno è durato meno di un gelato ad agosto. Ora comanda ${ANNA}.`, live: true };
    const clip = await ensureLineClip(sql, cfg, line, { sessionId });
    expect(clip.cached).toBe(true);
    expect(synthesized).toEqual([]);
  });

  it("nome già in archivio in un'altra frase: si generano solo le parti fisse nuove", async () => {
    const line = { who: "professore" as const, text: `Applausi per ${GIGI}, il più veloce della serata!`, live: true };
    await ensureLineClip(sql, cfg, line, { sessionId });
    expect(sent()).toEqual(["Applausi per", "il più veloce della serata!"]);
  });

  it("stessa frase con un altro giocatore: si genera solo il nome", async () => {
    const line = { who: "professore" as const, text: `Applausi per ${CARLA}, il più veloce della serata!`, live: true };
    const clip = await ensureLineClip(sql, cfg, line, { sessionId });
    expect(synthesized).toEqual([`${CARLA},`]);
    const row = await clipRow(clip.key);
    expect(row?.saved_chars).toBe(planClip(cfg, line)!.chars - `${CARLA},`.length);
    const stats = await namesArchiveStats(sql);
    expect(stats.spliced).toBeGreaterThanOrEqual(3);
    expect(stats.savedChars).toBeGreaterThanOrEqual(row!.saved_chars);
  });

  it("modalità frase intera, battute non live o senza serata: come prima", async () => {
    const text = `Ora comanda ${ANNA}, la regina della serata di oggi!`;
    await ensureLineClip(sql, config({ namesMode: "whole" }), { who: "regina", text, live: true }, { sessionId });
    expect(synthesized).toEqual([text]);
    synthesized = [];
    const other = `Ora comanda ${GIGI}, il re della serata di oggi!`;
    await ensureLineClip(sql, cfg, { who: "regina", text: other, live: true }, {});
    expect(synthesized).toEqual([other]);
    expect((await clipRow(planClip(cfg, { who: "regina", text: other, live: true })!.key))?.source).toBe("live");
    synthesized = [];
    // la modalità forzata dal chiamante (futura "Gioca ora") vince sull'impostazione
    const forced = `Ora comanda ${CARLA}, la più brava della serata!`;
    await ensureLineClip(sql, config({ namesMode: "whole" }), { who: "regina", text: forced, live: true }, { sessionId, namesMode: "spliced" });
    expect(sent()).toEqual(["Ora comanda", `${CARLA},`, "la più brava della serata!"].sort());
  });

  it("se l'unione fallisce si genera la frase intera (la voce non si rompe)", async () => {
    const line = { who: "palmino" as const, text: `[giggles] ${GIGI} ha la risposta ROTTO in tasca, che fortuna sfacciata!`, live: true };
    const clip = await ensureLineClip(sql, cfg, line, { sessionId });
    expect(synthesized.at(-1)).toBe(planClip(cfg, line)!.text);
    expect((await clipRow(clip.key))?.source).toBe("live");
  });

  it("modello che non accetta il contesto: si riprova senza", async () => {
    const line = { who: "regina" as const, text: `Brindiamo a ${ANNA}, la NOCTX regina della serata!`, live: true };
    const clip = await ensureLineClip(sql, cfg, line, { sessionId });
    expect((await clipRow(clip.key))?.source).toBe("spliced");
    expect(contexts.get("la NOCTX regina della serata!")).toEqual({ previous: undefined, next: undefined });
  });

  it("budget esaurito: TTS_BUDGET come prima", async () => {
    const line = { who: "palmino" as const, text: `${ANNA} vola in testa alla classifica, che spettacolo ragazzi!`, live: true };
    await expect(ensureLineClip(sql, config({ monthlyBudgetChars: 0 }), line, { sessionId })).rejects.toSatisfy((e) => e instanceof TtsError && e.code === "TTS_BUDGET");
    expect(synthesized).toEqual([]);
  });

  it("all'ingresso: varianti del nome per i tre presentatori, una volta sola", async () => {
    const nick = rnd();
    const first = await prewarmNameClips(sql, cfg, nick);
    expect(first.generated).toBe(12);
    expect(new Set(synthesized)).toEqual(new Set([nick, `${nick},`, `${nick}!`, `${nick}.`]));
    expect(contexts.get(`${nick},`)?.next).toBeTruthy(); // contesto generico per l'intonazione
    synthesized = [];
    expect((await prewarmNameClips(sql, cfg, nick)).generated).toBe(0);
    expect(synthesized).toEqual([]);
    expect((await prewarmNameClips(sql, config({ namesMode: "whole" }), rnd())).generated).toBe(0);
  });
});
