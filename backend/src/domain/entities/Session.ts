/**
 * One sign-in on one device. It exists on the server, so it can be ended there: deleting it
 * stops its refresh token from producing any more access tokens.
 */
export interface Session {
  readonly id: string;
  readonly userId: string;
  /** Hash of the refresh token. The token itself is only ever held by the browser. */
  readonly tokenHash: string;
  readonly expiresAt: Date;
}
