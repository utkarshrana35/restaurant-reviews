import type { RestaurantCreateInput } from '@restaurant-reviews/common';
import type { PaginatedResponse, Pagination } from '../../src/application/ports/Pagination';
import type {
  NewRestaurant,
  RestaurantChanges,
  RestaurantLookup,
  RestaurantRepository,
  RestaurantSearch,
  RestaurantUpdate,
} from '../../src/application/ports/RestaurantRepository';
import { OwnedRestaurants } from '../../src/application/services/OwnedRestaurants';
import { RestaurantImages } from '../../src/application/services/RestaurantImages';
import { CreateImageUploadUseCase } from '../../src/application/use-cases/restaurants/CreateImageUploadUseCase';
import { CreateRestaurantUseCase } from '../../src/application/use-cases/restaurants/CreateRestaurantUseCase';
import { DeleteRestaurantUseCase } from '../../src/application/use-cases/restaurants/DeleteRestaurantUseCase';
import { GetRestaurantUseCase } from '../../src/application/use-cases/restaurants/GetRestaurantUseCase';
import { ListMyRestaurantsUseCase } from '../../src/application/use-cases/restaurants/ListMyRestaurantsUseCase';
import { ListRestaurantsUseCase } from '../../src/application/use-cases/restaurants/ListRestaurantsUseCase';
import { UpdateRestaurantUseCase } from '../../src/application/use-cases/restaurants/UpdateRestaurantUseCase';
import type { Restaurant } from '../../src/domain/entities/Restaurant';
import { ConflictError } from '../../src/domain/errors';
import { InMemoryFileStorage, SAMPLE_BYTES } from './InMemoryFileStorage';
import { InMemoryReviewRepository } from './InMemoryReviewRepository';

/** Restaurants in an array, with a switch to make the next write fail. */
export class InMemoryRestaurantRepository implements RestaurantRepository {
  readonly restaurants: Restaurant[] = [];
  /** Set to make the next write fail, as a database outage would. */
  failNextWrite = false;
  /** Each restaurant's rating revision, as the MongoDB document's ratingRevision field holds. */
  private readonly ratingRevisions = new Map<string, number>();

  async create(restaurant: NewRestaurant): Promise<Restaurant> {
    this.failIfAsked();
    // As the unique index does, with the repository's generic message: the use case words it.
    if (this.restaurants.some(({ slug }) => slug === restaurant.slug)) {
      throw new ConflictError('This record already exists');
    }
    const created: Restaurant = {
      ...restaurant,
      id: String(this.restaurants.length + 1),
      ratingAvg: null,
      ratingCount: 0,
      createdAt: new Date(),
    };
    this.restaurants.push(created);
    return created;
  }

  async findOne(lookup: RestaurantLookup): Promise<Restaurant | null> {
    const matches = (restaurant: Restaurant) =>
      lookup.slug === undefined ? restaurant.id === lookup.id : restaurant.slug === lookup.slug;
    return this.restaurants.find(matches) ?? null;
  }

  async findByIds(ids: readonly string[]): Promise<Restaurant[]> {
    return this.restaurants.filter((restaurant) => ids.includes(restaurant.id));
  }

  async findByOwner(ownerId: string): Promise<Restaurant[]> {
    return this.restaurants.filter((restaurant) => restaurant.ownerId === ownerId).reverse();
  }

