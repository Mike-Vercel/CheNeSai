import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Db } from "@/lib/database/db";
import { getAccountUserId } from "./account";
import { authenticatePlayer, PlayerError, type PlayerAuth } from "./players";
import { readPlayerToken } from "./player-cookies";

/**
 * Chi può aprire la VISTA LIVE di una partita (/gioca/live/[sessionId]):
 *  - un giocatore della partita (cookie del giocatore: stesso browser in cui gioca);
 *  - l'host (il suo account);
 *  - una «Sorgente browser» di OBS (browser separato, senza i cookie): con il gettone `t` che il
 *    giocatore o l'host copiano dalla loro partita. Il gettone apre SOLO la vista (stato già ripulito
 *    da codice, QR e link), non fa giocare; è firmato con la chiave segreta dello schermo della
 *    partita e vale anche per le rivincite che seguono (stesso codice, catena next_session_id).
 * Nessun altro: la vista non si apre conoscendo solo l'indirizzo.
 */
export type LiveViewer = { kind: "player"; auth: PlayerAuth } | { kind: "host"; userId: string } | { kind: "token"; sessionId: string; who: string };

const TOKEN_RE = /^([0-9a-f-]{36})~([0-9a-f-]{36}|h)~([A-Za-z0-9_-]{32})$/;
/** Rivincite seguite al massimo con lo stesso gettone. */
const MAX_REMATCH_HOPS = 10;

function sign(displayKey: string, sessionId: string, who: string): string {
  return createHmac("sha256", displayKey).update(`qz-live|${sessionId}|${who}`).digest("base64url").slice(0, 32);
}

/** Gettone della vista LIVE per la Sorgente browser di OBS (`who` = id del giocatore o "h" per l'host). */
export async function liveToken(db: Db, sessionId: string, who: string): Promise<string> {
  const [s] = await db<{ display_key: string }[]>`select display_key from game_sessions where id = ${sessionId}`;
  if (!s) throw new PlayerError("NOT_FOUND", "Partita non trovata");
  return `${sessionId}~${who}~${sign(s.display_key, sessionId, who)}`;
}

async function verifyToken(db: Db, sessionId: string, raw: string): Promise<LiveViewer | null> {
  const m = TOKEN_RE.exec(raw);
  if (!m) return null;
  const [, tokenSession, who, sig] = m;
  const [s] = await db<{ display_key: string }[]>`select display_key from game_sessions where id = ${tokenSession}`;
  if (!s) return null;
  const a = Buffer.from(sign(s.display_key, tokenSession, who));
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (who !== "h") {
    const [p] = await db<{ status: string }[]>`select status from participants where id = ${who} and session_id = ${tokenSession}`;
    if (!p) return null;
    if (p.status !== "active") throw new PlayerError("KICKED", "Sei stato escluso da questa partita dalla regia");
  }
  // la partita del gettone o una sua rivincita (stesso codice)
  let cur: string | null = tokenSession;
  for (let hop = 0; cur && hop <= MAX_REMATCH_HOPS; hop++) {
    if (cur === sessionId) return { kind: "token", sessionId, who };
    const [n]: { next_session_id: string | null }[] = await db<{ next_session_id: string | null }[]>`select next_session_id from game_sessions where id = ${cur}`;
    cur = n?.next_session_id ?? null;
  }
  return null;
}

export async function authorizeLiveViewer(db: Db, sessionId: string, token: string | null = null): Promise<LiveViewer> {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new PlayerError("NOT_FOUND", "Partita non trovata");
  const [s] = await db<{ code: string; host_user_id: string | null }[]>`select code, host_user_id from game_sessions where id = ${sessionId}`;
  if (!s) throw new PlayerError("NOT_FOUND", "Partita non trovata");
  if (token) {
    const v = await verifyToken(db, sessionId, token);
    if (v) return v;
  }
  const raw = await readPlayerToken(s.code);
  if (raw) {
    try {
      const auth = await authenticatePlayer(db, s.code, raw);
      if (auth.sessionId === sessionId) return { kind: "player", auth };
    } catch (e) {
      if (e instanceof PlayerError && e.code === "KICKED") throw e;
      // token di un'altra partita o scaduto: si prova con l'account dell'host
    }
  }
  if (s.host_user_id) {
    const userId = await getAccountUserId();
    if (userId && userId === s.host_user_id) return { kind: "host", userId };
  }
  throw new PlayerError("NOT_JOINED", "La vista LIVE si apre dalla tua partita: entra prima come giocatore");
}

/** Chiave per i limiti di frequenza (voci) di chi guarda la vista LIVE. */
export function liveRateKey(v: LiveViewer): string {
  if (v.kind === "player") return `tts-live:${v.auth.participantId}`;
  if (v.kind === "host") return `tts-live-host:${v.userId}`;
  return `tts-live-t:${v.who}`;
}

/** Le voci della vista LIVE: con lo show online sempre; in salotto solo per l'host (le altre suonano dal TV). */
export function liveVoiceNeedsPhone(v: LiveViewer): boolean {
  return v.kind === "player" || (v.kind === "token" && v.who !== "h");
}

/** Gettone `t` dalla richiesta (query string). */
export function liveTokenParam(req: Request): string | null {
  const t = new URL(req.url).searchParams.get("t");
  return t && t.length <= 120 ? t : null;
}
