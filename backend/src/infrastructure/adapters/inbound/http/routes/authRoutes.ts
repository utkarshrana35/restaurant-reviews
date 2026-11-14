import {
  loginSchema,
  refreshSchema,
  registerSchema,
  requestOtpSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from '@restaurant-reviews/common';
import { Router } from 'express';
import type { AuthController } from '../controllers/AuthController';
import type { Authenticator } from '../middleware/Authenticator';
import { rateLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validateBody';

/** Routes under /api/auth. */
export function authRoutes(
  auth: AuthController,
  authenticator: Authenticator,
  options: { rateLimiting: boolean },
): Router {
  // Sending email is the costliest and most abusable action, so it has the tightest limit. One
  // limiter for every endpoint that emails a code, so they share one allowance per client.
  const otpLimit = rateLimiter({ windowMinutes: 15, limit: 5 }, options.rateLimiting);
  // Shared likewise by every endpoint that checks a password or a code.
  const credentialLimit = rateLimiter({ windowMinutes: 15, limit: 20 }, options.rateLimiting);

  const router = Router();

  // Public
  router.post('/request-otp', otpLimit, validateBody(requestOtpSchema), auth.requestOtp);
  router.post('/register', credentialLimit, validateBody(registerSchema), auth.register);
  router.post('/login', credentialLimit, validateBody(loginSchema), auth.login);
  router.post(
    '/password-reset/request',
    otpLimit,
    validateBody(requestPasswordResetSchema),
    auth.requestPasswordReset,
  );
  router.post(
    '/password-reset/confirm',
    credentialLimit,
    validateBody(resetPasswordSchema),
    auth.resetPassword,
  );
  // Authenticated by the refresh token: the cookie, which the browser sends to this path only, or
  // the body, for a mobile client.
  router.post('/refresh', validateBody(refreshSchema), auth.refresh);
  // Works for guests and signed-in users alike.
  router.get('/session', authenticator.identify, auth.session);

  // Requires a valid access token
  router.post('/logout', authenticator.requireUser, auth.logout);

  return router;
}
