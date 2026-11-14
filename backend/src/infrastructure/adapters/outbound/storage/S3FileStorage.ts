import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import type {
  FileStorage,
  PresignedUpload,
  PresignedUploadRequest,
  ServedHeaders,
  StoredFile,
} from '../../../../application/ports/FileStorage';

/** Which bucket to use and how to reach it. */
export interface S3Config {
  bucket: string;
  region: string;
  /** Set for an S3-compatible service such as LocalStack; leave unset for AWS itself. */
  endpoint?: string;
  /** Base address browsers load files from, without a trailing slash. */
  publicUrl: string;
  /** Leave unset to use the AWS SDK's default credential chain. */
  credentials?: { accessKeyId: string; secretAccessKey: string };
}

/** An S3 client for AWS or, with an endpoint, an S3-compatible service such as LocalStack. */
export function createS3Client(config: S3Config): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    // A custom endpoint has no per-bucket subdomains, so the bucket goes in the path.
    forcePathStyle: Boolean(config.endpoint),
    credentials: config.credentials,
  });
}

/** File storage in an S3 bucket, with browsers uploading through presigned POSTs. */
export class S3FileStorage implements FileStorage {
  private readonly client: S3Client;

  constructor(private readonly config: S3Config) {
    this.client = createS3Client(config);
  }

  async createPresignedUpload(request: PresignedUploadRequest): Promise<PresignedUpload> {
    const { key, contentType, maxBytes, expiresInSeconds } = request;
    // S3 itself refuses an upload that breaks any of these conditions, so the limits hold even
    // though the file never passes through this server.
    const { url, fields } = await createPresignedPost(this.client, {
      Bucket: this.config.bucket,
      Key: key,
      Expires: expiresInSeconds,
      Fields: { 'Content-Type': contentType },
      Conditions: [
        ['content-length-range', 1, maxBytes],
        ['eq', '$Content-Type', contentType],
        ['eq', '$key', key],
      ],
    });
    return { url, fields };
  }

  async stat(key: string): Promise<StoredFile | null> {
    try {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      return { size: head.ContentLength ?? 0 };
    } catch (err) {
      if (err instanceof S3ServiceException && err.$metadata.httpStatusCode === 404) return null;
      throw err;
    }
  }

  async readHead(key: string, byteCount: number): Promise<Uint8Array> {
    const object = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Range: `bytes=0-${byteCount - 1}`,
      }),
    );
    return (await object.Body?.transformToByteArray()) ?? new Uint8Array();
  }

  async copy(fromKey: string, toKey: string, headers: ServedHeaders): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.config.bucket,
        CopySource: `${this.config.bucket}/${fromKey}`,
        Key: toKey,
        // Replace the uploaded file's headers with ones the API has decided on.
        MetadataDirective: 'REPLACE',
        ContentType: headers.contentType,
        CacheControl: headers.cacheControl,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  publicUrl(key: string): string {
    return `${this.config.publicUrl}/${key}`;
  }
}
