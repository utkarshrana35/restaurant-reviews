import { describe, expect, it } from 'vitest';
import { REVIEW_COMMENT_MAX_LENGTH } from '../../src/constants';
import { MAX_PAGE, MAX_PAGE_SIZE } from '../../src/schemas/pagination';
import { reviewCreateSchema, reviewListQuerySchema } from '../../src/schemas/review';

describe('reviewCreateSchema', () => {
  it('accepts whole stars from 1 to 5 with a trimmed comment', () => {
    expect(reviewCreateSchema.parse({ rating: 1, comment: '  Fine.  ' })).toEqual({
      rating: 1,
      comment: 'Fine.',
    });
    expect(reviewCreateSchema.safeParse({ rating: 5, comment: 'Great' }).success).toBe(true);
  });

  it('keeps the author and restaurant out: they come from the session and the URL', () => {
    const parsed = reviewCreateSchema.parse({
      rating: 4,
      comment: 'Nice',
      authorId: 'someone-else',
      restaurantId: 'another',
    });
    expect(parsed).toEqual({ rating: 4, comment: 'Nice' });
  });

  it.each([
    ['no rating', { comment: 'Nice' }],
    ['a rating of 0', { rating: 0, comment: 'Nice' }],
    ['a rating of 6', { rating: 6, comment: 'Nice' }],
    ['half a star', { rating: 3.5, comment: 'Nice' }],
    ['a rating sent as text', { rating: '4', comment: 'Nice' }],
    ['a blank comment', { rating: 4, comment: '   ' }],
    ['a comment over the limit', { rating: 4, comment: 'x'.repeat(REVIEW_COMMENT_MAX_LENGTH + 1) }],
  ])('rejects %s', (_label, body) => {
    expect(reviewCreateSchema.safeParse(body).success).toBe(false);
  });

  it('accepts a comment of exactly the maximum length', () => {
    const comment = 'x'.repeat(REVIEW_COMMENT_MAX_LENGTH);
    expect(reviewCreateSchema.safeParse({ rating: 3, comment }).success).toBe(true);
  });
});

describe('reviewListQuerySchema', () => {
  it('defaults to the first page of ten', () => {
    expect(reviewListQuerySchema.parse({})).toEqual({ page: 1, limit: 10 });
  });

  it('coerces query-string values', () => {
    expect(reviewListQuerySchema.parse({ page: '3', limit: '5' })).toEqual({ page: 3, limit: 5 });
  });

  it.each([
    ['page 0', { page: '0' }],
    ['a page past the cap', { page: String(MAX_PAGE + 1) }],
    ['a page size past the cap', { limit: String(MAX_PAGE_SIZE + 1) }],
    ['a fractional page', { page: '1.5' }],
    ['a page that is not a number', { page: 'abc' }],
  ])('rejects %s', (_label, query) => {
    expect(reviewListQuerySchema.safeParse(query).success).toBe(false);
  });
});
