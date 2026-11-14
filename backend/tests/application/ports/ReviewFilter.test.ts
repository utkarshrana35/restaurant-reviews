import { describe, expectTypeOf, it } from 'vitest';
import type { ReviewFilter } from '../../../src/application/ports/ReviewRepository';

// Type-level checks of `ExactlyOne`, through its first use. They are enforced by `pnpm typecheck`:
// a `@ts-expect-error` line that stops being an error fails the type check.
describe('ReviewFilter', () => {
  it('accepts a restaurant or an author', () => {
    expectTypeOf({ restaurantId: 'r1' }).toExtend<ReviewFilter>();
    expectTypeOf({ authorId: 'u1' }).toExtend<ReviewFilter>();
  });

  it('rejects both at once, and neither', () => {
    // @ts-expect-error Both a restaurant and an author.
    const both: ReviewFilter = { restaurantId: 'r1', authorId: 'u1' };
    // @ts-expect-error Neither, which would list every review.
    const neither: ReviewFilter = {};
    expectTypeOf(both).toEqualTypeOf<ReviewFilter>();
    expectTypeOf(neither).toEqualTypeOf<ReviewFilter>();
  });
});
