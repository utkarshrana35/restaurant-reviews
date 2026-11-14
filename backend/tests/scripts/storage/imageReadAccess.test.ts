import { describe, expect, it } from 'vitest';
import { imageReadAccessFromEnv } from '../../../scripts/storage/imageReadAccess';

const ARN = 'arn:aws:cloudfront::123456789012:distribution/EDFDVBD6EXAMPLE';

describe('imageReadAccessFromEnv', () => {
  it('limits reading to the named distribution', () => {
    expect(
      imageReadAccessFromEnv({ CLOUDFRONT_DISTRIBUTION_ARN: ` ${ARN} ` }, { targetsAws: true }),
    ).toEqual({ kind: 'cloudfront', distributionArn: ARN });
  });

  it('lets anyone read when unset against LocalStack, for the local CDN container', () => {
    expect(imageReadAccessFromEnv({}, { targetsAws: false })).toEqual({ kind: 'public' });
    expect(
      imageReadAccessFromEnv({ CLOUDFRONT_DISTRIBUTION_ARN: '' }, { targetsAws: false }),
    ).toEqual({ kind: 'public' });
  });

  it('refuses to leave an AWS bucket readable by anyone', () => {
    expect(() => imageReadAccessFromEnv({}, { targetsAws: true })).toThrow(
      /CLOUDFRONT_DISTRIBUTION_ARN: required when setting up a bucket in AWS/,
    );
  });

  it.each([
    ['an S3 bucket ARN', 'arn:aws:s3:::restaurant-reviews'],
    ['a distribution id alone', 'EDFDVBD6EXAMPLE'],
    [
      'an account id that is not 12 digits',
      'arn:aws:cloudfront::1234:distribution/EDFDVBD6EXAMPLE',
    ],
    ['a missing distribution id', 'arn:aws:cloudfront::123456789012:distribution/'],
  ])('rejects %s', (_label, value) => {
    expect(() =>
      imageReadAccessFromEnv({ CLOUDFRONT_DISTRIBUTION_ARN: value }, { targetsAws: true }),
    ).toThrow(/CLOUDFRONT_DISTRIBUTION_ARN: expected an ARN like/);
  });
});
