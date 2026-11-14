import type { ResetPasswordInput } from '@restaurant-reviews/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { InvalidCredentialsError, InvalidOtpError } from '../../../../src/domain/errors';
import {
  ADA_EMAIL,
  ADA_PASSWORD,
  createAuthFixture,
  type AuthFixture,
} from '../../../support/authFixture';
import { time, useControllableTime } from '../../../support/time';

useControllableTime();

const NEW_PASSWORD = 'new-battery-staple-2';

let f: AuthFixture;
let resetCode: string;

beforeEach(async () => {
  f = createAuthFixture();
  await f.registerAda();
  time.advance({ minutes: 1 });
  await f.requestPasswordReset.execute({ email: ADA_EMAIL });
  resetCode = f.emails.lastCodeFor(ADA_EMAIL)!;
});

const input = (overrides: Partial<ResetPasswordInput> = {}): ResetPasswordInput => ({
  email: ADA_EMAIL,
  otp: resetCode,
  password: NEW_PASSWORD,
  ...overrides,
});

async function failWithWrongCode(times: number): Promise<void> {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await expect(f.resetPassword.execute(input({ otp: '999999' }))).rejects.toThrow(
      InvalidOtpError,
    );
  }
}

describe('ResetPasswordUseCase', () => {
  it('sets the new password, so it signs in and the old one no longer does', async () => {
    const user = await f.resetPassword.execute(input());

    expect(user.passwordHash).toBe(`hashed:${NEW_PASSWORD}`);
    await expect(f.login.execute({ email: ADA_EMAIL, password: NEW_PASSWORD })).resolves.toEqual(
      user,
    );
    await expect(f.login.execute({ email: ADA_EMAIL, password: ADA_PASSWORD })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });

  it('ends every session of the account, and no one else’s', async () => {
    const ada = f.users.users[0]!;
    const phone = await f.startSession.execute(ada);
    const laptop = await f.startSession.execute(ada);
    await f.requestOtp.execute({ email: 'grace@example.com' });
    const grace = await f.registerUser.execute(
      f.details({ email: 'grace@example.com', otp: f.emails.lastCodeFor('grace@example.com') }),
    );
    const graceSession = await f.startSession.execute(grace);

    await f.resetPassword.execute(input());

    expect(await f.refreshSession.execute({ refreshToken: phone.refreshToken })).toBeNull();
    expect(await f.refreshSession.execute({ refreshToken: laptop.refreshToken })).toBeNull();
    expect(
      await f.refreshSession.execute({ refreshToken: graceSession.refreshToken }),
    ).not.toBeNull();
  });

  it('changes nothing when the code is wrong', async () => {
    await failWithWrongCode(1);

    expect(f.users.users[0]?.passwordHash).toBe(`hashed:${ADA_PASSWORD}`);
  });

  it('rejects the right code once it has expired', async () => {
    time.advance({ minutes: 10 });

    await expect(f.resetPassword.execute(input())).rejects.toThrow(InvalidOtpError);
  });

  it('locks the code after five wrong attempts, even for the right code', async () => {
    await failWithWrongCode(5);

    await expect(f.resetPassword.execute(input())).rejects.toThrow(InvalidOtpError);
    expect(f.users.users[0]?.passwordHash).toBe(`hashed:${ADA_PASSWORD}`);
  });

  it('cannot use a code twice', async () => {
    await f.resetPassword.execute(input());

    await expect(f.resetPassword.execute(input({ password: 'another-one-3' }))).rejects.toThrow(
      InvalidOtpError,
    );
    expect(f.users.users[0]?.passwordHash).toBe(`hashed:${NEW_PASSWORD}`);
  });

  it('only accepts a reset code, not a registration code', async () => {
    // A registration code for an address without an account, then used to "reset" it.
    await f.requestOtp.execute({ email: 'grace@example.com' });
    const registrationCode = f.emails.lastCodeFor('grace@example.com');

    await expect(
      f.resetPassword.execute(input({ email: 'grace@example.com', otp: registrationCode })),
    ).rejects.toThrow(InvalidOtpError);
  });

  it('is not accepted for registration either', async () => {
    await expect(
      f.registerUser.execute(f.details({ email: ADA_EMAIL, otp: resetCode })),
    ).rejects.toThrow(InvalidOtpError);
  });

  it('rejects a code issued for a different address', async () => {
    await expect(f.resetPassword.execute(input({ email: 'grace@example.com' }))).rejects.toThrow(
      InvalidOtpError,
    );
  });

  it('reports a removed account like a wrong code', async () => {
    f.users.users.splice(0, 1);

    await expect(f.resetPassword.execute(input())).rejects.toThrow(InvalidOtpError);
  });
});
