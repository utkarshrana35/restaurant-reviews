import { z } from 'zod';
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  OTP_LENGTH,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  ROLES,
} from '../constants';

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    bytes += codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** Trimmed and lower-cased, so the same address always maps to the same account. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .max(EMAIL_MAX_LENGTH, 'Email is too long')
  .pipe(z.email('Enter a valid email address'));

/** Rules for a password being set; existing passwords are not re-checked against them. */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number')
  .refine((value) => utf8ByteLength(value) <= PASSWORD_MAX_BYTES, 'Password is too long');

/** An emailed verification code: exactly the expected number of digits. */
export const otpCodeSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Enter the ${OTP_LENGTH}-digit code`);

/** Body of `POST /api/auth/request-otp`. */
export const requestOtpSchema = z.object({
  email: emailSchema,
});

/** Everything on the registration form except the emailed code. */
export const registerDetailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(NAME_MAX_LENGTH, `Name must be at most ${NAME_MAX_LENGTH} characters`),
  email: emailSchema,
  password: newPasswordSchema,
  role: z.enum(ROLES, 'Choose an account type'),
});

/** Body of `POST /api/auth/register`: the account details plus the emailed code. */
export const registerSchema = registerDetailsSchema.extend({
  otp: otpCodeSchema,
});

/** Body of `POST /api/auth/login`. */
export const loginSchema = z.object({
  email: emailSchema,
  // Only presence is checked: the password rules may have changed since the account was created.
  password: z.string().min(1, 'Password is required').max(1024),
});

/** Body of `POST /api/auth/password-reset/request`. */
export const requestPasswordResetSchema = z.object({
  email: emailSchema,
});

/** Body of `POST /api/auth/password-reset/confirm`: the emailed code and the new password. */
export const resetPasswordSchema = z.object({
  email: emailSchema,
  otp: otpCodeSchema,
  password: newPasswordSchema,
});

/**
 * Body of `POST /api/auth/refresh`. A browser sends none: its refresh token is in a cookie. A
 * mobile client sends the token here instead.
 */
export const refreshSchema = z.object({
  // Issued tokens are 43 characters; the cap only keeps junk away from the hash lookup.
  refreshToken: z.string().min(1).max(256).optional(),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type RegisterDetailsInput = z.infer<typeof registerDetailsSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
