import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { OTP_LENGTH } from '@restaurant-reviews/common';
import type { OtpCodes } from '../../../../application/ports/security';

/** Random numeric codes, stored as a keyed HMAC so the database alone cannot reveal them. */
export class CryptoOtpCodes implements OtpCodes {
  /** @param secret Keys the hash, so a leaked database alone is not enough to brute-force codes. */
  constructor(private readonly secret: string) {}

  generate(): string {
    return randomInt(0, 10 ** OTP_LENGTH)
      .toString()
      .padStart(OTP_LENGTH, '0');
  }

  hash(email: string, code: string): string {
    return createHmac('sha256', this.secret).update(`${email}:${code}`).digest('hex');
  }

  matches(email: string, code: string, hash: string): boolean {
    const expected = Buffer.from(hash, 'hex');
    const actual = Buffer.from(this.hash(email, code), 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
