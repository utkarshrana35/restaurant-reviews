import { describe, expectTypeOf, it } from 'vitest';
import type { ExactlyOne } from '../src/typeUtils';

// Type-level checks, enforced by `pnpm typecheck`: a `@ts-expect-error` line that stops being an
// error fails the type check.
type OneId = ExactlyOne<{ restaurantId: string; authorId: string; userId: string }>;

describe('ExactlyOne', () => {
  it('accepts any single field', () => {
    expectTypeOf({ restaurantId: 'r1' }).toExtend<OneId>();
    expectTypeOf({ authorId: 'a1' }).toExtend<OneId>();
    expectTypeOf({ userId: 'u1' }).toExtend<OneId>();
  });

  it('rejects two fields, all of them, and none', () => {
    // @ts-expect-error Two at once.
    const two: OneId = { restaurantId: 'r1', authorId: 'a1' };
    // @ts-expect-error All three.
    const all: OneId = { restaurantId: 'r1', authorId: 'a1', userId: 'u1' };
    // @ts-expect-error None.
    const none: OneId = {};
    expectTypeOf([two, all, none]).toEqualTypeOf<OneId[]>();
  });

  it('keeps each field its own type', () => {
    type Mixed = ExactlyOne<{ id: string; index: number }>;
    expectTypeOf({ index: 3 }).toExtend<Mixed>();
    // @ts-expect-error The wrong type for the field.
    const wrong: Mixed = { index: 'three' };
    expectTypeOf(wrong).toEqualTypeOf<Mixed>();
  });
});
