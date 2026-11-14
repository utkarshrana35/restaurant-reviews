import type { IssuedTokens } from '@restaurant-reviews/common';
import type { CookieOptions, Request, Response } from 'express';

/** Holds the access token. Scoped to the API, so page and asset requests never carry it. */
export const ACCESS_COOKIE_NAME = 'access_token';
const ACCESS_COOKIE_PATH = '/api';

/** Holds the refresh token. Scoped to the refresh endpoint, the only place it is ever sent. */
export const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/auth/refresh';

// Only the parsed cookies are read, so a request with any typed body or params will do.
type CookieSource = Pick<Request, 'cookies'>;

/** How long each cookie lives, and whether it is HTTPS-only. */
export interface AuthCookieConfig {
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  /** Send the cookies over HTTPS only. On in production. */
  secure: boolean;
}

/**
 * Carries the tokens in HttpOnly cookies, each scoped by path to where it is needed:
 * the access token to the API, the refresh token to the refresh endpoint alone.
 */
export class AuthCookies {
  constructor(private readonly config: AuthCookieConfig) {}

  /** Sets everything a new session needs. */
  start(res: Response, { accessToken, refreshToken }: IssuedTokens): void {
    this.setAccessToken(res, accessToken);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      ...this.refreshOptions,
      maxAge: this.config.refreshTtlSeconds * 1000,
    });
  }

  setAccessToken(res: Response, accessToken: string): void {
    res.cookie(ACCESS_COOKIE_NAME, accessToken, {
      ...this.accessOptions,
      maxAge: this.config.accessTtlSeconds * 1000,
    });
  }

  clear(res: Response): void {
    // A cookie is only removed when the path matches the one it was set with.
    res.clearCookie(ACCESS_COOKIE_NAME, this.accessOptions);
    res.clearCookie(REFRESH_COOKIE_NAME, this.refreshOptions);
  }

  readAccessToken(req: CookieSource): string | undefined {
    return this.read(req, ACCESS_COOKIE_NAME);
  }

  readRefreshToken(req: CookieSource): string | undefined {
    return this.read(req, REFRESH_COOKIE_NAME);
  }

  private read(req: CookieSource, name: string): string | undefined {
    const value: unknown = req.cookies?.[name];
    return typeof value === 'string' && value !== '' ? value : undefined;
  }

  private get accessOptions(): CookieOptions {
    return {
      httpOnly: true,
      // Lax: withheld from cross-site POSTs (CSRF defence).
      sameSite: 'lax',
      secure: this.config.secure,
      path: ACCESS_COOKIE_PATH,
    };
  }

  private get refreshOptions(): CookieOptions {
    return {
      httpOnly: true,
      // Strict: only our own pages ever call the refresh endpoint.
      sameSite: 'strict',
      secure: this.config.secure,
      path: REFRESH_COOKIE_PATH,
    };
  }
}
