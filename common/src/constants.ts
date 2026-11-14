/** The two kinds of account. Chosen at registration and never changed. */
export const ROLES = ['reviewer', 'owner'] as const;
export type Role = (typeof ROLES)[number];

/** Cuisines a restaurant can be listed under. */
export const CUISINES = [
  'italian',
  'french',
  'chinese',
  'japanese',
  'indian',
  'mexican',
  'greek',
] as const;
export type Cuisine = (typeof CUISINES)[number];

/** How each cuisine is shown to users. */
export const CUISINE_LABELS: Record<Cuisine, string> = {
  italian: 'Italian',
  french: 'French',
  chinese: 'Chinese',
  japanese: 'Japanese',
  indian: 'Indian',
  mexican: 'Mexican',
  greek: 'Greek',
};

/** The range of a review rating, in whole stars. */
export const RATING_MIN = 1;
export const RATING_MAX = 5;

/** How the public restaurant list can be ordered. */
export const SORT_ORDERS = ['rating_desc', 'rating_asc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];
/** Best rated first by default. */
export const DEFAULT_SORT_ORDER: SortOrder = 'rating_desc';

/** Length limits for restaurant text fields, in characters. */
export const RESTAURANT_TITLE_MAX_LENGTH = 100;
export const RESTAURANT_LOCATION_MAX_LENGTH = 200;
export const RESTAURANT_DESCRIPTION_MAX_LENGTH = 2000;
/** Longest restaurant slug: the part of its public URL after `/restaurants/`. */
export const RESTAURANT_SLUG_MAX_LENGTH = 60;

/** Longest review comment, in characters. */
export const REVIEW_COMMENT_MAX_LENGTH = 1000;

/** Image formats accepted for a restaurant's preview image, mapped to their file extension. */
export const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;
export type ImageContentType = keyof typeof IMAGE_EXTENSIONS;
/** The accepted image types, as a list for validation. */
export const IMAGE_CONTENT_TYPES = Object.keys(IMAGE_EXTENSIONS) as [
  ImageContentType,
  ...ImageContentType[],
];
/** Largest accepted preview image: 5 MB. */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Limits for account fields. */
export const NAME_MAX_LENGTH = 80;
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt ignores everything after 72 bytes, so longer passwords are rejected, not truncated. */
export const PASSWORD_MAX_BYTES = 72;

/** Rules for emailed verification codes. */
export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
