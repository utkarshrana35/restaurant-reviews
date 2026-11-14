import type { ReviewCreateInput, Role } from '@restaurant-reviews/common';
import { RestaurantRatings } from '../../src/application/services/RestaurantRatings';
import { CreateReviewUseCase } from '../../src/application/use-cases/reviews/CreateReviewUseCase';
import { DeleteReviewUseCase } from '../../src/application/use-cases/reviews/DeleteReviewUseCase';
import { GetMyReviewUseCase } from '../../src/application/use-cases/reviews/GetMyReviewUseCase';
import { ListMyReviewsUseCase } from '../../src/application/use-cases/reviews/ListMyReviewsUseCase';
import { ListReviewsUseCase } from '../../src/application/use-cases/reviews/ListReviewsUseCase';
import { InMemoryUserRepository } from './fakes';
import { createRestaurantFixture, OWNER_A } from './restaurantFixture';

/**
 * The review use cases wired to in-memory fakes, on top of the restaurant fixture, with one
 * restaurant to review and accounts to review it with.
 */
export async function createReviewFixture() {
  const f = createRestaurantFixture();
  const users = new InMemoryUserRepository();
  const ratings = new RestaurantRatings(f.restaurants, f.reviews);

  const account = (name: string, role: Role) =>
    users.create({ name, email: `${name.toLowerCase()}@example.com`, role, passwordHash: 'x' });
  const [rita, ravi, owner] = await Promise.all([
    account('Rita', 'reviewer'),
    account('Ravi', 'reviewer'),
    account('Olivia', 'owner'),
  ]);

  const restaurant = await f.createFor(OWNER_A);

  const createReview = new CreateReviewUseCase(f.restaurants, users, f.reviews, ratings);
  const deleteReview = new DeleteReviewUseCase(f.reviews, ratings);
  const listReviews = new ListReviewsUseCase(f.restaurants, f.reviews);
  const getMyReview = new GetMyReviewUseCase(f.restaurants, f.reviews);
  const listMyReviews = new ListMyReviewsUseCase(f.reviews, f.restaurants);

  /** Writes a review of the fixture's restaurant (or another one) as `authorId`. */
  const review = (
    authorId: string,
    input: Partial<ReviewCreateInput> = {},
    restaurantId = restaurant.id,
  ) =>
    createReview.execute({
      restaurantId,
      authorId,
      review: { rating: 4, comment: 'Lovely evening.', ...input },
    });

  /** The fixture's restaurant as currently stored. */
  const current = async () => (await f.restaurants.findOne({ id: restaurant.id }))!;

  return {
    ...f,
    users,
    ratings,
    rita,
    ravi,
    owner,
    restaurant,
    createReview,
    deleteReview,
    listReviews,
    getMyReview,
    listMyReviews,
    review,
    current,
  };
}

export type ReviewFixture = Awaited<ReturnType<typeof createReviewFixture>>;
