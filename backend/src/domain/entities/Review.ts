/** A reviewer's rating and comment for one restaurant. Each reviewer reviews a restaurant once. */
export interface Review {
  readonly id: string;
  readonly restaurantId: string;
  readonly authorId: string;
  /**
   * Copied from the author's account when the review is written, so listing reviews needs no
   * join. Names cannot be changed after registration, so the copy never goes stale.
   */
  readonly authorName: string;
  /** Whole stars, 1 to 5. */
  readonly rating: number;
  readonly comment: string;
  readonly createdAt: Date;
}
