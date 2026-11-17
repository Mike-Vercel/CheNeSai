import { Grenze, Manrope } from "next/font/google";
import { tigTitleFont } from "./fonts-title";

/**
 * Caratteri di TAVERNA DEI PIRATI (ex TAVOLI IN GUERRA!; Google Fonts, licenza OFL, sottoinsiemi latin + latin-ext):
 *  - `--font-tig-display` «Pirata One»: titoli e logo, sempre in maiuscolo/minuscolo (in maiuscolo è poco leggibile);
 *  - `--font-tig-num` «Grenze»: numeri, punteggi, timer, etichette e pulsanti (robusto, leggibile da 5 m; cifre
 *    allineate con `lnum`/`tnum` nelle classi `tg-num`/`tg-display`);
 *  - `--font-tig-body` «Manrope»: testi lunghi (regole, domande, opzioni).
 * La pagina che monta i minigiochi mette `TIG_FONT_VARS` sull'elemento radice: le classi `tg-*`/`tig-*` li usano
 * tramite le variabili (senza, ripiegano su caratteri di sistema).
 */
const num = Grenze({ subsets: ["latin", "latin-ext"], variable: "--font-tig-num", display: "swap" });
const body = Manrope({ subsets: ["latin", "latin-ext"], variable: "--font-tig-body", display: "swap" });

export const TIG_FONT_VARS = `${tigTitleFont.variable} ${num.variable} ${body.variable}`;
