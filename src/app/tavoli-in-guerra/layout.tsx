import type { Metadata, Viewport } from "next";
import { TIG_FONT_VARS } from "@/features/tig/games/kit/fonts";
import "@/features/tig/games/kit/tig-games.css";
import "./tig.css";

/**
 * TAVOLI IN GUERRA! dentro la piattaforma: stesse pagine del sito (account, PWA), identità del gioco.
 * Caratteri gratuiti (Google Fonts, licenza OFL), gli stessi delle schermate dei minigiochi: Big Shoulders per
 * titoli, numeri e pulsanti, Manrope per i testi (`TIG_FONT_VARS`).
 */

export const metadata: Metadata = {
  title: { default: "TAVOLI IN GUERRA!", template: "%s · TAVOLI IN GUERRA!" },
  description: "TAVOLI IN GUERRA! – il game show per pub che trasforma ogni tavolo in una squadra: cinque manche, sfide, bluff, Bottone del Caos e mascotte che evolvono.",
};
export const viewport: Viewport = { themeColor: "#06070c" };

export default function TigLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${TIG_FONT_VARS} tig-root min-h-dvh`}>{children}</div>;
}
