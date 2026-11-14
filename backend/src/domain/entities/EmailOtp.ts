import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES,
} from '@restaurant-reviews/common';

/**
 * What a code proves the caller may do. Each purpose has its own code per address, so asking
 * for one kind never replaces or uses up the other, and a code can only be used for its own.
 */
export type OtpPurpose = 'registration' | 'password_reset';

/** Names one code: the address it was sent to, and what it is for. */
export interface OtpKey {
  email: string;
  purpose: OtpPurpose;
}

/** The stored state of a verification code. */
export interface EmailOtpProps extends OtpKey {
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  lastSentAt: Date;
}

/** A one-time code emailed to prove ownership of an address. Only its hash is ever stored. */
export class EmailOtp {
  static readonly MAX_ATTEMPTS = OTP_MAX_ATTEMPTS;

  readonly email: string;
  readonly purpose: OtpPurpose;
  readonly codeHash: string;
  readonly expiresAt: Date;
  readonly attempts: number;
  readonly lastSentAt: Date;

  constructor(props: EmailOtpProps) {
    this.email = props.email;
    this.purpose = props.purpose;
    this.codeHash = props.codeHash;
    this.expiresAt = props.expiresAt;
    this.attempts = props.attempts;
    this.lastSentAt = props.lastSentAt;
  }

  /** A fresh code: no attempts used, valid for the standard lifetime from `now`. */
  static issue({ email, purpose }: OtpKey, codeHash: string, now: Date): EmailOtp {
    return new EmailOtp({
      email,
      purpose,
      codeHash,
      expiresAt: new Date(now.getTime() + OTP_TTL_MINUTES * 60_000),
      attempts: 0,
      lastSentAt: now,
    });
  }

  isExpired(now: Date): boolean {
    return now.getTime() >= this.expiresAt.getTime();
  }

  /** Whether enough time has passed since the last send to issue another code. */
  canResend(now: Date): boolean {
    return now.getTime() - this.lastSentAt.getTime() >= OTP_RESEND_COOLDOWN_SECONDS * 1000;
  }
}
