import type { RestaurantUpdateInput } from '@restaurant-reviews/common';
import type { Restaurant } from '../../../domain/entities/Restaurant';
import { NotFoundError } from '../../../domain/errors';
import type { RestaurantRepository, RestaurantUpdate } from '../../ports/RestaurantRepository';
import type { RestaurantImages } from '../../services/RestaurantImages';
import type { UseCase } from '../UseCase';
import type { OwnedRestaurants } from '../../services/OwnedRestaurants';

interface Input {
  id: string;
  ownerId: string;
  changes: RestaurantUpdateInput;
}

/** Changes one of the caller's restaurants, replacing its image if a new one was uploaded. */
export class UpdateRestaurantUseCase implements UseCase<Input, Restaurant> {
  constructor(
    private readonly restaurants: RestaurantRepository,
    private readonly owned: OwnedRestaurants,
    private readonly images: RestaurantImages,
  ) {}

  async execute({ id, ownerId, changes }: Input): Promise<Restaurant> {
    await this.owned.get(id, ownerId);
    const upload = changes.imageKey;
    // Only a new upload replaces the image; without one the existing image is kept.
    if (!upload) return (await this.save(id, changes)).updated;

    const imageKey = await this.images.publish(ownerId, upload);
    let result: RestaurantUpdate;
    try {
      result = await this.save(id, { ...changes, imageKey });
    } catch (err) {
      // Not saved (a failed write, or the restaurant deleted meanwhile), so nothing refers to the
      // published copy. The upload is kept, so the owner can submit again without uploading the
      // file again.
      await this.images.remove(imageKey);
      throw err;
    }

    // Only once the record points at the new image are the image it replaced and the upload
    // safe to remove. That is the image this write replaced, not the one seen at the ownership
    // check: another update may have changed it in between, and its image would be left behind.
    await this.images.remove(result.previous.imageKey);
    await this.images.discardUpload(upload);
    return result.updated;
  }

  private async save(id: string, changes: RestaurantUpdateInput): Promise<RestaurantUpdate> {
    const result = await this.restaurants.update(id, changes);
    // Deleted by another request between the ownership check and the update.
    if (!result) throw new NotFoundError('Restaurant not found');
    return result;
  }
}
