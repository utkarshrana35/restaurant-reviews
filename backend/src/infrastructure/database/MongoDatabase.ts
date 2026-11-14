import mongoose from 'mongoose';

/** Owns the lifecycle of the MongoDB connection that every Mongoose model uses. */
export class MongoDatabase {
  constructor(private readonly uri: string) {}

  async connect(): Promise<void> {
    try {
      // Fail in seconds, not the 30 s default, when mongod is not running.
      await mongoose.connect(this.uri, { serverSelectionTimeoutMS: 5000 });
    } catch (err) {
      throw new Error(`Could not connect to MongoDB at ${this.safeUri}. Is mongod running?`, {
        cause: err,
      });
    }
    // Wait for index builds, so unique constraints are enforced before the first request.
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  }

  async disconnect(): Promise<void> {
    await mongoose.disconnect();
  }

  /** The URI with any credentials removed, safe to print. */
  private get safeUri(): string {
    return this.uri.replace(/\/\/[^@/]*@/, '//');
  }
}
