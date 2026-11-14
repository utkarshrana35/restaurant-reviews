import { beforeEach, describe, expect, it } from 'vitest';
import type { User } from '../../../../src/domain/entities/User';
import { createAuthFixture, type AuthFixture } from '../../../support/authFixture';
import { time, useControllableTime } from '../../../support/time';

useControllableTime();

const SEVEN_DAYS_IN_MINUTES = 7 * 24 * 60;

let f: AuthFixture;
let ada: User;
let refreshToken: string;

beforeEach(async () => {
  f = createAuthFixture();
  ada = await f.registerAda();
  ({ refreshToken } = await f.startSession.execute(ada));
});

describe('RefreshSessionUseCase', () => {
  it('issues a new access token for the same session', async () => {
    const refreshed = await f.refreshSession.execute({ refreshToken });

    const sessionId = f.sessions.sessions[0]?.id;
    expect(refreshed).toEqual({ user: ada, accessToken: `access:${ada.id}:reviewer:${sessionId}` });
  });

  it('can be used repeatedly while the session lasts', async () => {
    await f.refreshSession.execute({ refreshToken });

    expect(await f.refreshSession.execute({ refreshToken })).not.toBeNull();
  });

  it('has nothing to resume without a refresh token', async () => {
    expect(await f.refreshSession.execute({})).toBeNull();
  });

  it('rejects a refresh token the server has no record of', async () => {
    expect(await f.refreshSession.execute({ refreshToken: 'refresh-999' })).toBeNull();
  });

  it('keeps working until just before the session expires', async () => {
    time.advance({ minutes: SEVEN_DAYS_IN_MINUTES - 1 });

    expect(await f.refreshSession.execute({ refreshToken })).not.toBeNull();
  });

  it('rejects and removes a session that has expired', async () => {
    time.advance({ minutes: SEVEN_DAYS_IN_MINUTES });

    expect(await f.refreshSession.execute({ refreshToken })).toBeNull();
    expect(f.sessions.sessions).toHaveLength(0);
  });

  it('rejects and removes the session once the account is gone', async () => {
    f.users.users.length = 0;

    expect(await f.refreshSession.execute({ refreshToken })).toBeNull();
    expect(f.sessions.sessions).toHaveLength(0);
  });
});
