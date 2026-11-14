import { beforeEach, describe, expect, it } from 'vitest';
import { InvalidCredentialsError } from '../../../../src/domain/errors';
import {
  ADA_EMAIL,
  ADA_PASSWORD,
  createAuthFixture,
  type AuthFixture,
} from '../../../support/authFixture';

let f: AuthFixture;

beforeEach(async () => {
  f = createAuthFixture();
  await f.registerAda();
});

describe('LoginUseCase', () => {
  it('returns the user for the right password', async () => {
    const user = await f.login.execute({ email: ADA_EMAIL, password: ADA_PASSWORD });

    expect(user.email).toBe(ADA_EMAIL);
  });

  it('fails the same way for a wrong password and an unknown email', async () => {
    const wrongPassword = f.login.execute({ email: ADA_EMAIL, password: 'wrong-password-1' });
    const unknownEmail = f.login.execute({ email: 'nobody@example.com', password: ADA_PASSWORD });

    await expect(wrongPassword).rejects.toThrow(InvalidCredentialsError);
    await expect(unknownEmail).rejects.toThrow(InvalidCredentialsError);
    await expect(wrongPassword).rejects.toThrow('Invalid email or password');
    await expect(unknownEmail).rejects.toThrow('Invalid email or password');
  });
});
