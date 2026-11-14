import type { RestaurantRepository } from '../ports/RestaurantRepository';
import type { ReviewRepository } from '../ports/ReviewRepository';

/** Averages are kept to one decimal place, the precision they are shown and filtered at. */
export function roundRating(average: number): number {
  return Math.round(average * 10) / 10;
}

/**
 * Keeps a restaurant's stored average and count in line with its reviews. The listing filters and
 * sorts on those stored values, so they must be updated after every review write.
 *
 * They are recalculated from all of the restaurant's reviews rather than adjusted by the one that
 * changed. A standalone MongoDB has no multi-document transactions, so a write could succeed and
 * the update after it fail; recalculating means the next review write puts the numbers right
 * again, and running it twice gives the same result.
 *
 * Two review writes at once each recalculate, and the one that read the reviews first could
 * store its result last, overwriting a newer average with an older one. So each recalculation
 * takes a revision before reading the reviews, and its result is stored only if no later one has
 * started since. A later one took its revision after this one, so it read the reviews after this
 * one did and saw at least as much; it stores its own result instead. The last to start always
 * stores.
 */
export class RestaurantRatings {
  constructor(
    private readonly restaurants: RestaurantRepository,
    private readonly reviews: ReviewRepository,
  ) {}

  async recalculate(restaurantId: string): Promise<void> {
    const revision = await this.restaurants.startRatingUpdate(restaurantId);
    // Deleted: there is no rating to keep.
    if (revision === null) return;
    const { average, count } = await this.reviews.ratingSummary(restaurantId);
    await this.restaurants.setRating(
      restaurantId,
      average === null ? null : roundRating(average),
      count,
      revision,
    );
  }
}
