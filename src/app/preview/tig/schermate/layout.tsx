import { TIG_FONT_VARS } from "@/features/tig/games/kit/fonts";
import "@/features/tig/games/kit/tig-games.css";
import "../../../tavoli-in-guerra/tig.css";

/** Banco di prova delle schermate di TAVERNA DEI PIRATI: stessi caratteri e stesso stile delle pagine vere. */
export default function TigSchermatePreviewLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${TIG_FONT_VARS} tig-root min-h-dvh`}>{children}</div>;
}
