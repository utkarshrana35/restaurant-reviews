// Deletes reviews whose restaurant no longer exists. Run with `pnpm reviews:delete-orphans`
// (add `--dry-run` to only count them). Needs only MongoDB. Meant to be scheduled in production;
// see "Cleaning up orphaned reviews" in the README.
import { loadEnv } from '../../src/infrastructure/config/env';
import { MongoDatabase } from '../../src/infrastructure/database/MongoDatabase';
import { sweepOrphanedReviews } from './orphanedReviews';

const dryRun = process.argv.includes('--dry-run');
const database = new MongoDatabase(loadEnv().MONGODB_URI);

try {
  await database.connect();
  const { restaurants, reviews } = await sweepOrphanedReviews({ dryRun });
  const verb = dryRun ? 'Would delete' : 'Deleted';
  console.log(`${verb} ${reviews} orphaned reviews of ${restaurants} deleted restaurants.`);
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await database.disconnect();
}
