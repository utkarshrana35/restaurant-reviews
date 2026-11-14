import { isValidObjectId, Types } from 'mongoose';
import type { PaginatedResponse, Pagination } from '../../../../application/ports/Pagination';
import type {
  NewReview,
  RatingSummary,
  ReviewFilter,
  ReviewRepository,
} from '../../../../application/ports/ReviewRepository';
import { ALREADY_REVIEWED } from '../../../../application/use-cases/reviews/CreateReviewUseCase';
import type { Review } from '../../../../domain/entities/Review';
import { ReviewModel, type ReviewDocument } from './models/ReviewModel';
import { MongooseRepository } from './MongooseRepository';

/** Reviews in MongoDB. */
export class MongooseReviewRepository extends MongooseRepository implements ReviewRepository {
  async create({ restaurantId, authorId, ...fields }: NewReview): Promise<Review> {
    const doc = await this.run(
      () => ReviewModel.create({ ...fields, restaurant: restaurantId, author: authorId }),
      // Not retried: a retry after a lost reply would collide with the first insert. The unique
      // index turns a second review by the same author into a ConflictError.
      { retry: false, conflictMessage: ALREADY_REVIEWED },
    );
    return this.toEntity(doc);
  }

  async findById(id: string): Promise<Review | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await this.run(() => ReviewModel.findById(id));
    return doc ? this.toEntity(doc) : null;
  }

  async findByAuthor(restaurantId: string, authorId: string): Promise<Review | null> {
    if (!isValidObjectId(restaurantId) || !isValidObjectId(authorId)) return null;
    const doc = await this.run(() =>
      ReviewModel.findOne({ restaurant: restaurantId, author: authorId }),
    );
    return doc ? this.toEntity(doc) : null;
  }

  async list(
    filter: ReviewFilter,
    { skip, limit }: Pagination,
  ): Promise<PaginatedResponse<Review>> {
    const [field, id] =
      filter.restaurantId !== undefined
        ? (['restaurant', filter.restaurantId] as const)
        : (['author', filter.authorId] as const);
    if (!isValidObjectId(id)) return { items: [], total: 0 };
    const query = { [field]: id };

    const [docs, total] = await this.run(() =>
      Promise.all([
        // _id breaks ties so pagination is stable.
        ReviewModel.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
        ReviewModel.countDocuments(query),
      ]),
    );
    return { items: docs.map((doc) => this.toEntity(doc)), total };
  }

  async delete(id: string): Promise<void> {
    if (!isValidObjectId(id)) return;
    await this.run(() => ReviewModel.deleteOne({ _id: id }));
  }

  async deleteForRestaurant(restaurantId: string): Promise<void> {
    if (!isValidObjectId(restaurantId)) return;
    await this.run(() => ReviewModel.deleteMany({ restaurant: restaurantId }));
  }

  async ratingSummary(restaurantId: string): Promise<RatingSummary> {
    if (!isValidObjectId(restaurantId)) return { average: null, count: 0 };
    const [summary] = await this.run(() =>
      ReviewModel.aggregate<{ average: number; count: number }>([
        // Aggregations do not cast, so the id is converted here.
        { $match: { restaurant: new Types.ObjectId(restaurantId) } },
        { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]),
    );
    return summary
      ? { average: summary.average, count: summary.count }
      : { average: null, count: 0 };
  }

  private toEntity(doc: ReviewDocument): Review {
    return {
      id: doc.id,
      restaurantId: doc.restaurant.toString(),
      authorId: doc.author.toString(),
      authorName: doc.authorName,
      rating: doc.rating,
      comment: doc.comment,
      createdAt: doc.createdAt,
    };
  }
}
