import type { ApiErrorBody, ApiErrorDetail } from '@restaurant-reviews/common';

/** An API failure in the one shape the UI handles. */
export interface ApiError {
  /** The API's error code, or NETWORK_ERROR when no usable response arrived. */
  code: string;
  message: string;
  details: ApiErrorDetail[];
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const { error } = value;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

/** Normalises whatever an RTK Query call rejected with into one shape the UI can show. */
export function toApiError(error: unknown): ApiError {
  if (
    typeof error === 'object' &&
    error !== null &&
    'data' in error &&
    isApiErrorBody(error.data)
  ) {
    const { code, message, details } = error.data.error;
    return { code, message, details: details ?? [] };
  }
  return {
    code: 'NETWORK_ERROR',
    message: 'Could not reach the server. Check your connection and try again.',
    details: [],
  };
}
