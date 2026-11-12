"use client";

/**
 * VISTA PER LA LIVE (riutilizzabile da tutti i giochi): una finestra a parte con lo show pulito in
 * 16:9, da catturare con OBS / TikTok LIVE Studio (Cattura finestra o Sorgente browser), mentre si
 * gioca da un'altra finestra. Così chi guarda la diretta non vede mai il codice, il QR, il link,
 * né la risposta scelta prima che la domanda si chiuda.
 */

/** Indirizzo della vista LIVE di una partita di CHE NE SAI?! (`audio=false` → show muto). */
export function liveViewPath(sessionId: string, opts: { audio?: boolean } = {}): string {
  return `/gioca/live/${sessionId}${opts.audio === false ? "?audio=0" : ""}`;
}

/** Apre (o riporta in primo piano) la finestra della vista LIVE: 1280×720, senza barre se il browser lo consente. */
export function openLiveWindow(path: string): Window | null {
  try {
    const w = window.open(path, "qz-live", "popup,width=1280,height=720");
    w?.focus();
    return w;
  } catch {
    return null;
  }
}

/** Istruzioni brevi per OBS / TikTok LIVE Studio (mostrate accanto al pulsante). */
export const LIVE_STEPS: readonly string[] = [
  "Apri la vista LIVE: si apre una finestra a parte, in 16:9.",
  "In OBS aggiungi «Cattura finestra» e scegli la finestra «CHE NE SAI?! · LIVE» (in TikTok LIVE Studio: «Acquisizione finestra»).",
  "Oppure «Sorgente browser»: copia qui sotto l'indirizzo per OBS e incollalo, con larghezza 1280 e altezza 720 (o 1920×1080).",
  "Continua a giocare da questa finestra: nella diretta non si vedono mai codice, QR, link né la tua risposta prima della soluzione.",
];
