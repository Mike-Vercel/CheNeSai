/**
 * Percorso interno a cui tornare dopo l'accesso (es. ?next=/gioca).
 * Solo percorsi dello stesso sito: niente "//altro-sito", niente URL assoluti, niente area admin.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/gioca"): string {
  if (!raw || typeof raw !== "string") return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(raw)) return fallback;
  if (raw.startsWith("/admin") || raw.startsWith("/api") || raw.startsWith("/auth")) return fallback;
  return raw.slice(0, 300);
}

/** Supabase "locale" (CLI su questo PC): consente le scorciatoie di sviluppo. */
export function isLocalSupabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const h = new URL(url).hostname;
    return h === "127.0.0.1" || h === "localhost";
  } catch {
    return false;
  }
}
