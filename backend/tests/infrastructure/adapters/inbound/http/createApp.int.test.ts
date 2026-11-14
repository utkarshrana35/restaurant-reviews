import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp } from '../../../../support/testApp';

// These requests never reach the database (a guest's session check answers without a lookup,
// and bad bodies are refused before any route), so the suite runs without a MongoDB connection.
// The error responses themselves are covered by ErrorHandler.test.ts; these check the wiring.
const app = () => createTestApp().app;
const GUEST_SESSION = '/api/auth/session';

describe('every API response', () => {
  it('tells clients not to cache it', async () => {
    const res = await request(app()).get(GUEST_SESSION);

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('does not advertise the framework, and carries the usual security headers', async () => {
    const res = await request(app()).get(GUEST_SESSION);

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
});

describe('error handling', () => {
  it('returns the standard error shape for an unknown route', async () => {
    const res = await request(app()).get('/api/nope');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'No route for GET /api/nope' },
    });
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app())
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('rejects a body over the 100 KB limit with 413, before any route reads it', async () => {
    const res = await request(app())
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@example.com', password: 'x'.repeat(101 * 1024) }));

    expect(res.status).toBe(413);
    expect(res.body).toEqual({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' },
    });
  });
});

describe('origin check', () => {
  it('blocks a state-changing request from another origin', async () => {
    const res = await request(app()).post('/api/auth/logout').set('Origin', 'https://evil.example');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('lets a state-changing request from the frontend origin through', async () => {
    const res = await request(app())
      .post('/api/auth/logout')
      .set('Origin', 'http://localhost:3000');

    // Past the origin check; it is then turned away only for not being signed in.
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('does not restrict read requests', async () => {
    const res = await request(app()).get(GUEST_SESSION).set('Origin', 'https://evil.example');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
  });
});
