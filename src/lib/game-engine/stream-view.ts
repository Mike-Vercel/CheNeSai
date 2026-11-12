import type { PublicState } from "./types";

/**
 * Stato per la VISTA LIVE (finestra da catturare con OBS / TikTok LIVE Studio): lo stesso show del
 * TV ma senza niente che permetta a chi guarda la diretta di entrare o disturbare la partita.
 * Si tolgono il codice della partita (e quindi QR e link, che il client costruisce dal codice) e il
 * piano dello scorrimento automatico (la vista non guida mai la partita). Nomi, punti, domande e
 * risultati restano: sono lo show. Lo stato pubblico non contiene mai soluzioni prima della
 * rivelazione né le risposte dei giocatori (solo quante ne sono arrivate).
 */
export function streamSafeState(s: PublicState): PublicState {
  return { ...s, code: "", auto: null };
}

/** Parametro `?audio=0` della vista LIVE: show muto (l'audio lo prende OBS da un'altra sorgente). */
export function streamAudioFromParam(raw: string | string[] | null | undefined): boolean {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return !(v === "0" || v === "off" || v === "no" || v === "false");
}
