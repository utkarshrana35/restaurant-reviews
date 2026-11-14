import { z } from 'zod';
import {
  CUISINES,
  IMAGE_CONTENT_TYPES,
  IMAGE_MAX_BYTES,
  RESTAURANT_DESCRIPTION_MAX_LENGTH,
  RESTAURANT_LOCATION_MAX_LENGTH,
  RESTAURANT_SLUG_MAX_LENGTH,
  RESTAURANT_TITLE_MAX_LENGTH,
} from '../constants';

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

/** The key of an image the owner has just uploaded with a presigned upload. */
const imageKeySchema = z.string().min(1, 'Upload an image').max(300);

/**
 * What a stored slug looks like: lowercase letters and digits in words joined by single hyphens.
 * The database checks it too (see RestaurantModel).
 */
export const RESTAURANT_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * The part of a restaurant's public URL after `/restaurants/`, such as `le-petit-bistro`. Chosen
 * by the owner when creating the restaurant (the form suggests one from the title) and fixed
 * after that.
 *
 * Slugs are case-insensitive: capitals are lowercased rather than refused, so `Le-Petit-Bistro`
 * is saved as, and finds, `le-petit-bistro`.
 */
export const restaurantSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Choose a page address')
  .max(
    RESTAURANT_SLUG_MAX_LENGTH,
    `The page address must be at most ${RESTAURANT_SLUG_MAX_LENGTH} characters`,
  )
  .regex(RESTAURANT_SLUG_PATTERN, 'Use letters and numbers, with single hyphens between words');

/** Body of `POST /api/restaurants`. The owner is the caller and is never part of the body. */
export const restaurantCreateSchema = z.object({
  title: requiredText('Title', RESTAURANT_TITLE_MAX_LENGTH),
  slug: restaurantSlugSchema,
  location: requiredText('Location', RESTAURANT_LOCATION_MAX_LENGTH),
  description: requiredText('Description', RESTAURANT_DESCRIPTION_MAX_LENGTH),
  cuisine: z.enum(CUISINES, 'Choose a cuisine'),
  imageKey: imageKeySchema,
});

/**
 * Any subset of the fields; `imageKey` is only sent when the image is being replaced. The slug
 * is not among them: links to the restaurant keep working because it never changes.
 */
export const restaurantUpdateSchema = restaurantCreateSchema
  .omit({ slug: true })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, 'Nothing to update');

/** What the browser declares about a file before it is given permission to upload it. */
export const presignUploadSchema = z.object({
  contentType: z.enum(IMAGE_CONTENT_TYPES, 'Choose a JPEG, PNG or WebP image'),
  size: z
    .number()
    .int()
    .min(1, 'The file is empty')
    .max(IMAGE_MAX_BYTES, `The image must be at most ${IMAGE_MAX_BYTES / 1024 / 1024} MB`),
});

export type RestaurantCreateInput = z.infer<typeof restaurantCreateSchema>;
export type RestaurantUpdateInput = z.infer<typeof restaurantUpdateSchema>;
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;
