import { ForbiddenError, NotFoundError } from '../../../domain/errors';
import type { ReviewRepository } from '../../ports/ReviewRepository';
import type { RestaurantRatings } from '../../services/RestaurantRatings';
import type { UseCase } from '../UseCase';

interface Input {
  id: string;
  /** From the access token. */
  authorId: string;
}

/** A reviewer withdraws their own review. The restaurant's average follows. */
export class DeleteReviewUseCase implements UseCase<Input, void> {
  constructor(
    private readonly reviews: ReviewRepository,
    private readonly ratings: RestaurantRatings,
  ) {}

  async execute({ id, authorId }: Input): Promise<void> {
    const review = await this.reviews.findById(id);
    if (!review) throw new NotFoundError('Review not found');
    if (review.authorId !== authorId) {
      throw new ForbiddenError('You can only delete your own reviews');
    }
    await this.reviews.delete(id);
    await this.ratings.recalculate(review.restaurantId);
  }
}
