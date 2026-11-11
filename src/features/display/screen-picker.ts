/**
 * Schermo TV: su quale schermo aprire il TV (PC collegato al televisore con HDMI).
 *
 * Usa la Window Management API (Chrome/Edge desktop, permesso "window-management"):
 *  - `window.getScreenDetails()` elenca gli schermi con posizione e dimensioni;
 *  - `window.open(url, nome, "popup,left=…,top=…,width=…,height=…")` apre il TV sullo schermo scelto
 *    (con il permesso concesso si aggiunge anche "fullscreen": popup già a schermo intero);
 *  - `element.requestFullscreen({ screen })` porta lo schermo intero su un altro schermo
 *    (serve un clic nella finestra del TV: la richiesta di schermo intero vuole un gesto dell'utente).
 * Senza supporto (Firefox, Safari) o con un solo schermo: finestra normale + "trascinala sul TV e premi F11".
 *
 * La scelta resta salvata su questo dispositivo (localStorage). La regia (o la pagina dell'host)
 * comunica con la finestra del TV con un BroadcastChannel (stessa origine).
 *
 * Le funzioni pure (etichette, scelta, chiavi, posizione della finestra) sono testate in tests/unit.
 */

/** Sottoinsieme di ScreenDetailed che ci serve (le proprietà sono quelle della specifica). */
export interface ScreenLike {
  left: number;
  top: number;
  width: number;
  height: number;
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  isPrimary?: boolean;
  isInternal?: boolean;
  label?: string;
  devicePixelRatio?: number;
}

export interface ScreenInfo {
  /** posizione nell'elenco ordinato (0 = "Schermo 1") */
  index: number;
  /** "Schermo 2 – TV 3840×2160" */
  label: string;
  /** chiave stabile per ricordare la scelta su questo dispositivo */
  key: string;
  isPrimary: boolean;
  isInternal: boolean;
  /** risoluzione reale (pixel fisici) */
  pixelWidth: number;
  pixelHeight: number;
  left: number;
  top: number;
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
}

/** Chiave dello schermo: posizione nel desktop esteso e dimensioni (il nome può mancare). */
export function screenKey(s: Pick<ScreenLike, "left" | "top" | "width" | "height">): string {
  return `${Math.round(s.left)},${Math.round(s.top)}:${Math.round(s.width)}x${Math.round(s.height)}`;
}

/** Ruolo leggibile: principale, integrato (portatile) o TV (esterno). */
function roleOf(s: ScreenLike, total: number): string {
  if (total <= 1) return "questo schermo";
  if (s.isPrimary) return "principale";
  if (s.isInternal) return "integrato";
  return "TV";
}

/**
 * Elenco ordinato (da sinistra a destra, poi dall'alto) con etichette per il menu:
 * "Schermo 1 – principale 1920×1080", "Schermo 2 – TV 3840×2160 (LG TV)".
 */
export function describeScreens(raw: readonly ScreenLike[]): ScreenInfo[] {
  const sorted = [...raw].sort((a, b) => a.left - b.left || a.top - b.top);
  return sorted.map((s, i) => {
    const dpr = s.devicePixelRatio && s.devicePixelRatio > 0 ? s.devicePixelRatio : 1;
    const pw = Math.round(s.width * dpr);
    const ph = Math.round(s.height * dpr);
    const name = (s.label ?? "").trim();
    return {
      index: i,
      label: `Schermo ${i + 1} – ${roleOf(s, sorted.length)} ${pw}×${ph}${name ? ` (${name.slice(0, 40)})` : ""}`,
      key: screenKey(s),
      isPrimary: !!s.isPrimary,
      isInternal: !!s.isInternal,
      pixelWidth: pw,
      pixelHeight: ph,
      left: s.left,
      top: s.top,
      availLeft: s.availLeft,
      availTop: s.availTop,
      availWidth: s.availWidth,
      availHeight: s.availHeight,
    };
  });
}

/**
 * Schermo da proporre: quello salvato su questo dispositivo se c'è ancora,
 * altrimenti il primo che non è il principale (di solito il TV), altrimenti il primo.
 */
export function chooseScreen(screens: readonly ScreenInfo[], savedKey: string | null): ScreenInfo | null {
  if (screens.length === 0) return null;
  const saved = savedKey ? screens.find((s) => s.key === savedKey) : undefined;
  if (saved) return saved;
  return screens.find((s) => !s.isPrimary) ?? screens[0];
}

/** Caratteristiche della finestra popup che copre l'area utile dello schermo scelto. */
export function popupFeatures(s: Pick<ScreenInfo, "availLeft" | "availTop" | "availWidth" | "availHeight"> | null, fullscreen = false): string {
  if (!s) return "popup,width=1280,height=720";
  const parts = ["popup", `left=${Math.round(s.availLeft)}`, `top=${Math.round(s.availTop)}`, `width=${Math.round(s.availWidth)}`, `height=${Math.round(s.availHeight)}`];
  if (fullscreen) parts.push("fullscreen");
  return parts.join(",");
}

