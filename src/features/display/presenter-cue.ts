import type { Presenter, PublicShowLine } from "@/lib/game-engine/types";
import type { CharacterAnimation } from "@/features/three/characters/types";
import { CHARACTER_ANIMATIONS } from "@/lib/show/types";
import { ttsText } from "@/features/game/script";

/**
 * Regia dei personaggi sul TV guidata dalla battuta (funzioni pure, testate).
 *
 * Durante i momenti del regista automatico (punti di una risposta, inizio finale) in scena c'è
 * chi sta dicendo la battuta, con l'animazione scelta dalla battuta stessa. Se la battuta è di un
 * presentatore diverso da quello della schermata, entra lui al posto del padrone di casa (stesso
 * riquadro: non copre mai testi o risposte) e a battuta finita il padrone di casa torna.
 * Dopo un ricaricamento del TV nessuno sta parlando: si vede il padrone di casa (stato sicuro).
 */
export interface PresenterCue {
  /** chi è in scena */
  who: Presenter;
  animation: CharacterAnimation;
  /** battuta del regista in corso (null = nessuna) */
  line: PublicShowLine | null;
  /** true se in scena c'è un ospite al posto del padrone di casa */
  guest: boolean;
}

export interface SpeechNow {
  who: Presenter;
  text: string;
}

/** Battuta del regista che il TV sta dicendo adesso (stesso personaggio e stesso testo). */
export function matchShowLine(lines: readonly PublicShowLine[] | null | undefined, speech: SpeechNow | null): PublicShowLine | null {
  if (!speech || !lines?.length) return null;
  const text = ttsText(speech.text);
  return lines.find((l) => l.who === speech.who && ttsText(l.text) === text) ?? null;
}

const ANIMS: ReadonlySet<string> = new Set(CHARACTER_ANIMATIONS);

/** Animazione della battuta, se valida (i dati della libreria non sono codice: si controlla). */
export function lineAnimation(line: Pick<PublicShowLine, "animation">): CharacterAnimation | null {
  return line.animation && ANIMS.has(line.animation) ? (line.animation as CharacterAnimation) : null;
}

/**
 * Chi mostrare e come: la battuta del regista in corso vince; altrimenti il padrone di casa,
 * che "parla" se sta parlando lui e altrimenti resta con l'animazione della schermata.
 */
export function presenterCue(host: Presenter, idle: CharacterAnimation, lines: readonly PublicShowLine[] | null | undefined, speech: SpeechNow | null): PresenterCue {
  const line = matchShowLine(lines, speech);
  if (line) return { who: line.who, animation: lineAnimation(line) ?? "talk", line, guest: line.who !== host };
  if (speech?.who === host) return { who: host, animation: "talk", line: null, guest: false };
  return { who: host, animation: idle, line: null, guest: false };
}

// ---------------------------------------------------------------------------------- il trio
export type TrioRole = "front" | "left" | "right";

export interface TrioMember {
  who: Presenter;
  role: TrioRole;
  animation: CharacterAnimation;
}

/** Posti fissi di chi ascolta: l'ordine resta stabile quando cambia chi parla (si scambiano in due). */
const SEATS: readonly Presenter[] = ["professore", "regina", "palmino"];

/** Gesti a cui reagiscono anche gli altri due (festa e sorpresa sono di tutti). */
const SHARED: ReadonlySet<CharacterAnimation> = new Set<CharacterAnimation>(["celebrate", "surprised"]);

/**
 * Tutti e tre in scena: davanti chi parla (o la battuta del regista, o il padrone di casa),
 * dietro a sinistra e a destra gli altri due che ascoltano e reagiscono ai momenti di festa o
 * sorpresa della schermata.
 */
export function trioCast(host: Presenter, idle: CharacterAnimation, lines: readonly PublicShowLine[] | null | undefined, speech: SpeechNow | null): { cue: PresenterCue; members: TrioMember[] } {
  const cue = presenterCue(host, idle, lines, speech);
  // chi sta parlando va davanti anche se non è una battuta del regista (es. battute di rito)
  const front = speech?.who ?? cue.who;
  const frontAnim: CharacterAnimation = front === cue.who ? cue.animation : "talk";
  const listen: CharacterAnimation = SHARED.has(idle) ? idle : "idle";
  const [left, right] = SEATS.filter((w) => w !== front);
  return {
    cue,
    members: [
      { who: front, role: "front", animation: frontAnim },
      { who: left, role: "left", animation: listen },
      { who: right, role: "right", animation: listen },
    ],
  };
}
