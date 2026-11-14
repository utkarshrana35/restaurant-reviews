import { RESTAURANT_SLUG_MAX_LENGTH } from './constants';

// Latin letters that are not an ASCII letter with an accent, so removing accents would leave
// nothing of them. Lowercase only: titles are lowercased before these are replaced.
const LETTERS_WITHOUT_ACCENTS: Record<string, string> = {
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  ł: 'l',
  đ: 'd',
  ð: 'd',
  þ: 'th',
  ı: 'i',
};
const LETTER_WITHOUT_ACCENTS = new RegExp(
  `[${Object.keys(LETTERS_WITHOUT_ACCENTS).join('')}]`,
  'g',
);

/**
 * Suggests a slug for a title: lowercase ASCII letters and digits joined by hyphens. Accents
 * are dropped ("Café Olé" becomes "cafe-ole") and letters such as ß and ø are spelled in ASCII
 * ("Straße" becomes "strasse"); anything else that is not a letter or digit separates words. A
 * long title is cut between words. Returns an empty string for a title with nothing usable in a
 * URL (one written in Thai, say), leaving the owner to choose a slug.
 *
 * The result always passes `restaurantSlugSchema` unless it is empty.
 */
export function slugify(title: string): string {
  // Lowercased first: lowercasing can itself add an accent ("İ" becomes "i" plus a dot above),
  // which the accent removal below then takes off.
  const words = title
    .toLowerCase()
    .replace(LETTER_WITHOUT_ACCENTS, (letter) => LETTERS_WITHOUT_ACCENTS[letter] ?? letter)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (words.length <= RESTAURANT_SLUG_MAX_LENGTH) return words;

  const cut = words.slice(0, RESTAURANT_SLUG_MAX_LENGTH + 1);
  const lastBreak = cut.lastIndexOf('-');
  return lastBreak > 0 ? cut.slice(0, lastBreak) : cut.slice(0, RESTAURANT_SLUG_MAX_LENGTH);
}
