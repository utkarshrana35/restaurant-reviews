import type { Cuisine, ExactlyOne, SortOrder } from '@restaurant-reviews/common';
import type { Restaurant } from '../../domain/entities/Restaurant';
import type { PaginatedResponse, Pagination } from './Pagination';

/** One restaurant, named by its id or by the slug in its public URL. */
export type RestaurantLookup = ExactlyOne<{ id: string; slug: string }>;

/** Everything needed to create a restaurant. */
export interface NewRestaurant {
  ownerId: string;
  /** Must not be taken by another restaurant. */
  slug: string;
  title: string;
  location: string;
  description: string;
  cuisine: Cuisine;
  imageKey: string;
}

/** The fields an owner may change. The owner, slug and rating are never set through this. */
export type RestaurantChanges = Partial<Omit<NewRestaurant, 'ownerId' | 'slug'>>;

/**
 * A restaurant just before and just after one update. `previous` is read in the same operation
 * as the write, so it is exactly what this update replaced, even when another update landed in
 * between the caller reading the restaurant and changing it.
 */
export interface RestaurantUpdate {
  previous: Restaurant;
  updated: Restaurant;
}

/** What to look for in the public listing, and in what order. */
export interface RestaurantSearch {
  cuisine?: Cuisine;
  /** Only restaurants rated at least this. Unrated restaurants never match a rating bound. */
  minRating?: number;
  /** Only restaurants rated at most this. */
  maxRating?: number;
  /** By average rating. Unrated restaurants come last either way; ties go oldest first. */
  sort: SortOrder;
}

/** Stores restaurants. Implemented with Mongoose. */
export interface RestaurantRepository {
  /** @throws ConflictError when the slug is already taken. */
  create(restaurant: NewRestaurant): Promise<Restaurant>;
  findOne(lookup: RestaurantLookup): Promise<Restaurant | null>;
  /** The restaurants that exist among `ids`, in no particular order. */
  findByIds(ids: readonly string[]): Promise<Restaurant[]>;
  /** Newest first. */
  findByOwner(ownerId: string): Promise<Restaurant[]>;
  /** The restaurant as this update found it and left it, or null if it no longer exists. */
  update(id: string, changes: RestaurantChanges): Promise<RestaurantUpdate | null>;
  /**
   * Deletes the restaurant and returns it as it was when deleted, or null if it was already
   * gone. Read in the same operation, so it reflects any update that landed just before.
   */
  delete(id: string): Promise<Restaurant | null>;
  /**
   * Starts a recalculation of the restaurant's rating: atomically takes a revision higher than
   * that of any recalculation started before. Null if the restaurant is gone.
   */
  startRatingUpdate(id: string): Promise<number | null>;
  /**
   * Stores the rating worked out from the restaurant's reviews by the recalculation holding
   * `revision`. Does nothing if a later recalculation has started since, or if the restaurant
   * is gone.
   */
  setRating(
    id: string,
    ratingAvg: number | null,
    ratingCount: number,
    revision: number,
  ): Promise<void>;
  /** One slice of the matching restaurants, and how many match in total. */
  search(search: RestaurantSearch, pagination: Pagination): Promise<PaginatedResponse<Restaurant>>;
}
