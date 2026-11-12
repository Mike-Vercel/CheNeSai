import { Saira_Condensed } from "next/font/google";

const saira = Saira_Condensed({ weight: ["600", "800", "900"], subsets: ["latin"], variable: "--font-giramente", display: "swap" });

/** Anteprime del livello visivo di GIRAMENTE! (nero profondo, verde elettrico, rosso; carattere condensato). */
export default function GiramentePreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${saira.variable} min-h-dvh text-[#F4F6F7]`}
      style={{
        fontFamily: "var(--font-giramente), 'Arial Narrow', sans-serif",
        background:
          "radial-gradient(70% 55% at 0% 0%, rgba(57,255,20,0.14), transparent 60%), radial-gradient(70% 55% at 100% 100%, rgba(255,37,58,0.14), transparent 60%), #080B0D",
      }}
    >
      {children}
    </div>
  );
}
