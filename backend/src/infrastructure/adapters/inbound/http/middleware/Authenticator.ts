import type { Role } from '@restaurant-reviews/common';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AuthenticateUseCase } from '../../../../../application/use-cases/auth/AuthenticateUseCase';
import { ForbiddenError, UnauthenticatedError } from '../../../../../domain/errors';
import type { AuthCookies } from '../AuthCookies';

// The scheme is case-insensitive (RFC 9110); the token itself is taken as sent.
const BEARER = /^Bearer +(\S+)$/i;

/** Express middleware that identifies the caller and enforces sign-in and role. */
export class Authenticator {
  constructor(
    private readonly cookies: AuthCookies,
    private readonly authenticate: AuthenticateUseCase,
  ) {}

  /**
   * For protected routes: the request must carry a valid access token, in the access cookie or
   * (for mobile clients) an `Authorization: Bearer` header, otherwise it is rejected
   * with 401 and the handler never runs. Sets `req.auth` from the token's claims.
   */
  readonly requireUser = async (req: Request, _res: Response, next: NextFunction) => {
    await this.attach(req);
    next();
  };

  /**
   * For routes that work for guests too: sets `req.auth` when there is a valid access token and
   * lets the request through without it otherwise.
   */
  readonly identify = async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await this.attach(req);
    } catch (err) {
      if (!(err instanceof UnauthenticatedError)) throw err;
    }
    next();
  };

  /**
   * For routes limited to one kind of account. Use after `requireUser`: a signed-in user with a
   * different role is rejected with 403. The role comes from the signed token, so the caller
   * cannot choose it.
   */
  requireRole(role: Role): RequestHandler {
    return (req, _res, next) => {
      if (!req.auth) {
        next(new UnauthenticatedError('Sign in to continue'));
      } else if (req.auth.role !== role) {
        next(new ForbiddenError('Your account type cannot do this'));
      } else {
        next();
      }
    };
  }

  private async attach(req: Request): Promise<void> {
    req.auth = await this.authenticate.execute({ accessToken: this.readAccessToken(req) });
  }

  /**
   * The header wins over the cookie: a client sends it on purpose, while the cookie may be left
   * over in the jar. A bearer token is not sent automatically, so it is no CSRF vector.
   */
  private readAccessToken(req: Request): string | undefined {
    return BEARER.exec(req.get('authorization') ?? '')?.[1] ?? this.cookies.readAccessToken(req);
  }
}
