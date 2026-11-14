import { EmailOtp, type OtpKey } from '../../domain/entities/EmailOtp';
import { InvalidOtpError } from '../../domain/errors';
import type { EmailMessage, EmailSender } from '../ports/EmailSender';
import type { OtpRepository } from '../ports/OtpRepository';
import type { OtpCodes } from '../ports/security';

/**
 * Emailed one-time codes, for every purpose: sending one with a resend cooldown, and checking
 * one with a limited number of attempts. Registration and password reset both go through here,
 * so the two follow exactly the same rules.
 */
export class EmailCodes {
  constructor(
    private readonly otps: OtpRepository,
    private readonly codes: OtpCodes,
    private readonly emailSender: EmailSender,
  ) {}

  /**
   * Emails a new code for `key`, replacing any earlier one, unless one was sent within the
   * resend cooldown, in which case nothing happens. `compose` writes the email; it may leave
   * the code out (to tell an address it has no account, say), and the cooldown still applies,
   * so that email cannot be triggered more often than a code could.
   */
  async send(key: OtpKey, compose: (code: string) => EmailMessage): Promise<void> {
    const now = new Date();
    const previous = await this.otps.find(key);
    if (previous && !previous.canResend(now)) return;

    const code = this.codes.generate();
    // Send first: if delivery fails the cooldown has not started, so the user can retry at once.
    await this.emailSender.send(compose(code));
    await this.otps.save(EmailOtp.issue(key, this.codes.hash(key.email, code), now));
  }

  /**
   * Checks a submitted code, spending one of its attempts whether it is right or wrong.
   *
   * @throws InvalidOtpError when there is no such code, it has expired, its attempts are used
   *   up, or the code is wrong. Deliberately the same error for each.
   */
  async verify(key: OtpKey, code: string): Promise<void> {
    const issued = await this.otps.claimAttempt(key, EmailOtp.MAX_ATTEMPTS);
    if (
      !issued ||
      issued.isExpired(new Date()) ||
      !this.codes.matches(key.email, code, issued.codeHash)
    ) {
      throw new InvalidOtpError();
    }
  }

  /** Removes a code once it has been used, so it cannot be replayed. */
  async discard(key: OtpKey): Promise<void> {
    await this.otps.delete(key);
  }
}
