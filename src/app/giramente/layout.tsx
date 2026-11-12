import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./giramente.css";

/**
 * GIRAMENTE! dentro la piattaforma: stesse pagine del sito (account, PWA), identità del gioco.
 * Caratteri gratuiti (Google Fonts, licenza OFL): Barlow Condensed per titoli e pulsanti, Barlow per i testi.
 */
const display = Barlow_Condensed({ weight: ["700", "800", "900"], style: ["italic", "normal"], subsets: ["latin"], variable: "--font-gm-display", display: "swap" });
const body = Barlow({ weight: ["500", "600", "700", "800", "900"], subsets: ["latin"], variable: "--font-gm-body", display: "swap" });

export const metadata: Metadata = {
  title: { default: "GIRAMENTE!", template: "%s · GIRAMENTE!" },
  description: "GIRAMENTE! – La ruota gira. La mente decide. Il game show con la ruota, cinque manche, enigmi, Jolly e classifiche in tempo reale.",
};
export const viewport: Viewport = { themeColor: "#080b0d" };

export default function GiramenteLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${display.variable} ${body.variable} gm-root min-h-dvh`}>{children}</div>;
}
