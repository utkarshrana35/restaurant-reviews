import mongoose from 'mongoose';
import { ConflictError, ServiceUnavailableError, ValidationError } from '../../../../domain/errors';

const { MongoError, MongoNetworkError, MongoServerSelectionError } = mongoose.mongo;

const DUPLICATE_KEY = 11000;
// Labels the driver attaches to failures that are safe to attempt again.
const RETRYABLE_LABELS = ['RetryableWriteError', 'TransientTransactionError'];

/** True when a write was rejected by a unique index. */
export function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === DUPLICATE_KEY;
}

/** True for failures caused by the connection or a failover, which may succeed if tried again. */
export function isTransientError(err: unknown): boolean {
  if (err instanceof MongoNetworkError || err instanceof MongoServerSelectionError) return true;
  return err instanceof MongoError && RETRYABLE_LABELS.some((label) => err.hasErrorLabel(label));
}

/** Mongoose gives up on an operation queued while disconnected with this message. */
function isBufferingTimeout(err: unknown): boolean {
  return err instanceof mongoose.Error && /buffering timed out/i.test(err.message);
}

/** How to word the errors a translated failure turns into. */
export interface TranslateOptions {
  /** Message for a unique-index violation, phrased for the end user. */
  conflictMessage?: string;
}

/**
 * Converts a MongoDB or Mongoose failure into the error types the rest of the backend
 * understands. Anything unrecognised is returned unchanged and surfaces as an internal error.
 */
export function translateMongoError(err: unknown, options: TranslateOptions = {}): unknown {
  if (isDuplicateKeyError(err)) {
    return new ConflictError(options.conflictMessage ?? 'This record already exists');
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((issue) => ({
      path: issue.path,
      message: issue.message,
    }));
    return new ValidationError('Some fields are invalid', details);
  }
  if (err instanceof mongoose.Error.CastError) {
    return new ValidationError('Some fields are invalid', [
      { path: err.path, message: 'Invalid value' },
    ]);
  }
  if (isTransientError(err) || isBufferingTimeout(err)) {
    return new ServiceUnavailableError({ cause: err });
  }
  return err;
}
