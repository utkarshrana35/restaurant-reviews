import type { Restaurant } from '../../../domain/entities/Restaurant';
import type { RestaurantRepository } from '../../ports/RestaurantRepository';
import type { UseCase } from '../UseCase';

/** The restaurants belonging to the signed-in owner, and only those. */
export class ListMyRestaurantsUseCase implements UseCase<{ ownerId: string }, Restaurant[]> {
  constructor(private readonly restaurants: RestaurantRepository) {}

  execute({ ownerId }: { ownerId: string }): Promise<Restaurant[]> {
    return this.restaurants.findByOwner(ownerId);
  }
}
