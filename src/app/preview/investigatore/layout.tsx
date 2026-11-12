import { Rubik_Dirt, Special_Elite } from "next/font/google";
import "../../psyco/psyco.css";

const title = Rubik_Dirt({ weight: "400", subsets: ["latin"], variable: "--font-psyco-title", display: "swap" });
const type = Special_Elite({ weight: "400", subsets: ["latin"], variable: "--font-psyco-type", display: "swap" });

/** Anteprime dell'Investigatore con l'identità noir di PSYCO (stessi caratteri e stili di /psyco). */
export default function InvestigatorePreviewLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${title.variable} ${type.variable} psy-root min-h-dvh`}>{children}</div>;
}
