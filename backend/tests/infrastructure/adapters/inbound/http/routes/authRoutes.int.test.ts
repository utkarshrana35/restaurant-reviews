import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from '../../../../../../src/infrastructure/adapters/inbound/http/AuthCookies';
import {
  CLIENT_HEADER,
  MOBILE_CLIENT,
} from '../../../../../../src/infrastructure/adapters/inbound/http/controllers/AuthController';
import { SessionModel } from '../../../../../../src/infrastructure/adapters/outbound/mongoose/models/SessionModel';
import { UserModel } from '../../../../../../src/infrastructure/adapters/outbound/mongoose/models/UserModel';
import { clearDatabase, createTestApp, type TestApp } from '../../../../../support/testApp';
import { time, useControllableTime } from '../../../../../support/time';

const EMAIL = 'ada@example.com';
const PASSWORD = 'correct-horse-1';

useControllableTime();

let t: TestApp;

beforeAll(async () => {
  t = createTestApp();
  await t.container.database.connect();
});

beforeEach(async () => {
  await clearDatabase();
  t = createTestApp();
});

afterAll(async () => {
  await clearDatabase();
  await t.container.database.disconnect();
});

function details(overrides: Record<string, unknown> = {}) {
  return { name: 'Ada Lovelace', email: EMAIL, password: PASSWORD, role: 'owner', ...overrides };
}

async function requestCode(email = EMAIL): Promise<string> {
  await request(t.app).post('/api/auth/request-otp').send({ email }).expect(204);
  const code = t.emails.lastCodeFor(email);
  if (!code) throw new Error(`No code was emailed to ${email}`);
  return code;
}

/** Registers Ada and returns an agent holding her session cookie. */
async function registerAda() {
  const agent = request.agent(t.app);
  const otp = await requestCode();
  await agent.post('/api/auth/register').send(details({ otp })).expect(201);
  return agent;
}

/** The Set-Cookie header for the named cookie, or undefined if the response did not set it. */
function cookie(res: request.Response, name: string): string | undefined {
  return (res.get('Set-Cookie') ?? []).find((header) => header.startsWith(`${name}=`));
}

/** The value the response set for the named cookie. */
function cookieValue(res: request.Response, name: string): string {
  const value = cookie(res, name)?.split(';')[0]?.split('=')[1];
  if (!value) throw new Error(`The response did not set ${name}`);
  return value;
}

/** A refresh that found no session to resume: the one answer that means the session is over. */
function expectSessionEnded(res: request.Response): void {
  expect(res.status).toBe(401);
  expect(res.body).toEqual({
    error: { code: 'SESSION_ENDED', message: 'Your session has ended. Please sign in again.' },
  });
}

/** Registers Ada and also returns the raw tokens her browser was given. */
async function registerAndCaptureTokens() {
  const agent = request.agent(t.app);
  const otp = await requestCode();
  const res = await agent.post('/api/auth/register').send(details({ otp })).expect(201);
  return {
    agent,
    accessToken: cookieValue(res, ACCESS_COOKIE_NAME),
    refreshToken: cookieValue(res, REFRESH_COOKIE_NAME),
  };
}

const CLEARED = /Expires=Thu, 01 Jan 1970/;
const SEVEN_DAYS_IN_MINUTES = 7 * 24 * 60;

