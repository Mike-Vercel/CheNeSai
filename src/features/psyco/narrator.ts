"use client";

import { getSoundEngine } from "@/features/media/audio-engine";
import { getAudioPrefs } from "./audio-prefs";
import { remainingMs } from "@/lib/psyco/logic";
import type { PsycoPublicState } from "@/lib/psyco/types";

/**
 * NARRATORE DI PSYCO – voce propria del gioco (l'Investigatore: «Gottfried - Dark Thriller & Crime»).
 *
 * File: public/audio/psyco/<id>.mp3 (copiati da REFERENCE/GIOCHI/PSYCO/AUDIO/NARRATORE con `npm run psyco:voci`;
 * le battute della CHIAMATA e «tocca-al-prossimo» si generano con `npm run psyco:voci -- --genera`).
 * Se un file manca o non si carica: nessun errore, nessun blocco, si mostra solo il sottotitolo.
 * Il narratore NON comanda mai il gioco: lo stato del server avanza senza aspettare i clip.
 *
 * Dove parla (niente doppioni rumorosi nella stessa stanza):
 *  - schermo TV/PC pubblico: sempre (dopo «Attiva audio»);
 *  - dispositivo condiviso: sempre;
 *  - telefoni personali: SOLO il telefono di chi gestisce la partita, e solo se nessuno schermo TV
 *    è collegato (state.displayOnline = false). Gli altri telefoni non parlano.
 * Muto: il pannello Audio di PSYCO (tutto, musica, voce, effetti, volume).
 *
 * Mappa id → testo (sottotitolo) e momento: QUI, in un solo posto. Documentata in docs/psyco/VOCI.md.
 */
export const VOICE_LINES = {
  benvenuti: "Benvenuti a PSYCO. Tutti conoscono la regola… tranne uno.",
  "lobby-attesa": "Entrate pure. Più siete, più sarà difficile.",
  "minimo-giocatori": "Servono almeno tre giocatori per cominciare.",
  "ruoli-assegnati": "I ruoli sono stati assegnati. Uno di voi è lo Psyco.",
  "passa-telefono": "Passa il telefono al prossimo giocatore. Senza sbirciare.",
  "guarda-ruolo": "Guarda il tuo ruolo. E non farti vedere.",
  "tutti-visto": "Tutti conoscono il proprio ruolo. Si comincia.",
  "psyco-non-guardare": "Psyco, non guardare. Gli altri stanno scegliendo la regola.",
  "scegliete-difficolta": "Scegliete la difficoltà della regola.",
  "votate-regola": "Leggete la regola e votate. Vi piace?",
  "nuova-regola": "Non vi convince? Eccone un'altra.",
  "scrivete-regole": "Scrivete la vostra regola. Più è subdola, meglio è.",
  "votate-proposte": "Votate la regola migliore.",
  spareggio: "Parità. Si vota di nuovo.",
  "regola-scelta": "La regola è stata scelta. Psyco, preparati a scoprirla.",
  pronti: "Tutti pronti?",
  countdown: "Tre… due… uno…",
  via: "Via! Psyco, fai le tue domande.",
  "senza-tempo": "Nessun limite di tempo. Prenditi tutto il tempo che serve… se ci riesci.",
  pausa: "Pausa.",
  ripresa: "Si riprende.",
  "un-minuto": "Manca un minuto.",
  "trenta-secondi": "Trenta secondi.",
  "dieci-secondi": "Dieci secondi…",
  "ho-capito": "Lo Psyco crede di aver capito. Silenzio… ascoltiamolo.",
  "votate-risposta": "Ha indovinato? Votate.",
  "risposta-giusta": "Esatto. Lo Psyco ha scoperto la regola!",
  "risposta-sbagliata": "Sbagliato. Si continua.",
  "tempo-scaduto": "Tempo scaduto! La regola resta un mistero… per lui.",
  "ecco-la-regola": "Ecco qual era la regola.",
  "vince-psyco": "Vince lo Psyco!",
  "vince-gruppo": "Vince il gruppo!",
  "nuova-manche": "Nuova manche. Nuovo Psyco. Nuova regola.",
  "fine-partita": "Fine della partita. Grazie per aver giocato a PSYCO.",
  // un solo dispositivo su PC/tablet (lo schermo non si passa di mano: si cambia chi lo guarda)
  "tocca-al-prossimo": "Tocca al prossimo giocatore. Gli altri… non guardate lo schermo.",
  // «CHIAMA L'INVESTIGATORE»: la voce al telefono dello PSYCO (mai l'indizio: quello arriva per messaggio)
  "investigatore-1": "Pronto? …Sì, sono io. Non posso parlare a lungo. Ti ho mandato un messaggio. Leggilo… e non farti vedere.",
  "investigatore-2": "Ascolta bene, Psyco. Le risposte non mentono mai… ma vanno lette. Ti ho scritto tutto.",
  "investigatore-3": "Non dire il mio nome ad alta voce. Controlla i messaggi: lì c'è quello che ti serve.",
  "investigatore-4": "Ho seguito la pista per te. Non è molto… ma è qualcosa. Ti ho appena scritto.",
  "investigatore-5": "Sono io. Niente domande. Ti ho mandato un messaggio: leggilo, prima che sia tardi.",
  "investigatore-fine": "Era l'ultima volta che rispondo. Da qui in poi… sei solo.",
} as const;
export type VoiceId = keyof typeof VOICE_LINES;
export const VOICE_IDS = Object.keys(VOICE_LINES) as VoiceId[];

