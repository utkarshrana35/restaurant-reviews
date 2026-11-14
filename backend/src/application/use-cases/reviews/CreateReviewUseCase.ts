import type { ReviewCreateInput } from '@restaurant-reviews/common';
import type { Review } from '../../../domain/entities/Review';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
} from '../../../domain/errors';
import type { RestaurantRepository } from '../../ports/RestaurantRepository';
import type { ReviewRepository } from '../../ports/ReviewRepository';
import type { UserRepository } from '../../ports/UserRepository';
import type { RestaurantRatings } from '../../services/RestaurantRatings';
import type { UseCase } from '../UseCase';

interface Input {
  restaurantId: string;
  /** From the access token, never from the request body. */
  authorId: string;
  review: ReviewCreateInput;
}

export const ALREADY_REVIEWED = 'You have already reviewed this restaurant';

/** A reviewer rates and comments on a restaurant, once. The restaurant's average follows. */
export class CreateReviewUseCase implements UseCase<Input, Review> {
  constructor(
    private readonly restaurants: RestaurantRepository,
    private readonly users: UserRepository,
    private readonly reviews: ReviewRepository,
    private readonly ratings: RestaurantRatings,
  ) {}

  async execute({ restaurantId, authorId, review }: Input): Promise<Review> {
    if (!(await this.restaurants.findOne({ id: restaurantId }))) {
      throw new NotFoundError('Restaurant not found');
    }

    // The name is not in the access token, and loading the account also catches one that was
    // removed while its token was still valid.
    const author = await this.users.findById(authorId);
    if (!author) throw new UnauthenticatedError('Sign in to continue');
    // The route already requires the reviewer role; this keeps the rule true for any caller.
    if (author.role !== 'reviewer') throw new ForbiddenError('Only reviewers can write reviews');

    // A clear answer in the common case. Two requests at once are caught by the unique index,
    // which the repository reports as the same ConflictError.
    if (await this.reviews.findByAuthor(restaurantId, authorId)) {
      throw new ConflictError(ALREADY_REVIEWED);
    }

    const created = await this.reviews.create({
      restaurantId,
      authorId,
      authorName: author.name,
      rating: review.rating,
      comment: review.comment,
    });
    await this.ratings.recalculate(restaurantId);
    return created;
  }
}
