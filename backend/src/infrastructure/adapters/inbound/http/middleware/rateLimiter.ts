import type { ApiErrorBody } from '@restaurant-reviews/common';
import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

/** How many requests one client may make in a time window. */
export interface RateLimit {
  windowMinutes: number;
  /** Requests allowed per client IP in each window. */
  limit: number;
}

/** Limits requests per client IP, answering 429 in the standard error shape once exceeded. */
export function rateLimiter({ windowMinutes, limit }: RateLimit, enabled: boolean): RequestHandler {
  if (!enabled) return (_req, _res, next) => next();

  return rateLimit({
    windowMs: windowMinutes * 60_000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' },
      } satisfies ApiErrorBody);
    },
  });
}
