import type { EmailOtp, OtpKey } from '../../domain/entities/EmailOtp';

/** Holds at most one active code per email address and purpose. */
export interface OtpRepository {
  find(key: OtpKey): Promise<EmailOtp | null>;
  /** Stores the code, replacing any earlier one for the same address and purpose. */
  save(otp: EmailOtp): Promise<void>;
  /**
   * Atomically uses up one verification attempt and returns the code, or null when there is no
   * such code or all `maxAttempts` are spent. Atomic so parallel guesses cannot exceed the limit.
   */
  claimAttempt(key: OtpKey, maxAttempts: number): Promise<EmailOtp | null>;
  delete(key: OtpKey): Promise<void>;
}
