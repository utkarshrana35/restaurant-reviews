import type { Restaurant } from '../../domain/entities/Restaurant';
import { ForbiddenError, NotFoundError } from '../../domain/errors';
import type { RestaurantRepository } from '../ports/RestaurantRepository';

/**
 * The ownership rule, in one place: an owner may only change their own restaurants. Every use
 * case that modifies a restaurant loads it through here, so the check cannot be forgotten.
 */
export class OwnedRestaurants {
  constructor(private readonly restaurants: RestaurantRepository) {}

  /** The restaurant, if it exists and belongs to `ownerId`; otherwise rejects. */
  async get(id: string, ownerId: string): Promise<Restaurant> {
    const restaurant = await this.restaurants.findOne({ id });
    if (!restaurant) throw new NotFoundError('Restaurant not found');
    if (restaurant.ownerId !== ownerId) {
      throw new ForbiddenError('You can only manage your own restaurants');
    }
    return restaurant;
  }
}
