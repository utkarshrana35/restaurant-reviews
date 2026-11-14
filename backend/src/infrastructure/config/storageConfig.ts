import type { S3Config } from '../adapters/outbound/storage/S3FileStorage';
import type { Env } from './env';

// Where docker-compose.yml runs LocalStack and the CDN in front of it, and the dummy
// credentials LocalStack accepts.
const LOCALSTACK_ENDPOINT = 'http://127.0.0.1:4566';
const LOCAL_CDN = 'http://127.0.0.1:4567';
const LOCALSTACK_CREDENTIALS = { accessKeyId: 'test', secretAccessKey: 'test' };

/**
 * Works out the S3 settings. Outside production, anything left unset points at LocalStack, so
 * the app runs locally with no storage configuration. In production an unset endpoint means AWS
 * itself, and unset credentials mean the AWS SDK's default chain (for example an attached role).
 */
export function s3ConfigFromEnv(env: Env): S3Config {
  const local = env.NODE_ENV !== 'production';
  const endpoint = env.S3_ENDPOINT ?? (local ? LOCALSTACK_ENDPOINT : undefined);

  const explicitCredentials =
    env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
      ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
      : undefined;

  // Images are always loaded through a CDN, never from the bucket. The local CDN serves every
  // bucket under its own name; CloudFront serves one bucket at its root.
  const imageBaseUrl = env.IMAGE_BASE_URL ?? `${LOCAL_CDN}/${env.S3_BUCKET}`;

  return {
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
    endpoint,
    credentials: explicitCredentials ?? (local ? LOCALSTACK_CREDENTIALS : undefined),
    publicUrl: imageBaseUrl.replace(/\/+$/, ''),
  };
}