  async update(id: string, changes: RestaurantChanges): Promise<RestaurantUpdate | null> {
    this.failIfAsked();
    const index = this.restaurants.findIndex((restaurant) => restaurant.id === id);
    const previous = this.restaurants[index];
    if (!previous) return null;
    const defined = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    );
    const updated: Restaurant = { ...previous, ...defined };
    this.restaurants[index] = updated;
    return { previous, updated };
  }

  async delete(id: string): Promise<Restaurant | null> {
    const index = this.restaurants.findIndex((restaurant) => restaurant.id === id);
    if (index < 0) return null;
    const [deleted] = this.restaurants.splice(index, 1);
    return deleted ?? null;
  }

  /**
   * Makes the next ownership check see the restaurant as it is now, while the write after it
   * finds the restaurant as `change` leaves it: another request's change landing in between.
   */
  changeAfterNextRead(change: () => Promise<unknown>): void {
    const findOne = this.findOne.bind(this);
    this.findOne = async (lookup) => {
      this.findOne = findOne;
      const seen = await findOne(lookup);
      await change();
      return seen;
    };
  }

  async startRatingUpdate(id: string): Promise<number | null> {
    if (!this.restaurants.some((restaurant) => restaurant.id === id)) return null;
    const revision = (this.ratingRevisions.get(id) ?? 0) + 1;
    this.ratingRevisions.set(id, revision);
    return revision;
  }

  async setRating(
    id: string,
    ratingAvg: number | null,
    ratingCount: number,
    revision: number,
  ): Promise<void> {
    // As the MongoDB filter on ratingRevision does: a later recalculation has started.
    if (this.ratingRevisions.get(id) !== revision) return;
    const index = this.restaurants.findIndex((restaurant) => restaurant.id === id);
    const current = this.restaurants[index];
    if (current) this.restaurants[index] = { ...current, ratingAvg, ratingCount };
  }

  /** Same rules as the MongoDB implementation, applied to the array. */
  async search(
    { cuisine, minRating, maxRating, sort }: RestaurantSearch,
    { skip, limit }: Pagination,
  ): Promise<PaginatedResponse<Restaurant>> {
    const hasBound = minRating !== undefined || maxRating !== undefined;
    const matching = this.restaurants.filter((restaurant) => {
      if (cuisine && restaurant.cuisine !== cuisine) return false;
      if (!hasBound) return true;
      const rating = restaurant.ratingAvg;
      if (rating === null) return false;
      if (minRating !== undefined && rating < minRating) return false;
      return maxRating === undefined || rating <= maxRating;
    });
    const direction = sort === 'rating_asc' ? 1 : -1;
    const ordered = [...matching].sort((a, b) => {
      if (a.ratingAvg === null || b.ratingAvg === null) {
        return (a.ratingAvg === null ? 1 : 0) - (b.ratingAvg === null ? 1 : 0);
      }
      return (a.ratingAvg - b.ratingAvg) * direction || Number(a.id) - Number(b.id);
    });
    return { items: ordered.slice(skip, skip + limit), total: matching.length };
  }

  /** Sets a restaurant's rating directly, standing in for reviews in tests. */
  rate(id: string, ratingAvg: number | null, ratingCount = ratingAvg === null ? 0 : 1): void {
    const index = this.restaurants.findIndex((restaurant) => restaurant.id === id);
    const current = this.restaurants[index];
    if (!current) throw new Error(`No restaurant ${id}`);
    this.restaurants[index] = { ...current, ratingAvg, ratingCount };
  }

  private failIfAsked(): void {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error('Database unavailable');
    }
  }
}

/** Two owner ids, for checking that owners cannot touch each other's restaurants. */
export const OWNER_A = 'owner-a';
export const OWNER_B = 'owner-b';

/** The restaurant use cases wired to in-memory fakes, for tests that need no database or S3. */
export function createRestaurantFixture() {
  const restaurants = new InMemoryRestaurantRepository();
  const reviews = new InMemoryReviewRepository();
  const storage = new InMemoryFileStorage();
  const images = new RestaurantImages(storage);
  const owned = new OwnedRestaurants(restaurants);

  const createImageUpload = new CreateImageUploadUseCase(images);
  const createRestaurant = new CreateRestaurantUseCase(restaurants, images);
  const updateRestaurant = new UpdateRestaurantUseCase(restaurants, owned, images);
  const deleteRestaurant = new DeleteRestaurantUseCase(restaurants, owned, images, reviews);
  const listMyRestaurants = new ListMyRestaurantsUseCase(restaurants);
  const getRestaurant = new GetRestaurantUseCase(restaurants);
  const listRestaurants = new ListRestaurantsUseCase(restaurants);

  /** Does what the browser does: gets permission, then uploads a file to the key it was given. */
  const uploadImage = async (
    ownerId: string,
    bytes: readonly number[] = SAMPLE_BYTES.jpeg,
    totalSize?: number,
  ): Promise<string> => {
    const { key } = await createImageUpload.execute({
      ownerId,
      contentType: 'image/jpeg',
      size: 1,
    });
    storage.put(key, bytes, totalSize);
    return key;
  };

  // Each set of details gets its own slug, so tests can create several restaurants.
  let slugCount = 0;
  const details = (overrides: Partial<RestaurantCreateInput> = {}): RestaurantCreateInput => ({
    title: 'Thyme Traveler',
    slug: `thyme-traveler-${(slugCount += 1)}`,
    location: '7 Wishing Well Way, Hidden Valley',
    description: 'A culinary adventure through time.',
    cuisine: 'italian',
    imageKey: 'set-by-the-test',
    ...overrides,
  });

  /** Creates a restaurant for the owner, uploading an image for it first. */
  const createFor = async (ownerId: string, overrides: Partial<RestaurantCreateInput> = {}) =>
    createRestaurant.execute({
      ownerId,
      details: details({ imageKey: await uploadImage(ownerId), ...overrides }),
    });

  return {
    restaurants,
    reviews,
    storage,
    createImageUpload,
    createRestaurant,
    updateRestaurant,
    deleteRestaurant,
    listMyRestaurants,
    getRestaurant,
    listRestaurants,
    uploadImage,
    details,
    createFor,
  };
}

export type RestaurantFixture = ReturnType<typeof createRestaurantFixture>;
