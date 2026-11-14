import type { BaseQueryApi } from '@reduxjs/toolkit/query/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaseQuery, refreshSession } from '@/store/baseQuery';

const USER = { id: 'u1', name: 'Rita', email: 'rita@example.com', role: 'reviewer' };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const apiError = (status: number, code: string) => json(status, { error: { code, message: code } });

/** What the API answers for each path, in order: one entry per call. */
let answers: Record<string, (Response | Error)[]>;
let requested: string[];

beforeEach(() => {
  answers = {};
  requested = [];
  // The app calls the API by relative URL, which Node's Request does not accept on its own.
  const NodeRequest = globalThis.Request;
  vi.stubGlobal(
    'Request',
    class extends NodeRequest {
      constructor(input: string, init?: RequestInit) {
        super(new URL(input, 'http://localhost'), init);
      }
    },
  );
  vi.stubGlobal('fetch', async (request: Request) => {
    const path = new URL(request.url).pathname;
    requested.push(path);
    const answer = answers[path]?.shift();
    if (!answer) throw new Error(`Unexpected request to ${path}`);
    if (answer instanceof Error) throw answer;
    return answer;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function fakeApi(): BaseQueryApi {
  return {
    signal: new AbortController().signal,
    abort: () => {},
    dispatch: () => {},
    getState: () => ({}),
    extra: undefined,
    endpoint: 'test',
    type: 'query',
  } as unknown as BaseQueryApi;
}

describe('refreshSession', () => {
  it('reports a resumed session with its user', async () => {
    answers['/api/auth/refresh'] = [json(200, { user: USER })];

    expect(await refreshSession(fakeApi())).toEqual({ status: 'resumed', user: USER });
  });

  it('reports the session as ended only when the API says so', async () => {
    answers['/api/auth/refresh'] = [apiError(401, 'SESSION_ENDED')];

    expect(await refreshSession(fakeApi())).toEqual({ status: 'ended' });
  });

  it.each([
    ['the API is down', () => apiError(503, 'SERVICE_UNAVAILABLE')],
    ['the server fails', () => apiError(500, 'INTERNAL_ERROR')],
    ['the request is rate limited', () => apiError(429, 'RATE_LIMITED')],
    ['the proxy answers with no JSON', () => new Response('Bad Gateway', { status: 502 })],
    ['the network fails', () => new TypeError('Failed to fetch')],
  ])('reports a failure, not an ended session, when %s', async (_label, answer) => {
    answers['/api/auth/refresh'] = [answer()];

    expect((await refreshSession(fakeApi())).status).toBe('failed');
  });

  it('shares one refresh between calls made while it is under way', async () => {
    answers['/api/auth/refresh'] = [json(200, { user: USER })];

    const [first, second] = await Promise.all([
      refreshSession(fakeApi()),
      refreshSession(fakeApi()),
    ]);

    expect(first).toEqual(second);
    expect(requested).toEqual(['/api/auth/refresh']);
  });
});

describe('createBaseQuery', () => {
  const expired = () => apiError(401, 'UNAUTHENTICATED');

  it('refreshes once and repeats a request whose access token had expired', async () => {
    const onSignedOut = vi.fn();
    answers['/api/restaurants/mine'] = [expired(), json(200, [])];
    answers['/api/auth/refresh'] = [json(200, { user: USER })];

    const result = await createBaseQuery(onSignedOut)('restaurants/mine', fakeApi(), {});

    expect(result).toMatchObject({ data: [] });
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it('signs out when the session has ended, returning the original 401', async () => {
    const onSignedOut = vi.fn();
    answers['/api/restaurants/mine'] = [expired()];
    answers['/api/auth/refresh'] = [apiError(401, 'SESSION_ENDED')];

    const result = await createBaseQuery(onSignedOut)('restaurants/mine', fakeApi(), {});

    expect(onSignedOut).toHaveBeenCalledOnce();
    expect(result.error).toMatchObject({
      status: 401,
      data: { error: { code: 'UNAUTHENTICATED' } },
    });
  });

  it('stays signed in when the refresh fails, returning the refresh error', async () => {
    const onSignedOut = vi.fn();
    answers['/api/restaurants/mine'] = [expired()];
    answers['/api/auth/refresh'] = [apiError(503, 'SERVICE_UNAVAILABLE')];

    const result = await createBaseQuery(onSignedOut)('restaurants/mine', fakeApi(), {});

    expect(onSignedOut).not.toHaveBeenCalled();
    expect(result.error).toMatchObject({ status: 503 });
    // Not retried: the original request would only fail again.
    expect(requested).toEqual(['/api/restaurants/mine', '/api/auth/refresh']);
  });

  it('leaves other 401s alone, such as a wrong password', async () => {
    const onSignedOut = vi.fn();
    answers['/api/auth/login'] = [apiError(401, 'INVALID_CREDENTIALS')];

    await createBaseQuery(onSignedOut)({ url: 'auth/login', method: 'POST' }, fakeApi(), {});

    expect(requested).toEqual(['/api/auth/login']);
    expect(onSignedOut).not.toHaveBeenCalled();
  });
});
