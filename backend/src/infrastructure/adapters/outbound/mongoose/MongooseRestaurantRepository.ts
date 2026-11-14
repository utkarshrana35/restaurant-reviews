import { isValidObjectId } from 'mongoose';
import type { PaginatedResponse, Pagination } from '../../../../application/ports/Pagination';
import type {
  NewRestaurant,
  RestaurantChanges,
  RestaurantLookup,
  RestaurantRepository,
  RestaurantSearch,
  RestaurantUpdate,
} from '../../../../application/ports/RestaurantRepository';
import type { Restaurant } from '../../../../domain/entities/Restaurant';
import { RestaurantModel, type RestaurantDocument } from './models/RestaurantModel';
import { MongooseRepository } from './MongooseRepository';

/** Restaurants in MongoDB. */
export class MongooseRestaurantRepository
  extends MongooseRepository
  implements RestaurantRepository
{
  async create({ ownerId, ...fields }: NewRestaurant): Promise<Restaurant> {
    // Not retried: a retry after a lost reply would create the restaurant twice. The slug is the
    // only unique field, so a ConflictError always means it is taken; the use case words the
    // message for the owner.
    const doc = await this.run(() => RestaurantModel.create({ ...fields, owner: ownerId }), {
      retry: false,
    });
    return this.toEntity(doc);
  }

  async findOne(lookup: RestaurantLookup): Promise<Restaurant | null> {
    let filter: { _id: string } | { slug: string };
    if (lookup.slug === undefined) {
      if (!isValidObjectId(lookup.id)) return null;
      filter = { _id: lookup.id };
    } else {
      filter = { slug: lookup.slug };
    }
    const doc = await this.run(() => RestaurantModel.findOne(filter));
    return doc ? this.toEntity(doc) : null;
  }

  async findByIds(ids: readonly string[]): Promise<Restaurant[]> {
    const valid = ids.filter((id) => isValidObjectId(id));
    if (valid.length === 0) return [];
    const docs = await this.run(() => RestaurantModel.find({ _id: { $in: valid } }));
    return docs.map((doc) => this.toEntity(doc));
  }

  async findByOwner(ownerId: string): Promise<Restaurant[]> {
    if (!isValidObjectId(ownerId)) return [];
    const docs = await this.run(() =>
      RestaurantModel.find({ owner: ownerId }).sort({ createdAt: -1, _id: -1 }),
    );
    return docs.map((doc) => this.toEntity(doc));
  }

  async update(id: string, changes: RestaurantChanges): Promise<RestaurantUpdate | null> {
    if (!isValidObjectId(id)) return null;
    // Each field is named, so nothing else (owner, rating) can be written through this method.
    const { title, location, description, cuisine, imageKey } = changes;
    const fields = Object.fromEntries(
      Object.entries({ title, location, description, cuisine, imageKey }).filter(
        ([, value]) => value !== undefined,
      ),
    );
    // The document as this write found it, read in the same operation, so `previous` is exactly
    // what was replaced.
    const doc = await this.run(() =>
      RestaurantModel.findByIdAndUpdate(
        id,
        { $set: fields },
        { returnDocument: 'before', runValidators: true },
      ),
    );
    if (!doc) return null;
    const previous = this.toEntity(doc);
    // The write set exactly these fields, so setting them on the document it replaced gives the
    // restaurant as it now is, cast and trimmed the way the write was.
    doc.set(fields);
    return { previous, updated: this.toEntity(doc) };
  }

  async delete(id: string): Promise<Restaurant | null> {
    if (!isValidObjectId(id)) return null;
    // A retry after a lost reply finds nothing and answers null, as if another request had
    // deleted it; the restaurant is gone either way.
    const doc = await this.run(() => RestaurantModel.findByIdAndDelete(id));
    return doc ? this.toEntity(doc) : null;
  }

  async startRatingUpdate(id: string): Promise<number | null> {
    if (!isValidObjectId(id)) return null;
    // One atomic increment, so two recalculations never get the same revision. A retry after a
    // lost reply increments twice, which only skips a number.
    const doc = await this.run(() =>
      RestaurantModel.findByIdAndUpdate(
        id,
        { $inc: { ratingRevision: 1 } },
        { returnDocument: 'after', projection: { ratingRevision: 1 } },
      ),
    );
    return doc ? doc.ratingRevision : null;
  }

  async setRating(
    id: string,
    ratingAvg: number | null,
    ratingCount: number,
    revision: number,
  ): Promise<void> {
    if (!isValidObjectId(id)) return;
    await this.run(() =>
      RestaurantModel.updateOne(
        // Matches nothing once a later recalculation has taken a higher revision.
        { _id: id, ratingRevision: revision },
        // `rated` is set in the same write, so it always agrees with ratingAvg.
        { $set: { ratingAvg, ratingCount, rated: ratingAvg !== null } },
      ),
    );
  }

  async search(
    { cuisine, minRating, maxRating, sort }: RestaurantSearch,
    { skip, limit }: Pagination,
  ): Promise<PaginatedResponse<Restaurant>> {
    const filter: Record<string, unknown> = {};
    if (cuisine) filter.cuisine = cuisine;
    if (minRating !== undefined || maxRating !== undefined) {
      // A rating bound asks about ratings, so restaurants without one never match it.
      filter.rated = true;
      filter.ratingAvg = {
        ...(minRating !== undefined && { $gte: minRating }),
        ...(maxRating !== undefined && { $lte: maxRating }),
      };
    }

    // Unrated restaurants go last in both orders, so worst-rated-first does not open with
    // restaurants that have no rating at all. Each order has an index that returns restaurants
    // already sorted, so a page reads only the restaurants up to its end.
    const direction = sort === 'rating_asc' ? 1 : -1;
    const [docs, total] = await this.run(() =>
      Promise.all([
        RestaurantModel.find(filter)
          .sort({ rated: -1, ratingAvg: direction, _id: 1 })
          .skip(skip)
          .limit(limit),
        RestaurantModel.countDocuments(filter),
      ]),
    );
    return { items: docs.map((doc) => this.toEntity(doc)), total };
  }

  private toEntity(doc: RestaurantDocument): Restaurant {
    return {
      id: doc.id,
      ownerId: doc.owner.toString(),
      slug: doc.slug,
      title: doc.title,
      location: doc.location,
      description: doc.description,
      cuisine: doc.cuisine,
      imageKey: doc.imageKey,
      // Not required in the schema, so a document stored without it reads as unrated.
      ratingAvg: doc.ratingAvg ?? null,
      ratingCount: doc.ratingCount,
      createdAt: doc.createdAt,
    };
  }
}
