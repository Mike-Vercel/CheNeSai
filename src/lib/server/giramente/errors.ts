/** Errori di GIRAMENTE!, tradotti in HTTP da handleError (src/lib/http.ts). */
export type GiramenteErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "NOT_MEMBER"
  | "FORBIDDEN"
  | "ROOM_CLOSED"
  | "SHARED_ROOM"
  | "WRONG_PHASE"
  | "NOT_YOUR_TURN"
  | "NOT_ENOUGH_PLAYERS"
  | "ROOM_FULL"
  | "VALIDATION"
  | "NICKNAME_TAKEN"
  | "KICKED"
  | "RATE_LIMITED"
  | "TOO_LATE"
  | "ALREADY_ANSWERED"
  | "NOT_AVAILABLE"
  | "PAUSED"
  | "BUSY";

const STATUS: Record<GiramenteErrorCode, number> = {
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  NOT_MEMBER: 403,
  FORBIDDEN: 403,
  ROOM_CLOSED: 409,
  SHARED_ROOM: 409,
  WRONG_PHASE: 409,
  NOT_YOUR_TURN: 403,
  NOT_ENOUGH_PLAYERS: 409,
  ROOM_FULL: 409,
  VALIDATION: 422,
  NICKNAME_TAKEN: 409,
  KICKED: 403,
  RATE_LIMITED: 429,
  TOO_LATE: 409,
  ALREADY_ANSWERED: 409,
  NOT_AVAILABLE: 409,
  PAUSED: 409,
  BUSY: 503,
};

export class GiramenteError extends Error {
  readonly code: GiramenteErrorCode;
  readonly status: number;
  readonly details?: unknown;
  constructor(code: GiramenteErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "GiramenteError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}
