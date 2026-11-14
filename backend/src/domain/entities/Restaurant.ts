import type { Cuisine } from '@restaurant-reviews/common';

/** A restaurant listed by an owner. Plain data; the ownership rule lives in OwnedRestaurants. */
export interface Restaurant {
  readonly id: string;
  readonly ownerId: string;
  /**
   * The restaurant's address in public URLs (`/restaurants/<slug>`). Unique, made from the title
   * when the restaurant is created, and never changed afterwards, so links to it keep working
   * after a rename.
   */
  readonly slug: string;
  readonly title: string;
  readonly location: string;
  readonly description: string;
  readonly cuisine: Cuisine;
  /** Where the preview image is kept in file storage. */
  readonly imageKey: string;
  /** Average of all review ratings; null until the first review. */
  readonly ratingAvg: number | null;
  readonly ratingCount: number;
  readonly createdAt: Date;
}
