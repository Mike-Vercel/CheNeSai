"use client";

import { getSoundEngine } from "@/features/media/audio-engine";
import { getAudioPrefs } from "./audio-prefs";
import { remainingMs } from "@/lib/psyco/logic";
import type { PsycoPublicState } from "@/lib/psyco/types";

/**
 * NARRATORE DI PSYCO – voce propria del gioco (registrata dall'utente, NON ElevenLabs).
 *
 * File: public/audio/psyco/<id>.mp3 (copiati da REFERENCE/AUDIO/PSYCO con `npm run psyco:voci`).
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
} as const;
export type VoiceId = keyof typeof VOICE_LINES;
export const VOICE_IDS = Object.keys(VOICE_LINES) as VoiceId[];

export const voiceUrl = (id: VoiceId) => `/audio/psyco/${id}.mp3`;

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

class Narrator {
  private queue: VoiceId[] = [];
  private playing = false;
  private listeners = new Set<CaptionListener>();
  private missing = new Set<VoiceId>();

  onCaption(fn: CaptionListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private caption(t: string | null) {
    for (const l of this.listeners) l(t);
  }

  /** Precarica i clip (in sottofondo, senza errori se mancano). */
  preload(ids: VoiceId[] = VOICE_IDS) {
    const engine = getSoundEngine();
    for (const id of ids) void engine.loadBuffer(voiceUrl(id)).then((b) => !b && this.missing.add(id));
  }

  say(ids: VoiceId[]) {
    if (ids.length === 0) return;
    // al massimo pochi clip in attesa: se il gioco corre più veloce della voce, si saltano i vecchi
    this.queue.push(...ids);
    if (this.queue.length > 4) this.queue = this.queue.slice(-4);
    if (!this.playing) void this.next();
  }

  stop() {
    this.queue = [];
    this.caption(null);
  }

  private async next() {
    const id = this.queue.shift();
    if (!id) {
      this.playing = false;
      this.caption(null);
      return;
    }
    this.playing = true;
    this.caption(VOICE_LINES[id]);
    const minShow = new Promise((r) => setTimeout(r, Math.min(3200, 900 + VOICE_LINES[id].length * 35)));
    let spoken: Promise<void> | null = null;
    if (voiceEnabled() && !this.missing.has(id)) {
      try {
        const engine = getSoundEngine();
        const buf = await Promise.race([engine.loadBuffer(voiceUrl(id)), new Promise<null>((r) => setTimeout(() => r(null), 1500))]);
        if (buf) spoken = engine.playVoiceClip(buf);
        else this.missing.add(id);
      } catch {
        this.missing.add(id);
      }
    }
    // mai bloccati: un clip lunghissimo o rotto non ferma la coda oltre 12 s
    await Promise.race([Promise.all([spoken ?? Promise.resolve(), minShow]), new Promise((r) => setTimeout(r, 12_000))]);
    void this.next();
  }
}

let narrator: Narrator | null = null;
export function getNarrator(): Narrator {
  if (!narrator) narrator = new Narrator();
  return narrator;
}
