import type { EmailSender } from './application/ports/EmailSender';
import type { FileStorage } from './application/ports/FileStorage';
import { EmailCodes } from './application/services/EmailCodes';
import { OwnedRestaurants } from './application/services/OwnedRestaurants';
import { RestaurantImages } from './application/services/RestaurantImages';
import { RestaurantRatings } from './application/services/RestaurantRatings';
import { AuthenticateUseCase } from './application/use-cases/auth/AuthenticateUseCase';
import { EndSessionUseCase } from './application/use-cases/auth/EndSessionUseCase';
import { GetCurrentUserUseCase } from './application/use-cases/auth/GetCurrentUserUseCase';
import { LoginUseCase } from './application/use-cases/auth/LoginUseCase';
import { RefreshSessionUseCase } from './application/use-cases/auth/RefreshSessionUseCase';
import { RegisterUserUseCase } from './application/use-cases/auth/RegisterUserUseCase';
import { RequestOtpUseCase } from './application/use-cases/auth/RequestOtpUseCase';
import { RequestPasswordResetUseCase } from './application/use-cases/auth/RequestPasswordResetUseCase';
import { ResetPasswordUseCase } from './application/use-cases/auth/ResetPasswordUseCase';
import { StartSessionUseCase } from './application/use-cases/auth/StartSessionUseCase';
import { CreateImageUploadUseCase } from './application/use-cases/restaurants/CreateImageUploadUseCase';
import { CreateRestaurantUseCase } from './application/use-cases/restaurants/CreateRestaurantUseCase';
import { DeleteRestaurantUseCase } from './application/use-cases/restaurants/DeleteRestaurantUseCase';
import { GetRestaurantUseCase } from './application/use-cases/restaurants/GetRestaurantUseCase';
import { ListMyRestaurantsUseCase } from './application/use-cases/restaurants/ListMyRestaurantsUseCase';
import { ListRestaurantsUseCase } from './application/use-cases/restaurants/ListRestaurantsUseCase';
import { UpdateRestaurantUseCase } from './application/use-cases/restaurants/UpdateRestaurantUseCase';
import { CreateReviewUseCase } from './application/use-cases/reviews/CreateReviewUseCase';
import { DeleteReviewUseCase } from './application/use-cases/reviews/DeleteReviewUseCase';
import { GetMyReviewUseCase } from './application/use-cases/reviews/GetMyReviewUseCase';
import { ListMyReviewsUseCase } from './application/use-cases/reviews/ListMyReviewsUseCase';
import { ListReviewsUseCase } from './application/use-cases/reviews/ListReviewsUseCase';
import { AuthCookies } from './infrastructure/adapters/inbound/http/AuthCookies';
import { AuthController } from './infrastructure/adapters/inbound/http/controllers/AuthController';
import { RestaurantController } from './infrastructure/adapters/inbound/http/controllers/RestaurantController';
import { ReviewController } from './infrastructure/adapters/inbound/http/controllers/ReviewController';
import type { HttpDependencies } from './infrastructure/adapters/inbound/http/createApp';
import { Authenticator } from './infrastructure/adapters/inbound/http/middleware/Authenticator';
import { ConsoleEmailSender } from './infrastructure/adapters/outbound/email/ConsoleEmailSender';
import { SesEmailSender } from './infrastructure/adapters/outbound/email/SesEmailSender';
import { SmtpEmailSender } from './infrastructure/adapters/outbound/email/SmtpEmailSender';
import { MongooseOtpRepository } from './infrastructure/adapters/outbound/mongoose/MongooseOtpRepository';
import { MongooseRestaurantRepository } from './infrastructure/adapters/outbound/mongoose/MongooseRestaurantRepository';
import { MongooseReviewRepository } from './infrastructure/adapters/outbound/mongoose/MongooseReviewRepository';
import { MongooseSessionRepository } from './infrastructure/adapters/outbound/mongoose/MongooseSessionRepository';
import { MongooseUserRepository } from './infrastructure/adapters/outbound/mongoose/MongooseUserRepository';
import { BcryptPasswordHasher } from './infrastructure/adapters/outbound/security/BcryptPasswordHasher';
import { CryptoOtpCodes } from './infrastructure/adapters/outbound/security/CryptoOtpCodes';
import { CryptoRefreshTokens } from './infrastructure/adapters/outbound/security/CryptoRefreshTokens';
import { JwtAccessTokens } from './infrastructure/adapters/outbound/security/JwtAccessTokens';
import { S3FileStorage } from './infrastructure/adapters/outbound/storage/S3FileStorage';
import type { Env } from './infrastructure/config/env';
import { s3ConfigFromEnv } from './infrastructure/config/storageConfig';
import { MongoDatabase } from './infrastructure/database/MongoDatabase';

/** What the entry point needs: the database to connect, and everything the HTTP app is built from. */
export interface Container {
  database: MongoDatabase;
  http: HttpDependencies;
}

/** Adapters a test may replace with a fake. Everything else is always the real implementation. */
export interface AdapterOverrides {
  emailSender?: EmailSender;
  fileStorage?: FileStorage;
}

/**
 * Composition root: the only place that knows which adapter implements which port. Everything
 * else receives its collaborators through its constructor.
 */
