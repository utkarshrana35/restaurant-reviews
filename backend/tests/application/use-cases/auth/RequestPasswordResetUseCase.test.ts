import { beforeEach, describe, expect, it } from 'vitest';
import { ADA_EMAIL, createAuthFixture, type AuthFixture } from '../../../support/authFixture';
import { time, useControllableTime } from '../../../support/time';

useControllableTime();

let f: AuthFixture;

beforeEach(async () => {
  f = createAuthFixture();
  await f.registerAda();
  // Past the cooldown of the registration code, though resets have their own (see below).
  time.advance({ minutes: 1 });
});

describe('RequestPasswordResetUseCase', () => {
  it('emails a reset code to an address with an account and stores only its hash', async () => {
    await f.requestPasswordReset.execute({ email: ADA_EMAIL });

    expect(f.emails.sentTo(ADA_EMAIL).at(-1)?.subject).toMatch(/password reset code/i);
    const code = f.emails.lastCodeFor(ADA_EMAIL);
    const stored = await f.otps.find({ email: ADA_EMAIL, purpose: 'password_reset' });
    expect(stored?.codeHash).toBe(`hash(${ADA_EMAIL}:${code})`);
  });

  it('emails a notice with no code to an address without an account', async () => {
    await f.requestPasswordReset.execute({ email: 'nobody@example.com' });

    const [notice] = f.emails.sentTo('nobody@example.com');
    expect(notice?.subject).toMatch(/no restaurant reviews account/i);
    expect(f.emails.lastCodeFor('nobody@example.com')).toBeUndefined();
  });

  it('does not send again during the resend cooldown, with or without an account', async () => {
    for (const email of [ADA_EMAIL, 'nobody@example.com']) {
      await f.requestPasswordReset.execute({ email });
      time.advance({ seconds: 59 });
      await f.requestPasswordReset.execute({ email });
    }

    expect(f.emails.sentTo(ADA_EMAIL)).toHaveLength(2); // the registration code, then one reset
    expect(f.emails.sentTo('nobody@example.com')).toHaveLength(1);
  });

  it('has a cooldown and a code of its own, apart from registration', async () => {
    await f.requestOtp.execute({ email: ADA_EMAIL }); // the "already registered" notice

    await f.requestPasswordReset.execute({ email: ADA_EMAIL });
    // A registration request afterwards does not replace the reset code.
    time.advance({ minutes: 1 });
    await f.requestOtp.execute({ email: ADA_EMAIL });

    expect(f.emails.sentTo(ADA_EMAIL).map((email) => email.subject)).toEqual([
      expect.stringMatching(/verification code/),
      expect.stringMatching(/already have/),
      expect.stringMatching(/password reset code/),
      expect.stringMatching(/already have/),
    ]);
    expect(await f.otps.find({ email: ADA_EMAIL, purpose: 'password_reset' })).not.toBeNull();
  });

  it('does not start the cooldown when the email could not be sent', async () => {
    f.emails.failNextSend = true;
    await expect(f.requestPasswordReset.execute({ email: ADA_EMAIL })).rejects.toThrow(
      'SMTP unavailable',
    );

    await f.requestPasswordReset.execute({ email: ADA_EMAIL });

    expect(f.emails.lastCodeFor(ADA_EMAIL)).toBeDefined();
    expect(f.emails.sentTo(ADA_EMAIL).at(-1)?.subject).toMatch(/password reset code/i);
  });
});
