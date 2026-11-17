/** Icone dell'interfaccia (tratto 2, 24×24), disegnate per TAVOLI IN GUERRA!. Nessuna emoji. */
export type IconName =
  | "check"
  | "x"
  | "lock"
  | "crown"
  | "arrow"
  | "checkbox"
  | "box"
  | "tv"
  | "bolt"
  | "dots"
  | "up"
  | "down"
  | "swap"
  | "shield"
  | "target"
  | "eye"
  | "back"
  | "users"
  | "flame"
  | "coins"
  | "clock"
  | "handshake"
  | "sword";

const PATHS: Record<IconName, string> = {
  check: "M4 12.5l5 5L20 6.5",
  x: "M6 6l12 12M18 6L6 18",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  crown: "M4 18h16M4 18l-1-10 5 4 4-6 4 6 5-4-1 10",
  arrow: "M5 12h14M13 6l6 6-6 6",
  checkbox: "M4 4h16v16H4zM8 12l3 3 5-6",
  box: "M4 4h16v16H4z",
  tv: "M3 6h18v11H3zM8 21h8M12 17v4",
  bolt: "M13 2L5 14h6l-1 8 8-12h-6z",
  dots: "M6 12h.01M12 12h.01M18 12h.01",
  up: "M6 15l6-6 6 6",
  down: "M6 9l6 6 6-6",
  swap: "M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  target: "M12 12m-8 0a8 8 0 1 0 16 0 8 8 0 1 0-16 0M12 12m-4 0a4 4 0 1 0 8 0 4 4 0 1 0-8 0M12 12h.01",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0",
  back: "M20 12H8M8 12l5-5M8 12l5 5M4 5v14",
  users: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 6-5s6 2 6 5M16 11a3 3 0 1 0 0-6M18 15c2 .5 4 2 4 5",
  flame: "M12 3c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3 0-3-1-5 0-7z",
  coins: "M12 7c4 0 7-1 7-2.5S16 2 12 2 5 3 5 4.5 8 7 12 7zM5 4.5v5C5 11 8 12 12 12s7-1 7-2.5v-5M5 9.5v5c0 1.5 3 2.5 7 2.5s7-1 7-2.5v-5M5 14.5v5c0 1.5 3 2.5 7 2.5s7-1 7-2.5v-5",
  clock: "M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0M12 7v5l3 2",
  handshake: "M10 14a4 4 0 0 1 0-5.66l2.83-2.83a4 4 0 0 1 5.66 5.66l-1.42 1.42M14 10a4 4 0 0 1 0 5.66l-2.83 2.83a4 4 0 0 1-5.66-5.66l1.42-1.42",
  sword: "M20 4l-9.5 9.5M20 4h-4M20 4v4M7 11.5l5.5 5.5M9.5 14.5L4 20M3.5 20.5l.5-.5",
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
