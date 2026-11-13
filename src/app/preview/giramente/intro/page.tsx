import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { GameShell } from "@/features/giramente/shell/GameShell";
import "../../../giramente/giramente.css";

export const metadata: Metadata = {
  title: "Anteprima · Intro e menu di GIRAMENTE!",
  robots: { index: false, follow: false },
};

const display = Barlow_Condensed({ weight: ["700", "800", "900"], style: ["italic", "normal"], subsets: ["latin"], variable: "--font-gm-display", display: "swap" });
const body = Barlow({ weight: ["500", "600", "700", "800", "900"], subsets: ["latin"], variable: "--font-gm-body", display: "swap" });

/**
 * /preview/giramente/intro — la shell del gioco senza account né server (intro e menu; «NUOVA PARTITA» porta
 * all'accesso). `?intro=1` per rivedere l'intro, `?q=high|low|2d` per la qualità.
 */
export default function Page() {
  return (
    <div className={`${display.variable} ${body.variable} gm-root min-h-dvh`}>
      <GameShell username={null} loggedIn={false} rooms={[]} start="menu" />
    </div>
  );
}
