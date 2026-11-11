/** Errori del gioco libero (account host e partite create dal pubblico), tradotti in HTTP da handleError. */
export type GiocoErrorCode =
  | "UNAUTHENTICATED"
  | "PROFILE_REQUIRED"
  | "PROFILE_EXISTS"
  | "USERNAME_INVALID"
  | "USERNAME_TAKEN"
  | "GIOCO_CHIUSO"
  | "QUOTA_EXHAUSTED"
  | "NOT_OWNER"
  | "NOT_FOUND"
  | "NO_PLAYERS"
  | "ACTION_NOT_ALLOWED"
  | "ARCHIVE_TOO_SMALL"
  | "RATE_LIMITED"
  | "PAIRING_INVALID"
  | "SIGNUP_CLOSED"
  | "EMAIL_TAKEN"
  | "WEAK_PASSWORD"
  | "EMAIL_LIMIT"
  | "AUTH_FAILED";

const STATUS: Record<GiocoErrorCode, number> = {
  UNAUTHENTICATED: 401,
  PROFILE_REQUIRED: 409,
  PROFILE_EXISTS: 409,
  USERNAME_INVALID: 422,
  USERNAME_TAKEN: 409,
  GIOCO_CHIUSO: 403,
  QUOTA_EXHAUSTED: 403,
  NOT_OWNER: 403,
  NOT_FOUND: 404,
  NO_PLAYERS: 409,
  ACTION_NOT_ALLOWED: 409,
  ARCHIVE_TOO_SMALL: 422,
  RATE_LIMITED: 429,
  PAIRING_INVALID: 404,
  SIGNUP_CLOSED: 403,
  EMAIL_TAKEN: 409,
  WEAK_PASSWORD: 422,
  EMAIL_LIMIT: 429,
  AUTH_FAILED: 502,
};

export class GiocoError extends Error {
  readonly code: GiocoErrorCode;
  readonly status: number;
  readonly details?: unknown;
  constructor(code: GiocoErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "GiocoError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}
