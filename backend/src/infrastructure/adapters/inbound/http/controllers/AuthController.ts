import type {
  LoginInput,
  RefreshedDto,
  RefreshInput,
  RegisterInput,
  RequestOtpInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  SessionDto,
  SessionStartedDto,
} from '@restaurant-reviews/common';
import type { Request, Response } from 'express';
import type { EndSessionUseCase } from '../../../../../application/use-cases/auth/EndSessionUseCase';
import type { GetCurrentUserUseCase } from '../../../../../application/use-cases/auth/GetCurrentUserUseCase';
import type { LoginUseCase } from '../../../../../application/use-cases/auth/LoginUseCase';
import type { RefreshSessionUseCase } from '../../../../../application/use-cases/auth/RefreshSessionUseCase';
import type { RegisterUserUseCase } from '../../../../../application/use-cases/auth/RegisterUserUseCase';
import type { RequestOtpUseCase } from '../../../../../application/use-cases/auth/RequestOtpUseCase';
import type { RequestPasswordResetUseCase } from '../../../../../application/use-cases/auth/RequestPasswordResetUseCase';
import type { ResetPasswordUseCase } from '../../../../../application/use-cases/auth/ResetPasswordUseCase';
import type { StartSessionUseCase } from '../../../../../application/use-cases/auth/StartSessionUseCase';
import type { User } from '../../../../../domain/entities/User';
import { SessionEndedError } from '../../../../../domain/errors';
import type { AuthCookies } from '../AuthCookies';
import { toUserDto } from '../presenters/toUserDto';

// Request bodies are typed by the schema each route validates with before the handler runs.
type Body<T> = Request<unknown, unknown, T>;

/**
 * Sent by a mobile client to also receive the tokens in the body of a sign-in answer. A browser
 * never sends it, so page script never sees the tokens.
 */
export const CLIENT_HEADER = 'X-Client';
export const MOBILE_CLIENT = 'mobile';

function isMobileClient(req: Body<unknown>): boolean {
  return req.get(CLIENT_HEADER) === MOBILE_CLIENT;
}

/** The use cases the auth endpoints call. */
export interface AuthUseCases {
  requestOtp: RequestOtpUseCase;
  registerUser: RegisterUserUseCase;
  requestPasswordReset: RequestPasswordResetUseCase;
  resetPassword: ResetPasswordUseCase;
  login: LoginUseCase;
  startSession: StartSessionUseCase;
  refreshSession: RefreshSessionUseCase;
  endSession: EndSessionUseCase;
  getCurrentUser: GetCurrentUserUseCase;
}

/**
 * Handles the `/api/auth` endpoints: registration, sign-in, password reset, refresh, sign-out
 * and session.
 */
export class AuthController {
  constructor(
    private readonly useCases: AuthUseCases,
    private readonly cookies: AuthCookies,
  ) {}

  readonly requestOtp = async (req: Body<RequestOtpInput>, res: Response): Promise<void> => {
    await this.useCases.requestOtp.execute(req.body);
    // Always the same answer, whatever the state of the address.
    res.status(204).end();
  };

  readonly register = async (req: Body<RegisterInput>, res: Response): Promise<void> => {
    const user = await this.useCases.registerUser.execute(req.body);
    res.status(201).json(await this.signIn(req, res, user));
  };

  readonly requestPasswordReset = async (
    req: Body<RequestPasswordResetInput>,
    res: Response,
  ): Promise<void> => {
    await this.useCases.requestPasswordReset.execute(req.body);
    // Always the same answer, whether or not the address has an account.
    res.status(204).end();
  };

  /** Sets the new password, which ends every other session, and signs the user in here. */
  readonly resetPassword = async (req: Body<ResetPasswordInput>, res: Response): Promise<void> => {
    const user = await this.useCases.resetPassword.execute(req.body);
    res.json(await this.signIn(req, res, user));
  };

  readonly login = async (req: Body<LoginInput>, res: Response): Promise<void> => {
    const user = await this.useCases.login.execute(req.body);
    res.json(await this.signIn(req, res, user));
  };

  /**
   * The signed-in user's profile. A guest gets `{ user: null }`, not an error.
   *
   * This is the one place the user record is read for an authenticated request: the name and
   * email shown in the UI are not in the access token. That makes it the checkpoint where a
   * still-valid token for an account that no longer exists is caught. The UI calls this on every
   * page load, so such a user is treated as signed out at once: the session is ended and the
   * cookies are cleared, without waiting for the access token to expire.
   */
  readonly session = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) {
      res.json({ user: null } satisfies SessionDto);
      return;
    }

    const user = await this.useCases.getCurrentUser.execute({ userId: req.auth.userId });
    if (!user) {
      await this.useCases.endSession.execute({ sessionId: req.auth.sessionId });
      this.cookies.clear(res);
    }
    res.json({ user: user ? toUserDto(user) : null } satisfies SessionDto);
  };

  /**
   * Exchanges the refresh token for a new access token. The only endpoint that receives the
   * refresh cookie. With nothing to resume it clears the cookies and answers 401 SESSION_ENDED.
   *
   * That answer is the only one that means the session is over. The client forgets it was signed
   * in on that answer alone; any other failure (the API unreachable, a 5xx, a 429) says nothing
   * about the session, which may still be valid.
   */
  readonly refresh = async (req: Body<RefreshInput>, res: Response): Promise<void> => {
    // The body wins over the cookie, as the bearer header does for the access token: a client
    // sends it on purpose. It is not sent automatically, so it is no CSRF vector.
    const refreshToken = req.body.refreshToken ?? this.cookies.readRefreshToken(req);
    const refreshed = await this.useCases.refreshSession.execute({ refreshToken });

    if (!refreshed) {
      // Set on the response before the error handler writes it, so the cookies are still cleared.
      this.cookies.clear(res);
      throw new SessionEndedError();
    }
    this.cookies.setAccessToken(res, refreshed.accessToken);
    const body: RefreshedDto = { user: toUserDto(refreshed.user) };
    if (isMobileClient(req)) body.accessToken = refreshed.accessToken;
    res.json(body);
  };

  /** Requires a valid access token, which names the session to end. */
  readonly logout = async (req: Request, res: Response): Promise<void> => {
    if (req.auth) await this.useCases.endSession.execute({ sessionId: req.auth.sessionId });
    this.cookies.clear(res);
    res.status(204).end();
  };

  /** Starts a session for the user and builds the answer, with the tokens for a mobile client. */
  private async signIn(req: Body<unknown>, res: Response, user: User): Promise<SessionStartedDto> {
    const tokens = await this.useCases.startSession.execute(user);
    this.cookies.start(res, tokens);
    const body: SessionStartedDto = { user: toUserDto(user) };
    if (isMobileClient(req)) body.tokens = tokens;
    return body;
  }
}
