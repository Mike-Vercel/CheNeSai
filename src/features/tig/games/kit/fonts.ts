import { Big_Shoulders, Manrope } from "next/font/google";

/**
 * Caratteri di TAVOLI IN GUERRA! (Google Fonts, licenza OFL): Big Shoulders per titoli, numeri e pulsanti
 * (condensato da tabellone), Manrope per i testi. La pagina che monta i minigiochi mette `TIG_FONT_VARS`
 * sull'elemento radice: le classi `tg-*` li usano tramite `--font-tig-display` / `--font-tig-body`
 * (senza, ripiegano su caratteri di sistema condensati).
 */
const display = Big_Shoulders({ weight: ["700", "800", "900"], subsets: ["latin"], variable: "--font-tig-display", display: "swap" });
const body = Manrope({ weight: ["500", "600", "700", "800"], subsets: ["latin"], variable: "--font-tig-body", display: "swap" });

export const TIG_FONT_VARS = `${display.variable} ${body.variable}`;
