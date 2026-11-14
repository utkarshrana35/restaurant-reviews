import type { Restaurant } from '../../../domain/entities/Restaurant';
import { NotFoundError } from '../../../domain/errors';
import type { RestaurantLookup, RestaurantRepository } from '../../ports/RestaurantRepository';
import type { UseCase } from '../UseCase';

/** One restaurant's public details, by id or by slug. Anyone may read them. */
export class GetRestaurantUseCase implements UseCase<RestaurantLookup, Restaurant> {
  constructor(private readonly restaurants: RestaurantRepository) {}

  async execute(lookup: RestaurantLookup): Promise<Restaurant> {
    const restaurant = await this.restaurants.findOne(lookup);
    if (!restaurant) throw new NotFoundError('Restaurant not found');
    return restaurant;
  }
}
