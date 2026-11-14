import { IMAGE_MAX_BYTES } from '@restaurant-reviews/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RestaurantImages } from '../../../src/application/services/RestaurantImages';
import { ValidationError } from '../../../src/domain/errors';
import { InMemoryFileStorage, SAMPLE_BYTES } from '../../support/InMemoryFileStorage';

let storage: InMemoryFileStorage;
let images: RestaurantImages;

beforeEach(() => {
  storage = new InMemoryFileStorage();
  images = new RestaurantImages(storage);
});

/** Gets an upload permission for the owner and puts a file where it points. */
async function upload(ownerId: string, bytes: readonly number[], totalSize?: number) {
  const { key } = await images.createUpload(ownerId, 'image/jpeg');
  storage.put(key, bytes, totalSize);
  return key;
}

async function rejection(promise: Promise<unknown>) {
  const error = await promise.catch((err: unknown) => err);
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).details?.[0];
}

describe('RestaurantImages.createUpload', () => {
  it('issues a permission scoped to a new key in the owner’s own upload area', async () => {
    const upload = await images.createUpload('owner-a', 'image/png');

    expect(upload.key).toMatch(/^pending\/owner-a\/[0-9a-f-]{36}\.png$/);
    expect(storage.issuedUploads).toEqual([
      {
        key: upload.key,
        contentType: 'image/png',
        maxBytes: IMAGE_MAX_BYTES,
        expiresInSeconds: 300,
      },
    ]);
    expect(upload.fields.key).toBe(upload.key);
  });

  it('never reuses a key', async () => {
    const first = await images.createUpload('owner-a', 'image/jpeg');
    const second = await images.createUpload('owner-a', 'image/jpeg');

    expect(first.key).not.toBe(second.key);
  });
});

describe('RestaurantImages.publish', () => {
  it('copies a valid upload to the public area and keeps the upload until it is discarded', async () => {
    const key = await upload('owner-a', SAMPLE_BYTES.jpeg);

    const published = await images.publish('owner-a', key);

    expect(published).toMatch(/^restaurants\/[0-9a-f-]{36}\.jpg$/);
    // Kept so a failed save can be retried without uploading again.
    expect(storage.keys()).toEqual([key, published]);

    await images.discardUpload(key);
    expect(storage.keys()).toEqual([published]);
  });

  it('can publish the same upload again, as a retry after a failed save does', async () => {
    const key = await upload('owner-a', SAMPLE_BYTES.jpeg);
    const first = await images.publish('owner-a', key);
    await images.remove(first); // what the use case does when the save fails

    const second = await images.publish('owner-a', key);

    expect(second).not.toBe(first);
    expect(storage.keys()).toEqual([key, second]);
  });

  it('publishes with the detected type and a long, immutable cache lifetime', async () => {
    // Declared as a JPEG when the upload was requested; the bytes are a PNG.
    const key = await upload('owner-a', SAMPLE_BYTES.png);

    const published = await images.publish('owner-a', key);

    expect(storage.servedHeaders.get(published)).toEqual({
      contentType: 'image/png',
      cacheControl: 'public, max-age=31536000, immutable',
    });
  });

  it('names the published file after what the content is, not what was declared', async () => {
    // Uploaded under a .jpg key, but the bytes are a PNG.
    const key = await upload('owner-a', SAMPLE_BYTES.png);

    expect(await images.publish('owner-a', key)).toMatch(/\.png$/);
  });

  it('rejects a key in another owner’s upload area', async () => {
    const key = await upload('owner-b', SAMPLE_BYTES.jpeg);

    expect(await rejection(images.publish('owner-a', key))).toEqual({
      path: 'imageKey',
      message: 'Upload the image again',
    });
    // The other owner's upload is left untouched.
    expect(storage.keys()).toEqual([key]);
  });

  it('rejects an image that is already published, so one cannot be taken from another restaurant', async () => {
    const key = await upload('owner-a', SAMPLE_BYTES.jpeg);
    const published = await images.publish('owner-a', key);

    await rejection(images.publish('owner-b', published));
    expect(storage.keys()).toEqual([key, published]);
  });

  it.each([
    ['a path that climbs out of the upload area', 'pending/owner-a/../owner-b/x.jpg'],
    ['a key outside the upload area', 'secrets/config.json'],
    ['a prefix that only resembles the owner’s', 'pending/owner-ab/x.jpg'],
    ['an empty key', ''],
  ])('rejects %s', async (_label, key) => {
    storage.put(key, SAMPLE_BYTES.jpeg);

    await rejection(images.publish('owner-a', key));
  });

  it('rejects a key nothing was uploaded to', async () => {
    const { key } = await images.createUpload('owner-a', 'image/jpeg');

    expect((await rejection(images.publish('owner-a', key)))?.message).toBe(
      'Upload the image again',
    );
  });

  it('rejects and deletes a file that is not really an image', async () => {
    const key = await upload('owner-a', SAMPLE_BYTES.notAnImage);

    expect((await rejection(images.publish('owner-a', key)))?.message).toBe(
      'The file is not a JPEG, PNG or WebP image',
    );
    expect(storage.keys()).toEqual([]);
  });

  it('rejects and deletes a file over the size limit', async () => {
    const key = await upload('owner-a', SAMPLE_BYTES.jpeg, IMAGE_MAX_BYTES + 1);

    expect((await rejection(images.publish('owner-a', key)))?.message).toBe(
      'The image must be at most 5 MB',
    );
    expect(storage.keys()).toEqual([]);
  });

  it('accepts a file of exactly the size limit', async () => {
    const key = await upload('owner-a', SAMPLE_BYTES.jpeg, IMAGE_MAX_BYTES);

    await expect(images.publish('owner-a', key)).resolves.toMatch(/^restaurants\//);
  });
});

describe('RestaurantImages.remove', () => {
  it('logs and carries on when storage fails, so the user’s action is not undone', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    storage.put('restaurants/x.jpg', SAMPLE_BYTES.jpeg);
    storage.failNextDelete = true;

    await expect(images.remove('restaurants/x.jpg')).resolves.toBeUndefined();

    expect(logged).toHaveBeenCalledOnce();
    logged.mockRestore();
  });
});
