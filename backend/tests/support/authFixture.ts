import type { RegisterInput } from '@restaurant-reviews/common';
import { AuthenticateUseCase } from '../../src/application/use-cases/auth/AuthenticateUseCase';
import { EndSessionUseCase } from '../../src/application/use-cases/auth/EndSessionUseCase';
import { LoginUseCase } from '../../src/application/use-cases/auth/LoginUseCase';
import { RefreshSessionUseCase } from '../../src/application/use-cases/auth/RefreshSessionUseCase';
import { RegisterUserUseCase } from '../../src/application/use-cases/auth/RegisterUserUseCase';
import { EmailCodes } from '../../src/application/services/EmailCodes';
import { RequestOtpUseCase } from '../../src/application/use-cases/auth/RequestOtpUseCase';
import { RequestPasswordResetUseCase } from '../../src/application/use-cases/auth/RequestPasswordResetUseCase';
import { ResetPasswordUseCase } from '../../src/application/use-cases/auth/ResetPasswordUseCase';
import { StartSessionUseCase } from '../../src/application/use-cases/auth/StartSessionUseCase';
import type { User } from '../../src/domain/entities/User';
import {
  FakeAccessTokens,
  FakePasswordHasher,
  InMemoryOtpRepository,
  InMemorySessionRepository,
  InMemoryUserRepository,
  RecordingEmailSender,
  SequentialOtpCodes,
  SequentialRefreshTokens,
} from './fakes';

/** The account most auth tests register and sign in with. */
export const ADA_EMAIL = 'ada@example.com';
export const ADA_PASSWORD = 'correct-horse-1';
/** Refresh token lifetime used by the fixture: the 7-day default. */
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

/** The auth use cases wired to in-memory fakes, for tests that need no database. */
export function createAuthFixture() {
  const users = new InMemoryUserRepository();
  const otps = new InMemoryOtpRepository();
  const emails = new RecordingEmailSender();
  const codes = new SequentialOtpCodes();
  const hasher = new FakePasswordHasher();

  const sessions = new InMemorySessionRepository();
  const emailCodes = new EmailCodes(otps, codes, emails);

  const requestOtp = new RequestOtpUseCase(users, emailCodes);
  const registerUser = new RegisterUserUseCase(users, emailCodes, hasher);
  const requestPasswordReset = new RequestPasswordResetUseCase(users, emailCodes);
  const resetPassword = new ResetPasswordUseCase(users, sessions, emailCodes, hasher);
  const login = new LoginUseCase(users, hasher);

  const refreshTokens = new SequentialRefreshTokens();
  const accessTokens = new FakeAccessTokens();
  const startSession = new StartSessionUseCase(
    sessions,
    refreshTokens,
    accessTokens,
    REFRESH_TTL_SECONDS,
  );
  const refreshSession = new RefreshSessionUseCase(users, sessions, refreshTokens, accessTokens);
  const endSession = new EndSessionUseCase(sessions);
  const authenticate = new AuthenticateUseCase(accessTokens);

  /** Valid registration input for Ada; the first code issued by the fixture is 000001. */
  const details = (overrides: Partial<RegisterInput> = {}): RegisterInput => ({
    name: 'Ada',
    email: ADA_EMAIL,
    password: ADA_PASSWORD,
    role: 'reviewer',
    otp: '000001',
    ...overrides,
  });

  const registerAda = async (): Promise<User> => {
    await requestOtp.execute({ email: ADA_EMAIL });
    return registerUser.execute(details({ otp: emails.lastCodeFor(ADA_EMAIL) }));
  };

  return {
    users,
    otps,
    sessions,
    emails,
    requestOtp,
    registerUser,
    requestPasswordReset,
    resetPassword,
    login,
    startSession,
    refreshSession,
    endSession,
    authenticate,
    details,
    registerAda,
  };
}

export type AuthFixture = ReturnType<typeof createAuthFixture>;
