/**
 * Piattaforma dei giochi: nome e catalogo della home.
 * Per aggiungere un gioco basta aggiungere una voce a GAMES (e la sua copertina verticale in /public/games,
 * ricavata dall'originale in REFERENCE/GIOCHI).
 */

/** Nome provvisorio della piattaforma (barra in alto, piè di pagina): si cambia qui. */
export const PLATFORM_NAME = "CheNeSai";

export type GameStatus = "disponibile" | "in-arrivo";

/** Disegno della copertina provvisoria (vedi features/home/cards.tsx). */
export type CoverMark = "note" | "letters" | "pencil";

export interface GameEntry {
  id: string;
  title: string;
  /** una riga sotto il titolo */
  tagline: string;
  /** dettagli brevi (giocatori, durata, prezzo) */
  meta: string[];
  status: GameStatus;
  /** dove porta "Gioca" (null = non ancora disponibile) */
  href: string | null;
  /** copertina verticale (locandina 4:5 circa): immagine reale del gioco oppure campo di colore con una sigla */
  cover: { kind: "image"; src: string; alt: string; width: number; height: number } | { kind: "placeholder"; color: string; mark: CoverMark };
}

export const GAMES: GameEntry[] = [
  {
    id: "che-ne-sai",
    title: "CHE NE SAI?!",
    tagline: "Il quiz show da giocare in compagnia: il PC fa da TV, i telefoni sono i pulsanti.",
    meta: ["Quiz dal vivo", "Da 2 giocatori in su", "15–40 minuti", "Gratis"],
    status: "disponibile",
    href: "/gioca",
    cover: {
      kind: "image",
      src: "/games/che-ne-sai-copertina.webp",
      alt: "Copertina di CHE NE SAI?!: il Professore, Palmino e la Regina sul palco del quiz pub",
      width: 1122,
      height: 1402,
    },
  },
  {
    id: "psyco",
    title: "PSYCO",
    tagline: "Tutti conoscono la regola. Tranne te. Il party game psicologico da giocare seduti insieme.",
    meta: ["Party game", "Da 3 giocatori in su", "Manche a tempo libero", "Gratis"],
    status: "disponibile",
    href: "/psyco",
    cover: {
      kind: "image",
      src: "/games/psyco-copertina.webp",
      alt: "Copertina di PSYCO: lente d'ingrandimento, lampada e il fascicolo «Regola segreta»",
      width: 1055,
      height: 1318,
    },
  },
];

export const FEATURED_GAME = GAMES[0];
