import type { AuthoredReviewDto, ReviewDto } from '@restaurant-reviews/common';
import type { AuthoredReview } from '../../../../../application/use-cases/reviews/ListMyReviewsUseCase';
import type { Review } from '../../../../../domain/entities/Review';

/** The public view of a review. */
export function toReviewDto(review: Review): ReviewDto {
  return {
    id: review.id,
    restaurantId: review.restaurantId,
    authorId: review.authorId,
    authorName: review.authorName,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
  };
}

/**
 * A review in its author's own list, with the title and image of the restaurant it is about.
 * `imageUrlFor` turns the storage key into the address the image is served from.
 */
export function toAuthoredReviewDto(
  { review, restaurant }: AuthoredReview,
  imageUrlFor: (imageKey: string) => string,
): AuthoredReviewDto {
  return {
    ...toReviewDto(review),
    restaurantSlug: restaurant.slug,
    restaurantTitle: restaurant.title,
    restaurantImageUrl: imageUrlFor(restaurant.imageKey),
  };
}
