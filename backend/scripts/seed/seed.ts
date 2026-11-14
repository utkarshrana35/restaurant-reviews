// Fills the development database with demo accounts, restaurants and reviews. Run with `pnpm seed`
// (add `--reset` to replace existing data). Needs MongoDB, and LocalStack via `pnpm infra:up`.
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { slugify, type Cuisine, type Role } from '@restaurant-reviews/common';
import { RestaurantRatings } from '../../src/application/services/RestaurantRatings';
import { EmailOtpModel } from '../../src/infrastructure/adapters/outbound/mongoose/models/EmailOtpModel';
import { RestaurantModel } from '../../src/infrastructure/adapters/outbound/mongoose/models/RestaurantModel';
import { ReviewModel } from '../../src/infrastructure/adapters/outbound/mongoose/models/ReviewModel';
import { SessionModel } from '../../src/infrastructure/adapters/outbound/mongoose/models/SessionModel';
import { UserModel } from '../../src/infrastructure/adapters/outbound/mongoose/models/UserModel';
import { MongooseRestaurantRepository } from '../../src/infrastructure/adapters/outbound/mongoose/MongooseRestaurantRepository';
import { MongooseReviewRepository } from '../../src/infrastructure/adapters/outbound/mongoose/MongooseReviewRepository';
import { BcryptPasswordHasher } from '../../src/infrastructure/adapters/outbound/security/BcryptPasswordHasher';
import { createS3Client } from '../../src/infrastructure/adapters/outbound/storage/S3FileStorage';
import { loadEnv } from '../../src/infrastructure/config/env';
import { s3ConfigFromEnv } from '../../src/infrastructure/config/storageConfig';
import { MongoDatabase } from '../../src/infrastructure/database/MongoDatabase';
import { gradientPng } from './placeholderImage';

/** Every seeded account uses this password. */
export const SEED_PASSWORD = 'Password123';

// The accounts to sign in with. Of the reviewers, only Rita has a review already (of Le Petit
// Bistro), so the others can try writing one anywhere.
const ACCOUNTS: { name: string; email: string; role: Role }[] = [
  { name: 'Olivia Owner', email: 'owner1@example.com', role: 'owner' },
  { name: 'Oscar Owner', email: 'owner2@example.com', role: 'owner' },
  { name: 'Rita Reviewer', email: 'reviewer1@example.com', role: 'reviewer' },
  { name: 'Ravi Reviewer', email: 'reviewer2@example.com', role: 'reviewer' },
  { name: 'Rosa Reviewer', email: 'reviewer3@example.com', role: 'reviewer' },
];

// Reviewers who write the seeded reviews, so restaurants have several each.
const COMMUNITY = [
  'Amara Okafor',
  'Ben Carter',
  'Chloé Martin',
  'Dev Patel',
  'Elena Rossi',
  'Finn Murphy',
  'Grace Liu',
  'Hiro Tanaka',
  'Isla Novak',
].map((name, i) => ({ name, email: `diner${i + 1}@example.com`, role: 'reviewer' as const }));

// Comments to choose from for each star rating, so the words match the score.
const COMMENTS: Record<number, string[]> = {
  1: [
    'Cold food and a long wait. We will not be back.',
    'Disappointing from start to finish; the staff seemed not to care.',
  ],
  2: [
    'A couple of decent dishes, but most of it was bland and overpriced.',
    'Service was slow and the mains arrived lukewarm.',
  ],
  3: [
    'Perfectly fine. Nothing wrong, nothing memorable.',
    'Good starters, average mains. Worth it if you are nearby.',
  ],
  4: [
    'Really enjoyed it. Friendly staff and generous portions.',
    'Lovely food; a little noisy on a Friday, but we would go again.',
  ],
  5: [
    'Outstanding. Every dish was a highlight.',
    'One of the best meals I have had this year. Book ahead.',
  ],
};

/**
 * `count` whole-star ratings whose average is as close to `average` as whole stars allow: each is
 * the average rounded down, and just enough of them one star higher to make up the difference.
 */
