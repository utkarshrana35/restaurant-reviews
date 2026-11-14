import {
  presignUploadSchema,
  restaurantCreateSchema,
  restaurantListQuerySchema,
  restaurantUpdateSchema,
} from '@restaurant-reviews/common';
import { Router } from 'express';
import type { RestaurantController } from '../controllers/RestaurantController';
import type { Authenticator } from '../middleware/Authenticator';
import { rateLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validateBody';
import { validateQuery } from '../middleware/validateQuery';

/** Routes under /api/restaurants. */
export function restaurantRoutes(
  restaurants: RestaurantController,
  authenticator: Authenticator,
): Router {
  // Two checks, in order: signed in at all, then signed in as an owner.
  const ownerOnly = [authenticator.requireUser, authenticator.requireRole('owner')];

  const router = Router();

  // Owner only. Declared before "/:id" so "mine" is not read as an id.
  router.get('/mine', ownerOnly, restaurants.listMine);
  router.post('/', ownerOnly, validateBody(restaurantCreateSchema), restaurants.create);
  // These also require the restaurant to be the caller's own, which the use case checks.
  router.patch('/:id', ownerOnly, validateBody(restaurantUpdateSchema), restaurants.update);
  router.delete('/:id', ownerOnly, restaurants.remove);

  // Public
  router.get('/', validateQuery(restaurantListQuerySchema), restaurants.list);
  // The public pages look restaurants up by the slug in their URL.
  router.get('/by-slug/:slug', restaurants.showBySlug);
  router.get('/:id', restaurants.show);

  return router;
}

/** Routes under /api/uploads. */
export function uploadRoutes(
  restaurants: RestaurantController,
  authenticator: Authenticator,
  options: { rateLimiting: boolean },
): Router {
  const presignLimit = rateLimiter({ windowMinutes: 15, limit: 60 }, options.rateLimiting);

  const router = Router();
  router.post(
    '/presign',
    presignLimit,
    authenticator.requireUser,
    authenticator.requireRole('owner'),
    validateBody(presignUploadSchema),
    restaurants.presignImageUpload,
  );
  return router;
}