export const voiceUrl = (id: VoiceId) => `/audio/psyco/${id}.mp3`;

/** Varianti della risposta dell'Investigatore al telefono (una a caso per chiamata). */
export const CALL_VOICES: VoiceId[] = ["investigatore-1", "investigatore-2", "investigatore-3", "investigatore-4", "investigatore-5"];
/** Clip che non partono mai da soli (li chiede la chiamata o il dispositivo condiviso): niente precaricamento ovunque. */
const ON_DEMAND = new Set<VoiceId>([...CALL_VOICES, "investigatore-fine", "tocca-al-prossimo"]);

/** Avvisi del timer: secondi rimasti → clip (solo se la durata totale li supera, mai durante la verifica). */
export const TIMER_WARNINGS: { atMs: number; id: VoiceId }[] = [
  { atMs: 60_000, id: "un-minuto" },
  { atMs: 30_000, id: "trenta-secondi" },
  { atMs: 10_000, id: "dieci-secondi" },
];

/**
 * Momenti del gioco → clip, dal confronto tra lo stato pubblico precedente e il nuovo.
 * Pura (testata in tests/unit/psyco-narrator.test.ts). `mode` cambia solo i momenti del passaggio del telefono.
 */
export function cuesFor(prev: PsycoPublicState | null, next: PsycoPublicState): VoiceId[] {
  if (!prev) return next.phase === "LOBBY" && next.status === "open" ? ["benvenuti", "lobby-attesa"] : [];
  if (prev.roomId !== next.roomId) return [];
  if (prev.status === "open" && next.status === "closed") return ["fine-partita"];
  const out: VoiceId[] = [];
  const pr = prev.round;
  const nr = next.round;
  const newEvent = next.event && next.event.at !== prev.event?.at ? next.event : null;
  const phaseChanged = prev.phase !== next.phase || pr?.no !== nr?.no;

  if (phaseChanged) {
    switch (next.phase) {
      case "ROLE_REVEAL":
        if ((nr?.no ?? 1) > 1) out.push("nuova-manche");
        out.push("ruoli-assegnati");
        break;
      case "DIFFICULTY_VOTE":
        if (prev.phase === "ROLE_REVEAL") out.push("tutti-visto", "psyco-non-guardare");
        out.push("scegliete-difficolta");
        break;
      case "RULE_PROPOSALS":
        if (prev.phase === "ROLE_REVEAL") out.push("tutti-visto", "psyco-non-guardare");
        if (prev.phase !== "RULE_PROPOSALS") out.push("scrivete-regole");
        break;
      case "RULE_VOTE":
        out.push("votate-regola");
        break;
      case "PROPOSAL_VOTE":
        out.push("votate-proposte");
        break;
      case "RULE_CONFIRMED":
        out.push("regola-scelta", "pronti");
        break;
      case "PLAYING":
        if (prev.phase === "RULE_CONFIRMED") out.push("countdown");
        else if (prev.phase === "GUESS_VOTE" && newEvent?.kind === "guess_wrong") out.push("risposta-sbagliata");
        break;
      case "GUESS_VOTE":
        out.push("ho-capito", "votate-risposta");
        break;
      case "ROUND_END": {
        const o = nr?.outcome;
        if (o === "guessed") out.push("risposta-giusta", "ecco-la-regola", "vince-psyco");
        else if (o === "time_up") out.push("tempo-scaduto", "ecco-la-regola", "vince-gruppo");
        else out.push("ecco-la-regola");
        break;
      }
    }
    return out;
  }

  // stessa fase: nuova regola proposta, spareggio, pausa/ripresa
  if (next.phase === "RULE_VOTE" && (nr?.candidatesShown ?? 0) > (pr?.candidatesShown ?? 0)) out.push("nuova-regola");
  if (newEvent?.kind === "runoff") out.push("spareggio");
  if (next.phase === "PLAYING" && pr && nr) {
    if (!pr.timer.pausedAt && nr.timer.pausedAt) out.push("pausa");
    if (pr.timer.pausedAt && !nr.timer.pausedAt) out.push("ripresa");
  }
  return out;
}

