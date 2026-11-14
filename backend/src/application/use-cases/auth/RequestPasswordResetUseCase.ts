import type { RequestPasswordResetInput } from '@restaurant-reviews/common';
import { noAccountEmail, passwordResetEmail } from '../../emails/passwordResetEmails';
import type { UserRepository } from '../../ports/UserRepository';
import type { EmailCodes } from '../../services/EmailCodes';
import type { UseCase } from '../UseCase';

/**
 * Emails a code for choosing a new password. Like registration, it behaves identically from the
 * caller's point of view whether or not the address has an account or is in its resend
 * cooldown: an address without an account is emailed a notice instead of a code, so even the
 * time taken gives nothing away.
 */
export class RequestPasswordResetUseCase implements UseCase<RequestPasswordResetInput, void> {
  constructor(
    private readonly users: UserRepository,
    private readonly emailCodes: EmailCodes,
  ) {}

  async execute({ email }: RequestPasswordResetInput): Promise<void> {
    const hasAccount = (await this.users.findByEmail(email)) !== null;
    await this.emailCodes.send({ email, purpose: 'password_reset' }, (code) =>
      hasAccount ? passwordResetEmail(email, code) : noAccountEmail(email),
    );
  }
}
