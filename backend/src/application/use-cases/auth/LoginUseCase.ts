import type { LoginInput } from '@restaurant-reviews/common';
import type { User } from '../../../domain/entities/User';
import { InvalidCredentialsError } from '../../../domain/errors';
import type { PasswordHasher } from '../../ports/security';
import type { UserRepository } from '../../ports/UserRepository';
import type { UseCase } from '../UseCase';

/** Checks an email and password and returns the account they belong to. */
export class LoginUseCase implements UseCase<LoginInput, User> {
  private decoyHash?: Promise<string>;

  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute({ email, password }: LoginInput): Promise<User> {
    const user = await this.users.findByEmail(email);

    // Verify against a decoy when the account does not exist, so an unknown email takes as long
    // to reject as a wrong password and response time does not reveal which emails are registered.
    const hash = user?.passwordHash ?? (await this.getDecoyHash());
    const passwordMatches = await this.passwordHasher.verify(password, hash);

    if (!user || !passwordMatches) {
      throw new InvalidCredentialsError();
    }
    return user;
  }

  private getDecoyHash(): Promise<string> {
    this.decoyHash ??= this.passwordHasher.hash('decoy-password-for-unknown-accounts');
    return this.decoyHash;
  }
}
