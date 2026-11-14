import type { RequestHandler } from 'express';
import { ForbiddenError } from '../../../../../domain/errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth, alongside the SameSite cookie: a state-changing request that names an
 * origin must name one of ours. Browsers always send Origin on such requests; clients that send
 * none (curl, server-to-server) carry no ambient cookies, so they are not a CSRF vector.
 */
export function originCheck(allowedOrigins: readonly string[]): RequestHandler {
  return (req, _res, next) => {
    const origin = req.get('origin');
    if (SAFE_METHODS.has(req.method) || !origin || allowedOrigins.includes(origin)) {
      next();
      return;
    }
    next(new ForbiddenError('Cross-origin request blocked'));
  };
}
