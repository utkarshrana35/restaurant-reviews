import { isValidObjectId } from 'mongoose';
import type {
  NewSession,
  SessionRepository,
} from '../../../../application/ports/SessionRepository';
import type { Session } from '../../../../domain/entities/Session';
import { SessionModel, type SessionDocument } from './models/SessionModel';
import { MongooseRepository } from './MongooseRepository';

/** Sessions in MongoDB, expired by a TTL index. */
export class MongooseSessionRepository extends MongooseRepository implements SessionRepository {
  async create({ userId, tokenHash, expiresAt }: NewSession): Promise<Session> {
    const doc = await this.run(() => SessionModel.create({ user: userId, tokenHash, expiresAt }), {
      // Not retried: a retry after a lost reply would collide with the first insert's token hash.
      retry: false,
    });
    return this.toEntity(doc);
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const doc = await this.run(() => SessionModel.findOne({ tokenHash }));
    return doc ? this.toEntity(doc) : null;
  }

  async deleteById(id: string): Promise<void> {
    if (!isValidObjectId(id)) return;
    await this.run(() => SessionModel.deleteOne({ _id: id }));
  }

  async deleteByUser(userId: string): Promise<void> {
    if (!isValidObjectId(userId)) return;
    await this.run(() => SessionModel.deleteMany({ user: userId }));
  }

  private toEntity(doc: SessionDocument): Session {
    return {
      id: doc.id,
      userId: doc.user.toString(),
      tokenHash: doc.tokenHash,
      expiresAt: doc.expiresAt,
    };
  }
}
