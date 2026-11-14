import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

const DEV_JWT_SECRET = 'development-only-secret-do-not-use-in-production';

/** Validates the environment once at startup so a bad value fails fast with a readable message. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  const env = createEnv({
    server: {
      NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
      PORT: z.coerce.number().int().min(1).max(65535).default(4000),
      MONGODB_URI: z
        .string()
        .regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://')
        .default('mongodb://127.0.0.1:27017/restaurant_reviews'),

      JWT_SECRET: z.string().min(32, 'must be at least 32 characters').default(DEV_JWT_SECRET),
      BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
      // Lifetime of an access token. Short, because an issued access token cannot be revoked.
      ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
      // Lifetime of a refresh token: how long a user stays signed in on a device.
      REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
      // Browser origins allowed to make state-changing requests, comma-separated.
      ALLOWED_ORIGINS: z
        .string()
        .default('http://localhost:3000,http://127.0.0.1:3000')
        .transform((value) =>
          value
            .split(',')
            .map((origin) => origin.trim())
            .filter(Boolean),
        ),

      // console prints emails to the server log; smtp and ses deliver them.
      EMAIL_PROVIDER: z.enum(['console', 'smtp', 'ses']).default('console'),
      EMAIL_FROM: z.string().default('Restaurant Reviews <no-reply@restaurant-reviews.local>'),
      SMTP_HOST: z.string().optional(),
      SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
      SMTP_USER: z.string().optional(),
      SMTP_PASS: z.string().optional(),
      // Region of the SES identity. AWS credentials come from the SDK's default chain.
      AWS_REGION: z.string().optional(),

      // Image storage. Outside production, unset values point at LocalStack (see storageConfig).
      S3_BUCKET: z.string().min(3).default('restaurant-reviews'),
      S3_REGION: z.string().default('us-east-1'),
      // Only for an S3-compatible service; leave unset in production to use AWS itself.
      S3_ENDPOINT: z.url().optional(),
      S3_ACCESS_KEY_ID: z.string().optional(),
      S3_SECRET_ACCESS_KEY: z.string().optional(),
      // Base address browsers load images from: the CDN. Outside production it defaults to the
      // local CDN container; in production it is the CloudFront distribution's address.
      IMAGE_BASE_URL: z.url().optional(),
      // CLOUDFRONT_DISTRIBUTION_ARN is not here: only `pnpm storage:setup` reads it, and it is
      // validated there (scripts/storage/imageReadAccess.ts). This schema lists what the API needs.
    },
    runtimeEnv: source,
    // `PORT=` in a .env file means "not set", so the default applies instead of failing.
    emptyStringAsUndefined: true,
    onValidationError: (issues) => {
      throw configurationError(
        issues.map((issue) => `${issue.path?.map(String).join('.') ?? ''}: ${issue.message}`),
      );
    },
  });

  // Rules that span more than one variable.
  const inProduction = env.NODE_ENV === 'production';
  const problems = [
    env.EMAIL_PROVIDER === 'smtp' &&
      !env.SMTP_HOST &&
      'SMTP_HOST: required when EMAIL_PROVIDER is smtp',
    // A user without a password (or the reverse) would only fail at the first email sent.
    Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASS) &&
      'SMTP_USER, SMTP_PASS: set both to sign in to the SMTP server, or neither',
    env.EMAIL_PROVIDER === 'ses' &&
      !env.AWS_REGION &&
      'AWS_REGION: required when EMAIL_PROVIDER is ses',
    inProduction && env.JWT_SECRET === DEV_JWT_SECRET && 'JWT_SECRET: must be set in production',
    inProduction &&
      !env.IMAGE_BASE_URL &&
      'IMAGE_BASE_URL: must be set in production (the CloudFront distribution address)',
    inProduction &&
      env.EMAIL_PROVIDER === 'console' &&
      'EMAIL_PROVIDER: must be smtp or ses in production',
  ].filter((problem) => typeof problem === 'string');
  if (problems.length > 0) throw configurationError(problems);

  return env;
}

function configurationError(problems: string[]): Error {
  return new Error(
    `Invalid environment configuration:\n${problems.map((problem) => `  ${problem}`).join('\n')}`,
  );
}

/** The validated environment. */
export type Env = ReturnType<typeof loadEnv>;
