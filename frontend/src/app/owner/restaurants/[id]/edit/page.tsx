import type { Metadata } from 'next';
import EditRestaurant from '@/components/restaurants/EditRestaurant';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Edit restaurant' };

interface EditPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPage({ params }: EditPageProps) {
  const { id } = await params;

  return (
    <>
      <PageHeader title="Edit restaurant" />
      <EditRestaurant id={id} />
    </>
  );
}
