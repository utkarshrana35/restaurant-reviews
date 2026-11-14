import type { RestaurantDto } from '@restaurant-reviews/common';
import type { Restaurant } from '../../../../../domain/entities/Restaurant';

/**
 * The public view of a restaurant. The storage key is internal; clients get the address the
 * image can be loaded from, built by `imageUrlFor`.
 */
export function toRestaurantDto(
  restaurant: Restaurant,
  imageUrlFor: (imageKey: string) => string,
): RestaurantDto {
  return {
    id: restaurant.id,
    ownerId: restaurant.ownerId,
    slug: restaurant.slug,
    title: restaurant.title,
    location: restaurant.location,
    description: restaurant.description,
    cuisine: restaurant.cuisine,
    imageUrl: imageUrlFor(restaurant.imageKey),
    ratingAvg: restaurant.ratingAvg,
    ratingCount: restaurant.ratingCount,
    createdAt: restaurant.createdAt.toISOString(),
  };
}
