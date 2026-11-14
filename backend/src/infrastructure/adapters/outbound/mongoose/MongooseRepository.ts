import { isTransientError, translateMongoError, type TranslateOptions } from './mongoErrors';

/** How often, and how patiently, a transient failure is retried. */
export interface RetryPolicy {
  /** Total tries, including the first. */
  attempts: number;
  /** Wait before the second try; doubles for each try after that. */
  baseDelayMs: number;
}

/** Per-call options for `MongooseRepository.run`. */
export interface RunOptions extends TranslateOptions {
  /**
   * Set to false for an operation that must not run twice. If a first try reached the database
   * but its reply was lost, a second try would see the first one's effect: an insert, for
   * example, would fail as a duplicate of itself.
   */
  retry?: boolean;
}

const DEFAULT_RETRY_POLICY: RetryPolicy = { attempts: 3, baseDelayMs: 50 };

/**
 * Base class for every Mongoose-backed repository. Database calls go through `run`, which gives
 * them all the same two behaviours: transient failures are retried with backoff, and whatever
 * still fails is converted from a MongoDB error into one of the backend's own error types.
 */
export abstract class MongooseRepository {
  constructor(private readonly retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY) {}

  protected async run<T>(operation: () => Promise<T>, options: RunOptions = {}): Promise<T> {
    const maxAttempts = options.retry === false ? 1 : this.retryPolicy.attempts;

    for (let attempt = 1; ; attempt += 1) {
      try {
        return await operation();
      } catch (err) {
        if (attempt >= maxAttempts || !isTransientError(err)) {
          throw translateMongoError(err, options);
        }
        await this.wait(this.retryPolicy.baseDelayMs * 2 ** (attempt - 1));
      }
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
