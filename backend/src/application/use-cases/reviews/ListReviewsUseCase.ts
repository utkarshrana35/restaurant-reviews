import type { Paginated } from '@restaurant-reviews/common';
import type { Review } from '../../../domain/entities/Review';
import { NotFoundError } from '../../../domain/errors';
import type { RestaurantRepository } from '../../ports/RestaurantRepository';
import type { ReviewRepository } from '../../ports/ReviewRepository';
import { sliceFor, toPage } from '../paging';
import type { UseCase } from '../UseCase';

interface Input {
  restaurantId: string;
  page: number;
  limit: number;
}

/** A restaurant's reviews, newest first, one page at a time. Anyone may read them. */
export class ListReviewsUseCase implements UseCase<Input, Paginated<Review>> {
  constructor(
    private readonly restaurants: RestaurantRepository,
    private readonly reviews: ReviewRepository,
  ) {}

  async execute({ restaurantId, page, limit }: Input): Promise<Paginated<Review>> {
    // An unknown restaurant is a 404, not an empty list that looks like "no reviews yet".
    if (!(await this.restaurants.findOne({ id: restaurantId }))) {
      throw new NotFoundError('Restaurant not found');
    }
    const results = await this.reviews.list({ restaurantId }, sliceFor(page, limit));
    return toPage(results, page, limit);
  }
}
