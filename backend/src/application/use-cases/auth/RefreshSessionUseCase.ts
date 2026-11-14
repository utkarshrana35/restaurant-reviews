import type { User } from '../../../domain/entities/User';
import type { AccessTokens, RefreshTokens } from '../../ports/security';
import type { SessionRepository } from '../../ports/SessionRepository';
import type { UserRepository } from '../../ports/UserRepository';
import type { UseCase } from '../UseCase';

/** The user behind a live session, with a new access token for them. */
export interface RefreshedSession {
  user: User;
  accessToken: string;
}

/**
 * Exchanges a refresh token for a new access token, as long as its session is still live.
 * Resolves null when there is nothing to resume: no token, an unknown one, an expired session,
 * or an account that no longer exists.
 *
 * This is where the database is consulted, so it is also where a removed account is cut off.
 */
export class RefreshSessionUseCase implements UseCase<
  { refreshToken?: string },
  RefreshedSession | null
> {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly refreshTokens: RefreshTokens,
    private readonly accessTokens: AccessTokens,
  ) {}

  async execute({ refreshToken }: { refreshToken?: string }): Promise<RefreshedSession | null> {
    if (!refreshToken) return null;

    const session = await this.sessions.findByTokenHash(this.refreshTokens.hash(refreshToken));
    if (!session) return null;

    const expired = Date.now() >= session.expiresAt.getTime();
    const user = expired ? null : await this.users.findById(session.userId);
    if (!user) {
      // Expired, or its account is gone: the session can never be used again.
      await this.sessions.deleteById(session.id);
      return null;
    }

    return {
      user,
      accessToken: this.accessTokens.sign({
        userId: user.id,
        role: user.role,
        sessionId: session.id,
      }),
    };
  }
}
