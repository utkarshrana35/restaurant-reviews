import type { RestaurantRepository } from '../../ports/RestaurantRepository';
import type { ReviewRepository } from '../../ports/ReviewRepository';
import type { OwnedRestaurants } from '../../services/OwnedRestaurants';
import type { RestaurantImages } from '../../services/RestaurantImages';
import type { UseCase } from '../UseCase';

interface Input {
  id: string;
  ownerId: string;
}

/** Deletes one of the caller's restaurants, its reviews and its image. */
export class DeleteRestaurantUseCase implements UseCase<Input, void> {
  constructor(
    private readonly restaurants: RestaurantRepository,
    private readonly owned: OwnedRestaurants,
    private readonly images: RestaurantImages,
    private readonly reviews: ReviewRepository,
  ) {}

  async execute({ id, ownerId }: Input): Promise<void> {
    await this.owned.get(id, ownerId);
    // The restaurant as it was deleted. Its image may not be the one seen at the ownership check:
    // an update may have replaced it in between, and that newer image is the one to remove.
    const deleted = await this.restaurants.delete(id);
    // After the record, so a failure here never leaves a listed restaurant missing its reviews
    // or pointing at a missing image. Reviews left behind would be unreachable, not visible.
    // Removed even if another request deleted the restaurant first; doing it twice is harmless.
    await this.reviews.deleteForRestaurant(id);
    // When another request deleted it first, that request removes the image.
    if (deleted) await this.images.remove(deleted.imageKey);
  }
}
