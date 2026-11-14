import { RATING_MAX, RATING_MIN, REVIEW_COMMENT_MAX_LENGTH } from '@restaurant-reviews/common';
import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

const reviewSchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, immutable: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    authorName: { type: String, required: true, trim: true },
    rating: {
      type: Number,
      required: true,
      min: RATING_MIN,
      max: RATING_MAX,
      validate: { validator: Number.isInteger, message: 'Ratings are whole stars' },
    },
    comment: { type: String, required: true, trim: true, maxlength: REVIEW_COMMENT_MAX_LENGTH },
  },
  { timestamps: true },
);

// One review per reviewer per restaurant, enforced by the database even for simultaneous requests.
reviewSchema.index({ restaurant: 1, author: 1 }, { unique: true });
// A restaurant's reviews, newest first. _id breaks ties so pagination is stable.
reviewSchema.index({ restaurant: 1, createdAt: -1, _id: -1 });
// A reviewer's own reviews across restaurants, newest first.
reviewSchema.index({ author: 1, createdAt: -1, _id: -1 });

/** A review as stored. Inferred from the schema, so the two cannot drift apart. */
export type ReviewRecord = InferSchemaType<typeof reviewSchema>;
export type ReviewDocument = HydratedDocument<ReviewRecord>;
/** The `reviews` collection. */
export const ReviewModel = model('Review', reviewSchema);
