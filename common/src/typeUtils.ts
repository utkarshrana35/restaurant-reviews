/**
 * Exactly one of `T`'s fields: any single one of them, never several at once and never none.
 *
 * A plain union of single-field objects is not enough for this: an object carrying several of
 * the fields is still assignable to it, because it satisfies each member. Here each member
 * declares every other field as `never`, so supplying a second one is a type error.
 *
 * ```ts
 * type ReviewFilter = ExactlyOne<{ restaurantId: string; authorId: string }>;
 * const a: ReviewFilter = { restaurantId: 'r1' }; // ok
 * const b: ReviewFilter = { authorId: 'u1' }; // ok
 * const c: ReviewFilter = { restaurantId: 'r1', authorId: 'u1' }; // error
 * const d: ReviewFilter = {}; // error
 * ```
 */
export type ExactlyOne<T extends object> = {
  [K in keyof T]: Pick<T, K> & { [Other in Exclude<keyof T, K>]?: never };
}[keyof T];
