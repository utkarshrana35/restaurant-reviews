// Creates and configures the image bucket. Run with `pnpm storage:setup` (see the README).
import { imageReadAccessFromEnv } from './imageReadAccess';
import { setupBucket } from './setupBucket';
import { loadEnv } from '../../src/infrastructure/config/env';
import { s3ConfigFromEnv } from '../../src/infrastructure/config/storageConfig';

const env = loadEnv();
const config = s3ConfigFromEnv(env);

try {
  // No custom endpoint means AWS itself; LocalStack always has one.
  const readAccess = imageReadAccessFromEnv(process.env, { targetsAws: !config.endpoint });
  await setupBucket(config, env.ALLOWED_ORIGINS, readAccess);
  console.log(`Bucket "${config.bucket}" is ready at ${config.endpoint ?? 'AWS S3'}`);
} catch (err) {
  console.error(
    `Could not set up bucket "${config.bucket}" at ${config.endpoint ?? 'AWS S3'}.`,
    config.endpoint ? 'Is LocalStack running? Start it with `pnpm infra:up`.' : '',
  );
  console.error(err);
  process.exit(1);
}
