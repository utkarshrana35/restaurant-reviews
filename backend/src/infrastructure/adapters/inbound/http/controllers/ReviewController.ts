import type {
  AuthoredReviewDto,
  MyReviewDto,
  Paginated,
  ReviewCreateInput,
  ReviewDto,
  ReviewListQuery,
} from '@restaurant-reviews/common';
import type { Request, Response } from 'express';
import type { AccessTokenClaims } from '../../../../../application/ports/security';
import type { CreateReviewUseCase } from '../../../../../application/use-cases/reviews/CreateReviewUseCase';
import type { DeleteReviewUseCase } from '../../../../../application/use-cases/reviews/DeleteReviewUseCase';
import type { GetMyReviewUseCase } from '../../../../../application/use-cases/reviews/GetMyReviewUseCase';
import type { ListMyReviewsUseCase } from '../../../../../application/use-cases/reviews/ListMyReviewsUseCase';
import type { ListReviewsUseCase } from '../../../../../application/use-cases/reviews/ListReviewsUseCase';
import { UnauthenticatedError } from '../../../../../domain/errors';
import { toAuthoredReviewDto, toReviewDto } from '../presenters/toReviewDto';

/** Routes under /api/restaurants/:restaurantId/reviews carry the restaurant id. */
type ForRestaurant<B = unknown> = Request<{ restaurantId: string }, unknown, B>;

/** The use cases the review endpoints call. */
export interface ReviewUseCases {
  listReviews: ListReviewsUseCase;
  listMyReviews: ListMyReviewsUseCase;
  getMyReview: GetMyReviewUseCase;
  createReview: CreateReviewUseCase;
  deleteReview: DeleteReviewUseCase;
}

/** Handles `/api/restaurants/:restaurantId/reviews` and `/api/reviews`. */
export class ReviewController {
  constructor(
    private readonly useCases: ReviewUseCases,
    private readonly imageUrlFor: (imageKey: string) => string,
  ) {}

  /** Public. The query has been validated by the route. */
  readonly list = async (req: ForRestaurant, res: Response): Promise<void> => {
    const { page, limit } = req.validatedQuery as ReviewListQuery;
    const result = await this.useCases.listReviews.execute({
      restaurantId: req.params.restaurantId,
      page,
      limit,
    });
    res.json({ ...result, items: result.items.map(toReviewDto) } satisfies Paginated<ReviewDto>);
  };

  /** The caller's reviews across restaurants. The query has been validated by the route. */
  readonly listMine = async (req: Request, res: Response): Promise<void> => {
    const { userId } = this.caller(req);
    const { page, limit } = req.validatedQuery as ReviewListQuery;
    const result = await this.useCases.listMyReviews.execute({ authorId: userId, page, limit });
    res.json({
      ...result,
      items: result.items.map((item) => toAuthoredReviewDto(item, this.imageUrlFor)),
    } satisfies Paginated<AuthoredReviewDto>);
  };

  readonly mine = async (req: ForRestaurant, res: Response): Promise<void> => {
    const { userId } = this.caller(req);
    const review = await this.useCases.getMyReview.execute({
      restaurantId: req.params.restaurantId,
      authorId: userId,
    });
    res.json({ review: review && toReviewDto(review) } satisfies MyReviewDto);
  };

  readonly create = async (req: ForRestaurant<ReviewCreateInput>, res: Response): Promise<void> => {
    const { userId } = this.caller(req);
    const review = await this.useCases.createReview.execute({
      restaurantId: req.params.restaurantId,
      authorId: userId,
      review: req.body,
    });
    res.status(201).json(toReviewDto(review));
  };

  readonly remove = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { userId } = this.caller(req);
    await this.useCases.deleteReview.execute({ id: req.params.id, authorId: userId });
    res.status(204).end();
  };

  /** The authenticated caller. Routes that reach this always run `requireUser` first. */
  private caller(req: Request): AccessTokenClaims {
    if (!req.auth) throw new UnauthenticatedError('Sign in to continue');
    return req.auth;
  }
}