// ---------------------------------------------------------------------------
// Scelta salvata su questo dispositivo
// ---------------------------------------------------------------------------
export const SCREEN_STORAGE_KEY = "qz.tv.screen";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadScreenChoice(storage: StorageLike | null = defaultStorage()): string | null {
  try {
    const v = storage?.getItem(SCREEN_STORAGE_KEY) ?? null;
    return v && /^-?\d+,-?\d+:\d+x\d+$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveScreenChoice(key: string, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(SCREEN_STORAGE_KEY, key);
  } catch {
    // archiviazione non disponibile (navigazione privata): la scelta vale solo per adesso
  }
}

// ---------------------------------------------------------------------------
// Messaggi tra regia/host e finestra del TV
// ---------------------------------------------------------------------------
export type TvScreenMessage =
  | { type: "move"; key: string }
  | { type: "fullscreen" }
  | { type: "ping" }
  | { type: "pong"; key: string | null; fullscreen: boolean };

export function tvChannelName(sessionId: string): string {
  return `qz-tv:${sessionId}`;
}

export function tvWindowName(sessionId: string): string {
  return `qz-tv-${sessionId.replace(/[^a-z0-9]/gi, "").slice(0, 32)}`;
}

export function isTvScreenMessage(v: unknown): v is TvScreenMessage {
  if (!v || typeof v !== "object") return false;
  const t = (v as { type?: unknown }).type;
  if (t === "move") return typeof (v as { key?: unknown }).key === "string";
  return t === "fullscreen" || t === "ping" || t === "pong";
}

// ---------------------------------------------------------------------------
// Browser (Window Management API): non eseguibile nei test
// ---------------------------------------------------------------------------
interface ScreenDetailsLike extends EventTarget {
  screens: (ScreenLike & EventTarget)[];
  currentScreen: ScreenLike;
}

type WindowWithScreens = Window & { getScreenDetails?: () => Promise<ScreenDetailsLike> };

export type ScreenPermission = "granted" | "prompt" | "denied" | "unsupported";

export function screenApiSupported(): boolean {
  return typeof window !== "undefined" && "getScreenDetails" in window;
}

/** true se il PC ha più schermi (non richiede permessi; Chrome/Edge). */
export function hasMultipleScreens(): boolean {
  if (typeof window === "undefined") return false;
  return (window.screen as Screen & { isExtended?: boolean }).isExtended === true;
}

export async function screenPermission(): Promise<ScreenPermission> {
  if (!screenApiSupported()) return "unsupported";
  try {
    const r = await navigator.permissions.query({ name: "window-management" as PermissionName });
    return r.state as ScreenPermission;
  } catch {
    return "prompt";
  }
}

let cachedDetails: ScreenDetailsLike | null = null;

/** Elenco degli schermi (la prima volta Chrome chiede il permesso "Gestione finestre"). */
export async function loadScreens(): Promise<{ screens: ScreenInfo[]; raw: Map<string, ScreenLike> } | null> {
  if (!screenApiSupported()) return null;
  try {
    cachedDetails ??= await (window as WindowWithScreens).getScreenDetails!();
    const raw = new Map<string, ScreenLike>();
    for (const s of cachedDetails.screens) raw.set(screenKey(s), s);
    return { screens: describeScreens(cachedDetails.screens), raw };
  } catch {
    return null;
  }
}

/** Oggetto ScreenDetailed originale (serve a requestFullscreen({ screen })). */
export async function rawScreenFor(key: string): Promise<ScreenLike | null> {
  const r = await loadScreens();
  return r?.raw.get(key) ?? null;
}

/**
 * Apre (o riporta in primo piano) la finestra del TV sullo schermo scelto.
 * Restituisce la finestra o null se il browser ha bloccato il popup.
 */
export function openTvWindow(url: string, sessionId: string, screen: ScreenInfo | null, fullscreen: boolean): Window | null {
  const w = window.open(url, tvWindowName(sessionId), popupFeatures(screen, fullscreen && !!screen));
  if (w && screen) {
    try {
      w.moveTo(screen.availLeft, screen.availTop);
      w.resizeTo(screen.availWidth, screen.availHeight);
    } catch {
      // finestra già in un'altra origine o browser che non consente lo spostamento
    }
  }
  try {
    w?.focus();
  } catch {
    /* ignora */
  }
  return w;
}

/**
 * Nella finestra del TV: schermo intero sullo schermo indicato.
 * Con un gesto dell'utente (clic) funziona sempre; senza, il browser può rifiutare: allora
 * la finestra si sposta (moveTo/resizeTo, consentito ai popup) e si chiede un clic.
 * Restituisce true se lo schermo intero è riuscito.
 */
export async function fullscreenOn(key: string | null): Promise<boolean> {
  const el = document.documentElement;
  const target = key ? await rawScreenFor(key) : null;
  try {
    if (target) await el.requestFullscreen({ screen: target } as FullscreenOptions);
    else await el.requestFullscreen();
    return true;
  } catch {
    if (target) {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
      } catch {
        /* ignora */
      }
      try {
        window.moveTo(target.availLeft, target.availTop);
        window.resizeTo(target.availWidth, target.availHeight);
      } catch {
        /* spostamento non consentito */
      }
    }
    return false;
  }
}
