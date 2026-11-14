import type { ResetPasswordInput } from '@restaurant-reviews/common';
import type { OtpKey } from '../../../domain/entities/EmailOtp';
import type { User } from '../../../domain/entities/User';
import { InvalidOtpError } from '../../../domain/errors';
import type { PasswordHasher } from '../../ports/security';
import type { SessionRepository } from '../../ports/SessionRepository';
import type { UserRepository } from '../../ports/UserRepository';
import type { EmailCodes } from '../../services/EmailCodes';
import type { UseCase } from '../UseCase';

/**
 * Sets a new password for the account, given the reset code emailed to its address. Every
 * existing session is then ended, so someone signed in with the old password (the reason for a
 * reset, often) is signed out everywhere. Returns the user, for the caller to sign in afresh.
 */
export class ResetPasswordUseCase implements UseCase<ResetPasswordInput, User> {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly emailCodes: EmailCodes,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute({ email, otp, password }: ResetPasswordInput): Promise<User> {
    const key: OtpKey = { email, purpose: 'password_reset' };
    await this.emailCodes.verify(key, otp);

    // A code is only ever sent to an address with an account, but the account may have been
    // removed since. Reported like a wrong code, so nothing about the account is revealed.
    const account = await this.users.findByEmail(email);
    const user =
      account &&
      (await this.users.setPasswordHash(account.id, await this.passwordHasher.hash(password)));
    if (!user) throw new InvalidOtpError();

    await this.sessions.deleteByUser(user.id);
    // Single use: the code cannot set the password again.
    await this.emailCodes.discard(key);
    return user;
  }
}
