import { beforeEach, describe, expect, it } from 'vitest';
import { InvalidOtpError } from '../../../../src/domain/errors';
import { ADA_EMAIL, createAuthFixture, type AuthFixture } from '../../../support/authFixture';
import { time, useControllableTime } from '../../../support/time';

useControllableTime();

let f: AuthFixture;

beforeEach(() => {
  f = createAuthFixture();
});

describe('RequestOtpUseCase', () => {
  it('emails a code and stores only its hash', async () => {
    await f.requestOtp.execute({ email: ADA_EMAIL });

    expect(f.emails.lastCodeFor(ADA_EMAIL)).toBe('000001');
    const stored = await f.otps.find({ email: ADA_EMAIL, purpose: 'registration' });
    expect(stored?.codeHash).toBe('hash(ada@example.com:000001)');
    expect(stored?.attempts).toBe(0);
  });

  it('does not send again during the resend cooldown', async () => {
    await f.requestOtp.execute({ email: ADA_EMAIL });
    time.advance({ seconds: 59 });
    await f.requestOtp.execute({ email: ADA_EMAIL });

    expect(f.emails.sentTo(ADA_EMAIL)).toHaveLength(1);
  });

  it('sends a new code after the cooldown, which replaces the old one', async () => {
    await f.requestOtp.execute({ email: ADA_EMAIL });
    time.advance({ seconds: 60 });
    await f.requestOtp.execute({ email: ADA_EMAIL });

    expect(f.emails.sentTo(ADA_EMAIL)).toHaveLength(2);
    await expect(f.registerUser.execute(f.details({ otp: '000001' }))).rejects.toThrow(
      InvalidOtpError,
    );
    await expect(f.registerUser.execute(f.details({ otp: '000002' }))).resolves.toBeDefined();
  });

  it('sends a notice with no code when the address already has an account', async () => {
    await f.registerAda();
    time.advance({ seconds: 60 });

    await f.requestOtp.execute({ email: ADA_EMAIL });

    expect(f.emails.sentTo(ADA_EMAIL).at(-1)?.subject).toMatch(/already have/i);
    expect(f.emails.lastCodeFor(ADA_EMAIL)).toBeUndefined();
  });

  it('does not start the cooldown when the email could not be sent', async () => {
    f.emails.failNextSend = true;
    await expect(f.requestOtp.execute({ email: ADA_EMAIL })).rejects.toThrow('SMTP unavailable');

    await f.requestOtp.execute({ email: ADA_EMAIL });

    expect(f.emails.sentTo(ADA_EMAIL)).toHaveLength(1);
  });
});
