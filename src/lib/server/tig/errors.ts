/** Errori di TAVOLI IN GUERRA!, tradotti in HTTP da handleError (src/lib/http.ts). */
export type TigErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "NOT_MEMBER"
  | "FORBIDDEN"
  | "CLOSED"
  | "WRONG_PHASE"
  | "PAUSED"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "TOO_LATE"
  | "ALREADY_SUBMITTED"
  | "ALREADY_IN_TEAM"
  | "KICKED"
  | "LOBBY_LOCKED"
  | "NOT_AVAILABLE"
  | "LIMIT"
  | "PIN_REQUIRED"
  | "PIN_WRONG"
  | "TEAM_FULL"
  | "BUSY";

const STATUS: Record<TigErrorCode, number> = {
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  NOT_MEMBER: 403,
  FORBIDDEN: 403,
  CLOSED: 409,
  WRONG_PHASE: 409,
  PAUSED: 409,
  VALIDATION: 422,
  RATE_LIMITED: 429,
  TOO_LATE: 409,
  ALREADY_SUBMITTED: 409,
  ALREADY_IN_TEAM: 409,
  KICKED: 403,
  LOBBY_LOCKED: 409,
  NOT_AVAILABLE: 409,
  LIMIT: 409,
  PIN_REQUIRED: 422,
  PIN_WRONG: 422,
  TEAM_FULL: 409,
  BUSY: 503,
};

export class TigError extends Error {
  readonly code: TigErrorCode;
  readonly status: number;
  readonly details?: unknown;
  constructor(code: TigErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "TigError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

export function tigFail(code: TigErrorCode, message: string, details?: unknown): never {
  throw new TigError(code, message, details);
}
