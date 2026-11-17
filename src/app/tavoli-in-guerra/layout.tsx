import type { Metadata, Viewport } from "next";
import { Anton, Barlow } from "next/font/google";
import "./tig.css";

/**
 * TAVOLI IN GUERRA! dentro la piattaforma: stesse pagine del sito (account, PWA), identità del gioco.
 * Caratteri gratuiti (Google Fonts, licenza OFL): Anton per titoli e pulsanti, Barlow per i testi.
 */
const display = Anton({ weight: "400", subsets: ["latin"], variable: "--font-tig-display", display: "swap" });
const body = Barlow({ weight: ["500", "600", "700", "800", "900"], subsets: ["latin"], variable: "--font-tig-body", display: "swap" });

export const metadata: Metadata = {
  title: { default: "TAVOLI IN GUERRA!", template: "%s · TAVOLI IN GUERRA!" },
  description: "TAVOLI IN GUERRA! – il game show per pub che trasforma ogni tavolo in una squadra: cinque manche, sfide, bluff, Bottone del Caos e mascotte che evolvono.",
};
export const viewport: Viewport = { themeColor: "#06070c" };

export default function TigLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${display.variable} ${body.variable} tig-root min-h-dvh`}>{children}</div>;
}
