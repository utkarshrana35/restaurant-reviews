import type { RequestOtpInput } from '@restaurant-reviews/common';
import { alreadyRegisteredEmail, otpEmail } from '../../emails/registrationEmails';
import type { UserRepository } from '../../ports/UserRepository';
import type { EmailCodes } from '../../services/EmailCodes';
import type { UseCase } from '../UseCase';

/**
 * Emails a verification code to start registration. It behaves identically from the caller's
 * point of view whether or not the address is registered or in its resend cooldown, so it cannot
 * be used to discover which emails have accounts.
 */
export class RequestOtpUseCase implements UseCase<RequestOtpInput, void> {
  constructor(
    private readonly users: UserRepository,
    private readonly emailCodes: EmailCodes,
  ) {}

  async execute({ email }: RequestOtpInput): Promise<void> {
    const alreadyRegistered = (await this.users.findByEmail(email)) !== null;
    // A registered address is told so instead of getting a code.
    await this.emailCodes.send({ email, purpose: 'registration' }, (code) =>
      alreadyRegistered ? alreadyRegisteredEmail(email) : otpEmail(email, code),
    );
  }
}
