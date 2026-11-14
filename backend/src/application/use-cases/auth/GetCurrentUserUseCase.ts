import type { User } from '../../../domain/entities/User';
import type { UserRepository } from '../../ports/UserRepository';
import type { UseCase } from '../UseCase';

/**
 * Loads the signed-in user's own record, for the places that show profile details (name, email)
 * which the access token does not carry. Resolves null if the account no longer exists.
 */
export class GetCurrentUserUseCase implements UseCase<{ userId: string }, User | null> {
  constructor(private readonly users: UserRepository) {}

  execute({ userId }: { userId: string }): Promise<User | null> {
    return this.users.findById(userId);
  }
}
