import type { Role } from '@restaurant-reviews/common';

/** An account. Plain data: a user has no behaviour of its own yet, so it needs no class. */
export interface User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  readonly passwordHash: string;
  readonly createdAt: Date;
}
