import type { Metadata, Viewport } from "next";
import { TIG_FONT_VARS } from "@/features/tig/games/kit/fonts";
import "@/features/tig/games/kit/tig-games.css";
import "./tig.css";

/**
 * TAVERNA DEI PIRATI (ex TAVOLI IN GUERRA!; rotte e identificatori «tig» per ora restano) dentro la piattaforma:
 * stesse pagine del sito (account, PWA), identità del gioco. Caratteri gratuiti (Google Fonts, licenza OFL), gli stessi
 * delle schermate dei minigiochi (`TIG_FONT_VARS`): Pirata One per titoli e logo, Grenze per numeri, etichette e
 * pulsanti, Manrope per i testi.
 */

export const metadata: Metadata = {
  title: { default: "TAVERNA DEI PIRATI", template: "%s · TAVERNA DEI PIRATI" },
  description: "TAVERNA DEI PIRATI – il game show per pub dove ogni tavolo è una ciurma: cinque manche, sfide, bluff, Bottone del Caos e mascotte che evolvono.",
};
export const viewport: Viewport = { themeColor: "#07131a" };

export default function TigLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${TIG_FONT_VARS} tig-root min-h-dvh`}>{children}</div>;
}
