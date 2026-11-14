import { GetBucketLifecycleConfigurationCommand } from '@aws-sdk/client-s3';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createS3Client,
  S3FileStorage,
} from '../../../../../src/infrastructure/adapters/outbound/storage/S3FileStorage';
import { setupBucket } from '../../../../../scripts/storage/setupBucket';
import { s3ConfigFromEnv } from '../../../../../src/infrastructure/config/storageConfig';
import { SAMPLE_BYTES } from '../../../../support/InMemoryFileStorage';
import { testEnv } from '../../../../support/testApp';

// These tests talk to a real S3 API (LocalStack) and the CDN container in front of it. They are
// skipped, not failed, when those are not running, so the rest of the suite needs only MongoDB.
// Start them with `pnpm infra:up`.
// A bucket of its own, so the tests never touch development images.
const config = s3ConfigFromEnv({ ...testEnv(), S3_BUCKET: 'restaurant-reviews-test' });
const ORIGIN = 'http://localhost:3000';

// One protection is enforced by AWS but not by the LocalStack community edition, so it cannot
// be asserted here: the signature on a presigned upload's policy. (LocalStack also ignores the
// bucket policy; the CDN tests below show pending uploads are unreachable through the CDN.)
const isUp = (url: string) =>
  fetch(url, { signal: AbortSignal.timeout(1500) })
    .then((res) => res.ok)
    .catch(() => false);
const infraIsUp =
  (await isUp(`${config.endpoint}/_localstack/health`)) &&
  (await isUp('http://127.0.0.1:4567/healthz'));

const PUBLISHED = {
  contentType: 'image/jpeg',
  cacheControl: 'public, max-age=31536000, immutable',
};

const storage = new S3FileStorage(config);
const MAX_BYTES = 1024;

/** Sends a file the way a browser would: a multipart POST to the presigned address. */
async function browserUpload(
  key: string,
  bytes: readonly number[],
  overrides: Record<string, string> = {},
  contentType = 'image/jpeg',
) {
  const { url, fields } = await storage.createPresignedUpload({
    key,
    contentType,
    maxBytes: MAX_BYTES,
    expiresInSeconds: 60,
  });
  const form = new FormData();
  for (const [name, value] of Object.entries({ ...fields, ...overrides })) form.set(name, value);
  // S3 requires the file to be the last field.
  form.set('file', new Blob([new Uint8Array(bytes)], { type: contentType }));
  return fetch(url, { method: 'POST', body: form, headers: { Origin: ORIGIN } });
}

const uniqueKey = (prefix: string) => `${prefix}/${crypto.randomUUID()}.jpg`;

