import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import type { ApiError } from './apiError';

/**
 * Shows the API's per-field messages next to the matching inputs.
 * Returns the fields that received a message, so the caller knows whether a general message is
 * still needed.
 */
export function applyFieldErrors<Values extends FieldValues>(
  error: ApiError,
  fields: readonly Path<Values>[],
  setError: UseFormSetError<Values>,
): Path<Values>[] {
  const applied: Path<Values>[] = [];
  for (const field of fields) {
    const detail = error.details.find((candidate) => candidate.path === field);
    if (detail) {
      setError(field, { type: 'server', message: detail.message });
      applied.push(field);
    }
  }
  return applied;
}
