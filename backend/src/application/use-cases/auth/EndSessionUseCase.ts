import type { SessionRepository } from '../../ports/SessionRepository';
import type { UseCase } from '../UseCase';

/** Signs a device out by deleting its session, so its refresh token can never be used again. */
export class EndSessionUseCase implements UseCase<{ sessionId: string }, void> {
  constructor(private readonly sessions: SessionRepository) {}

  async execute({ sessionId }: { sessionId: string }): Promise<void> {
    await this.sessions.deleteById(sessionId);
  }
}