describe.skipIf(!infraIsUp)('S3FileStorage (against LocalStack and the CDN)', () => {
  beforeAll(async () => {
    await setupBucket(config, [ORIGIN]);
  });

  describe('bucket rules set by setupBucket', () => {
    // Uploads stay in pending/ until their restaurant is saved, so that a failed save can be
    // retried. This rule is what removes the ones never saved. (LocalStack stores the rule;
    // only AWS is relied on to actually expire objects, and the shortest expiry is a day.)
    it('expires abandoned uploads in pending/, and only there, after a day', async () => {
      const s3 = createS3Client(config);
      const { Rules } = await s3.send(
        new GetBucketLifecycleConfigurationCommand({ Bucket: config.bucket }),
      );
      s3.destroy();

      expect(Rules).toEqual([
        expect.objectContaining({
          ID: 'expire-abandoned-uploads',
          Status: 'Enabled',
          Filter: { Prefix: 'pending/' },
          Expiration: { Days: 1 },
        }),
      ]);
    });
  });

  describe('presigned upload', () => {
    it('accepts a file that satisfies the policy', async () => {
      const key = uniqueKey('pending/owner-a');

      const res = await browserUpload(key, SAMPLE_BYTES.jpeg);

      expect(res.status).toBe(204);
      expect(await storage.stat(key)).toEqual({ size: SAMPLE_BYTES.jpeg.length });
    });

    it('lets the frontend’s origin make the upload', async () => {
      const res = await browserUpload(uniqueKey('pending/owner-a'), SAMPLE_BYTES.jpeg);

      expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    });

    it('is refused by S3 when the file is larger than the permitted size', async () => {
      const key = uniqueKey('pending/owner-a');
      const tooBig = [...SAMPLE_BYTES.jpeg, ...new Array<number>(MAX_BYTES).fill(0)];

      const res = await browserUpload(key, tooBig);

      expect(res.status).toBe(400);
      expect(await storage.stat(key)).toBeNull();
    });

    it('is refused by S3 when sent to a different key than the one permitted', async () => {
      const permitted = uniqueKey('pending/owner-a');
      const other = uniqueKey('pending/owner-b');

      const res = await browserUpload(permitted, SAMPLE_BYTES.jpeg, { key: other });

      expect(res.status).toBe(403);
      expect(await storage.stat(other)).toBeNull();
    });

    it('is refused by S3 when the content type differs from the one permitted', async () => {
      const key = uniqueKey('pending/owner-a');

      const res = await browserUpload(key, SAMPLE_BYTES.jpeg, { 'Content-Type': 'text/html' });

      expect(res.status).toBe(403);
      expect(await storage.stat(key)).toBeNull();
    });
  });

  describe('stored files', () => {
    it('reports nothing for a key that was never written', async () => {
      expect(await storage.stat(uniqueKey('pending/owner-a'))).toBeNull();
    });

    it('reads just the leading bytes of a file', async () => {
      const key = uniqueKey('pending/owner-a');
      await browserUpload(key, SAMPLE_BYTES.png);

      const head = await storage.readHead(key, 8);

      expect([...head]).toEqual(SAMPLE_BYTES.png.slice(0, 8));
    });

    it('copies and deletes', async () => {
      const from = uniqueKey('pending/owner-a');
      const to = uniqueKey('restaurants');
      await browserUpload(from, SAMPLE_BYTES.jpeg);

      await storage.copy(from, to, PUBLISHED);
      await storage.delete(from);

      expect(await storage.stat(from)).toBeNull();
      expect(await storage.stat(to)).toEqual({ size: SAMPLE_BYTES.jpeg.length });
    });

    it('treats deleting a missing file as done', async () => {
      await expect(storage.delete(uniqueKey('restaurants'))).resolves.toBeUndefined();
    });
  });

  describe('serving through the CDN', () => {
    /** Uploads a JPEG and publishes it the way the API does, returning its published key. */
    async function publishImage() {
      const pending = uniqueKey('pending/owner-a');
      const published = uniqueKey('restaurants');
      await browserUpload(pending, SAMPLE_BYTES.jpeg);
      await storage.copy(pending, published, PUBLISHED);
      return published;
    }

    it('serves published images at their public URL, which is the CDN', async () => {
      const published = await publishImage();

      const res = await fetch(storage.publicUrl(published));

      expect(storage.publicUrl(published)).toMatch(/^http:\/\/127\.0\.0\.1:4567\//);
      expect(res.status).toBe(200);
      expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([...SAMPLE_BYTES.jpeg]);
    });

    it('serves them with the headers set when they were published', async () => {
      const res = await fetch(storage.publicUrl(await publishImage()));

      expect(res.headers.get('content-type')).toBe('image/jpeg');
      expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    });

    // A second layer behind the separate origin: even a file that slipped past the checks could
    // not be treated as anything but its declared type, nor run script if opened as a page.
    it('forbids type sniffing and sandboxes the response as a document', async () => {
      const res = await fetch(storage.publicUrl(await publishImage()));

      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('content-security-policy')).toBe("sandbox; default-src 'none'");
    });

    it('answers repeat requests from its cache', async () => {
      const url = storage.publicUrl(await publishImage());

      const first = await fetch(url);
      const second = await fetch(url);

      expect(first.headers.get('x-cache-status')).toBe('MISS');
      expect(second.headers.get('x-cache-status')).toBe('HIT');
    });

    it('does not serve uploads that are still pending', async () => {
      const pending = uniqueKey('pending/owner-a');
      await browserUpload(pending, SAMPLE_BYTES.jpeg);

      const res = await fetch(storage.publicUrl(pending));

      expect(res.status).toBe(404);
    });

    it('does not serve anything outside the published images', async () => {
      const res = await fetch(
        `http://127.0.0.1:4567/${config.bucket}/../${config.bucket}/pending/x.jpg`,
      );

      expect(res.status).toBe(404);
    });

    it('is read-only', async () => {
      const res = await fetch(storage.publicUrl(await publishImage()), { method: 'DELETE' });

      expect(res.status).toBe(403);
    });
  });
});
