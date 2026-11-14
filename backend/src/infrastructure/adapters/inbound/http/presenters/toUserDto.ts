import type { UserDto } from '@restaurant-reviews/common';
import type { User } from '../../../../../domain/entities/User';

/** The public view of a user. Lists fields explicitly so the password hash can never leak. */
export function toUserDto(user: User): UserDto {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
