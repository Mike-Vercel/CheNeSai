/**
 * Nome fisso del cookie di sessione admin: uguale per server e browser anche quando il browser
 * raggiunge Supabase con un indirizzo diverso (es. dal telefono in rete locale), altrimenti
 * il nome derivato dall'indirizzo cambierebbe e il login non verrebbe riconosciuto.
 */
export const AUTH_COOKIE_NAME = "sb-qz-auth-token";

/**
 * Indirizzo di Supabase visto dal browser. Se l'app è configurata con Supabase "locale"
 * (localhost/127.0.0.1) ma la pagina è aperta da un altro dispositivo (http://IP-del-PC:porta),
 * si usa lo stesso host della pagina: così i telefoni in Wi-Fi funzionano anche se l'IP cambia.
 */
export function browserSupabaseUrl(configured: string): string {
  if (typeof window === "undefined") return configured;
  try {
    const u = new URL(configured);
    const local = u.hostname === "127.0.0.1" || u.hostname === "localhost";
    const pageHost = window.location.hostname;
    if (local && pageHost !== "localhost" && pageHost !== "127.0.0.1") {
      u.hostname = pageHost;
      return u.toString().replace(/\/$/, "");
    }
  } catch {
    // indirizzo non valido: si usa così com'è
  }
  return configured;
}
