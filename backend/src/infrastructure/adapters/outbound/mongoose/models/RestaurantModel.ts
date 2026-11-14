import {
  CUISINES,
  RESTAURANT_SLUG_MAX_LENGTH,
  RESTAURANT_SLUG_PATTERN,
} from '@restaurant-reviews/common';
import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

const restaurantSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    // The public URL. The unique index settles two restaurants claiming the same slug at once.
    // Lowercased and checked here as well as by the API, so no write path (the seed script, a
    // future one) can store a slug that public URLs would not find.
    slug: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      lowercase: true,
      maxlength: RESTAURANT_SLUG_MAX_LENGTH,
      match: RESTAURANT_SLUG_PATTERN,
    },
    title: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    cuisine: { type: String, required: true, enum: CUISINES },
    imageKey: { type: String, required: true },
    // Kept on the restaurant so listings can filter and sort by rating without joining reviews.
    // Null until the first review.
    ratingAvg: { type: Number, default: null },
    ratingCount: { type: Number, required: true, default: 0 },
    // Whether ratingAvg is set, written with it. Stored so the listing's "unrated last" order is
    // a plain sort that an index can serve, rather than one worked out for every restaurant.
    rated: { type: Boolean, required: true, default: false },
    // Counts rating recalculations started for this restaurant (see RestaurantRatings). Each one
    // takes the next number before reading the reviews, and stores its result only if no later
    // one has started since, so a slow recalculation cannot overwrite a newer result.
    ratingRevision: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

// An owner's restaurants, newest first.
restaurantSchema.index({ owner: 1, createdAt: -1 });
// The public listing, in each order, optionally within one cuisine: rated restaurants first,
// then by rating. _id breaks ties so pagination is stable. An index is read in one direction
// only for all its fields, so each rating order needs its own.
for (const order of [-1, 1] as const) {
  restaurantSchema.index({ rated: -1, ratingAvg: order, _id: 1 });
  restaurantSchema.index({ cuisine: 1, rated: -1, ratingAvg: order, _id: 1 });
}

/** A restaurant as stored. Inferred from the schema, so the two cannot drift apart. */
export type RestaurantRecord = InferSchemaType<typeof restaurantSchema>;
export type RestaurantDocument = HydratedDocument<RestaurantRecord>;
/** The `restaurants` collection. */
export const RestaurantModel = model('Restaurant', restaurantSchema);
