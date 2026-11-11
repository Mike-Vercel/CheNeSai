import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { GameError } from "@/lib/game-engine/types";
import { PlayerError } from "@/lib/server/players";
import { CmsError } from "@/lib/server/audit";
import { AuthError } from "@/lib/auth/admin";
import { TtsError } from "@/lib/server/tts";

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });
}

export function fail(status: number, code: string, message: string, details?: unknown) {
  const body: ApiErrorBody = { error: { code, message, details } };
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const GAME_STATUS: Record<GameError["code"], number> = {
  INVALID_TRANSITION: 409,
  VERSION_CONFLICT: 409,
  NO_MORE_QUESTIONS: 409,
  NO_MORE_ROUNDS: 409,
  TIMER_RUNNING: 409,
  WHEEL_SPINNING: 409,
  TIE_NEEDS_ADMIN: 409,
  EVENT_NOT_ALLOWED: 409,
  EVENT_LIMIT: 409,
  NOT_FOUND: 404,
  NOT_TEST_SESSION: 409,
  VALIDATION: 422,
  FORBIDDEN: 403,
};

const PLAYER_STATUS: Record<PlayerError["code"], number> = {
  NOT_FOUND: 404,
  LOBBY_CLOSED: 409,
  JOIN_LOCKED: 409,
  GAME_FINISHED: 409,
  NICKNAME_INVALID: 422,
  NICKNAME_TAKEN: 409,
  RECOVERY_INVALID: 422,
  KICKED: 403,
  NOT_JOINED: 401,
  NOT_OPEN: 409,
  WRONG_QUESTION: 409,
  TOO_LATE: 409,
  ALREADY_ANSWERED: 409,
  INVALID_ANSWER: 422,
  RATE_LIMITED: 429,
};

/** Traduce gli errori di dominio in risposte HTTP coerenti. */
export function handleError(e: unknown) {
  if (e instanceof AuthError) return fail(e.status, e.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", e.message);
  if (e instanceof GameError) return fail(GAME_STATUS[e.code] ?? 400, e.code, e.message, e.details);
  if (e instanceof PlayerError) return fail(PLAYER_STATUS[e.code] ?? 400, e.code, e.message, e.details);
  if (e instanceof CmsError) return fail(e.status, "CMS_ERROR", e.message, e.details);
  if (e instanceof TtsError) return fail(e.code === "TTS_BUDGET" ? 503 : e.code === "TTS_PROVIDER" ? 502 : 409, e.code, e.message);
  if (e instanceof z.ZodError) return fail(422, "VALIDATION", "Dati non validi", e.issues);
  const pg = e as { code?: string; message?: string };
  if (pg?.code === "P0001" && pg.message?.startsWith("SESSION_FROZEN")) {
    return fail(409, "SESSION_FROZEN", "La sessione è pubblicata e non può essere modificata");
  }
  if (pg?.code === "23505") return fail(409, "CONFLICT", "Elemento già esistente");
  console.error("[quizzone] errore non gestito", e);
  return fail(500, "INTERNAL", "Errore interno del server");
}

export async function readJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new z.ZodError([{ code: "custom", path: [], message: "JSON non valido", input: undefined }]);
  }
  return schema.parse(raw);
}

/** Wrapper per le route: gestione errori uniforme. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      return handleError(e);
    }
  };
}
