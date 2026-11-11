import "server-only";
import { cookies } from "next/headers";
import { IDENTITY_COOKIE, playerCookieName } from "./players";

/**
 * Cookie "Secure" in produzione (https). QZ_LAN_HTTP=1 li disattiva solo per le prove in rete
 * locale (telefoni veri su http://IP-del-PC:porta), dove il browser altrimenti li scarterebbe.
 */
const secure = process.env.NODE_ENV === "production" && process.env.QZ_LAN_HTTP !== "1";

export function safeSlot(slot: string | null | undefined): string | null {
  return slot && /^[a-z0-9]{1,8}$/.test(slot) ? slot : null;
}

export async function readPlayerToken(code: string, slot?: string | null): Promise<string | null> {
  return (await cookies()).get(playerCookieName(code, safeSlot(slot)))?.value ?? null;
}

export async function writePlayerToken(code: string, slot: string | null | undefined, token: string) {
  (await cookies()).set(playerCookieName(code, safeSlot(slot)), token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function readDeviceToken(): Promise<string | null> {
  return (await cookies()).get(IDENTITY_COOKIE)?.value ?? null;
}

export async function writeDeviceToken(token: string) {
  (await cookies()).set(IDENTITY_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
}
