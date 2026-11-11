import type { GamePhase, Presenter, QuestionType, RoundKind, SessionStatus } from "@/lib/game-engine/types";

export type BadgeColor = "gray" | "gold" | "green" | "red" | "blue" | "violet" | "fuchsia";

export const STATUS_INFO: Record<SessionStatus, { label: string; color: BadgeColor }> = {
  draft: { label: "Bozza", color: "gray" },
  ready: { label: "Pubblicata", color: "blue" },
  live: { label: "In onda", color: "red" },
  finished: { label: "Terminata", color: "green" },
  archived: { label: "Archiviata", color: "violet" },
};

export const ROUND_KIND: Record<RoundKind, { label: string; icon: string; hint: string }> = {
  standard: { label: "Classico", icon: "❓", hint: "Domande a risposta multipla" },
  music: { label: "Musicale", icon: "🎵", hint: "Domande con un brano audio" },
  image: { label: "Immagini", icon: "🖼️", hint: "Domande con un'immagine" },
  video: { label: "Video", icon: "🎬", hint: "Domande con una clip video" },
  category_vote: { label: "Voto categoria", icon: "🗳️", hint: "Il pubblico vota la categoria, si gioca la scelta vincente" },
  bonus: { label: "Bonus", icon: "⭐", hint: "Round speciale con punteggi maggiorati" },
  final: { label: "Finale", icon: "🏁", hint: "Round conclusivo" },
};

export const PRESENTER_LABEL: Record<Presenter, string> = {
  professore: "Il Professore",
  regina: "La Regina",
  palmino: "Palmino",
};

export const TYPE_LABEL: Record<QuestionType, string> = { single: "Singola", multiple: "Multipla" };

export const QUESTION_STATUS: Record<string, { label: string; color: BadgeColor }> = {
  draft: { label: "Bozza", color: "gray" },
  approved: { label: "Approvata", color: "green" },
  archived: { label: "Archiviata", color: "violet" },
};

export const PHASE_LABEL: Partial<Record<GamePhase, string>> = {
  READY: "Pronta",
  LOBBY: "Lobby aperta",
  INTRO: "Sigla",
  ROUND_INTRO: "Presentazione round",
  QUESTION_VISIBLE: "Domanda",
  OPTIONS_VISIBLE: "Risposte aperte",
  ANSWERS_LOCKED: "Risposte chiuse",
  ANSWER_REVEAL: "Soluzione",
  SCORE_REVEAL: "Punteggi",
  LEADERBOARD: "Classifica",
  CATEGORY_VOTING: "Votazione",
  CATEGORY_RESULT: "Esito votazione",
  SPECIAL_EVENT: "Evento Palmino",
  PAUSED: "In pausa",
  FINISHED: "Finita",
};

export const LETTERS = ["A", "B", "C", "D"] as const;
export const ANSWER_COLORS = ["#00b85c", "#e8173e", "#0a6fe6", "#7a22f0"] as const;

export const AGGREGATION_LABEL: Record<string, string> = {
  sum_points: "Somma dei punti",
  placement_points: "Punti piazzamento",
};

const dateFmt = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "Data da definire";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const out = dateFmt.format(d);
  return out.charAt(0).toUpperCase() + out.slice(1);
}

export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? "-" : dayFmt.format(d);
}

export function fmtStamp(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : shortFmt.format(d);
}

export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return n.toLocaleString("it-IT", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtPct(n: number | null | undefined, isRatio = false): string {
  if (n === null || n === undefined) return "-";
  return `${fmtNum(isRatio ? n * 100 : n, 1)}%`;
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${fmtNum(n / 1024, 0)} KB`;
  return `${fmtNum(n / 1024 / 1024, 1)} MB`;
}

export function fmtDuration(ms: number | null | undefined): string {
  if (!ms && ms !== 0) return "-";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** ISO → valore per <input type="datetime-local"> (ora locale). */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Valore datetime-local → ISO con offset locale (es. 2026-11-14T21:00:00+01:00). */
export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return `${v.length === 16 ? `${v}:00` : v}${sign}${p(off / 60)}:${p(off % 60)}`;
}

/** "" → null, altrimenti intero. */
export function intOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function correctLetters(options: { position: number; isCorrect: boolean }[]): string {
  return options
    .filter((o) => o.isCorrect)
    .map((o) => LETTERS[o.position] ?? "?")
    .join(", ");
}

/** Scarica un testo come file (esempi, report). */
export function downloadText(filename: string, text: string, mime = "application/json") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "1 domanda" / "3 domande". */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
