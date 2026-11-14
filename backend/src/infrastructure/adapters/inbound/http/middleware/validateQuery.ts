import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { ValidationError } from '../../../../../domain/errors';

/**
 * Parses the query string with the schema (coercing numbers, applying defaults, dropping unknown
 * parameters) and stores the result on `req.validatedQuery`, or rejects the request with
 * per-parameter details. Express 5 does not allow `req.query` itself to be replaced.
 */
export function validateQuery(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      next(new ValidationError('Some query parameters are invalid', details));
      return;
    }
    req.validatedQuery = result.data;
    next();
  };
}
