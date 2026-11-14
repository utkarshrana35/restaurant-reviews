import type { Paginated, RestaurantListQuery } from '@restaurant-reviews/common';
import type { Restaurant } from '../../../domain/entities/Restaurant';
import type { RestaurantRepository } from '../../ports/RestaurantRepository';
import { sliceFor, toPage } from '../paging';
import type { UseCase } from '../UseCase';

/**
 * The public restaurant listing: filtered by cuisine and rating, ordered by average rating, one
 * page at a time. Anyone may read it. A page past the end is empty, with the true totals.
 */
export class ListRestaurantsUseCase implements UseCase<RestaurantListQuery, Paginated<Restaurant>> {
  constructor(private readonly restaurants: RestaurantRepository) {}

  async execute(query: RestaurantListQuery): Promise<Paginated<Restaurant>> {
    const { page, limit, cuisine, minRating, maxRating, sort } = query;
    const results = await this.restaurants.search(
      { cuisine, minRating, maxRating, sort },
      sliceFor(page, limit),
    );
    return toPage(results, page, limit);
  }
}
