import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { JwtAccessTokens } from '../../../../../src/infrastructure/adapters/outbound/security/JwtAccessTokens';

const SECRET = 'a-test-secret-that-is-long-enough-12345';
const CLAIMS = { userId: 'user-1', role: 'owner', sessionId: 'session-1' } as const;

const tokens = new JwtAccessTokens(SECRET, 900);

/** Signs an arbitrary payload with the real secret, as an older or buggy issuer might. */
function signedWith(payload: object, options: jwt.SignOptions = {}): string {
  return jwt.sign(payload, SECRET, { algorithm: 'HS256', expiresIn: 900, ...options });
}

describe('JwtAccessTokens', () => {
  it('returns the claims it signed', () => {
    expect(tokens.verify(tokens.sign(CLAIMS))).toEqual(CLAIMS);
  });

  describe('rejects a token that fails verification', () => {
    it('when it is not a JWT at all', () => {
      expect(tokens.verify('not-a-token')).toBeNull();
    });

    it('when it was signed with a different secret', () => {
      const other = new JwtAccessTokens('a-different-secret-also-long-enough-999', 900);

      expect(tokens.verify(other.sign(CLAIMS))).toBeNull();
    });

    it('when it has expired', () => {
      const expired = new JwtAccessTokens(SECRET, -1);

      expect(tokens.verify(expired.sign(CLAIMS))).toBeNull();
    });

    it('when its payload was altered after signing', () => {
      const [header, , signature] = tokens.sign(CLAIMS).split('.');
      const forgedPayload = Buffer.from(
        JSON.stringify({ sub: 'user-1', sid: 'session-1', role: 'owner', admin: true }),
      ).toString('base64url');

      expect(tokens.verify(`${header}.${forgedPayload}.${signature}`)).toBeNull();
    });

    it('when it declares no signature algorithm', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ sub: 'user-1', sid: 'session-1', role: 'owner' }),
      ).toString('base64url');

      expect(tokens.verify(`${header}.${payload}.`)).toBeNull();
    });
  });

  describe('rejects a correctly signed token whose claims have the wrong shape', () => {
    it.each([
      ['an unknown role', { sub: 'user-1', sid: 'session-1', role: 'admin' }],
      ['a missing role', { sub: 'user-1', sid: 'session-1' }],
      ['a missing session id', { sub: 'user-1', role: 'owner' }],
      ['a missing subject', { sid: 'session-1', role: 'owner' }],
      ['an empty subject', { sub: '', sid: 'session-1', role: 'owner' }],
      ['a session id of the wrong type', { sub: 'user-1', sid: 42, role: 'owner' }],
    ])('%s', (_label, payload) => {
      expect(tokens.verify(signedWith(payload))).toBeNull();
    });
  });
});
