/**
 * Regista automatico: dagli eventi reali sceglie SE far parlare i presentatori, CHI e con
 * QUALE battuta, poi inserisce i nomi veri. Puro e deterministico (stesso seme → stessa scelta),
 * così il TV che ricarica e il pre-riscaldamento delle voci sul server ottengono le stesse frasi.
 *
 * - Eventi in ordine di importanza; al massimo `maxLines` battute per momento.
 * - Personaggi diversi per battute consecutive (piccolo dialogo), scelti dal peso delle battute.
 * - Battibecco: con probabilità `banterPercent` un altro presentatore risponde alla prima battuta
 *   (battute `RETORT_<chi>`, attivabili/disattivabili come gli altri eventi).
 * - Ogni battuta ha il suo cooldown; niente battute già usate di recente nella serata.
 * - Un concorrente non viene nominato più di N volte per round; mai due volte nello stesso momento.
 * - I segnaposto vengono risolti solo con dati del server; segnaposto sconosciuti → battuta scartata.
 */
import type { Presenter } from "@/lib/game-engine/types";
import { cleanSpeech } from "@/features/game/script";
import { NO_MOMENT, type MomentContext } from "@/features/game/moment";
import { eventPlayers, eventTeams } from "./events";
import { candidateLines, libraryCandidates, renderTemplate, SCENE_GAP_MS, voiceOptionsOf, type LibraryCandidate, type LineContext, type RenderedLine } from "./library";
import {
  ALLOWED_PLACEHOLDERS,
  EVENT_PRIORITY,
  isRetortEvent,
  retortEventFor,
  type DialogueTemplate,
  type DirectorConfig,
  type PlayerRef,
  type ShowEvent,
  type ShowLine,
} from "./types";

export interface DirectorHistory {
  /** ultimo utilizzo (ms epoch) di ogni battuta nella serata */
  lastUsed: Map<string, number>;
  /** menzioni per concorrente nel round corrente */
  mentionsThisRound: Map<string, number>;
}

export interface DirectInput {
  events: ShowEvent[];
  templates: DialogueTemplate[];
  history: DirectorHistory;
  config: DirectorConfig;
  nowMs: number;
  /** seme stabile (es. id della domanda) */
  seed: string;
  /**
   * Ultima domanda del round/della serata: si scartano le battute che parlano della "prossima"
   * domanda (e, sull'ultima della serata, quelle che danno per scontato che si continui).
   */
  moment?: MomentContext;
  /** condizioni delle battute della libreria (modalità squadre, timer, difficoltà…) */
  ctx?: LineContext;
  /** battute dette nelle ultime serate dello stesso host (peso ridotto) */
  elsewhere?: ReadonlySet<string>;
  /** ultima scenetta della serata (ms): fra due scenette passa almeno SCENE_GAP_MS */
  lastSceneMs?: number | null;
}

const PLACEHOLDER = /\{([a-z_]+)\}/g;

/** Segnaposto usati in un testo. */
export function placeholdersIn(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[1]);
}

/** Errori di validazione di una battuta (vuoto = valida). */
export function validateTemplate(t: Pick<DialogueTemplate, "event" | "text">): string[] {
  const allowed = ALLOWED_PLACEHOLDERS[t.event];
  if (!allowed) return [`evento sconosciuto: ${t.event}`];
  const errors: string[] = [];
  for (const p of placeholdersIn(t.text)) if (!allowed.includes(p)) errors.push(`segnaposto non ammesso per ${t.event}: {${p}}`);
  if (/[<>]/.test(t.text)) errors.push("caratteri non ammessi (< >)");
  if (t.text.trim().length < 3 || t.text.length > 300) errors.push("lunghezza non valida");
  return errors;
}

/** "Vodka", "Vodka e Gigi", "Vodka, Gigi e Lalla"; con `others` > 0: "Vodka, Gigi e altri 3". */
export const names = (list: { nickname: string }[], others = 0) => {
  const n = list.map((x) => cleanSpeech(x.nickname)).filter((x) => x.length > 0);
  if (others > 0 && n.length > 0) return `${n.join(", ")} e ${others === 1 ? "un altro" : `altri ${others}`}`;
  return n.length <= 1 ? (n[0] ?? "") : `${n.slice(0, -1).join(", ")} e ${n[n.length - 1]}`;
};
const teamNames = (list: { name: string }[]) => names(list.map((t) => ({ nickname: t.name })));
const secondsIt = (ms: number) => (Math.round(ms / 100) / 10).toFixed(1).replace(".", ",");

