import type { Cuisine, Role } from '@restaurant-reviews/common';
import type { Types } from 'mongoose';
import { describe, expectTypeOf, it } from 'vitest';
import type { OtpPurpose } from '../../../../../../src/domain/entities/EmailOtp';
import type { EmailOtpRecord } from '../../../../../../src/infrastructure/adapters/outbound/mongoose/models/EmailOtpModel';
import type { RestaurantRecord } from '../../../../../../src/infrastructure/adapters/outbound/mongoose/models/RestaurantModel';
import type { ReviewRecord } from '../../../../../../src/infrastructure/adapters/outbound/mongoose/models/ReviewModel';
import type { SessionRecord } from '../../../../../../src/infrastructure/adapters/outbound/mongoose/models/SessionModel';
import type { UserRecord } from '../../../../../../src/infrastructure/adapters/outbound/mongoose/models/UserModel';

/** One object type. Mongoose adds the timestamps as an intersection, which compares unequal. */
type Flat<T> = { [K in keyof T]: T[K] };

// The record types are inferred from the schemas. These checks, enforced by `pnpm typecheck`,
// make sure the inference produces precise types: a field that silently became `any` would let
// the mappers compile against anything and hide drift between the schema and the entities.
describe('records inferred from the Mongoose schemas', () => {
  it('User', () => {
    expectTypeOf<Flat<UserRecord>>().toEqualTypeOf<{
      name: string;
      email: string;
      role: Role;
      passwordHash: string;
      createdAt: NativeDate;
      updatedAt: NativeDate;
    }>();
  });

  it('Session', () => {
    expectTypeOf<Flat<SessionRecord>>().toEqualTypeOf<{
      user: Types.ObjectId;
      tokenHash: string;
      expiresAt: NativeDate;
      createdAt: NativeDate;
      updatedAt: NativeDate;
    }>();
  });

  it('Restaurant', () => {
    expectTypeOf<Flat<RestaurantRecord>>().toEqualTypeOf<{
      owner: Types.ObjectId;
      slug: string;
      title: string;
      location: string;
      description: string;
      cuisine: Cuisine;
      imageKey: string;
      // Not required, so possibly missing on a stored document; the mapper reads that as null.
      ratingAvg?: number | null | undefined;
      ratingCount: number;
      rated: boolean;
      ratingRevision: number;
      createdAt: NativeDate;
      updatedAt: NativeDate;
    }>();
  });

  it('Review', () => {
    expectTypeOf<Flat<ReviewRecord>>().toEqualTypeOf<{
      restaurant: Types.ObjectId;
      author: Types.ObjectId;
      authorName: string;
      rating: number;
      comment: string;
      createdAt: NativeDate;
      updatedAt: NativeDate;
    }>();
  });

  it('EmailOtp', () => {
    expectTypeOf<EmailOtpRecord>().toEqualTypeOf<{
      email: string;
      purpose: OtpPurpose;
      codeHash: string;
      expiresAt: NativeDate;
      attempts: number;
      lastSentAt: NativeDate;
    }>();
  });
});
