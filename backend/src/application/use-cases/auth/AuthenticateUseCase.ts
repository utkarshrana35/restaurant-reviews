import { UnauthenticatedError } from '../../../domain/errors';
import type { AccessTokenClaims, AccessTokens } from '../../ports/security';
import type { UseCase } from '../UseCase';

/**
 * Identifies the caller of a protected endpoint from their access token, or rejects the request.
 *
 * The token is signed, so its claims are trusted as they stand and no database is consulted: this
 * runs on every protected request and must stay cheap. The price is that a claim can be out of
 * date for as long as the token lives (minutes). An account removed in that window is cut off at
 * its next refresh, which does check the database.
 */
export class AuthenticateUseCase implements UseCase<{ accessToken?: string }, AccessTokenClaims> {
  constructor(private readonly accessTokens: AccessTokens) {}

  async execute({ accessToken }: { accessToken?: string }): Promise<AccessTokenClaims> {
    const claims = accessToken ? this.accessTokens.verify(accessToken) : null;
    if (!claims) {
      // One message for missing, expired and forged tokens alike.
      throw new UnauthenticatedError('Sign in to continue');
    }
    return claims;
  }
}
