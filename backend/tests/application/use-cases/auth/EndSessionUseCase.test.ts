import { beforeEach, describe, expect, it } from 'vitest';
import type { User } from '../../../../src/domain/entities/User';
import { createAuthFixture, type AuthFixture } from '../../../support/authFixture';

let f: AuthFixture;
let ada: User;

beforeEach(async () => {
  f = createAuthFixture();
  ada = await f.registerAda();
});

/** Signs Ada in on a device and returns its refresh token and session id. */
async function signIn() {
  const tokens = await f.startSession.execute(ada);
  const { sessionId } = await f.authenticate.execute(tokens);
  return { ...tokens, sessionId };
}

describe('EndSessionUseCase', () => {
  it('makes the refresh token unusable', async () => {
    const { refreshToken, sessionId } = await signIn();

    await f.endSession.execute({ sessionId });

    expect(await f.refreshSession.execute({ refreshToken })).toBeNull();
  });

  it('leaves the same user signed in on other devices', async () => {
    const laptop = await signIn();
    const phone = await signIn();

    await f.endSession.execute({ sessionId: laptop.sessionId });

    expect(await f.refreshSession.execute({ refreshToken: phone.refreshToken })).not.toBeNull();
  });

  it('does nothing for a session that no longer exists', async () => {
    await expect(f.endSession.execute({ sessionId: 'gone' })).resolves.toBeUndefined();
  });
});
