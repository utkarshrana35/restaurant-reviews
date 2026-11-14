import {
  IMAGE_EXTENSIONS,
  IMAGE_MAX_BYTES,
  type ImageContentType,
} from '@restaurant-reviews/common';
import { ValidationError } from '../../domain/errors';
import { detectImageType, IMAGE_SIGNATURE_BYTES } from '../../domain/images';
import type { FileStorage, PresignedUpload } from '../ports/FileStorage';

const UPLOAD_EXPIRY_SECONDS = 5 * 60;

// Uploads land under pending/<ownerId>/ and are private. Only images that pass inspection are
// copied to restaurants/, the one prefix browsers can read. Anything abandoned in pending/ is
// removed by the bucket's lifecycle rule.
const PENDING_PREFIX = 'pending';
const PUBLISHED_PREFIX = 'restaurants';

// A published image is never changed: replacing it creates a new key. So browsers and the CDN
// may keep it for a year without checking back.
const PUBLISHED_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/** An upload permission together with the key the file will be stored under. */
export interface ImageUpload extends PresignedUpload {
  key: string;
}

/**
 * The lifecycle of a restaurant's preview image, shared by the use cases that create, update and
 * delete restaurants: issuing an upload permission, accepting what was uploaded, and removal.
 */
export class RestaurantImages {
  constructor(private readonly files: FileStorage) {}

  /** Permission for an owner to upload one image of the declared type. */
  async createUpload(ownerId: string, contentType: ImageContentType): Promise<ImageUpload> {
    const key = `${PENDING_PREFIX}/${ownerId}/${crypto.randomUUID()}.${IMAGE_EXTENSIONS[contentType]}`;
    const upload = await this.files.createPresignedUpload({
      key,
      contentType,
      maxBytes: IMAGE_MAX_BYTES,
      expiresInSeconds: UPLOAD_EXPIRY_SECONDS,
    });
    return { ...upload, key };
  }

  /**
   * Accepts an image the owner says they uploaded, and returns the key it is published under.
   * Nothing about the claim is trusted: the key must be in the owner's own upload area, a file
   * must really be there, and its content must really be an image of an accepted type and size.
   *
   * A valid upload is copied, not moved: it stays in pending/ until `discardUpload` is called
   * once the restaurant has been saved. If the save fails, the owner can submit again without
   * uploading the file a second time. An upload that fails inspection is deleted at once.
   */
  async publish(ownerId: string, uploadedKey: string): Promise<string> {
    // Covers a key that is malformed, belongs to someone else, or is an already published image.
    if (!uploadedKey.startsWith(`${PENDING_PREFIX}/${ownerId}/`) || uploadedKey.includes('..')) {
      throw this.rejected('Upload the image again');
    }

    const file = await this.files.stat(uploadedKey);
    if (!file) throw this.rejected('Upload the image again');

    if (file.size > IMAGE_MAX_BYTES) {
      await this.remove(uploadedKey);
      throw this.rejected(`The image must be at most ${IMAGE_MAX_BYTES / 1024 / 1024} MB`);
    }

    const type = detectImageType(await this.files.readHead(uploadedKey, IMAGE_SIGNATURE_BYTES));
    if (!type) {
      await this.remove(uploadedKey);
      throw this.rejected('The file is not a JPEG, PNG or WebP image');
    }

    // The extension comes from the detected type, not from the name the uploader chose.
    const publishedKey = `${PUBLISHED_PREFIX}/${crypto.randomUUID()}.${IMAGE_EXTENSIONS[type]}`;
    await this.files.copy(uploadedKey, publishedKey, {
      // The detected type, not the one the uploader declared.
      contentType: type,
      cacheControl: PUBLISHED_CACHE_CONTROL,
    });
    return publishedKey;
  }

  /**
   * Deletes an upload whose published copy now belongs to a saved restaurant. After this the
   * same upload cannot be published again. If it is never called (the owner gave up after a
   * failed save), the bucket's lifecycle rule removes the upload from pending/ within a day or two.
   */
  async discardUpload(uploadedKey: string): Promise<void> {
    await this.remove(uploadedKey);
  }

  /**
   * Deletes an image. A failure is logged and swallowed: a leftover file is harmless, and it
   * must not undo or fail the change the user actually asked for.
   */
  async remove(key: string): Promise<void> {
    try {
      await this.files.delete(key);
    } catch (err) {
      console.error(`Could not delete stored file ${key}`, err);
    }
  }

  private rejected(message: string): ValidationError {
    return new ValidationError('Some fields are invalid', [{ path: 'imageKey', message }]);
  }
}
