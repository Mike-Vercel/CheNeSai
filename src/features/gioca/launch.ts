"use client";

import {
  currentScreenKey,
  hasMultipleScreens,
  loadScreenChoice,
  loadScreens,
  pickTvScreen,
  popupFeatures,
  saveScreenChoice,
  screenApiSupported,
  screenPermission,
} from "@/features/display/screen-picker";

/**
 * Dopo «CREA PARTITA» (gioco libero) si va dritti al TV, senza pagine intermedie né un secondo «avvia».
 *
 * - Un solo schermo (o browser senza Window Management API): lo schermo intero si chiede SUBITO,
 *   finché vale il clic appena fatto, e il TV si apre in questa scheda (lobby con QR e codice).
 * - Due o più schermi (Chrome/Edge): la finestra del TV si apre SUBITO sull'altro schermo (quello
 *   scelto e ricordato, altrimenti il primo che non è questo), a schermo intero se il permesso
 *   "Gestione finestre" è già concesso; appena la partita è pronta ci si carica il TV, e questa
 *   scheda diventa il pannello dell'host. Se il browser blocca la finestra si resta su un solo schermo.
 * La finestra va aperta prima della creazione: i browser consentono i popup solo subito dopo un clic.
 */
export interface TvLaunch {
  /** finestra del TV sull'altro schermo (null = TV su questo schermo) */
  win: Window | null;
  /** schermo intero chiesto da questa pagina */
  fullscreen: boolean;
}

function placeholder(w: Window) {
  try {
    const d = w.document;
    d.title = "CHE NE SAI?! – TV";
    d.body.style.cssText = "margin:0;height:100vh;display:grid;place-items:center;background:#170824;color:#ffd43b;font:800 32px system-ui,sans-serif";
    d.body.textContent = "Preparo la partita…";
  } catch {
    /* finestra non accessibile: resta vuota per un attimo */
  }
}

export async function beginTvLaunch(): Promise<TvLaunch> {
  if (screenApiSupported() && hasMultipleScreens()) {
    try {
      const r = await loadScreens(); // la prima volta Chrome chiede il permesso "Gestione finestre"
      const pick = r ? pickTvScreen(r.screens, loadScreenChoice(), await currentScreenKey()) : null;
      if (pick) {
        const granted = (await screenPermission()) === "granted";
        const w = window.open("about:blank", "qz-tv-nuova", popupFeatures(pick, granted));
        if (w) {
          saveScreenChoice(pick.key);
          try {
            w.moveTo(pick.availLeft, pick.availTop);
            w.resizeTo(pick.availWidth, pick.availHeight);
          } catch {
            /* spostamento non consentito */
          }
          placeholder(w);
          return { win: w, fullscreen: false };
        }
      }
    } catch {
      /* elenco schermi non disponibile: un solo schermo */
    }
  }
  let fullscreen = false;
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    fullscreen = true;
  } catch {
    /* schermo intero non consentito: il TV lo offre dall'icona impostazioni */
  }
  return { win: null, fullscreen };
}

/** Partita creata: carica il TV (nella finestra sull'altro schermo o qui) e dice dove va questa scheda. */
export function completeTvLaunch(l: TvLaunch, sessionId: string): string {
  const tvUrl = `/gioca/tv/${sessionId}`;
  if (l.win && !l.win.closed) {
    try {
      l.win.location.replace(tvUrl);
      return `/gioca/partita/${sessionId}`;
    } catch {
      /* finestra non più raggiungibile: TV qui */
    }
  }
  return tvUrl;
}

/** Creazione non riuscita: si chiude la finestra del TV e si esce dallo schermo intero. */
export function cancelTvLaunch(l: TvLaunch): void {
  try {
    l.win?.close();
  } catch {
    /* ignora */
  }
  if (l.fullscreen && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
}
