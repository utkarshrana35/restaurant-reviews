import type { AccessTokenClaims } from '../application/ports/security';

declare global {
  namespace Express {
    interface Request {
      /**
       * Who is making the request (user id, role, session id), taken from a valid access token.
       * Set by Authenticator; always present after `requireUser`.
       */
      auth?: AccessTokenClaims;
      /** The query string as parsed by `validateQuery`, for routes that use it. */
      validatedQuery?: unknown;
    }
  }
}
