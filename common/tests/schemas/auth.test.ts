import { describe, expect, it } from 'vitest';
import { EMAIL_MAX_LENGTH, NAME_MAX_LENGTH, PASSWORD_MAX_BYTES } from '../../src/constants';
import {
  emailSchema,
  loginSchema,
  newPasswordSchema,
  otpCodeSchema,
  refreshSchema,
  registerSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from '../../src/schemas/auth';

const valid = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  password: 'correct-horse-1',
  role: 'reviewer',
  otp: '123456',
};

describe('emailSchema', () => {
  it('trims and lower-cases, so one address always means one account', () => {
    expect(emailSchema.parse('  Ada@Example.COM ')).toBe('ada@example.com');
  });

  it.each([
    ['empty', ''],
    ['not an address', 'not-an-email'],
    ['missing the domain', 'ada@'],
    ['over the length limit', `${'a'.repeat(EMAIL_MAX_LENGTH)}@example.com`],
  ])('rejects an address that is %s', (_label, email) => {
    expect(emailSchema.safeParse(email).success).toBe(false);
  });
});

describe('newPasswordSchema', () => {
  it('accepts a password with a letter and a number', () => {
    expect(newPasswordSchema.safeParse('correct-horse-1').success).toBe(true);
  });

  it.each([
    ['too short', 'abc12'],
    ['without a number', 'correct-horse'],
    ['without a letter', '12345678'],
  ])('rejects a password %s', (_label, password) => {
    expect(newPasswordSchema.safeParse(password).success).toBe(false);
  });

  // bcrypt only uses the first 72 bytes, so a longer password would be silently truncated.
  it('accepts exactly the byte limit and refuses one byte more', () => {
    const atLimit = `a1${'x'.repeat(PASSWORD_MAX_BYTES - 2)}`;
    expect(newPasswordSchema.safeParse(atLimit).success).toBe(true);
    expect(newPasswordSchema.safeParse(`${atLimit}x`).success).toBe(false);
  });

  it('counts bytes, not characters: multi-byte characters use up the limit faster', () => {
    // 24 characters of 3 bytes each is 72 bytes; with "a1" in front it is 74 bytes but 26 chars.
    const multiByte = `a1${'€'.repeat(24)}`;
    expect(multiByte.length).toBeLessThan(PASSWORD_MAX_BYTES);
    expect(newPasswordSchema.safeParse(multiByte).success).toBe(false);
  });
});

describe('otpCodeSchema', () => {
  it('accepts six digits, ignoring surrounding spaces', () => {
    expect(otpCodeSchema.parse(' 123456 ')).toBe('123456');
  });

  it.each([['12345'], ['1234567'], ['12a456'], ['']])('rejects %j', (code) => {
    expect(otpCodeSchema.safeParse(code).success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('accepts a complete registration and drops unknown fields', () => {
    const parsed = registerSchema.parse({ ...valid, passwordHash: 'x', _id: 'y' });
    expect(parsed).toEqual(valid);
  });

  it.each([
    ['a blank name', { name: '   ' }, 'name'],
    ['a name over the limit', { name: 'x'.repeat(NAME_MAX_LENGTH + 1) }, 'name'],
    ['a role that does not exist', { role: 'admin' }, 'role'],
  ])('rejects %s', (_label, change, path) => {
    const result = registerSchema.safeParse({ ...valid, ...change });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(path);
  });
});

describe('loginSchema', () => {
  it('only requires a password to be present, since the rules may have changed since', () => {
    expect(loginSchema.safeParse({ email: 'ada@example.com', password: 'old' }).success).toBe(true);
  });

  it('rejects an operator object in place of a string', () => {
    const result = loginSchema.safeParse({ email: 'ada@example.com', password: { $ne: null } });
    expect(result.success).toBe(false);
  });
});

describe('refreshSchema', () => {
  it('accepts an empty body, which is what a browser sends', () => {
    expect(refreshSchema.parse({})).toEqual({});
  });

  it('accepts a refresh token from a mobile client', () => {
    expect(refreshSchema.parse({ refreshToken: 'abc' })).toEqual({ refreshToken: 'abc' });
  });

  it('rejects an empty or oversized token, and anything but a string', () => {
    expect(refreshSchema.safeParse({ refreshToken: '' }).success).toBe(false);
    expect(refreshSchema.safeParse({ refreshToken: 'a'.repeat(257) }).success).toBe(false);
    expect(refreshSchema.safeParse({ refreshToken: { $ne: null } }).success).toBe(false);
  });
});

describe('requestPasswordResetSchema', () => {
  it('normalises the address the same way as everywhere else', () => {
    expect(requestPasswordResetSchema.parse({ email: ' Ada@Example.COM ' })).toEqual({
      email: 'ada@example.com',
    });
  });
});

describe('resetPasswordSchema', () => {
  const reset = { email: 'ada@example.com', otp: '123456', password: 'new-password-2' };

  it('accepts an address, a code and a new password, and drops anything else', () => {
    expect(resetPasswordSchema.parse({ ...reset, role: 'owner' })).toEqual(reset);
  });

  it.each([
    ['a new password that breaks the rules', { password: 'short' }, 'password'],
    ['a code of the wrong length', { otp: '12345' }, 'otp'],
    ['a missing address', { email: '' }, 'email'],
  ])('rejects %s', (_label, change, path) => {
    const result = resetPasswordSchema.safeParse({ ...reset, ...change });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(path);
  });
});
