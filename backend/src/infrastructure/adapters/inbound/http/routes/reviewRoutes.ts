import { reviewCreateSchema, reviewListQuerySchema } from '@restaurant-reviews/common';
import { Router } from 'express';
import type { ReviewController } from '../controllers/ReviewController';
import type { Authenticator } from '../middleware/Authenticator';
import { rateLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validateBody';
import { validateQuery } from '../middleware/validateQuery';

/** Routes under /api/restaurants/:restaurantId/reviews. */
export function restaurantReviewRoutes(
  reviews: ReviewController,
  authenticator: Authenticator,
  options: { rateLimiting: boolean },
): Router {
  const reviewerOnly = [authenticator.requireUser, authenticator.requireRole('reviewer')];
  // Generous for a person, low enough to slow a script writing reviews from many accounts.
  const writeLimit = rateLimiter({ windowMinutes: 15, limit: 30 }, options.rateLimiting);

  // mergeParams: the restaurant id is part of the path this router is mounted on.
  const router = Router({ mergeParams: true });
  router.get('/', validateQuery(reviewListQuerySchema), reviews.list);
  router.get('/mine', reviewerOnly, reviews.mine);
  router.post('/', writeLimit, reviewerOnly, validateBody(reviewCreateSchema), reviews.create);
  return router;
}

/** Routes under /api/reviews. */
export function reviewRoutes(reviews: ReviewController, authenticator: Authenticator): Router {
  const reviewerOnly = [authenticator.requireUser, authenticator.requireRole('reviewer')];

  const router = Router();
  router.get('/mine', reviewerOnly, validateQuery(reviewListQuerySchema), reviews.listMine);
  // The review must also be the caller's own, which the use case checks.
  router.delete('/:id', reviewerOnly, reviews.remove);
  return router;
}
