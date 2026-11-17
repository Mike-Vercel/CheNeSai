import { Pirata_One } from "next/font/google";

/**
 * Carattere dei TITOLI di TAVERNA DEI PIRATI (ex TAVOLI IN GUERRA!): «Pirata One» (Google Fonts, licenza OFL).
 * Variabile CSS `--font-tig-display`: è il punto d'incontro con l'arena 3D, che la legge per le scritte
 * della grande vela. Solo testi in maiuscolo/minuscolo (i titoli tutti maiuscoli vanno in `--font-tig-num`).
 * Modulo a parte perché lo usa anche la copertina della home, senza caricare gli altri caratteri del gioco.
 */
export const tigTitleFont = Pirata_One({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--font-tig-display", display: "swap" });
