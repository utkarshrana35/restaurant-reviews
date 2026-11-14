import type { RestaurantCreateInput } from '@restaurant-reviews/common';
import type { Restaurant } from '../../../domain/entities/Restaurant';
import { ConflictError } from '../../../domain/errors';
import type { RestaurantRepository } from '../../ports/RestaurantRepository';
import type { RestaurantImages } from '../../services/RestaurantImages';
import type { UseCase } from '../UseCase';

interface Input {
  /** From the access token, never from the request body. */
  ownerId: string;
  details: RestaurantCreateInput;
}

/**
 * Refuses a slug another restaurant has, on the slug field so the form can show it there. The
 * one place this is worded: the repository only reports that the slug is taken.
 */
const slugTaken = () => {
  const message = 'Another restaurant already uses this address. Choose a different one.';
  return new ConflictError(message, [{ path: 'slug', message }]);
};

/**
 * Creates a restaurant for the caller under the slug they chose, publishing the image they
 * uploaded for it.
 */
export class CreateRestaurantUseCase implements UseCase<Input, Restaurant> {
  constructor(
    private readonly restaurants: RestaurantRepository,
    private readonly images: RestaurantImages,
  ) {}

  async execute({ ownerId, details }: Input): Promise<Restaurant> {
    const imageKey = await this.images.publish(ownerId, details.imageKey);
    let restaurant: Restaurant;
    try {
      // A taken slug is left to the unique index, which the repository reports as a
      // ConflictError. That one check also settles two owners claiming the same slug at once,
      // so no lookup beforehand is needed: a taken slug is rare, and costs only a published
      // copy that is removed straight away.
      restaurant = await this.restaurants.create({ ...details, ownerId, imageKey });
    } catch (err) {
      // The restaurant was not saved, so nothing refers to the image just published. The upload
      // itself is kept, so the owner can submit again without uploading the file again.
      await this.images.remove(imageKey);
      throw err instanceof ConflictError ? slugTaken() : err;
    }
    // Only now is the upload no longer needed.
    await this.images.discardUpload(details.imageKey);
    return restaurant;
  }
}
