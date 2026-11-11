/**
 * Piattaforma dei giochi: nome e catalogo della home.
 * Per aggiungere un gioco basta aggiungere una voce a GAMES (e la sua copertina in /public).
 */

/** Nome provvisorio della piattaforma (barra in alto, piè di pagina): si cambia qui. */
export const PLATFORM_NAME = "Sala Giochi";

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
  /** copertina: immagine reale del gioco oppure campo di colore con una sigla */
  cover: { kind: "image"; src: string; alt: string } | { kind: "placeholder"; color: string; mark: CoverMark };
}

export const GAMES: GameEntry[] = [
  {
    id: "che-ne-sai",
    title: "CHE NE SAI?!",
    tagline: "Il quiz show da giocare in compagnia: il PC fa da TV, i telefoni sono i pulsanti.",
    meta: ["Quiz dal vivo", "2–20 giocatori", "15–40 minuti", "Gratis"],
    status: "disponibile",
    href: "/gioca",
    cover: { kind: "image", src: "/brand/logo-mark-900.webp", alt: "CHE NE SAI?!" },
  },
  {
    id: "musica",
    title: "Gioco musicale",
    tagline: "Riconosci il brano prima degli altri.",
    meta: ["In arrivo"],
    status: "in-arrivo",
    href: null,
    cover: { kind: "placeholder", color: "#087cff", mark: "note" },
  },
  {
    id: "parole",
    title: "Sfida di parole",
    tagline: "Indizi, definizioni e parole nascoste, a squadre.",
    meta: ["In arrivo"],
    status: "in-arrivo",
    href: null,
    cover: { kind: "placeholder", color: "#ff1493", mark: "letters" },
  },
  {
    id: "disegno",
    title: "Disegna e indovina",
    tagline: "Uno disegna sul telefono, tutti indovinano sul TV.",
    meta: ["In arrivo"],
    status: "in-arrivo",
    href: null,
    cover: { kind: "placeholder", color: "#00d46a", mark: "pencil" },
  },
];

export const FEATURED_GAME = GAMES[0];
export const AVAILABLE_GAMES = GAMES.filter((g) => g.status === "disponibile");
export const UPCOMING_GAMES = GAMES.filter((g) => g.status === "in-arrivo");
