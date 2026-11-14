import type { Cuisine, Role } from './constants';

/** One field-level problem: which field, and what is wrong with it. */
export interface ApiErrorDetail {
  path: string;
  message: string;
}

/** The single error shape every API failure is returned in. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}

/** The public view of an account. Never includes the password hash. */
export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/** The two tokens issued when a user signs in on a device. */
export interface IssuedTokens {
  /** Short-lived; sent with each request that needs the user to be signed in. */
  accessToken: string;
  /** Long-lived; exchanged at the refresh endpoint for a new access token. */
  refreshToken: string;
}

/** `user` is null for a guest; asking who is signed in is not an error. */
export interface SessionDto {
  user: UserDto | null;
}

/**
 * The base of every sign-in and refresh answer: each one succeeds with the user or fails with an
 * error, so `user` is never null. Also a valid `SessionDto`.
 */
export interface SignedInDto {
  user: UserDto;
}

/**
 * The answer to an endpoint that starts a session (registering, signing in, resetting the
 * password). The tokens are always set as cookies. `tokens` repeats them only for a client that
 * sends `X-Client: mobile`, which cannot rely on a browser's cookie jar; a browser never gets
 * them where page script could read them. Also a valid `SignedInDto`.
 */
export interface SessionStartedDto extends SignedInDto {
  tokens?: IssuedTokens;
}

/**
 * The answer to refreshing. The new access token is always set as a cookie, and repeated as
 * `accessToken` only for a client that sends `X-Client: mobile`. Also a valid `SignedInDto`.
 */
export interface RefreshedDto extends SignedInDto {
  accessToken?: string;
}

/** The public view of a restaurant. */
export interface RestaurantDto {
  id: string;
  ownerId: string;
  /** Identifies the restaurant in public URLs: `/restaurants/<slug>`. Never changes. */
  slug: string;
  title: string;
  location: string;
  description: string;
  cuisine: Cuisine;
  imageUrl: string;
  /** Average of all review ratings, or null when there are no reviews yet. */
  ratingAvg: number | null;
  ratingCount: number;
  createdAt: string;
}

/** Permission to upload one file straight to storage: POST `fields` plus the file to `url`. */
export interface PresignedUploadDto {
  url: string;
  fields: Record<string, string>;
  /** Identifies the uploaded file. Sent back as `imageKey` when saving the restaurant. */
  key: string;
}

/** The public view of a review. */
export interface ReviewDto {
  id: string;
  restaurantId: string;
  authorId: string;
  /** The reviewer's name as shown next to the review. */
  authorName: string;
  /** Whole stars, 1 to 5. */
  rating: number;
  comment: string;
  createdAt: string;
}

/** One of the caller's reviews in their list of reviews, with the restaurant it is about. */
export interface AuthoredReviewDto extends ReviewDto {
  /** For linking to the restaurant's page. */
  restaurantSlug: string;
  restaurantTitle: string;
  /** Where the restaurant's preview image can be loaded from. */
  restaurantImageUrl: string;
}

/** The caller's own review of a restaurant, or null if they have not reviewed it. */
export interface MyReviewDto {
  review: ReviewDto | null;
}

/** One page of a list, with what is needed to show page controls. */
export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  /** How many items match across all pages. */
  total: number;
  totalPages: number;
}
