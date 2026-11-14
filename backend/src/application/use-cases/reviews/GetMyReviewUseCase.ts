import type { Review } from '../../../domain/entities/Review';
import { NotFoundError } from '../../../domain/errors';
import type { RestaurantRepository } from '../../ports/RestaurantRepository';
import type { ReviewRepository } from '../../ports/ReviewRepository';
import type { UseCase } from '../UseCase';

interface Input {
  restaurantId: string;
  authorId: string;
}

/**
 * The caller's own review of a restaurant, or null. Lets the page show the review form only to
 * reviewers who have not reviewed the restaurant yet, whichever page of reviews theirs is on.
 */
export class GetMyReviewUseCase implements UseCase<Input, Review | null> {
  constructor(
    private readonly restaurants: RestaurantRepository,
    private readonly reviews: ReviewRepository,
  ) {}

  async execute({ restaurantId, authorId }: Input): Promise<Review | null> {
    if (!(await this.restaurants.findOne({ id: restaurantId }))) {
      throw new NotFoundError('Restaurant not found');
    }
    return this.reviews.findByAuthor(restaurantId, authorId);
  }
}
