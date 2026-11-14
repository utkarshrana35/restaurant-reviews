import type { Metadata } from 'next';
import MyRestaurants from '@/components/restaurants/MyRestaurants';
import { LinkButton, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Your restaurants' };

export default function OwnerRestaurantsPage() {
  return (
    <>
      <PageHeader
        title="Your restaurants"
        action={
          <LinkButton href="/owner/restaurants/new" variant="contained">
            Add restaurant
          </LinkButton>
        }
      />
      <MyRestaurants />
    </>
  );
}