function ratingsFor(average: number, count: number): number[] {
  const low = Math.floor(average);
  const higher = Math.round((average - low) * count);
  return Array.from({ length: count }, (_, i) => Math.min(5, i < higher ? low + 1 : low));
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Two colours per cuisine for the placeholder images, so cards are easy to tell apart.
const PALETTE: Record<Cuisine, [[number, number, number], [number, number, number]]> = {
  italian: [
    [200, 60, 50],
    [250, 190, 90],
  ],
  french: [
    [40, 70, 160],
    [200, 170, 220],
  ],
  chinese: [
    [170, 30, 30],
    [240, 180, 40],
  ],
  japanese: [
    [30, 30, 40],
    [220, 80, 90],
  ],
  indian: [
    [230, 120, 20],
    [120, 40, 110],
  ],
  mexican: [
    [30, 130, 70],
    [240, 200, 60],
  ],
  greek: [
    [20, 90, 170],
    [230, 240, 250],
  ],
};

interface SeedRestaurant {
  owner: 0 | 1;
  title: string;
  cuisine: Cuisine;
  location: string;
  description: string;
  /** The average and number of reviews to generate. null leaves the restaurant unreviewed. */
  rating: { avg: number; count: number } | null;
}

const RESTAURANTS: SeedRestaurant[] = [
  {
    owner: 0,
    title: 'Thyme Traveler',
    cuisine: 'italian',
    location: '7 Wishing Well Way, Hidden Valley',
    description: 'A culinary adventure through time, from ancient Rome to the trattorias of today.',
    rating: { avg: 4.6, count: 9 },
  },
  {
    owner: 0,
    title: 'Pasta la Vista',
    cuisine: 'italian',
    location: '12 Linguine Lane, Riverside',
    description: 'Fresh pasta rolled every morning and sauces that simmer all day.',
    rating: { avg: 3.8, count: 5 },
  },
  {
    owner: 0,
    title: 'Le Petit Bistro',
    cuisine: 'french',
    location: '3 Rue des Lilas, Old Town',
    description: 'A small room with a short menu: steak frites, onion soup and tarte tatin.',
    rating: { avg: 4.9, count: 9 },
  },
  {
    owner: 1,
    title: 'Crêpe Expectations',
    cuisine: 'french',
    location: '45 Market Square, Harbourside',
    description: 'Sweet and savoury crêpes made to order at the counter.',
    rating: { avg: 2.7, count: 4 },
  },
  {
    owner: 1,
    title: 'Golden Dragon',
    cuisine: 'chinese',
    location: '88 Lantern Street, Chinatown',
    description: 'Cantonese dim sum at lunch, Sichuan classics at dinner.',
    rating: { avg: 4.2, count: 9 },
  },
  {
    owner: 0,
    title: 'Wok This Way',
    cuisine: 'chinese',
    location: '19 Station Road, Northside',
    description: 'Fast, fiery stir-fries cooked over the highest flame in town.',
    rating: { avg: 3.1, count: 6 },
  },
  {
    owner: 1,
    title: 'Sakura Sushi Bar',
    cuisine: 'japanese',
    location: '5 Blossom Avenue, Eastgate',
    description: 'An omakase counter for ten, with fish delivered every morning.',
    rating: { avg: 4.8, count: 8 },
  },
  {
    owner: 1,
    title: 'Ramen Republic',
    cuisine: 'japanese',
    location: '61 Noodle Row, Uptown',
    description: 'Rich tonkotsu broth cooked for eighteen hours, and a lighter shio for summer.',
    rating: null,
  },
  {
    owner: 0,
    title: 'Spice Route',
    cuisine: 'indian',
    location: '27 Cardamom Court, Westfield',
    description: 'Regional dishes from Kerala to Punjab, with a tandoor at the centre of the room.',
    rating: { avg: 4.4, count: 7 },
  },
  {
    owner: 1,
    title: 'Curry Leaf',
    cuisine: 'indian',
    location: '9 Peppercorn Place, Southbank',
    description: 'South Indian dosas and thalis, vegetarian throughout.',
    rating: { avg: 1.9, count: 3 },
  },
  {
    owner: 0,
    title: 'Taco Libre',
    cuisine: 'mexican',
    location: '33 Fiesta Boulevard, Midtown',
    description: 'Hand-pressed tortillas, slow-cooked al pastor and a long mezcal list.',
    rating: { avg: 4.0, count: 8 },
  },
  {
    owner: 1,
    title: 'Casa Verde',
    cuisine: 'mexican',
    location: '14 Cactus Close, Hillside',
    description: 'Garden seating, mole from a family recipe and churros to finish.',
    rating: null,
  },
  {
    owner: 0,
    title: 'The Olive Grove',
    cuisine: 'greek',
    location: '2 Aegean Terrace, Seafront',
    description: 'Grilled fish, slow-roasted lamb and a terrace that catches the sunset.',
    rating: { avg: 3.5, count: 5 },
  },
  {
    owner: 1,
    title: 'Souvlaki Street',
    cuisine: 'greek',
    location: '70 Agora Lane, Old Town',
    description: 'Gyros and souvlaki wrapped to go, late into the night.',
    rating: { avg: 2.3, count: 6 },
  },
  {
    owner: 0,
    title: 'Mamma Mia Trattoria',
    cuisine: 'italian',
    location: '50 Vineyard Road, Countryside',
    description: 'Wood-fired pizza and a wine list from small Italian producers.',
    rating: null,
  },
];

/**
 * Each seeded restaurant with the slug the create form would suggest for it. Worked out and
 * checked before anything is written: two titles that differ only in accents or punctuation
 * ("Café Olé" and "Cafe Ole") get the same slug, and the unique index would then stop the seed
 * halfway, after the existing data was cleared and some images uploaded.
 */
function withSlugs(restaurants: readonly SeedRestaurant[]) {
  const seeded = restaurants.map((restaurant) => ({
    ...restaurant,
    slug: slugify(restaurant.title),
  }));
  const titlesBySlug = new Map<string, string[]>();
  for (const { slug, title } of seeded) {
    titlesBySlug.set(slug, [...(titlesBySlug.get(slug) ?? []), `"${title}"`]);
  }
  const problems = [...titlesBySlug].flatMap(([slug, titles]) => {
    if (!slug) return [`${titles.join(', ')}: nothing in the title can be used in a URL`];
    return titles.length > 1 ? [`${titles.join(', ')}: all become "${slug}"`] : [];
  });
  if (problems.length > 0) {
    throw new Error(`Seed restaurants need distinct slugs:\n  ${problems.join('\n  ')}`);
  }
  return seeded;
}

async function main() {
  const env = loadEnv();
  if (env.NODE_ENV === 'production') throw new Error('Refusing to seed a production database.');
  const reset = process.argv.includes('--reset');
  const restaurants = withSlugs(RESTAURANTS);

  const database = new MongoDatabase(env.MONGODB_URI);
  await database.connect();
  try {
    const existing = await UserModel.countDocuments();
    if (existing > 0 && !reset) {
      console.log(
        `The database already has ${existing} accounts. Run with --reset to replace them.`,
      );
      return;
    }
    if (reset) {
      await Promise.all([
        UserModel.deleteMany({}),
        RestaurantModel.deleteMany({}),
        ReviewModel.deleteMany({}),
        SessionModel.deleteMany({}),
        EmailOtpModel.deleteMany({}),
      ]);
    }

    const passwordHash = await new BcryptPasswordHasher(env.BCRYPT_ROUNDS).hash(SEED_PASSWORD);
    const users = await UserModel.insertMany(
      [...ACCOUNTS, ...COMMUNITY].map((account) => ({ ...account, passwordHash })),
    );
    const owners = users.filter((user) => user.role === 'owner');
    const community = users.filter((user) => user.email.startsWith('diner'));
    const rita = users.find((user) => user.email === 'reviewer1@example.com')!;
    // The real recalculation, so seeded averages follow exactly the rules reviews do.
    const ratings = new RestaurantRatings(
      new MongooseRestaurantRepository(),
      new MongooseReviewRepository(),
    );
    let reviewCount = 0;

    const storage = s3ConfigFromEnv(env);
    const s3 = createS3Client(storage);
    for (const restaurant of restaurants) {
      const { slug } = restaurant;
      const imageKey = `restaurants/seed-${slug}.png`;
      const [from, to] = PALETTE[restaurant.cuisine]!;
      await s3.send(
        new PutObjectCommand({
          Bucket: storage.bucket,
          Key: imageKey,
          Body: gradientPng(640, 400, from, to),
          ContentType: 'image/png',
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      const created = await RestaurantModel.create({
        owner: owners[restaurant.owner]!._id,
        slug,
        title: restaurant.title,
        cuisine: restaurant.cuisine,
        location: restaurant.location,
        description: restaurant.description,
        imageKey,
      });

      const authors = restaurant.rating ? community.slice(0, restaurant.rating.count) : [];
      const scores = restaurant.rating ? ratingsFor(restaurant.rating.avg, authors.length) : [];
      if (restaurant.title === 'Le Petit Bistro') {
        authors.push(rita);
        scores.push(5);
      }
      // Written to the collection directly so each review can be dated in the past.
      const now = Date.now();
      const docs = authors.map((author, i) => {
        const rating = scores[i]!;
        const options = COMMENTS[rating]!;
        const createdAt = new Date(now - (i * 9 + 2) * DAY_MS);
        return {
          restaurant: created._id,
          author: author._id,
          authorName: author.name,
          rating,
          comment: options[(i + reviewCount) % options.length]!,
          createdAt,
          updatedAt: createdAt,
        };
      });
      if (docs.length > 0) await ReviewModel.collection.insertMany(docs);
      reviewCount += docs.length;
      await ratings.recalculate(created.id);
    }
    s3.destroy();

    console.log(
      `Seeded ${users.length} accounts, ${RESTAURANTS.length} restaurants and ${reviewCount} reviews.`,
    );
    console.log(`Every account's password is ${SEED_PASSWORD}:`);
    for (const account of ACCOUNTS) console.log(`  ${account.role.padEnd(8)} ${account.email}`);
    console.log(
      `  reviewer diner1@example.com to diner${COMMUNITY.length}@example.com (wrote the reviews)`,
    );
  } finally {
    await database.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
