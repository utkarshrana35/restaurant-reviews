import type { Role } from '@restaurant-reviews/common';

/** Hashes and checks passwords. Implemented with bcrypt. */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

/**
 * What an access token says about its bearer. Protected endpoints act on these claims directly,
 * without looking the user up, so they hold everything needed to authorise a request.
 */
export interface AccessTokenClaims {
  userId: string;
  role: Role;
  /** The session this token was issued for, so signing out can end the right one. */
  sessionId: string;
}

/**
 * Issues and checks access tokens: short-lived, signed and self-contained, so a request can be
 * authenticated from the token alone.
 */
export interface AccessTokens {
  sign(claims: AccessTokenClaims): string;
  /** Returns the claims, or null when the token is missing, tampered with or expired. */
  verify(token: string): AccessTokenClaims | null;
}

/** Creates refresh tokens: long-lived random secrets that are looked up on the server. */
export interface RefreshTokens {
  generate(): string;
  /** A one-way hash, so the stored value cannot be used as a token if the database leaks. */
  hash(token: string): string;
}

/** Creates and checks emailed verification codes. */
export interface OtpCodes {
  /** A new random numeric code. */
  generate(): string;
  /** A one-way hash bound to the email, so a code cannot be replayed for another address. */
  hash(email: string, code: string): string;
  /** Constant-time comparison of a submitted code against a stored hash. */
  matches(email: string, code: string, hash: string): boolean;
}