/** Clip da dire al via (dopo il conto alla rovescia). */
export function startCues(state: PsycoPublicState): VoiceId[] {
  return state.round?.timer.totalMs === null ? ["via", "senza-tempo"] : ["via"];
}

/** Avviso del timer da dire adesso (o null), dato l'ultimo già detto. */
export function timerWarning(state: PsycoPublicState, nowMs: number, said: Set<string>): VoiceId | null {
  const r = state.round;
  if (state.phase !== "PLAYING" || !r || r.timer.totalMs === null || r.timer.pausedAt || !r.timer.startedAt) return null;
  if (Date.parse(r.timer.startedAt) > nowMs) return null;
  const left = remainingMs(r.timer, nowMs);
  if (left === null || left <= 0) return null;
  for (const w of TIMER_WARNINGS) {
    const key = `${r.no}:${w.id}`;
    if (r.timer.totalMs > w.atMs && left <= w.atMs && left > w.atMs - 4000 && !said.has(key)) {
      said.add(key);
      return w.id;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Riproduzione in coda (un clip alla volta), con sottotitoli
// ---------------------------------------------------------------------------
type CaptionListener = (text: string | null) => void;

export function voiceEnabled(): boolean {
  return getAudioPrefs().voice;
}

/** Stato del narratore: per i sottotitoli e per il personaggio (PsycoNarratorSlot, poi il modello 3D). */
export interface NarratorState {
  /** true mentre un clip è in riproduzione (o il sottotitolo è a schermo se il clip manca) */
  speaking: boolean;
  /** true solo se l'audio sta davvero suonando (clip caricato, audio sbloccato, non muto) */
  audible: boolean;
  id: VoiceId | null;
  text: string | null;
}
type StateListener = (s: NarratorState) => void;

class Narrator {
  private queue: VoiceId[] = [];
  /** frasi che passano davanti a tutto (la voce dell'Investigatore al telefono), con chi aspetta la fine */
  private priority: { id: VoiceId; done: () => void }[] = [];
  /** chiamata in corso: le frasi normali aspettano in coda (il narratore non parla sopra la chiamata) */
  private held = false;
  private playing = false;
  private listeners = new Set<CaptionListener>();
  private stateListeners = new Set<StateListener>();
  private missing = new Set<VoiceId>();
  private analyser: AnalyserNode | null = null;
  state: NarratorState = { speaking: false, audible: false, id: null, text: null };

  onCaption(fn: CaptionListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  /** Stato del narratore (parla / tace, clip, testo). Chiamato subito con lo stato attuale. */
  onState(fn: StateListener): () => void {
    this.stateListeners.add(fn);
    fn(this.state);
    return () => this.stateListeners.delete(fn);
  }
  private setState(s: NarratorState) {
    this.state = s;
    for (const l of this.listeners) l(s.text);
    for (const l of this.stateListeners) l(s);
  }

  /**
   * AnalyserNode collegato alla voce del narratore (per il lip sync del personaggio 3D, come gli
   * analyser dei presentatori). null finché l'audio non è stato sbloccato.
   */
  getAnalyser(): AnalyserNode | null {
    if (this.analyser) return this.analyser;
    const ctx = getSoundEngine().context;
    if (!ctx) return null;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.6;
    return this.analyser;
  }

  /** Precarica i clip (in sottofondo, senza errori se mancano). */
  preload(ids: VoiceId[] = VOICE_IDS.filter((id) => !ON_DEMAND.has(id))) {
    const engine = getSoundEngine();
    for (const id of ids) void engine.loadBuffer(voiceUrl(id)).then((b) => !b && this.missing.add(id));
  }

  /** `replace`: nuova fase del gioco → si scartano le frasi vecchie ancora in coda (quella in corso finisce). */
  say(ids: VoiceId[], replace = false) {
    if (ids.length === 0) return;
    if (replace) this.queue = [];
    // al massimo pochi clip in attesa: se il gioco corre più veloce della voce, si saltano i vecchi
    this.queue.push(...ids);
    if (this.queue.length > 4) this.queue = this.queue.slice(-4);
    if (!this.playing) void this.next();
  }

  stop() {
    this.queue = [];
    for (const p of this.priority.splice(0)) p.done();
    this.setState({ speaking: false, audible: false, id: null, text: null });
  }

  /**
   * Chiamata dell'Investigatore: `hold(true)` = il narratore non comincia nuove frasi (quella in corso
   * finisce, le nuove aspettano in coda); `hold(false)` = riprende, solo con le frasi più recenti.
   */
  hold(on: boolean) {
    if (this.held === on) return;
    this.held = on;
    if (!on) {
      this.queue = this.queue.slice(-2);
      if (!this.playing) void this.next();
    }
  }

  /** Frase che passa davanti alla coda (anche durante `hold`): risolve quando è finita (o saltata). */
  sayNow(id: VoiceId): Promise<void> {
    return new Promise((done) => {
      this.priority.push({ id, done });
      if (!this.playing) void this.next();
    });
  }

  private async next() {
    const first = this.priority.shift();
    const id = first?.id ?? (this.held ? undefined : this.queue.shift());
    if (!id) {
      this.playing = false;
      this.setState({ speaking: false, audible: false, id: null, text: null });
      return;
    }
    this.playing = true;
    const minShow = new Promise((r) => setTimeout(r, Math.min(3200, 900 + VOICE_LINES[id].length * 35)));
    let spoken: Promise<void> | null = null;
    if (voiceEnabled() && !this.missing.has(id)) {
      try {
        const engine = getSoundEngine();
        const buf = await Promise.race([engine.loadBuffer(voiceUrl(id)), new Promise<null>((r) => setTimeout(() => r(null), 1500))]);
        if (buf) spoken = engine.playVoiceClip(buf, 1, this.getAnalyser());
        else this.missing.add(id);
      } catch {
        this.missing.add(id);
      }
    }
    this.setState({ speaking: true, audible: !!spoken, id, text: VOICE_LINES[id] });
    // mai bloccati: un clip lunghissimo o rotto non ferma la coda oltre 12 s
    await Promise.race([Promise.all([spoken ?? Promise.resolve(), minShow]), new Promise((r) => setTimeout(r, 12_000))]);
    first?.done();
    void this.next();
  }
}

let narrator: Narrator | null = null;
export function getNarrator(): Narrator {
  if (!narrator) narrator = new Narrator();
  return narrator;
}
