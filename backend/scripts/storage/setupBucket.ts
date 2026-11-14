import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutBucketLifecycleConfigurationCommand,
  PutBucketPolicyCommand,
  PutPublicAccessBlockCommand,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import {
  createS3Client,
  type S3Config,
} from '../../src/infrastructure/adapters/outbound/storage/S3FileStorage';

/**
 * Who may read published images straight from the bucket:
 * - `public`: anyone. Used locally, where the CDN container reads the bucket without credentials.
 * - `cloudfront`: only the named CloudFront distribution, through Origin Access Control. Used in
 *   AWS, so the bucket itself is never public and images are reachable only through the CDN.
 */
export type ImageReadAccess = { kind: 'public' } | { kind: 'cloudfront'; distributionArn: string };

/**
 * Creates the image bucket if needed and applies its rules. Safe to run repeatedly. The same
 * steps work against LocalStack and AWS, which is why this is code and not a shell script.
 */
export async function setupBucket(
  config: S3Config,
  allowedOrigins: readonly string[],
  readAccess: ImageReadAccess = { kind: 'public' },
) {
  const client = createS3Client(config);
  const Bucket = config.bucket;

  try {
    await client.send(new HeadBucketCommand({ Bucket }));
  } catch (err) {
    if (!(err instanceof S3ServiceException) || err.$metadata.httpStatusCode !== 404) throw err;
    await client.send(new CreateBucketCommand({ Bucket }));
  }

  // Browsers on the frontend's origin may POST uploads and read images; no one else's pages may.
  await client.send(
    new PutBucketCorsCommand({
      Bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [...allowedOrigins],
            AllowedMethods: ['POST', 'GET', 'HEAD'],
            AllowedHeaders: ['*'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );

  // No public ACLs ever. A public bucket policy is allowed only when reads are public.
  const cloudfrontOnly = readAccess.kind === 'cloudfront';
  await client.send(
    new PutPublicAccessBlockCommand({
      Bucket,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        IgnorePublicAcls: true,
        BlockPublicPolicy: cloudfrontOnly,
        RestrictPublicBuckets: cloudfrontOnly,
      },
    }),
  );

  // Only published images are readable. Uploads waiting in pending/ stay private.
  const readPublishedImages = cloudfrontOnly
    ? {
        Sid: 'CloudFrontReadsPublishedImages',
        Effect: 'Allow',
        Principal: { Service: 'cloudfront.amazonaws.com' },
        Action: 's3:GetObject',
        Resource: `arn:aws:s3:::${Bucket}/restaurants/*`,
        Condition: { StringEquals: { 'AWS:SourceArn': readAccess.distributionArn } },
      }
    : {
        Sid: 'PublicReadPublishedImages',
        Effect: 'Allow',
        Principal: '*',
        Action: 's3:GetObject',
        Resource: `arn:aws:s3:::${Bucket}/restaurants/*`,
      };
  await client.send(
    new PutBucketPolicyCommand({
      Bucket,
      Policy: JSON.stringify({ Version: '2012-10-17', Statement: [readPublishedImages] }),
    }),
  );

  // Uploads that were never attached to a restaurant are cleaned up after a day.
  await client.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: 'expire-abandoned-uploads',
            Status: 'Enabled',
            Filter: { Prefix: 'pending/' },
            Expiration: { Days: 1 },
          },
        ],
      },
    }),
  );

  client.destroy();
}
