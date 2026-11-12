import type { Metadata, Viewport } from "next";
import { Rubik_Dirt, Special_Elite } from "next/font/google";
import "./psyco.css";

/**
 * PSYCO dentro CHE NE SAI?!: stesse pagine del sito (header, account, PWA), identità noir del gioco.
 * Caratteri gratuiti (Google Fonts, licenza OFL): Rubik Dirt per il titolo "graffiato",
 * Special Elite (macchina da scrivere) per i biglietti e le regole.
 */
const title = Rubik_Dirt({ weight: "400", subsets: ["latin"], variable: "--font-psyco-title", display: "swap" });
const type = Special_Elite({ weight: "400", subsets: ["latin"], variable: "--font-psyco-type", display: "swap" });

export const metadata: Metadata = {
  title: { default: "PSYCO", template: "%s · PSYCO" },
  description: "PSYCO – Tutti conoscono la regola. Tranne te. Il party game psicologico di CHE NE SAI?!",
};
export const viewport: Viewport = { themeColor: "#0b0909" };

export default function PsycoLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${title.variable} ${type.variable} psy-root min-h-dvh`}>{children}</div>;
}
