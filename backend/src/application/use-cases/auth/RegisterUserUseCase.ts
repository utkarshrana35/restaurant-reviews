import type { RegisterInput } from '@restaurant-reviews/common';
import type { OtpKey } from '../../../domain/entities/EmailOtp';
import type { User } from '../../../domain/entities/User';
import type { PasswordHasher } from '../../ports/security';
import type { UserRepository } from '../../ports/UserRepository';
import type { EmailCodes } from '../../services/EmailCodes';
import type { UseCase } from '../UseCase';

/** Creates the account, but only when the request carries the code emailed to that address. */
export class RegisterUserUseCase implements UseCase<RegisterInput, User> {
  constructor(
    private readonly users: UserRepository,
    private readonly emailCodes: EmailCodes,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute({ name, email, password, role, otp }: RegisterInput): Promise<User> {
    const key: OtpKey = { email, purpose: 'registration' };
    await this.emailCodes.verify(key, otp);

    const passwordHash = await this.passwordHasher.hash(password);
    // The repository's unique index settles two simultaneous registrations for one email.
    const user = await this.users.create({ name, email, role, passwordHash });

    // Single use: the code cannot be replayed once the account exists.
    await this.emailCodes.discard(key);
    return user;
  }
}
