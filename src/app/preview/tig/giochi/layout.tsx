import { TIG_FONT_VARS } from "@/features/tig/games/kit/fonts";

/** Anteprima dei minigiochi di TAVOLI IN GUERRA! (caratteri e fondo notte del gioco). */
export default function TigGiochiPreviewLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${TIG_FONT_VARS} tg-root min-h-dvh bg-[#0b0d12] text-[#eef2f6]`}>{children}</div>;
}