describe('registration', () => {
  it('creates the account and signs the user in when the emailed code is supplied', async () => {
    const otp = await requestCode();

    const res = await request(t.app).post('/api/auth/register').send(details({ otp }));

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      user: { id: expect.any(String), name: 'Ada Lovelace', email: EMAIL, role: 'owner' },
    });
    // A browser gets the tokens only in cookies, where page script cannot read them.
    expect(JSON.stringify(res.body)).not.toMatch(/token/i);
  });

  it('also returns the cookie tokens in the body to a mobile client', async () => {
    const otp = await requestCode();

    const res = await request(t.app)
      .post('/api/auth/register')
      .set(CLIENT_HEADER, MOBILE_CLIENT)
      .send(details({ otp }));

    expect(res.body.tokens).toEqual({
      accessToken: cookieValue(res, ACCESS_COOKIE_NAME),
      refreshToken: cookieValue(res, REFRESH_COOKIE_NAME),
    });
  });

  it('scopes each cookie to where it is needed', async () => {
    const otp = await requestCode();

    const res = await request(t.app).post('/api/auth/register').send(details({ otp }));

    const access = cookie(res, ACCESS_COOKIE_NAME);
    expect(access).toMatch(/Path=\/api;/);
    expect(access).toMatch(/HttpOnly/i);
    expect(access).toMatch(/SameSite=Lax/i);
    expect(access).toMatch(/Max-Age=900/);

    // The refresh token is sent to the refresh endpoint and nowhere else.
    const refresh = cookie(res, REFRESH_COOKIE_NAME);
    expect(refresh).toMatch(/Path=\/api\/auth\/refresh;/);
    expect(refresh).toMatch(/HttpOnly/i);
    expect(refresh).toMatch(/SameSite=Strict/i);
    expect(refresh).toMatch(/Max-Age=604800/);

    // Nothing else is set: no cookie is readable by page scripts.
    expect(res.get('Set-Cookie')).toHaveLength(2);
  });

  it('never returns or stores the plain password', async () => {
    const otp = await requestCode();

    const res = await request(t.app).post('/api/auth/register').send(details({ otp }));

    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    const stored = await UserModel.findOne({ email: EMAIL }).lean();
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored?.passwordHash).not.toContain(PASSWORD);
  });

  it('creates no account without a code', async () => {
    await requestCode();

    const res = await request(t.app).post('/api/auth/register').send(details());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details).toContainEqual(expect.objectContaining({ path: 'otp' }));
    expect(await UserModel.countDocuments()).toBe(0);
  });

  it('creates no account with a wrong code', async () => {
    const otp = await requestCode();
    const wrong = otp === '000000' ? '000001' : '000000';

    const res = await request(t.app)
      .post('/api/auth/register')
      .send(details({ otp: wrong }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_OTP');
    expect(cookie(res, ACCESS_COOKIE_NAME)).toBeUndefined();
    expect(cookie(res, REFRESH_COOKIE_NAME)).toBeUndefined();
    expect(await UserModel.countDocuments()).toBe(0);
  });

  it('rejects the right code after it has expired', async () => {
    const otp = await requestCode();
    time.advance({ minutes: 10 });

    const res = await request(t.app).post('/api/auth/register').send(details({ otp }));

    expect(res.body.error.code).toBe('INVALID_OTP');
  });

  it('reports every invalid field', async () => {
    const res = await request(t.app)
      .post('/api/auth/register')
      .send({ name: ' ', email: 'not-an-email', password: 'short', role: 'admin', otp: '12' });

    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((detail: { path: string }) => detail.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password', 'role', 'otp']));
  });

  it('cannot be used to grant a role other than reviewer or owner', async () => {
    const otp = await requestCode();

    const res = await request(t.app)
      .post('/api/auth/register')
      .send(details({ otp, role: 'admin' }));

    expect(res.status).toBe(400);
    expect(await UserModel.countDocuments()).toBe(0);
  });

  it('ignores unknown fields such as an id or a pre-set hash', async () => {
    const otp = await requestCode();

    await request(t.app)
      .post('/api/auth/register')
      .send(details({ otp, passwordHash: 'x', _id: '507f1f77bcf86cd799439011' }))
      .expect(201);

    const stored = await UserModel.findOne({ email: EMAIL }).lean();
    expect(String(stored?._id)).not.toBe('507f1f77bcf86cd799439011');
    expect(stored?.passwordHash).not.toBe('x');
  });

  it('treats differently-cased emails as the same address', async () => {
    const otp = await requestCode();

    const res = await request(t.app)
      .post('/api/auth/register')
      .send(details({ otp, email: '  ADA@Example.com ' }));

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(EMAIL);
  });

  it('creates exactly one account when the same code is submitted twice at once', async () => {
    const otp = await requestCode();
    const submit = () => request(t.app).post('/api/auth/register').send(details({ otp }));

    const statuses = (await Promise.all([submit(), submit()])).map((res) => res.status).sort();

    expect(statuses[0]).toBe(201);
    expect([400, 409]).toContain(statuses[1]);
    expect(await UserModel.countDocuments()).toBe(1);
  });
});

describe('requesting a code', () => {
  it('rejects an invalid email address', async () => {
    const res = await request(t.app).post('/api/auth/request-otp').send({ email: 'nope' });

    expect(res.status).toBe(400);
    expect(t.emails.sent).toHaveLength(0);
  });

  it('answers the same way for a registered address, and emails no code', async () => {
    await registerAda();
    time.advance({ seconds: 60 });

    const res = await request(t.app).post('/api/auth/request-otp').send({ email: EMAIL });

    expect(res.status).toBe(204);
    expect(t.emails.sentTo(EMAIL).at(-1)?.subject).toMatch(/already have/i);
    expect(t.emails.lastCodeFor(EMAIL)).toBeUndefined();
  });

  it('is rate limited per client', async () => {
    const limited = createTestApp({}, { rateLimiting: true });
    const send = (n: number) =>
      request(limited.app)
        .post('/api/auth/request-otp')
        .send({ email: `user${n}@example.com` });

    for (let n = 1; n <= 5; n += 1) await send(n).expect(204);
    const res = await send(6);

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(limited.emails.sent).toHaveLength(5);
  });
});

describe('signing in', () => {
  beforeEach(async () => {
    await registerAda();
  });

  it('starts a session with the right password', async () => {
    const agent = request.agent(t.app);

    const res = await agent.post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(EMAIL);
    expect(res.body).not.toHaveProperty('tokens');
    const session = await agent.get('/api/auth/session');
    expect(session.body.user.email).toBe(EMAIL);
  });

  it('also returns the cookie tokens in the body to a mobile client', async () => {
    const res = await request(t.app)
      .post('/api/auth/login')
      .set(CLIENT_HEADER, MOBILE_CLIENT)
      .send({ email: EMAIL, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.tokens).toEqual({
      accessToken: cookieValue(res, ACCESS_COOKIE_NAME),
      refreshToken: cookieValue(res, REFRESH_COOKIE_NAME),
    });
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const wrongPassword = await request(t.app)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: 'wrong-password-1' });
    const unknownEmail = await request(t.app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body).toEqual({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    });
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
    expect(cookie(wrongPassword, ACCESS_COOKIE_NAME)).toBeUndefined();
    expect(cookie(wrongPassword, REFRESH_COOKIE_NAME)).toBeUndefined();
  });

  it('rejects an operator object in place of a password', async () => {
    const res = await request(t.app)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: { $ne: '' } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('session', () => {
  it('reports no user for a guest', async () => {
    const res = await request(t.app).get('/api/auth/session');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
  });

  it('reports the user the access token belongs to', async () => {
    const agent = await registerAda();

    const res = await agent.get('/api/auth/session');

    expect(res.body.user).toMatchObject({ email: EMAIL, role: 'owner' });
  });

  it('treats a forged access token as a guest', async () => {
    const res = await request(t.app)
      .get('/api/auth/session')
      .set('Cookie', `${ACCESS_COOKIE_NAME}=not.a.valid-token`);

    expect(res.body).toEqual({ user: null });
  });

  it('does not accept a refresh token as an access token', async () => {
    const { refreshToken } = await registerAndCaptureTokens();

    const res = await request(t.app)
      .get('/api/auth/session')
      .set('Cookie', `${ACCESS_COOKIE_NAME}=${refreshToken}`);

    expect(res.body).toEqual({ user: null });
  });

  it('signs the browser out when the account was removed while its access token is still valid', async () => {
    const agent = await registerAda();
    await UserModel.deleteMany({});

    const res = await agent.get('/api/auth/session');

    // No user is reported, the cookies are cleared, and the session is gone from the server.
    expect(res.body).toEqual({ user: null });
    expect(cookie(res, ACCESS_COOKIE_NAME)).toMatch(CLEARED);
    expect(cookie(res, REFRESH_COOKIE_NAME)).toMatch(CLEARED);
    expect(await SessionModel.countDocuments()).toBe(0);
  });

  it('leaves a guest alone: nothing to clear', async () => {
    const res = await request(t.app).get('/api/auth/session');

    expect(res.get('Set-Cookie')).toBeUndefined();
  });
});

describe('a bearer access token (mobile clients)', () => {
  it('identifies the user without any cookie', async () => {
    const { accessToken } = await registerAndCaptureTokens();

    const res = await request(t.app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.body.user).toMatchObject({ email: EMAIL, role: 'owner' });
  });

  it('authorises a protected endpoint and ends that session', async () => {
    const { accessToken, refreshToken } = await registerAndCaptureTokens();

    await request(t.app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    const replay = await request(t.app)
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${refreshToken}`);
    expectSessionEnded(replay);
  });

  it('wins over the cookie when both are sent', async () => {
    const { accessToken } = await registerAndCaptureTokens();

    const res = await request(t.app)
      .get('/api/auth/session')
      .set('Authorization', 'Bearer not.a.valid-token')
      .set('Cookie', `${ACCESS_COOKIE_NAME}=${accessToken}`);

    expect(res.body).toEqual({ user: null });
  });

  it('does not accept a refresh token', async () => {
    const { refreshToken } = await registerAndCaptureTokens();

    const res = await request(t.app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${refreshToken}`);

    expect(res.status).toBe(401);
    expect(await SessionModel.countDocuments()).toBe(1);
  });
});

describe('refreshing', () => {
  const refreshWith = (cookieHeader: string) =>
    request(t.app).post('/api/auth/refresh').set('Cookie', cookieHeader);

  it('issues a new access token for a live session', async () => {
    const { refreshToken } = await registerAndCaptureTokens();

    const res = await refreshWith(`${REFRESH_COOKIE_NAME}=${refreshToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: EMAIL });
    expect(cookie(res, ACCESS_COOKIE_NAME)).toMatch(/Max-Age=900/);
    // The new access token works on its own.
    const session = await request(t.app)
      .get('/api/auth/session')
      .set('Cookie', `${ACCESS_COOKIE_NAME}=${cookieValue(res, ACCESS_COOKIE_NAME)}`);
    expect(session.body.user).toMatchObject({ email: EMAIL });
  });

  it('reports the session as ended when there is no refresh token, and clears the cookies', async () => {
    const res = await request(t.app).post('/api/auth/refresh');

    expectSessionEnded(res);
    expect(cookie(res, ACCESS_COOKIE_NAME)).toMatch(CLEARED);
  });

  it('rejects an unknown refresh token and clears both cookies', async () => {
    const res = await refreshWith(`${REFRESH_COOKIE_NAME}=made-up`);

    expectSessionEnded(res);
    expect(cookie(res, ACCESS_COOKIE_NAME)).toMatch(CLEARED);
    expect(cookie(res, REFRESH_COOKIE_NAME)).toMatch(CLEARED);
  });

  it('does not accept an access token as a refresh token', async () => {
    const { accessToken } = await registerAndCaptureTokens();

    const res = await refreshWith(`${REFRESH_COOKIE_NAME}=${accessToken}`);

    expectSessionEnded(res);
  });

  it('takes the refresh token from the body for a mobile client, and returns the new access token', async () => {
    const { refreshToken } = await registerAndCaptureTokens();

    const res = await request(t.app)
      .post('/api/auth/refresh')
      .set(CLIENT_HEADER, MOBILE_CLIENT)
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe(cookieValue(res, ACCESS_COOKIE_NAME));
    const session = await request(t.app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(session.body.user).toMatchObject({ email: EMAIL });
  });

  it('keeps the new access token out of the body for a browser', async () => {
    const { refreshToken } = await registerAndCaptureTokens();

    const res = await refreshWith(`${REFRESH_COOKIE_NAME}=${refreshToken}`);

    expect(res.body).not.toHaveProperty('accessToken');
  });

  it('prefers the body token over the cookie', async () => {
    const { refreshToken } = await registerAndCaptureTokens();

    const res = await refreshWith(`${REFRESH_COOKIE_NAME}=${refreshToken}`).send({
      refreshToken: 'made-up',
    });

    expectSessionEnded(res);
  });

  it('rejects an empty body token as invalid input, not as an ended session', async () => {
    const res = await request(t.app).post('/api/auth/refresh').send({ refreshToken: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('cannot be driven by the access token cookie', async () => {
    const { accessToken } = await registerAndCaptureTokens();

    const res = await refreshWith(`${ACCESS_COOKIE_NAME}=${accessToken}`);

    expectSessionEnded(res);
  });

  it('stops once the session has reached its lifetime', async () => {
    const { refreshToken } = await registerAndCaptureTokens();
    time.advance({ minutes: SEVEN_DAYS_IN_MINUTES });

    const res = await refreshWith(`${REFRESH_COOKIE_NAME}=${refreshToken}`);

    expectSessionEnded(res);
    expect(await SessionModel.countDocuments()).toBe(0);
  });

  it('stores only a hash of the refresh token', async () => {
    const { refreshToken } = await registerAndCaptureTokens();

    const stored = await SessionModel.findOne().lean();

    expect(stored?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.tokenHash).not.toBe(refreshToken);
  });

  it('is blocked from other origins', async () => {
    const { refreshToken } = await registerAndCaptureTokens();

    const res = await refreshWith(`${REFRESH_COOKIE_NAME}=${refreshToken}`).set(
      'Origin',
      'https://evil.example',
    );

    expect(res.status).toBe(403);
  });
});

describe('signing out', () => {
  it('requires an access token', async () => {
    const res = await request(t.app).post('/api/auth/logout');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue' },
    });
  });

  it('is not authorised by a refresh token', async () => {
    const { refreshToken } = await registerAndCaptureTokens();

    const res = await request(t.app)
      .post('/api/auth/logout')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${refreshToken}`);

    expect(res.status).toBe(401);
    expect(await SessionModel.countDocuments()).toBe(1);
  });

  it('ends the session on the server and clears both cookies', async () => {
    const { agent, refreshToken } = await registerAndCaptureTokens();

    const res = await agent.post('/api/auth/logout');

    expect(res.status).toBe(204);
    expect(cookie(res, ACCESS_COOKIE_NAME)).toMatch(CLEARED);
    expect(cookie(res, REFRESH_COOKIE_NAME)).toMatch(CLEARED);
    expect(await SessionModel.countDocuments()).toBe(0);
    // A copy of the refresh token taken before signing out can no longer mint access tokens.
    const replay = await request(t.app)
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${refreshToken}`);
    expectSessionEnded(replay);
  });

  it('authorises from the access token alone, without looking the user up', async () => {
    const { agent } = await registerAndCaptureTokens();
    // With the user record gone, a protected endpoint still accepts the unexpired token...
    await UserModel.deleteMany({});

    await agent.post('/api/auth/logout').expect(204);
  });

  it('cuts a removed account off at its next refresh', async () => {
    const { refreshToken } = await registerAndCaptureTokens();
    await UserModel.deleteMany({});

    const res = await request(t.app)
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${refreshToken}`);

    expectSessionEnded(res);
    expect(await SessionModel.countDocuments()).toBe(0);
  });

  it('leaves other devices signed in', async () => {
    const laptop = await registerAndCaptureTokens();
    const phone = request.agent(t.app);
    const phoneLogin = await phone
      .post('/api/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);

    await laptop.agent.post('/api/auth/logout').expect(204);

    const res = await request(t.app)
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${cookieValue(phoneLogin, REFRESH_COOKIE_NAME)}`);
    expect(res.body.user).toMatchObject({ email: EMAIL });
  });
});

describe('password reset', () => {
  const NEW_PASSWORD = 'new-battery-staple-2';

  async function requestResetCode(email = EMAIL): Promise<string | undefined> {
    await request(t.app).post('/api/auth/password-reset/request').send({ email }).expect(204);
    return t.emails.lastCodeFor(email);
  }

  const confirm = (body: Record<string, unknown>) =>
    request(t.app).post('/api/auth/password-reset/confirm').send(body);

  it('answers a request the same way whether or not the address has an account', async () => {
    await registerAda();
    time.advance({ minutes: 1 });

    const known = await request(t.app)
      .post('/api/auth/password-reset/request')
      .send({ email: EMAIL });
    const unknown = await request(t.app)
      .post('/api/auth/password-reset/request')
      .send({ email: 'nobody@example.com' });

    expect([known.status, unknown.status]).toEqual([204, 204]);
    expect(known.body).toEqual(unknown.body);
    expect(t.emails.lastCodeFor(EMAIL)).toBeDefined();
    expect(t.emails.lastCodeFor('nobody@example.com')).toBeUndefined();
  });

  it('sets the new password and signs the user in on this device', async () => {
    await registerAda();
    time.advance({ minutes: 1 });
    const otp = await requestResetCode();

    const res = await confirm({ email: EMAIL, otp, password: NEW_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: EMAIL });
    expect(cookie(res, ACCESS_COOKIE_NAME)).toBeDefined();
    expect(cookie(res, REFRESH_COOKIE_NAME)).toBeDefined();
    await request(t.app)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: NEW_PASSWORD })
      .expect(200);
    const old = await request(t.app)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: PASSWORD });
    expect(old.status).toBe(401);
  });

  it('signs out every device that was signed in before', async () => {
    const { refreshToken } = await registerAndCaptureTokens();
    time.advance({ minutes: 1 });
    const otp = await requestResetCode();

    const res = await confirm({ email: EMAIL, otp, password: NEW_PASSWORD }).expect(200);

    const replay = await request(t.app)
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${refreshToken}`);
    expectSessionEnded(replay);
    // Only the session just started by the reset remains.
    expect(await SessionModel.countDocuments()).toBe(1);
    const fresh = await request(t.app)
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${cookieValue(res, REFRESH_COOKIE_NAME)}`);
    expect(fresh.status).toBe(200);
  });

  it('refuses a wrong code on the code field, and keeps the old password', async () => {
    await registerAda();
    time.advance({ minutes: 1 });
    await requestResetCode();

    const res = await confirm({ email: EMAIL, otp: '000000', password: NEW_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'INVALID_OTP',
      details: [{ path: 'otp', message: expect.any(String) }],
    });
    await request(t.app)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);
  });

  it('does not accept a registration code', async () => {
    await registerAda();
    time.advance({ minutes: 1 });
    // A registered address gets a notice rather than a code, so take one for another address.
    const registrationCode = await requestCode('grace@example.com');

    const res = await confirm({
      email: 'grace@example.com',
      otp: registrationCode,
      password: NEW_PASSWORD,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_OTP');
  });

  it('keeps a reset code working when registration is requested for the address meanwhile', async () => {
    await registerAda();
    time.advance({ minutes: 1 });
    const otp = await requestResetCode();
    // Anyone can ask to register with Ada's address; that must not cancel her reset.
    await request(t.app).post('/api/auth/request-otp').send({ email: EMAIL }).expect(204);

    await confirm({ email: EMAIL, otp, password: NEW_PASSWORD }).expect(200);
  });

  it('validates the new password against the same rules as registration', async () => {
    const res = await confirm({ email: EMAIL, otp: '123456', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((detail: { path: string }) => detail.path)).toContain(
      'password',
    );
  });
});
