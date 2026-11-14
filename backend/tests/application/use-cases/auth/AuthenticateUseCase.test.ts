import { beforeEach, describe, expect, it } from 'vitest';
import { UnauthenticatedError } from '../../../../src/domain/errors';
import type { User } from '../../../../src/domain/entities/User';
import { createAuthFixture, type AuthFixture } from '../../../support/authFixture';

let f: AuthFixture;
let ada: User;
let accessToken: string;
let refreshToken: string;

beforeEach(async () => {
  f = createAuthFixture();
  ada = await f.registerAda();
  ({ accessToken, refreshToken } = await f.startSession.execute(ada));
});

describe('AuthenticateUseCase', () => {
  it('reads the user id, role and session from a valid access token', async () => {
    const claims = await f.authenticate.execute({ accessToken });

    expect(claims).toEqual({
      userId: ada.id,
      role: 'reviewer',
      sessionId: f.sessions.sessions[0]?.id,
    });
  });

  it('rejects a request with no access token', async () => {
    await expect(f.authenticate.execute({})).rejects.toThrow(UnauthenticatedError);
  });

  it('rejects an expired or forged access token', async () => {
    await expect(f.authenticate.execute({ accessToken: 'not-a-token' })).rejects.toThrow(
      UnauthenticatedError,
    );
  });

  it('never accepts a refresh token in place of an access token', async () => {
    await expect(f.authenticate.execute({ accessToken: refreshToken })).rejects.toThrow(
      UnauthenticatedError,
    );
  });

  it('trusts the token without consulting the database', async () => {
    // Even with the user record gone, a token that is still within its lifetime is honoured;
    // the refresh is what cuts a removed account off.
    f.users.users.length = 0;

    await expect(f.authenticate.execute({ accessToken })).resolves.toMatchObject({
      userId: ada.id,
    });
    expect(await f.refreshSession.execute({ refreshToken })).toBeNull();
  });
});
