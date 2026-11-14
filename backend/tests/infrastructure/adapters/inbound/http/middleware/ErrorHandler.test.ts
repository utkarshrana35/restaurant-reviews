import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthenticatedError,
  ValidationError,
} from '../../../../../../src/domain/errors';
import { ErrorHandler } from '../../../../../../src/infrastructure/adapters/inbound/http/middleware/ErrorHandler';

/** An app with one route that fails with `err`, handled by the real ErrorHandler. */
function appThrowing(err: unknown) {
  const handler = new ErrorHandler();
  const app = express();
  app.get('/fails', () => {
    throw err;
  });
  app.use(handler.notFound);
  app.use(handler.handle);
  return app;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorHandler', () => {
  it.each([
    [new ValidationError('Bad input', [{ path: 'title', message: 'Required' }]), 400],
    [new UnauthenticatedError('Sign in to continue'), 401],
    [new ForbiddenError('Not yours'), 403],
    [new NotFoundError('Missing'), 404],
    [new ConflictError('Already exists'), 409],
  ])('answers %s with its status and the standard shape', async (err, status) => {
    const res = await request(appThrowing(err)).get('/fails');

    expect(res.status).toBe(status);
    expect(res.body).toEqual({
      error: { code: err.code, message: err.message, details: err.details },
    });
  });

  it('hides internal details when something throws unexpectedly, and logs them', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(appThrowing(new Error('connection string with secrets'))).get(
      '/fails',
    );

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
    expect(JSON.stringify(res.body)).not.toContain('secrets');
    expect(logged).toHaveBeenCalledOnce();
  });

  it.each([
    [
      'an undecodable URL parameter',
      Object.assign(new URIError('Failed to decode'), { status: 400 }),
    ],
    [
      'an unsupported charset',
      Object.assign(new Error('unsupported charset "X"'), { status: 415 }),
    ],
    [
      'an error that names its status as statusCode',
      Object.assign(new Error('x'), { statusCode: 400 }),
    ],
  ])('keeps the 4xx status of %s, without logging it as a fault', async (_label, err) => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const status = 'status' in err ? err.status : err.statusCode;

    const res = await request(appThrowing(err)).get('/fails');

    expect(res.status).toBe(status);
    expect(res.body).toEqual({
      error: { code: 'BAD_REQUEST', message: 'The request could not be processed' },
    });
    expect(logged).not.toHaveBeenCalled();
  });

  it('still answers 500 for an error marked with a 5xx status', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(appThrowing(Object.assign(new Error('x'), { status: 502 }))).get(
      '/fails',
    );

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('answers a URL parameter that cannot be decoded with 400', async () => {
    const handler = new ErrorHandler();
    const app = express();
    app.get('/items/:id', (_req, res) => {
      res.end();
    });
    app.use(handler.handle);

    const res = await request(app).get('/items/%E0');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('answers an outage with 503 and logs its cause for operators', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(appThrowing(new ServiceUnavailableError())).get('/fails');

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(logged).toHaveBeenCalledOnce();
  });

  it('answers an unknown route with 404 in the standard shape', async () => {
    const res = await request(appThrowing(new Error('unused'))).post('/nowhere');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'No route for POST /nowhere' },
    });
  });
});
