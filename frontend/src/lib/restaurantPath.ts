/** The public page of the restaurant with this slug. */
export function restaurantPath(slug: string): string {
  return `/restaurants/${encodeURIComponent(slug)}`;
}
