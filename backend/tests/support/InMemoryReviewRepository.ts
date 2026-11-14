import type { PaginatedResponse, Pagination } from '../../src/application/ports/Pagination';
import type {
  NewReview,
  RatingSummary,
  ReviewFilter,
  ReviewRepository,
} from '../../src/application/ports/ReviewRepository';
import { ALREADY_REVIEWED } from '../../src/application/use-cases/reviews/CreateReviewUseCase';
import type { Review } from '../../src/domain/entities/Review';
import { ConflictError } from '../../src/domain/errors';

/** Reviews in an array, with the same uniqueness rule and ordering as the MongoDB version. */
export class InMemoryReviewRepository implements ReviewRepository {
  readonly reviews: Review[] = [];
  private nextId = 1;
  /**
   * Set to skip the duplicate check once, as when two requests both pass the use case's own
   * check before either insert lands. The insert then fails the way the unique index makes it.
   */
  raceNextCreate = false;

  async create(review: NewReview): Promise<Review> {
    const duplicate = this.reviews.some(
      (existing) =>
        existing.restaurantId === review.restaurantId && existing.authorId === review.authorId,
    );
    if (duplicate) throw new ConflictError(ALREADY_REVIEWED);
    const created: Review = { ...review, id: `review-${this.nextId++}`, createdAt: new Date() };
    this.reviews.push(created);
    return created;
  }

  async findById(id: string): Promise<Review | null> {
    return this.reviews.find((review) => review.id === id) ?? null;
  }

  async findByAuthor(restaurantId: string, authorId: string): Promise<Review | null> {
    if (this.raceNextCreate) {
      this.raceNextCreate = false;
      return null;
    }
    return (
      this.reviews.find(
        (review) => review.restaurantId === restaurantId && review.authorId === authorId,
      ) ?? null
    );
  }

  async list(
    filter: ReviewFilter,
    { skip, limit }: Pagination,
  ): Promise<PaginatedResponse<Review>> {
    const matching = this.reviews.filter((review) =>
      filter.restaurantId !== undefined
        ? review.restaurantId === filter.restaurantId
        : review.authorId === filter.authorId,
    );
    // Newest first; later inserts win ties, as the descending _id does in MongoDB.
    const ordered = matching
      .map((review, index) => ({ review, index }))
      .sort(
        (a, b) => b.review.createdAt.getTime() - a.review.createdAt.getTime() || b.index - a.index,
      )
      .map(({ review }) => review);
    return { items: ordered.slice(skip, skip + limit), total: matching.length };
  }

  async delete(id: string): Promise<void> {
    const index = this.reviews.findIndex((review) => review.id === id);
    if (index >= 0) this.reviews.splice(index, 1);
  }

  async deleteForRestaurant(restaurantId: string): Promise<void> {
    for (let i = this.reviews.length - 1; i >= 0; i -= 1) {
      if (this.reviews[i]!.restaurantId === restaurantId) this.reviews.splice(i, 1);
    }
  }

  async ratingSummary(restaurantId: string): Promise<RatingSummary> {
    const ratings = this.reviews
      .filter((review) => review.restaurantId === restaurantId)
      .map((review) => review.rating);
    if (ratings.length === 0) return { average: null, count: 0 };
    const sum = ratings.reduce((total, rating) => total + rating, 0);
    return { average: sum / ratings.length, count: ratings.length };
  }
}
