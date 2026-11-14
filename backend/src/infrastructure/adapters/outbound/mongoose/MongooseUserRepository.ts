import { isValidObjectId } from 'mongoose';
import type { NewUser, UserRepository } from '../../../../application/ports/UserRepository';
import type { User } from '../../../../domain/entities/User';
import { UserModel, type UserDocument } from './models/UserModel';
import { MongooseRepository } from './MongooseRepository';

/** Accounts in MongoDB. The unique index on email is the final guard against duplicates. */
export class MongooseUserRepository extends MongooseRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await this.run(() => UserModel.findById(id));
    return doc ? this.toEntity(doc) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const doc = await this.run(() => UserModel.findOne({ email }));
    return doc ? this.toEntity(doc) : null;
  }

  async create(user: NewUser): Promise<User> {
    const doc = await this.run(() => UserModel.create(user), {
      // Not retried: a retry after a lost reply would report the new account as a duplicate.
      retry: false,
      conflictMessage: 'An account with this email already exists',
    });
    return this.toEntity(doc);
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<User | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await this.run(() =>
      UserModel.findByIdAndUpdate(id, { $set: { passwordHash } }, { returnDocument: 'after' }),
    );
    return doc ? this.toEntity(doc) : null;
  }

  private toEntity(doc: UserDocument): User {
    return {
      id: doc.id,
      name: doc.name,
      email: doc.email,
      role: doc.role,
      passwordHash: doc.passwordHash,
      createdAt: doc.createdAt,
    };
  }
}
