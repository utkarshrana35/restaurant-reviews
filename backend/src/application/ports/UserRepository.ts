import type { Role } from '@restaurant-reviews/common';
import type { User } from '../../domain/entities/User';

/** Everything needed to create an account. */
export interface NewUser {
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
}

/** Stores accounts. Implemented with Mongoose. */
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  /** Rejects with ConflictError when the email is already taken. */
  create(user: NewUser): Promise<User>;
  /** Replaces the account's password. Returns the updated user, or null if it no longer exists. */
  setPasswordHash(id: string, passwordHash: string): Promise<User | null>;
}
