import {
  restaurantSlugSchema,
  type Paginated,
  type PresignedUploadDto,
  type PresignUploadInput,
  type RestaurantCreateInput,
  type RestaurantDto,
  type RestaurantListQuery,
  type RestaurantUpdateInput,
} from '@restaurant-reviews/common';
import type { Request, Response } from 'express';
import type { AccessTokenClaims } from '../../../../../application/ports/security';
import type { CreateImageUploadUseCase } from '../../../../../application/use-cases/restaurants/CreateImageUploadUseCase';
import type { CreateRestaurantUseCase } from '../../../../../application/use-cases/restaurants/CreateRestaurantUseCase';
import type { DeleteRestaurantUseCase } from '../../../../../application/use-cases/restaurants/DeleteRestaurantUseCase';
import type { GetRestaurantUseCase } from '../../../../../application/use-cases/restaurants/GetRestaurantUseCase';
import type { ListMyRestaurantsUseCase } from '../../../../../application/use-cases/restaurants/ListMyRestaurantsUseCase';
import type { ListRestaurantsUseCase } from '../../../../../application/use-cases/restaurants/ListRestaurantsUseCase';
import type { UpdateRestaurantUseCase } from '../../../../../application/use-cases/restaurants/UpdateRestaurantUseCase';
import type { Restaurant } from '../../../../../domain/entities/Restaurant';
import { NotFoundError, UnauthenticatedError } from '../../../../../domain/errors';
import { toRestaurantDto } from '../presenters/toRestaurantDto';

type Body<T> = Request<{ id: string }, unknown, T>;
type WithId = Request<{ id: string }>;

/** The use cases the restaurant and upload endpoints call. */
export interface RestaurantUseCases {
  createImageUpload: CreateImageUploadUseCase;
  createRestaurant: CreateRestaurantUseCase;
  updateRestaurant: UpdateRestaurantUseCase;
  deleteRestaurant: DeleteRestaurantUseCase;
  listMyRestaurants: ListMyRestaurantsUseCase;
  getRestaurant: GetRestaurantUseCase;
  listRestaurants: ListRestaurantsUseCase;
}

/** Handles the `/api/restaurants` and `/api/uploads` endpoints. */
export class RestaurantController {
  constructor(
    private readonly useCases: RestaurantUseCases,
    private readonly imageUrlFor: (imageKey: string) => string,
  ) {}

  readonly presignImageUpload = async (
    req: Body<PresignUploadInput>,
    res: Response,
  ): Promise<void> => {
    const { userId } = this.caller(req);
    const upload = await this.useCases.createImageUpload.execute({ ...req.body, ownerId: userId });
    res.status(201).json(upload satisfies PresignedUploadDto);
  };

  readonly listMine = async (req: Request, res: Response): Promise<void> => {
    const { userId } = this.caller(req);
    const restaurants = await this.useCases.listMyRestaurants.execute({ ownerId: userId });
    res.json(restaurants.map((restaurant) => this.present(restaurant)));
  };

  /** The public listing. The query has been validated by the route. */
  readonly list = async (req: Request, res: Response): Promise<void> => {
    const query = req.validatedQuery as RestaurantListQuery;
    const page = await this.useCases.listRestaurants.execute(query);
    res.json({
      ...page,
      items: page.items.map((restaurant) => this.present(restaurant)),
    } satisfies Paginated<RestaurantDto>);
  };

  readonly show = async (req: WithId, res: Response): Promise<void> => {
    res.json(this.present(await this.useCases.getRestaurant.execute({ id: req.params.id })));
  };

  /**
   * Slugs are case-insensitive and stored in lowercase, so the slug is parsed the way a new one
   * is: `Le-Petit-Bistro` finds `le-petit-bistro`. Anything that could never be a slug names no
   * restaurant, and is answered without a database query.
   */
  readonly showBySlug = async (req: Request<{ slug: string }>, res: Response): Promise<void> => {
    const slug = restaurantSlugSchema.safeParse(req.params.slug);
    if (!slug.success) throw new NotFoundError('Restaurant not found');
    const restaurant = await this.useCases.getRestaurant.execute({ slug: slug.data });
    res.json(this.present(restaurant));
  };

  readonly create = async (req: Body<RestaurantCreateInput>, res: Response): Promise<void> => {
    // The owner is the caller. A body cannot name someone else: the schema has no owner field.
    const { userId } = this.caller(req);
    const restaurant = await this.useCases.createRestaurant.execute({
      ownerId: userId,
      details: req.body,
    });
    res.status(201).json(this.present(restaurant));
  };

  readonly update = async (req: Body<RestaurantUpdateInput>, res: Response): Promise<void> => {
    const { userId } = this.caller(req);
    const restaurant = await this.useCases.updateRestaurant.execute({
      id: req.params.id,
      ownerId: userId,
      changes: req.body,
    });
    res.json(this.present(restaurant));
  };

  readonly remove = async (req: WithId, res: Response): Promise<void> => {
    const { userId } = this.caller(req);
    await this.useCases.deleteRestaurant.execute({ id: req.params.id, ownerId: userId });
    res.status(204).end();
  };

  /** The authenticated caller. Routes that reach this always run `requireUser` first. */
  private caller(req: Request): AccessTokenClaims {
    if (!req.auth) throw new UnauthenticatedError('Sign in to continue');
    return req.auth;
  }

  private present(restaurant: Restaurant): RestaurantDto {
    return toRestaurantDto(restaurant, this.imageUrlFor);
  }
}
