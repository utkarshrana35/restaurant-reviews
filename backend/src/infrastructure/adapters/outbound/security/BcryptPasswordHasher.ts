import bcrypt from 'bcryptjs';
import type { PasswordHasher } from '../../../../application/ports/security';

/** Hashes passwords with bcrypt, which is deliberately slow to resist guessing. */
export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly rounds: number) {}

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.rounds);
  }

  verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
