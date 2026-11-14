import type { Types } from 'mongoose';
import { RestaurantModel } from '../../src/infrastructure/adapters/outbound/mongoose/models/RestaurantModel';
import { ReviewModel } from '../../src/infrastructure/adapters/outbound/mongoose/models/ReviewModel';

/** What a sweep found, and removed unless it was a dry run. */
export interface OrphanedReviews {
  /** Deleted restaurants that still had reviews. */
  restaurants: number;
  reviews: number;
}

/**
 * Finds reviews whose restaurant no longer exists and deletes them (or, with `dryRun`, only
 * counts them).
 *
 * Deleting a restaurant removes its record first and its reviews after, so a failure in between,
 * or a review posted at the same moment, leaves reviews nobody can reach: the restaurant's page is
 * gone, and "My reviews" leaves them out but still counts them in its totals. This puts that
 * right.
 *
 * Safe to run at any time, as often as wanted: a review whose restaurant exists is never touched,
 * and a sweep running alongside a restaurant deletion only removes what that deletion would.
 */
export async function sweepOrphanedReviews({ dryRun = false } = {}): Promise<OrphanedReviews> {
  // At most one id per restaurant ever reviewed, served by the review indexes.
  const reviewed: Types.ObjectId[] = await ReviewModel.distinct('restaurant');
  const existing = await RestaurantModel.find({ _id: { $in: reviewed } }, { _id: 1 }).lean();
  const stillThere = new Set(existing.map(({ _id }) => _id.toString()));
  const missing = reviewed.filter((id) => !stillThere.has(id.toString()));
  if (missing.length === 0) return { restaurants: 0, reviews: 0 };

  const orphaned = { restaurant: { $in: missing } };
  const reviews = dryRun
    ? await ReviewModel.countDocuments(orphaned)
    : (await ReviewModel.deleteMany(orphaned)).deletedCount;
  return { restaurants: missing.length, reviews };
}
