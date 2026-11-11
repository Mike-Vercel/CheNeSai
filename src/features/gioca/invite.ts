/**
 * Invito alla partita: messaggio da condividere (WhatsApp, Telegram, SMS…) col link per entrare.
 * Funzioni pure (testate) + condivisione del browser con le alternative.
 */
export interface InviteInput {
  /** codice della partita (6 caratteri) */
  code: string;
  /** link per entrare: https://…/play/CODICE */
  joinUrl: string;
  /** username dell'host, se c'è */
  host?: string | null;
}

export const INVITE_TITLE = "CHE NE SAI?! – il quiz show";

/** Link per entrare (base del sito senza barra finale). */
export function joinLink(base: string, code: string): string {
  return `${base.replace(/\/+$/, "")}/play/${encodeURIComponent(code.trim().toUpperCase())}`;
}

/** Testo dell'invito: chi invita, cosa fare, codice e link (il link sempre in fondo, su una riga sua). */
export function inviteMessage({ code, joinUrl, host }: InviteInput): string {
  const who = host?.trim() ? `${host.trim()} ti sfida` : "Ti sfido";
  return `🎤 ${who} a CHE NE SAI?!, il quiz show da giocare col telefono!\nEntra con il codice ${code.toUpperCase()} (niente app, basta un nickname):\n${joinUrl}`;
}

/** Link diretto a WhatsApp col messaggio già scritto (si sceglie a chi mandarlo). */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Condivisione nativa del sistema (Android/iOS: WhatsApp & co.). true = condiviso o annullato dall'utente. */
export async function shareInvite(input: InviteInput): Promise<"shared" | "cancelled" | "unsupported"> {
  const data: ShareData = { title: INVITE_TITLE, text: inviteMessage({ ...input, joinUrl: "" }).trim(), url: input.joinUrl };
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return "unsupported";
  try {
    if (typeof navigator.canShare === "function" && !navigator.canShare(data)) return "unsupported";
    await navigator.share(data);
    return "shared";
  } catch (e) {
    return e instanceof DOMException && e.name === "AbortError" ? "cancelled" : "unsupported";
  }
}
