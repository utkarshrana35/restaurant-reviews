import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import {
  ConflictError,
  ServiceUnavailableError,
  ValidationError,
} from '../../../../../src/domain/errors';
import {
  MongooseRepository,
  type RunOptions,
} from '../../../../../src/infrastructure/adapters/outbound/mongoose/MongooseRepository';

const { MongoNetworkError, MongoServerError } = mongoose.mongo;

/** Exposes the protected `run` so the shared behaviour can be tested without a database. */
class TestRepository extends MongooseRepository {
  constructor() {
    super({ attempts: 3, baseDelayMs: 0 });
  }

  call<T>(operation: () => Promise<T>, options?: RunOptions): Promise<T> {
    return this.run(operation, options);
  }
}

const networkError = () => new MongoNetworkError('connection reset');
const duplicateKeyError = () => new MongoServerError({ code: 11000, errmsg: 'E11000 duplicate' });

describe('MongooseRepository.run', () => {
  it('returns the result of a successful operation without retrying', async () => {
    const operation = vi.fn().mockResolvedValue('ok');

    await expect(new TestRepository().call(operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  describe('retries', () => {
    it('retries a transient failure and returns the eventual result', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(networkError())
        .mockRejectedValueOnce(networkError())
        .mockResolvedValue('ok');

      await expect(new TestRepository().call(operation)).resolves.toBe('ok');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('gives up after the configured attempts and reports the service as unavailable', async () => {
      const cause = networkError();
      const operation = vi.fn().mockRejectedValue(cause);

      const failure = await new TestRepository().call(operation).catch((err: unknown) => err);

      expect(failure).toBeInstanceOf(ServiceUnavailableError);
      expect((failure as ServiceUnavailableError).cause).toBe(cause);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('runs an operation marked as not retryable only once', async () => {
      const operation = vi.fn().mockRejectedValue(networkError());

      await expect(new TestRepository().call(operation, { retry: false })).rejects.toThrow(
        ServiceUnavailableError,
      );
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('does not retry a failure that would fail the same way again', async () => {
      const operation = vi.fn().mockRejectedValue(duplicateKeyError());

      await expect(new TestRepository().call(operation)).rejects.toThrow(ConflictError);
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('error translation', () => {
    it('turns a unique-index violation into a conflict with the given message', async () => {
      const operation = () => Promise.reject(duplicateKeyError());

      await expect(
        new TestRepository().call(operation, { conflictMessage: 'Email already in use' }),
      ).rejects.toThrow(new ConflictError('Email already in use'));
    });

    it('turns a schema validation failure into a validation error with field details', async () => {
      const schemaError = new mongoose.Error.ValidationError();
      schemaError.addError(
        'name',
        new mongoose.Error.ValidatorError({ path: 'name', message: 'Name is required' }),
      );

      const failure = await new TestRepository()
        .call(() => Promise.reject(schemaError))
        .catch((err: unknown) => err);

      expect(failure).toBeInstanceOf(ValidationError);
      expect((failure as ValidationError).details).toEqual([
        { path: 'name', message: 'Name is required' },
      ]);
    });

    it('turns a value of the wrong type into a validation error', async () => {
      const castError = new mongoose.Error.CastError('ObjectId', 'not-an-id', 'owner');

      await expect(new TestRepository().call(() => Promise.reject(castError))).rejects.toThrow(
        ValidationError,
      );
    });

    it('passes an unrecognised error through unchanged', async () => {
      const unexpected = new Error('something else');

      await expect(new TestRepository().call(() => Promise.reject(unexpected))).rejects.toBe(
        unexpected,
      );
    });
  });
});