/** Valori dei segnaposto per un evento (solo dati confermati dal server). */
export function placeholderValues(e: ShowEvent): Record<string, string> {
  switch (e.type) {
    case "LEADER_CHANGED":
      return {
        nome_primo: names([e.leader]),
        nome_nuovo_primo: names([e.leader]),
        nome_ex_primo: names([e.previous]),
        nome_primo_precedente: names([e.previous]),
        punti_primo: String(e.points),
      };
    case "LEADER_TIE":
      return { nomi_primi: names(e.leaders), punti_primo: String(e.points) };
    case "LEADER_KEPT":
      return { nome_primo: names([e.leader]), domande: String(e.questions) };
    case "OVERTAKE":
      return { nome_sorpasso: names([e.who]), nome_superato: names([e.overtaken]) };
    case "COMEBACK":
      return { nome: names([e.who]), nome_rimonta: names([e.who]), posizioni: String(e.positions) };
    case "NEW_LAST":
      return { nome_ultimo: names([e.who]) };
    case "FASTEST_CORRECT":
      return { nome: names([e.who]), nome_piu_veloce: names([e.who]), secondi: secondsIt(e.ms) };
    case "CORRECT_STREAK":
    case "WRONG_STREAK":
      return { nome: names([e.who]), serie: String(e.streak) };
    case "ONLY_ONE_CORRECT":
      return { nome: names([e.who]), nome_risposta_corretta: names([e.who]) };
    case "ONLY_ONE_WRONG":
      return { nome: names([e.who]), nome_risposta_errata: names([e.who]) };
    case "PLAYER_NO_ANSWER":
    case "NO_ANSWER_LEADER":
    case "NO_ANSWER_LAST":
    case "NO_ANSWER_STREAK":
      return { nome: names([e.who]), nome_giocatore: names([e.who]), serie: String(e.streak) };
    case "TEAM_NO_ANSWER":
      return { nome_squadra: teamNames([e.team]) };
    case "GAME_WINNER":
      return { nome_vincitore: names([{ nickname: e.winner.name }]) };
    case "POINTS_MILESTONE":
      return { nome: names([e.who]), soglia: String(e.threshold) };
    case "ROUND_WINNER":
      return { nome_primo: names(e.leaders), punti_primo: String(e.points) };
    case "PLAYERS_JOINED":
      return { nomi: names(e.named, e.others) };
    case "FINAL_ROUND_START":
      return { nome_primo: names([e.leader]), nome_secondo: names([e.runnerUp]) };
    case "TEAM_LEADER_CHANGED":
      return { nome_squadra: teamNames([e.team]), nome_ex_squadra: teamNames([e.previous]) };
    case "TEAM_ROUND_WINNER":
      return { nome_squadra: teamNames(e.teams), punti_squadra: String(e.points) };
    case "RETORT_PROFESSORE":
    case "RETORT_REGINA":
    case "RETORT_PALMINO":
      return e.about ? { nome: names([e.about]) } : {};
    case "ALL_WRONG":
    case "ALL_CORRECT":
    case "ANSWER_WRONG":
    case "EASY_WRONG":
    case "ANSWER_CORRECT":
    case "LOSE_PATIENCE":
    case "TIME_RUNNING_OUT":
    case "WHEEL_SPIN":
    case "MANY_NO_ANSWER":
    case "FILLER":
    case "LEADERBOARD_QUIP":
    case "GAME_END":
      return {};
  }
}

/**
 * Battuta pronta per l'evento (testo per la voce, testo da mostrare): null se un segnaposto manca o
 * non è ammesso. Le battute curate (libreria ufficiale, pannello) passano da renderTemplate.
 */
export function renderFor(t: DialogueTemplate, e: ShowEvent, config: Pick<DirectorConfig, "palminoAccent">): RenderedLine | null {
  if (t.event !== e.type || validateTemplate(t).length > 0) return null;
  return renderTemplate(t, placeholderValues(e), voiceOptionsOf(config));
}

