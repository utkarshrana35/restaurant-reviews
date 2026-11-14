import type { ImageReadAccess } from './setupBucket';

// arn:aws:cloudfront::<12-digit account>:distribution/<distribution id>
const DISTRIBUTION_ARN = /^arn:aws:cloudfront::\d{12}:distribution\/[A-Z0-9]+$/;
const EXAMPLE_ARN = 'arn:aws:cloudfront::123456789012:distribution/EDFDVBD6EXAMPLE';

/**
 * Who may read published images, from `CLOUDFRONT_DISTRIBUTION_ARN`. Only `pnpm storage:setup`
 * reads this variable, which is why it is validated here and not with the API's environment.
 *
 * - Set: only that CloudFront distribution may read, through Origin Access Control.
 * - Unset, against LocalStack: anyone may read, so the local CDN container can.
 * - Unset, against AWS: refused. It would make published images readable straight from the
 *   bucket, bypassing the CDN and its headers.
 */
export function imageReadAccessFromEnv(
  source: Record<string, string | undefined>,
  { targetsAws }: { targetsAws: boolean },
): ImageReadAccess {
  const value = source.CLOUDFRONT_DISTRIBUTION_ARN?.trim();

  if (!value) {
    if (targetsAws) {
      throw new Error(
        'CLOUDFRONT_DISTRIBUTION_ARN: required when setting up a bucket in AWS, so that only the ' +
          `CDN can read images. Use the image distribution's ARN, for example ${EXAMPLE_ARN}.`,
      );
    }
    return { kind: 'public' };
  }

  if (!DISTRIBUTION_ARN.test(value)) {
    throw new Error(`CLOUDFRONT_DISTRIBUTION_ARN: expected an ARN like ${EXAMPLE_ARN}.`);
  }
  return { kind: 'cloudfront', distributionArn: value };
}
