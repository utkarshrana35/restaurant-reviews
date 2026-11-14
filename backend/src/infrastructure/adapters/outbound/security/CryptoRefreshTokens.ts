import { createHash, randomBytes } from 'node:crypto';
import type { RefreshTokens } from '../../../../application/ports/security';

/** Random refresh tokens, stored as a SHA-256 hash. */
export class CryptoRefreshTokens implements RefreshTokens {
  generate(): string {
    // 256 bits from the OS random source: not guessable.
    return randomBytes(32).toString('base64url');
  }

  hash(token: string): string {
    // A fast hash is enough here: unlike a password, the input is already high-entropy.
    return createHash('sha256').update(token).digest('hex');
  }
}
