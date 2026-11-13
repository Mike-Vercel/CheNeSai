import type { LedContent } from "../three/studio/led-texture";
import type { StudioDirection } from "../three/studio/studio-director";

/**
 * COPIONE DELL'INTRO di GIRAMENTE! (pagina «Nuova partita»), puro e testato (tests/unit/giramente-intro.test.ts).
 * Tempi in secondi dall'inizio (dopo il caricamento e, se serve, dopo «▶ INIZIA»):
 *
 *   0,0  buio, parte la sigla; campo lunghissimo dall'alto, la ruota gira da sola
 *   0,3  le luci di sala salgono (fino a 2,6), i fari girano verdi e rossi
 *   0,5  Don Patrizio entra camminando da sinistra verso il centro del palco
 *   2,4  la camera scende verso di lui (carrellata lenta)
 *   4,4  parte il benvenuto (clip registrato, con sottotitolo); a 4,9 arriva al centro e saluta il pubblico
 *   6,6  mezza figura mentre parla
 *  10,0+ finita la voce (al più tardi a 12,4): stacco largo, sul LED si accende GIRAMENTE! (fari, applauso)
 *  +2,3  dissolvenza sulle impostazioni (al più tardi a 14,4 dall'inizio)
 *
 * Versione 2D (niente WebGL vero) e versione ferma (movimento ridotto): stessa voce, tempi più corti.
 */
export const INTRO_T = {
  lightsFrom: 0.3,
  lightsTo: 2.6,
  walk: 0.5,
  pushIn: 2.4,
  arrive: 4.9,
  voiceAt: 4.4,
  closeUp: 6.6,
  /** il titolo si accende da qui in poi, appena Don Patrizio ha finito di parlare… */
  reveal: 10.0,
  /** …e comunque a questo punto */
  revealLatest: 12.4,
  /** il titolo resta in scena tanto così prima della dissolvenza */
  hold: 2.3,
  maxEnd: 14.4,
} as const;

/** Tempi della versione 2D (`still` = movimento ridotto: tutto fermo, solo voce e sottotitolo). */
export const INTRO_2D_T = {
  normal: { presenter: 0.5, voiceAt: 1.2, reveal: 1.8, minEnd: 6.5, maxEnd: 10 },
  still: { presenter: 0, voiceAt: 0.3, reveal: 0, minEnd: 3.5, maxEnd: 9 },
} as const;

/** La battuta del benvenuto (clip registrato: «Eccoci qua! Luci accese, ruota pronta… e voi?»). */
export const INTRO_LINE = "benvenuti-3";

/** Fine sicura dall'apertura della pagina (anche se la scheda è in pausa o il caricamento si blocca). */
export const INTRO_SAFETY_MS = 22_000;

const smooth = (a: number, b: number, t: number) => {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

/** Luci di sala 0..1: un filo di luce al buio (si intravede lo studio), poi su fino alla piena luce. */
export function introLights(t: number): number {
  return 0.08 + 0.92 * smooth(INTRO_T.lightsFrom, INTRO_T.lightsTo, t);
}

/** Si accende il titolo? (dopo `reveal`, a voce finita; comunque a `revealLatest`) */
export function introRevealed(t: number, speaking: boolean): boolean {
  return t >= INTRO_T.revealLatest || (t >= INTRO_T.reveal && !speaking);
}

/** Regia dello studio 3D durante l'intro (al posto di quella della partita). */
export function introDirection(elapsedMs: number, speaking: boolean): StudioDirection {
  const t = Math.max(0, elapsedMs) / 1000;
  const T = INTRO_T;
  if (t < T.walk) return { shot: "establish", ease: 0, action: "idle", mark: "offstage", mood: "idle", zafira: false };
  if (t < T.pushIn) return { shot: "establish", ease: 1.6, action: "idle", mark: "center", mood: t < 0.9 ? "idle" : "spin", zafira: false };
  if (t < T.arrive) return { shot: "presenterFull", ease: 2.6, action: "idle", mark: "center", mood: t < 3.2 ? "spin" : "idle", zafira: false };
  if (t < T.closeUp) return { shot: "presenterFull", ease: 1.6, action: "saluto", mark: "center", mood: "idle", zafira: false };
  if (!introRevealed(t, speaking)) return { shot: "host", ease: 2.0, action: speaking ? "presentazione" : "idle", mark: "center", mood: "tension", zafira: false };
  return { shot: "title", ease: 1.4, action: speaking ? "presentazione" : "saluto", mark: "center", mood: "spin", zafira: false };
}

/** Schermo LED: «IN ONDA» finché non si accende il titolo. */
export function introLed(revealed: boolean): LedContent {
  if (!revealed) return { kind: "title", over: "STASERA", title: "IN ONDA", tone: "red", sub: "Il game show della mente" };
  return { kind: "logo" };
}

/**
 * Può finire? 3D: titolo acceso da `hold` secondi (`revealAt` = quando si è acceso) e voce finita; 2D: dopo il minimo
 * con la voce finita. Comunque al massimo.
 */
export function introCanEnd(t: number, voiceDone: boolean, mode: "3d" | "2d" | "still" = "3d", revealAt: number | null = null): boolean {
  if (mode === "3d") return (revealAt !== null && t >= revealAt + INTRO_T.hold && voiceDone) || t >= INTRO_T.maxEnd;
  const T = INTRO_2D_T[mode === "still" ? "still" : "normal"];
  return (t >= T.minEnd && voiceDone) || t >= T.maxEnd;
}

/** Momento della versione 2D (per ridisegnare solo quando cambia qualcosa): 0 buio, 1 ritratto, 2 logo. */
export function introStep2d(t: number, still: boolean): number {
  const T = INTRO_2D_T[still ? "still" : "normal"];
  return (t >= T.presenter ? 1 : 0) + (t >= T.reveal ? 1 : 0);
}
