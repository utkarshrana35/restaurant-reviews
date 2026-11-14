import RestaurantBrowser from '@/components/restaurants/RestaurantBrowser';
import { PageHeader } from '@/components/ui';
import { parseListFilters } from '@/lib/listQuery';
import { fetchRestaurants } from '@/lib/serverApi';

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The public restaurant list. The first page is rendered on the server from the URL's filters,
 * so the response already contains the restaurants; later changes are fetched in the browser.
 */
export default async function HomePage({ searchParams }: HomePageProps) {
  const filters = parseListFilters(await searchParams);
  const results = await fetchRestaurants(filters);

  return (
    <>
      <PageHeader title="Restaurants" />
      <RestaurantBrowser initialFilters={filters} initialResults={results} />
    </>
  );
}
