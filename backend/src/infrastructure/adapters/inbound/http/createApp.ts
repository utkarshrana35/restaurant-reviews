import cookieParser from 'cookie-parser';
import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import type { AuthController } from './controllers/AuthController';
import type { RestaurantController } from './controllers/RestaurantController';
import type { ReviewController } from './controllers/ReviewController';
import type { Authenticator } from './middleware/Authenticator';
import { ErrorHandler } from './middleware/ErrorHandler';
import { originCheck } from './middleware/originCheck';
import { authRoutes } from './routes/authRoutes';
import { restaurantRoutes, uploadRoutes } from './routes/restaurantRoutes';
import { restaurantReviewRoutes, reviewRoutes } from './routes/reviewRoutes';

/** One controller per area of the API. */
export interface Controllers {
  auth: AuthController;
  restaurants: RestaurantController;
  reviews: ReviewController;
}

/** Settings for the HTTP layer, taken from the environment. */
export interface HttpConfig {
  /** Browser origins allowed to make state-changing requests. */
  allowedOrigins: readonly string[];
  rateLimiting: boolean;
}

/** Everything `createApp` needs, built by the container. */
export interface HttpDependencies {
  controllers: Controllers;
  authenticator: Authenticator;
  config: HttpConfig;
}

/** Builds the Express application: global middleware, routes, then error handling. */
export function createApp({ controllers, authenticator, config }: HttpDependencies): Express {
  const app = express();
  const errorHandler = new ErrorHandler();

  app.disable('x-powered-by');
  // The frontend proxies /api from the same machine; trust its X-Forwarded-For so rate limits
  // apply to the real client address and not to the proxy.
  app.set('trust proxy', 'loopback');
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = Router();
  api.use((_req, res, next) => {
    // Responses depend on the session, so no browser or proxy may cache them.
    res.set('Cache-Control', 'no-store');
    next();
  });
  api.use(originCheck(config.allowedOrigins));

  api.use('/auth', authRoutes(controllers.auth, authenticator, config));
  // Before the reviews below, so a restaurant whose slug is "reviews" is found at
  // /restaurants/by-slug/reviews rather than read as the reviews of a restaurant "by-slug".
  api.use('/restaurants', restaurantRoutes(controllers.restaurants, authenticator));
  api.use(
    '/restaurants/:restaurantId/reviews',
    restaurantReviewRoutes(controllers.reviews, authenticator, config),
  );
  api.use('/reviews', reviewRoutes(controllers.reviews, authenticator));
  api.use('/uploads', uploadRoutes(controllers.restaurants, authenticator, config));

  app.use('/api', api);
  app.use(errorHandler.notFound);
  app.use(errorHandler.handle);

  return app;
}
