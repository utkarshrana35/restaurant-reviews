import type { ExactlyOne } from '@restaurant-reviews/common';
import type { Review } from '../../domain/entities/Review';
import type { PaginatedResponse, Pagination } from './Pagination';

/** Everything needed to store a review. */
export type NewReview = Omit<Review, 'id' | 'createdAt'>;

/**
 * Whose reviews to list: one restaurant's, or one author's. Exactly one, so a listing can never
 * be asked for every review in the database, and each case has an index to serve it.
 */
export type ReviewFilter = ExactlyOne<{ restaurantId: string; authorId: string }>;

/** The average and number of ratings a restaurant has received. */
export interface RatingSummary {
  /** Null when there are no reviews. */
  average: number | null;
  count: number;
}

/** Stores reviews. Implemented with Mongoose. */
export interface ReviewRepository {
  /** Rejects with ConflictError when the author has already reviewed this restaurant. */
  create(review: NewReview): Promise<Review>;
  findById(id: string): Promise<Review | null>;
  /** The author's review of the restaurant, if they have written one. */
  findByAuthor(restaurantId: string, authorId: string): Promise<Review | null>;
  /** A restaurant's reviews, or an author's across all restaurants, newest first. */
  list(filter: ReviewFilter, pagination: Pagination): Promise<PaginatedResponse<Review>>;
  delete(id: string): Promise<void>;
  deleteForRestaurant(restaurantId: string): Promise<void>;
  /** Worked out from the stored reviews each time, so it is always consistent with them. */
  ratingSummary(restaurantId: string): Promise<RatingSummary>;
}
