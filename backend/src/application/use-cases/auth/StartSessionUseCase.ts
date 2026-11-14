import type { IssuedTokens } from '@restaurant-reviews/common';
import type { User } from '../../../domain/entities/User';
import type { AccessTokens, RefreshTokens } from '../../ports/security';
import type { SessionRepository } from '../../ports/SessionRepository';
import type { UseCase } from '../UseCase';

type SignedInUser = Pick<User, 'id' | 'role'>;

/** Signs a user in on a device: records a session and issues both tokens for it. */
export class StartSessionUseCase implements UseCase<SignedInUser, IssuedTokens> {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly refreshTokens: RefreshTokens,
    private readonly accessTokens: AccessTokens,
    private readonly refreshTtlSeconds: number,
  ) {}

  async execute({ id: userId, role }: SignedInUser): Promise<IssuedTokens> {
    const refreshToken = this.refreshTokens.generate();
    const session = await this.sessions.create({
      userId,
      tokenHash: this.refreshTokens.hash(refreshToken),
      expiresAt: new Date(Date.now() + this.refreshTtlSeconds * 1000),
    });
    return {
      refreshToken,
      accessToken: this.accessTokens.sign({ userId, role, sessionId: session.id }),
    };
  }
}