export function buildContainer(env: Env, overrides: AdapterOverrides = {}): Container {
  const database = new MongoDatabase(env.MONGODB_URI);
  const accessTtlSeconds = env.ACCESS_TOKEN_TTL_MINUTES * 60;
  const refreshTtlSeconds = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;

  // Outbound adapters
  const users = new MongooseUserRepository();
  const otps = new MongooseOtpRepository();
  const sessions = new MongooseSessionRepository();
  const restaurants = new MongooseRestaurantRepository();
  const reviews = new MongooseReviewRepository();
  const passwordHasher = new BcryptPasswordHasher(env.BCRYPT_ROUNDS);
  const accessTokens = new JwtAccessTokens(env.JWT_SECRET, accessTtlSeconds);
  const refreshTokens = new CryptoRefreshTokens();
  const otpCodes = new CryptoOtpCodes(env.JWT_SECRET);
  const emailSender = overrides.emailSender ?? buildEmailSender(env);
  const fileStorage = overrides.fileStorage ?? new S3FileStorage(s3ConfigFromEnv(env));

  // Application services shared by several use cases
  const restaurantImages = new RestaurantImages(fileStorage);
  const ownedRestaurants = new OwnedRestaurants(restaurants);
  const restaurantRatings = new RestaurantRatings(restaurants, reviews);
  const emailCodes = new EmailCodes(otps, otpCodes, emailSender);

  // Use cases
  const requestOtp = new RequestOtpUseCase(users, emailCodes);
  const registerUser = new RegisterUserUseCase(users, emailCodes, passwordHasher);
  const requestPasswordReset = new RequestPasswordResetUseCase(users, emailCodes);
  const resetPassword = new ResetPasswordUseCase(users, sessions, emailCodes, passwordHasher);
  const login = new LoginUseCase(users, passwordHasher);
  const startSession = new StartSessionUseCase(
    sessions,
    refreshTokens,
    accessTokens,
    refreshTtlSeconds,
  );
  const refreshSession = new RefreshSessionUseCase(users, sessions, refreshTokens, accessTokens);
  const endSession = new EndSessionUseCase(sessions);
  const authenticate = new AuthenticateUseCase(accessTokens);
  const getCurrentUser = new GetCurrentUserUseCase(users);
  const createImageUpload = new CreateImageUploadUseCase(restaurantImages);
  const createRestaurant = new CreateRestaurantUseCase(restaurants, restaurantImages);
  const updateRestaurant = new UpdateRestaurantUseCase(
    restaurants,
    ownedRestaurants,
    restaurantImages,
  );
  const deleteRestaurant = new DeleteRestaurantUseCase(
    restaurants,
    ownedRestaurants,
    restaurantImages,
    reviews,
  );
  const listMyRestaurants = new ListMyRestaurantsUseCase(restaurants);
  const getRestaurant = new GetRestaurantUseCase(restaurants);
  const listRestaurants = new ListRestaurantsUseCase(restaurants);
  const listReviews = new ListReviewsUseCase(restaurants, reviews);
  const listMyReviews = new ListMyReviewsUseCase(reviews, restaurants);
  const getMyReview = new GetMyReviewUseCase(restaurants, reviews);
  const createReview = new CreateReviewUseCase(restaurants, users, reviews, restaurantRatings);
  const deleteReview = new DeleteReviewUseCase(reviews, restaurantRatings);

  // Inbound adapters
  const cookies = new AuthCookies({
    accessTtlSeconds,
    refreshTtlSeconds,
    secure: env.NODE_ENV === 'production',
  });

  return {
    database,
    http: {
      controllers: {
        auth: new AuthController(
          {
            requestOtp,
            registerUser,
            requestPasswordReset,
            resetPassword,
            login,
            startSession,
            refreshSession,
            endSession,
            getCurrentUser,
          },
          cookies,
        ),
        restaurants: new RestaurantController(
          {
            createImageUpload,
            createRestaurant,
            updateRestaurant,
            deleteRestaurant,
            listMyRestaurants,
            getRestaurant,
            listRestaurants,
          },
          (imageKey) => fileStorage.publicUrl(imageKey),
        ),
        reviews: new ReviewController(
          { listReviews, listMyReviews, getMyReview, createReview, deleteReview },
          (imageKey) => fileStorage.publicUrl(imageKey),
        ),
      },
      authenticator: new Authenticator(cookies, authenticate),
      config: {
        allowedOrigins: env.ALLOWED_ORIGINS,
        // Off under test so suites can make many requests; exercised by its own test.
        rateLimiting: env.NODE_ENV !== 'test',
      },
    },
  };
}

function buildEmailSender(env: Env): EmailSender {
  // loadEnv has already checked that the chosen provider's settings are present.
  if (env.EMAIL_PROVIDER === 'smtp' && env.SMTP_HOST) {
    // loadEnv has checked that the user and password are set together or not at all.
    const auth =
      env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined;
    return new SmtpEmailSender({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      auth,
      from: env.EMAIL_FROM,
    });
  }
  if (env.EMAIL_PROVIDER === 'ses' && env.AWS_REGION) {
    return new SesEmailSender({ region: env.AWS_REGION, from: env.EMAIL_FROM });
  }
  return new ConsoleEmailSender();
}
