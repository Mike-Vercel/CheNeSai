/** Errori di PSYCO, tradotti in HTTP da handleError (src/lib/http.ts). */
export type PsycoErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "NOT_MEMBER"
  | "FORBIDDEN"
  | "ROOM_CLOSED"
  | "SHARED_ROOM"
  | "WRONG_PHASE"
  | "STALE_BALLOT"
  | "NOT_ENOUGH_PLAYERS"
  | "VALIDATION"
  | "NICKNAME_TAKEN"
  | "KICKED"
  | "RATE_LIMITED"
  | "BUSY";

const STATUS: Record<PsycoErrorCode, number> = {
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  NOT_MEMBER: 403,
  FORBIDDEN: 403,
  ROOM_CLOSED: 409,
  SHARED_ROOM: 409,
  WRONG_PHASE: 409,
  STALE_BALLOT: 409,
  NOT_ENOUGH_PLAYERS: 409,
  VALIDATION: 422,
  NICKNAME_TAKEN: 409,
  KICKED: 403,
  RATE_LIMITED: 429,
  BUSY: 503,
};

export class PsycoError extends Error {
  readonly code: PsycoErrorCode;
  readonly status: number;
  readonly details?: unknown;
  constructor(code: PsycoErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "PsycoError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}
