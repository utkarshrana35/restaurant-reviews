import type { PresignUploadInput } from '@restaurant-reviews/common';
import type { ImageUpload, RestaurantImages } from '../../services/RestaurantImages';
import type { UseCase } from '../UseCase';

type Input = PresignUploadInput & { ownerId: string };

/**
 * Lets an owner upload a preview image straight to file storage. The declared size is validated
 * before this runs, and the storage enforces the real limits on the upload itself.
 */
export class CreateImageUploadUseCase implements UseCase<Input, ImageUpload> {
  constructor(private readonly images: RestaurantImages) {}

  execute({ ownerId, contentType }: Input): Promise<ImageUpload> {
    return this.images.createUpload(ownerId, contentType);
  }
}
