import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../../src/infrastructure/config/env';

describe('loadEnv', () => {
  it('applies defaults when nothing is set', () => {
    expect(loadEnv({})).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      MONGODB_URI: 'mongodb://127.0.0.1:27017/restaurant_reviews',
    });
  });

  it('treats an empty value as unset', () => {
    expect(loadEnv({ PORT: '' }).PORT).toBe(4000);
  });

  it('coerces PORT to a number', () => {
    expect(loadEnv({ PORT: '5001' }).PORT).toBe(5001);
  });

  it('names the offending variable when a value is invalid', () => {
    expect(() => loadEnv({ PORT: 'abc', MONGODB_URI: 'postgres://x' })).toThrow(
      /Invalid environment configuration:[\s\S]*PORT[\s\S]*MONGODB_URI/,
    );
  });
});

describe('loadEnv email provider', () => {
  it('prints emails to the log by default', () => {
    expect(loadEnv({}).EMAIL_PROVIDER).toBe('console');
  });

  it('requires a host for smtp and a region for ses', () => {
    expect(() => loadEnv({ EMAIL_PROVIDER: 'smtp' })).toThrow(/SMTP_HOST/);
    expect(() => loadEnv({ EMAIL_PROVIDER: 'ses' })).toThrow(/AWS_REGION/);
    expect(loadEnv({ EMAIL_PROVIDER: 'ses', AWS_REGION: 'eu-west-1' }).EMAIL_PROVIDER).toBe('ses');
  });

  it('accepts SMTP credentials as a pair, or none', () => {
    const smtp = { EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'smtp.example.com' };
    expect(loadEnv(smtp).SMTP_USER).toBeUndefined();
    expect(loadEnv({ ...smtp, SMTP_USER: 'mailer', SMTP_PASS: 'secret' }).SMTP_USER).toBe('mailer');
  });

  it.each([
    ['a user without a password', { SMTP_USER: 'mailer' }],
    ['a password without a user', { SMTP_PASS: 'secret' }],
  ])('refuses %s at startup rather than at the first email', (_label, credentials) => {
    expect(() =>
      loadEnv({ EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'smtp.example.com', ...credentials }),
    ).toThrow(/SMTP_USER, SMTP_PASS: set both/);
  });
});

describe('loadEnv in production', () => {
  const production = {
    NODE_ENV: 'production',
    JWT_SECRET: 'a-real-secret-that-is-long-enough-123',
    EMAIL_PROVIDER: 'ses',
    AWS_REGION: 'eu-west-1',
    IMAGE_BASE_URL: 'https://d111111abcdef8.cloudfront.net',
  };

  it('accepts a complete configuration', () => {
    expect(loadEnv(production).NODE_ENV).toBe('production');
  });

  it('requires the CDN address images are served from', () => {
    expect(() => loadEnv({ ...production, IMAGE_BASE_URL: undefined })).toThrow(/IMAGE_BASE_URL/);
  });

  it('refuses the development secret', () => {
    expect(() => loadEnv({ ...production, JWT_SECRET: undefined })).toThrow(/JWT_SECRET/);
  });

  it('refuses to run without a real email provider', () => {
    expect(() => loadEnv({ ...production, EMAIL_PROVIDER: 'console' })).toThrow(/EMAIL_PROVIDER/);
  });
});