/** Sostituisce i segnaposto; null se ne manca qualcuno o non è ammesso (battuta scartata). */
export function resolveTemplate(t: Pick<DialogueTemplate, "event" | "text">, e: ShowEvent): string | null {
  if (t.event !== e.type || validateTemplate(t).length > 0) return null;
  const values = placeholderValues(e);
  let missing = false;
  const text = t.text.replace(PLACEHOLDER, (_, k: string) => {
    const v = values[k];
    if (v === undefined || v === "") missing = true;
    return v ?? "";
  });
  return missing ? null : text;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Numero pseudo-casuale stabile in [0, 1). */
function seeded(seed: string): number {
  let t = hash(seed) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function directShow(input: DirectInput): ShowLine[] {
  const { config, history } = input;
  if (!config.enabled || config.maxLines <= 0) return [];
  const allowedEvents = config.events.length ? new Set(config.events) : null;
  const events = input.events
    .filter((e) => !isRetortEvent(e.type))
    .filter((e) => !allowedEvents || allowedEvents.has(e.type))
    .map((e, i) => ({ e, i, prio: EVENT_PRIORITY[e.type] }))
    .sort((a, b) => b.prio - a.prio || a.i - b.i);

  const lines: ShowLine[] = [];
  const mentionedNow = new Set<string>();
  const teamsNow = new Set<string>();
  const usedTemplates = new Set<string>();
  for (const { e } of events) {
    if (lines.length >= config.maxLines) break;
    const players = eventPlayers(e);
    const teams = eventTeams(e);
    // la vittoria del round si annuncia sempre; gli altri eventi rispettano i limiti di menzioni
    const exempt = e.type === "ROUND_WINNER" || e.type === "TEAM_ROUND_WINNER";
    if (players.some((p) => mentionedNow.has(p.id))) continue;
    // una squadra non viene nominata due volte nello stesso momento
    if (teams.some((t) => teamsNow.has(t.id))) continue;
    if (!exempt && players.some((p) => (history.mentionsThisRound.get(p.id) ?? 0) >= config.maxMentionsPerPlayerPerRound)) continue;

    const lastWho: Presenter | null = lines.length ? lines[lines.length - 1].who : null;
    // scenetta: solo come prima cosa del momento (poi il momento finisce lì) e non troppo spesso
    const scenes = lines.length === 0 && (input.lastSceneMs == null || input.nowMs - input.lastSceneMs >= SCENE_GAP_MS);
    const candidates = candidatesFor(input, e, usedTemplates, scenes);
    if (candidates.length === 0) continue;
    // personaggio diverso dalla battuta precedente, se possibile
    const pool = lastWho && candidates.some((c) => c.character !== lastWho) ? candidates.filter((c) => c.character !== lastWho) : candidates;
    const chosen = pickWeighted(pool, `${input.seed}|${e.type}|${lines.length}`);
    const said = candidateLines(chosen, e.type, players.map((p) => p.id), input.seed);
    lines.push(...said);
    for (const l of said) usedTemplates.add(l.templateId);
    for (const p of players) mentionedNow.add(p.id);
    for (const t of teams) teamsNow.add(t.id);
    if (chosen.scene) break;

    // battibecco: dopo la prima battuta un altro presentatore può rispondere (e il momento finisce lì)
    if (lines.length === 1 && lines.length < config.maxLines) {
      const retort = pickRetort(input, chosen.character, players[0] ?? null, usedTemplates, allowedEvents);
      if (retort) {
        lines.push(retort);
        break;
      }
    }
  }
  return lines;
}

type Candidate = LibraryCandidate;

/**
 * Battute utilizzabili per un evento: attive, non già usate ora, fuori cooldown, segnaposto risolti,
 * adatte al momento, al livello di comicità e alle condizioni della libreria (tags).
 */
function candidatesFor(input: DirectInput, e: ShowEvent, usedTemplates: Set<string>, scenes = false): Candidate[] {
  return libraryCandidates({
    templates: input.templates,
    event: e.type,
    render: (t) => renderFor(t, e, input.config),
    comedyLevel: input.config.comedyLevel ?? "irriverente",
    ctx: { ...input.ctx, moment: input.moment ?? input.ctx?.moment ?? NO_MOMENT },
    lastUsed: input.history.lastUsed,
    nowMs: input.nowMs,
    used: usedTemplates,
    allowScenes: scenes,
    elsewhere: input.elsewhere,
  });
}

/** Scelta pesata e deterministica (stesso seme → stessa battuta). */
function pickWeighted(pool: Candidate[], seed: string): Candidate {
  const total = pool.reduce((a, c) => a + c.weight, 0);
  let r = seeded(seed) * total;
  for (const c of pool) {
    r -= c.weight;
    if (r <= 0) return c;
  }
  return pool[pool.length - 1];
}

/**
 * Risposta di un altro presentatore alla battuta di `to` (battibecco), oppure null:
 * dipende da `banterPercent`, dagli eventi abilitati in regia e dalle battute disponibili.
 */
function pickRetort(input: DirectInput, to: Presenter, about: PlayerRef | null, usedTemplates: Set<string>, allowedEvents: Set<string> | null): ShowLine | null {
  const type = retortEventFor(to);
  if (allowedEvents && !allowedEvents.has(type)) return null;
  const chance = Math.min(100, Math.max(0, input.config.banterPercent ?? 0));
  if (chance <= 0 || seeded(`${input.seed}|battibecco`) * 100 >= chance) return null;
  const pool = candidatesFor(input, { type, about }, usedTemplates).filter((c) => c.character !== to);
  if (pool.length === 0) return null;
  const chosen = pickWeighted(pool, `${input.seed}|${type}`);
  usedTemplates.add(chosen.id);
  // il concorrente era già nominato dalla battuta a cui si risponde: niente menzione in più
  return candidateLines(chosen, type, [], input.seed)[0] ?? null;
}
