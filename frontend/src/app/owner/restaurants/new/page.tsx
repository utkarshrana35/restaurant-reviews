import type { Metadata } from 'next';
import RestaurantForm from '@/components/restaurants/RestaurantForm';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Add a restaurant' };

export default function AddRestaurantPage() {
  return (
    <>
      <PageHeader title="Add a restaurant" />
      <RestaurantForm />
    </>
  );
}
