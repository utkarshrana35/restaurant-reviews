import type { EmailMessage, EmailSender } from '../../src/application/ports/EmailSender';
import type { OtpRepository } from '../../src/application/ports/OtpRepository';
import type {
  AccessTokenClaims,
  AccessTokens,
  OtpCodes,
  PasswordHasher,
  RefreshTokens,
} from '../../src/application/ports/security';
import type { NewSession, SessionRepository } from '../../src/application/ports/SessionRepository';
import type { NewUser, UserRepository } from '../../src/application/ports/UserRepository';
import { EmailOtp, type OtpKey } from '../../src/domain/entities/EmailOtp';
import type { Session } from '../../src/domain/entities/Session';
import type { User } from '../../src/domain/entities/User';
import { ConflictError } from '../../src/domain/errors';

/** Accounts in an array, rejecting duplicate emails like the real unique index. */
export class InMemoryUserRepository implements UserRepository {
  readonly users: User[] = [];

  async findById(id: string): Promise<User | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async create(user: NewUser): Promise<User> {
    if (await this.findByEmail(user.email)) {
      throw new ConflictError('An account with this email already exists');
    }
    const created: User = {
      ...user,
      id: String(this.users.length + 1),
      createdAt: new Date(),
    };
    this.users.push(created);
    return created;
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<User | null> {
    const index = this.users.findIndex((user) => user.id === id);
    const current = this.users[index];
    if (!current) return null;
    const updated: User = { ...current, passwordHash };
    this.users[index] = updated;
    return updated;
  }
}

/** Verification codes in a Map, keyed by email and purpose. */
export class InMemoryOtpRepository implements OtpRepository {
  private readonly byKey = new Map<string, EmailOtp>();

  async find(key: OtpKey): Promise<EmailOtp | null> {
    return this.byKey.get(this.id(key)) ?? null;
  }

  async save(otp: EmailOtp): Promise<void> {
    this.byKey.set(this.id(otp), otp);
  }

  async claimAttempt(key: OtpKey, maxAttempts: number): Promise<EmailOtp | null> {
    const otp = this.byKey.get(this.id(key));
    if (!otp || otp.attempts >= maxAttempts) return null;
    const claimed = new EmailOtp({ ...otp, attempts: otp.attempts + 1 });
    this.byKey.set(this.id(key), claimed);
    return claimed;
  }

  async delete(key: OtpKey): Promise<void> {
    this.byKey.delete(this.id(key));
  }

  private id({ email, purpose }: OtpKey): string {
    return `${purpose}:${email}`;
  }
}

/** Sessions in an array. */
export class InMemorySessionRepository implements SessionRepository {
  readonly sessions: Session[] = [];

  async create(session: NewSession): Promise<Session> {
    const created: Session = { ...session, id: String(this.sessions.length + 1) };
    this.sessions.push(created);
    return created;
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    return this.sessions.find((session) => session.tokenHash === tokenHash) ?? null;
  }

  async deleteById(id: string): Promise<void> {
    const index = this.sessions.findIndex((session) => session.id === id);
    if (index >= 0) this.sessions.splice(index, 1);
  }

  async deleteByUser(userId: string): Promise<void> {
    const kept = this.sessions.filter((session) => session.userId !== userId);
    this.sessions.splice(0, this.sessions.length, ...kept);
  }
}

/** Readable access tokens: "access:<userId>:<role>:<sessionId>". Anything else fails. */
export class FakeAccessTokens implements AccessTokens {
  sign({ userId, role, sessionId }: AccessTokenClaims): string {
    return `access:${userId}:${role}:${sessionId}`;
  }

  verify(token: string): AccessTokenClaims | null {
    const [prefix, userId, role, sessionId] = token.split(':');
    const valid =
      prefix === 'access' && userId && sessionId && (role === 'reviewer' || role === 'owner');
    return valid ? { userId, role, sessionId } : null;
  }
}

/** Hands out predictable refresh tokens: refresh-1, refresh-2, ... */
export class SequentialRefreshTokens implements RefreshTokens {
  private issued = 0;

  generate(): string {
    this.issued += 1;
    return `refresh-${this.issued}`;
  }

  hash(token: string): string {
    return `hash(${token})`;
  }
}

/** Reversible "hash" so tests can assert that the plain password was not stored. */
export class FakePasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hashed:${password}`;
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return hash === `hashed:${password}`;
  }
}

/** Hands out predictable codes: 000001, 000002, ... */
export class SequentialOtpCodes implements OtpCodes {
  private issued = 0;

  generate(): string {
    this.issued += 1;
    return String(this.issued).padStart(6, '0');
  }

  hash(email: string, code: string): string {
    return `hash(${email}:${code})`;
  }

  matches(email: string, code: string, hash: string): boolean {
    return this.hash(email, code) === hash;
  }
}

/** Keeps every email instead of sending it, so tests can read the codes. */
export class RecordingEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  failNextSend = false;

  async send(message: EmailMessage): Promise<void> {
    if (this.failNextSend) {
      this.failNextSend = false;
      throw new Error('SMTP unavailable');
    }
    this.sent.push(message);
  }

  sentTo(email: string): EmailMessage[] {
    return this.sent.filter((message) => message.to === email);
  }

  /** The code in the most recent email to the address, or undefined if that email had none. */
  lastCodeFor(email: string): string | undefined {
    return this.sentTo(email)
      .at(-1)
      ?.text.match(/\b\d{6}\b/)?.[0];
  }
}
