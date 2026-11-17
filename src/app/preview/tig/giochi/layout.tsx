import { TIG_FONT_VARS } from "@/features/tig/games/kit/fonts";

/** Anteprima dei minigiochi di TAVERNA DEI PIRATI (caratteri e fondo «notte di mare» del gioco). */
export default function TigGiochiPreviewLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${TIG_FONT_VARS} tg-root min-h-dvh bg-[#07131a] text-[#f6ead2]`}>{children}</div>;
}
