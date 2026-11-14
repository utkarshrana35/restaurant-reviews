/** Every kind of expected failure. The HTTP adapter maps each one to a status code. */
export type DomainErrorCode =
  | 'VALIDATION_FAILED'
  | 'INVALID_OTP'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHENTICATED'
  | 'SESSION_ENDED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SERVICE_UNAVAILABLE';

/** One field-level problem attached to an error, for showing next to the matching input. */
export interface DomainErrorDetail {
  path: string;
  message: string;
}

/**
 * An expected failure of a business rule. Use cases throw a subclass; the inbound adapter decides
 * how to present it (the HTTP adapter maps each code to a status).
 */
export abstract class DomainError extends Error {
  abstract readonly code: DomainErrorCode;

  constructor(
    message: string,
    readonly details?: DomainErrorDetail[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Input breaks a rule. Usually carries per-field details. */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_FAILED';
}

/** The emailed code is wrong, expired, used up, or was never issued. Deliberately not specific. */
export class InvalidOtpError extends DomainError {
  readonly code = 'INVALID_OTP';

  constructor() {
    const message = 'The code is incorrect or has expired';
    super(message, [{ path: 'otp', message }]);
  }
}

/** Wrong email or wrong password. Deliberately does not say which. */
export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS';

  constructor() {
    super('Invalid email or password');
  }
}

/** The request needs a signed-in user and has none. */
export class UnauthenticatedError extends DomainError {
  readonly code = 'UNAUTHENTICATED';
}

/**
 * There is no session to resume: the refresh token is missing, unknown or expired, or its account
 * is gone. Unlike UNAUTHENTICATED (an access token that has lapsed, which a refresh may fix), this
 * is final, so the client can safely forget that it was signed in.
 */
export class SessionEndedError extends DomainError {
  readonly code = 'SESSION_ENDED';

  constructor() {
    super('Your session has ended. Please sign in again.');
  }
}

/** The caller is signed in but may not do this. */
export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
}

/** The thing asked for does not exist. */
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
}

/** The change clashes with existing data, such as an email already in use. */
export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
}

/** Something the request depends on (such as the database) cannot be reached right now. */
export class ServiceUnavailableError extends DomainError {
  readonly code = 'SERVICE_UNAVAILABLE';

  constructor(options?: ErrorOptions) {
    super('The service is temporarily unavailable. Please try again shortly.');
    this.cause = options?.cause;
  }
}
