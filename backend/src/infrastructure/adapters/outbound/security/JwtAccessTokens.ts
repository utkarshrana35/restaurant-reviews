import { ROLES } from '@restaurant-reviews/common';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { AccessTokenClaims, AccessTokens } from '../../../../application/ports/security';

const ALGORITHM = 'HS256';

/**
 * The claims this service puts in a token, in their JWT field names. A verified signature proves
 * the payload came from us; this checks that it also has the shape the current code expects, so a
 * token issued by an older version (or with a role that no longer exists) is rejected cleanly.
 */
const payloadSchema = z.object({
  sub: z.string().min(1),
  sid: z.string().min(1),
  role: z.enum(ROLES),
});

/** Access tokens as signed, expiring JWTs (HS256). */
export class JwtAccessTokens implements AccessTokens {
  constructor(
    private readonly secret: string,
    private readonly ttlSeconds: number,
  ) {}

  sign({ userId, role, sessionId }: AccessTokenClaims): string {
    return jwt.sign({ role, sid: sessionId }, this.secret, {
      subject: userId,
      algorithm: ALGORITHM,
      expiresIn: this.ttlSeconds,
    });
  }

  verify(token: string): AccessTokenClaims | null {
    let payload: unknown;
    try {
      // Checks the signature and expiry. Pinning the algorithm rejects tokens that claim "none"
      // or a different scheme.
      payload = jwt.verify(token, this.secret, { algorithms: [ALGORITHM] });
    } catch {
      return null;
    }

    const claims = payloadSchema.safeParse(payload);
    if (!claims.success) return null;
    return { userId: claims.data.sub, role: claims.data.role, sessionId: claims.data.sid };
  }
}
