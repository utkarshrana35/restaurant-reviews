import { beforeEach, describe, expect, it } from 'vitest';
import { InvalidOtpError } from '../../../../src/domain/errors';
import { ADA_EMAIL, createAuthFixture, type AuthFixture } from '../../../support/authFixture';
import { time, useControllableTime } from '../../../support/time';

useControllableTime();

let f: AuthFixture;

beforeEach(async () => {
  f = createAuthFixture();
  await f.requestOtp.execute({ email: ADA_EMAIL });
});

async function failWithWrongCode(times: number): Promise<void> {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await expect(f.registerUser.execute(f.details({ otp: '999999' }))).rejects.toThrow(
      InvalidOtpError,
    );
  }
}

describe('RegisterUserUseCase', () => {
  it('creates the user with a hashed password when the code is right', async () => {
    const user = await f.registerUser.execute(f.details());

    expect(user).toMatchObject({ name: 'Ada', email: ADA_EMAIL, role: 'reviewer' });
    expect(user.passwordHash).toBe('hashed:correct-horse-1');
    expect(f.users.users).toHaveLength(1);
  });

  it('creates nothing when the code is wrong', async () => {
    await failWithWrongCode(1);

    expect(f.users.users).toHaveLength(0);
  });

  it('creates nothing when no code was ever requested for the address', async () => {
    const other = f.details({ email: 'nobody@example.com' });

    await expect(f.registerUser.execute(other)).rejects.toThrow(InvalidOtpError);
    expect(f.users.users).toHaveLength(0);
  });

  it('rejects a code issued for a different address', async () => {
    await f.requestOtp.execute({ email: 'grace@example.com' });
    const graceCode = f.emails.lastCodeFor('grace@example.com');

    await expect(f.registerUser.execute(f.details({ otp: graceCode }))).rejects.toThrow(
      InvalidOtpError,
    );
  });

  it('rejects the right code once it has expired', async () => {
    time.advance({ minutes: 10 });

    await expect(f.registerUser.execute(f.details())).rejects.toThrow(InvalidOtpError);
  });

  it('accepts the right code just before it expires', async () => {
    time.advance({ minutes: 9, seconds: 59 });

    await expect(f.registerUser.execute(f.details())).resolves.toBeDefined();
  });

  it('locks the code after five wrong attempts, even for the right code', async () => {
    await failWithWrongCode(5);

    await expect(f.registerUser.execute(f.details())).rejects.toThrow(InvalidOtpError);
    expect(f.users.users).toHaveLength(0);
  });

  it('still accepts the right code on the fifth attempt', async () => {
    await failWithWrongCode(4);

    await expect(f.registerUser.execute(f.details())).resolves.toBeDefined();
  });

  it('cannot reuse a code after it has created an account', async () => {
    await f.registerUser.execute(f.details());

    await expect(f.registerUser.execute(f.details({ name: 'Imposter' }))).rejects.toThrow(
      InvalidOtpError,
    );
    expect(f.users.users).toHaveLength(1);
  });
});
