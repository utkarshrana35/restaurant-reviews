import type { ApiErrorBody } from '@restaurant-reviews/common';
import type { NextFunction, Request, Response } from 'express';
import { DomainError, NotFoundError, type DomainErrorCode } from '../../../../../domain/errors';

interface ErrorResponse {
  status: number;
  code: string;
  message: string;
}

/** Turns every failure into the single `{ error: { code, message, details? } }` response shape. */
export class ErrorHandler {
  private static readonly STATUS_BY_CODE: Record<DomainErrorCode, number> = {
    VALIDATION_FAILED: 400,
    INVALID_OTP: 400,
    INVALID_CREDENTIALS: 401,
    UNAUTHENTICATED: 401,
    SESSION_ENDED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    SERVICE_UNAVAILABLE: 503,
  };

  // Errors raised by express.json() carry a `type` naming what went wrong.
  private static readonly BODY_PARSER_ERRORS: Record<string, ErrorResponse> = {
    'entity.parse.failed': {
      status: 400,
      code: 'INVALID_JSON',
      message: 'Request body is not valid JSON',
    },
    'entity.too.large': {
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body is too large',
    },
  };

  readonly notFound = (req: Request, _res: Response, next: NextFunction): void => {
    next(new NotFoundError(`No route for ${req.method} ${req.path}`));
  };

  // Express recognises an error handler by its four parameters.
  readonly handle = (err: unknown, _req: Request, res: Response, next: NextFunction): void => {
    if (res.headersSent) {
      next(err);
      return;
    }

    if (err instanceof DomainError) {
      // An outage is expected to be handled, but operators still need to see what caused it.
      if (err.code === 'SERVICE_UNAVAILABLE') console.error(err);
      const body: ApiErrorBody = {
        error: { code: err.code, message: err.message, details: err.details },
      };
      res.status(ErrorHandler.STATUS_BY_CODE[err.code]).json(body);
      return;
    }

    const clientError = this.bodyParserError(err) ?? this.otherClientError(err);
    if (clientError) {
      const { status, code, message } = clientError;
      res.status(status).json({ error: { code, message } } satisfies ApiErrorBody);
      return;
    }

    // Unexpected: log the detail server-side, tell the client nothing about internals.
    console.error(err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    } satisfies ApiErrorBody);
  };

  private bodyParserError(err: unknown): ErrorResponse | undefined {
    if (typeof err !== 'object' || err === null || !('type' in err)) return undefined;
    return typeof err.type === 'string' ? ErrorHandler.BODY_PARSER_ERRORS[err.type] : undefined;
  }

  /**
   * Any other error that Express or body-parser marked with a 4xx status: a URL parameter that
   * cannot be decoded, a body in an unsupported charset or encoding, an aborted request. The
   * request was at fault, not the server, so it keeps its status and is not logged as a fault.
   * Their messages can quote the request, so a fixed one is sent instead.
   */
  private otherClientError(err: unknown): ErrorResponse | undefined {
    if (typeof err !== 'object' || err === null) return undefined;
    const status = 'status' in err ? err.status : 'statusCode' in err ? err.statusCode : undefined;
    if (typeof status !== 'number' || !Number.isInteger(status) || status < 400 || status > 499) {
      return undefined;
    }
    return { status, code: 'BAD_REQUEST', message: 'The request could not be processed' };
  }
}
