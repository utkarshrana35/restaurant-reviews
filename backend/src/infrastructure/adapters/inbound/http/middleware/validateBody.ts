import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { ValidationError } from '../../../../../domain/errors';

/**
 * Replaces `req.body` with the schema's parsed output (trimmed, normalised, unknown keys
 * removed), or rejects the request with per-field details.
 */
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      next(new ValidationError('Some fields are invalid', details));
      return;
    }
    req.body = result.data;
    next();
  };
}
