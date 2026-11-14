import type { Paginated } from '@restaurant-reviews/common';
import type { Restaurant } from '../../../domain/entities/Restaurant';
import type { Review } from '../../../domain/entities/Review';
import type { RestaurantRepository } from '../../ports/RestaurantRepository';
import type { ReviewRepository } from '../../ports/ReviewRepository';
import { sliceFor, toPage } from '../paging';
import type { UseCase } from '../UseCase';

interface Input {
  /** From the access token. */
  authorId: string;
  page: number;
  limit: number;
}

/** One of the caller's reviews, with the restaurant it is about. */
export interface AuthoredReview {
  review: Review;
  restaurant: Restaurant;
}

/**
 * The caller's reviews across every restaurant, newest first, one page at a time.
 *
 * Restaurant titles are looked up when the list is read rather than copied onto each review,
 * because owners can rename their restaurants. One query fetches the restaurants for the whole
 * page.
 */
export class ListMyReviewsUseCase implements UseCase<Input, Paginated<AuthoredReview>> {
  constructor(
    private readonly reviews: ReviewRepository,
    private readonly restaurants: RestaurantRepository,
  ) {}

  async execute({ authorId, page, limit }: Input): Promise<Paginated<AuthoredReview>> {
    const results = await this.reviews.list({ authorId }, sliceFor(page, limit));
    const ids = [...new Set(results.items.map((review) => review.restaurantId))];
    const byId = new Map(
      (await this.restaurants.findByIds(ids)).map((restaurant) => [restaurant.id, restaurant]),
    );

    // A review whose restaurant was deleted a moment ago (its reviews go next) is left out.
    const items = results.items.flatMap((review) => {
      const restaurant = byId.get(review.restaurantId);
      return restaurant ? [{ review, restaurant }] : [];
    });
    return toPage({ items, total: results.total }, page, limit);
  }
}
