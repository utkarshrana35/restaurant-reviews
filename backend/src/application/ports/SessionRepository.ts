import type { Session } from '../../domain/entities/Session';

/** Everything needed to record a new session. */
export interface NewSession {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

/** Stores sessions, one per signed-in device. Implemented with Mongoose. */
export interface SessionRepository {
  create(session: NewSession): Promise<Session>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  deleteById(id: string): Promise<void>;
  /** Ends every session of the user, on every device. */
  deleteByUser(userId: string): Promise<void>;
}
