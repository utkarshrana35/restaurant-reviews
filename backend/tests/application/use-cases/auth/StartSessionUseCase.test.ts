import { beforeEach, describe, expect, it } from 'vitest';
import {
  createAuthFixture,
  REFRESH_TTL_SECONDS,
  type AuthFixture,
} from '../../../support/authFixture';
import { useControllableTime } from '../../../support/time';

useControllableTime();

let f: AuthFixture;

beforeEach(() => {
  f = createAuthFixture();
});

describe('StartSessionUseCase', () => {
  it('issues a refresh token and an access token tied to the new session', async () => {
    const tokens = await f.startSession.execute({ id: '42', role: 'owner' });

    const sessionId = f.sessions.sessions[0]?.id;
    expect(tokens).toEqual({
      refreshToken: 'refresh-1',
      accessToken: `access:42:owner:${sessionId}`,
    });
  });

  it('records the session with a hash of the refresh token, never the token itself', async () => {
    await f.startSession.execute({ id: '42', role: 'owner' });

    expect(f.sessions.sessions).toHaveLength(1);
    expect(f.sessions.sessions[0]).toMatchObject({ userId: '42', tokenHash: 'hash(refresh-1)' });
  });

  it('sets the session to expire after the refresh token lifetime', async () => {
    const startedAt = Date.now();

    await f.startSession.execute({ id: '42', role: 'owner' });

    const expiresAt = f.sessions.sessions[0]?.expiresAt.getTime();
    expect(expiresAt).toBe(startedAt + REFRESH_TTL_SECONDS * 1000);
  });

  it('gives each sign-in its own session, so devices can be signed out separately', async () => {
    const laptop = await f.startSession.execute({ id: '42', role: 'owner' });
    const phone = await f.startSession.execute({ id: '42', role: 'owner' });

    expect(laptop.refreshToken).not.toBe(phone.refreshToken);
    expect(f.sessions.sessions).toHaveLength(2);
  });
});
