import type { LedContent } from "../three/studio/led-texture";
import type { StudioDirection } from "../three/studio/studio-director";

/**
 * Regia dello studio 3D sotto il MENU di GIRAMENTE! (pura, testata in tests/unit/giramente-menu.test.ts).
 * Don Patrizio torna al suo posto accanto alla ruota e aspetta: ogni tanto saluta, mentre si prepara la partita
 * ci pensa su; lo schermo LED dice dove si è (logo nel menu, titolo del passo nelle impostazioni).
 * L'inquadratura sta nella "finestra" che il menu lascia libera (vedi StudioWindow), quindi non finisce mai sotto i pannelli.
 */
export type MenuPanel = "main" | "setup" | "modes" | "settings" | "resume";

export const SETUP_STEPS = [
  { id: "modalita", title: "MODALITÀ" },
  { id: "dispositivi", title: "DISPOSITIVI" },
  { id: "giocatori", title: "GIOCATORI" },
  { id: "regole", title: "REGOLE" },
] as const;
export type SetupStep = 0 | 1 | 2 | 3;

/** Ogni quanto saluta (s) e per quanto (s). */
const WAVE_EVERY = 15;
const WAVE_FOR = 2.6;

export function menuDirection(elapsedMs: number, speaking: boolean, panel: MenuPanel): StudioDirection {
  const t = Math.max(0, elapsedMs) / 1000;
  const waving = t > 2.5 && t % WAVE_EVERY < WAVE_FOR;
  const base: StudioDirection = { shot: "wide", ease: 1.8, action: "idle", mark: "home", mood: "idle", zafira: false };
  if (speaking) return { ...base, action: "presentazione" };
  if (panel === "setup") return { ...base, shot: "duo", ease: 1.6, action: waving ? "saluto" : t % 11 < 3.2 ? "pensiero" : "idle" };
  if (panel === "resume") return { ...base, shot: "duo", action: waving ? "saluto" : "indica" };
  return { ...base, action: waving ? "saluto" : "idle" };
}

/** Lo schermo LED sulla voce scelta del menu principale (finché non si sceglie nulla: il logo). */
const FOCUS_LED: Record<string, LedContent> = {
  riprendi: { kind: "title", over: "BENTORNATI", title: "RIPRENDI", tone: "green", sub: "La partita vi aspetta" },
  nuova: { kind: "title", over: "SI GIOCA", title: "NUOVA PARTITA", tone: "green", sub: "Individuale o a squadre" },
  entra: { kind: "title", over: "HAI UN CODICE?", title: "ENTRA IN PARTITA", tone: "red" },
  modalita: { kind: "title", over: "COME SI GIOCA", title: "MODALITÀ DI GIOCO", tone: "green", sub: "Da soli, a squadre, col televisore" },
  impostazioni: { kind: "title", over: "GIRAMENTE!", title: "IMPOSTAZIONI", tone: "white", sub: "Musica, voci, effetti, grafica" },
  regolamento: { kind: "title", over: "5 MANCHE · LA RUOTA · I JOLLY", title: "REGOLAMENTO", tone: "white" },
};

/** Lo schermo LED: il logo (o la voce scelta) nel menu principale, il nome del pannello o del passo altrove. */
export function menuLed(panel: MenuPanel, step: SetupStep = 0, focus: string | null = null): LedContent {
  switch (panel) {
    case "setup":
      return { kind: "title", over: `NUOVA PARTITA · ${step + 1} DI ${SETUP_STEPS.length}`, title: SETUP_STEPS[step].title, tone: "green" };
    case "modes":
      return { kind: "title", over: "GIRAMENTE!", title: "MODALITÀ DI GIOCO", tone: "green" };
    case "settings":
      return { kind: "title", over: "GIRAMENTE!", title: "IMPOSTAZIONI", tone: "white" };
    case "resume":
      return { kind: "title", over: "BENTORNATI", title: "RIPRENDI", tone: "green" };
    default:
      return (focus && FOCUS_LED[focus]) || { kind: "logo" };
  }
}
