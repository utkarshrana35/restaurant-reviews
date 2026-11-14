import { CUISINE_LABELS } from '@restaurant-reviews/common';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import RatingSummary from '@/components/restaurants/RatingSummary';
import RestaurantImage from '@/components/restaurants/RestaurantImage';
import RestaurantReviews from '@/components/reviews/RestaurantReviews';
import { Card, Chip, Divider, LinkButton, Stack, Typography } from '@/components/ui';
import { restaurantPath } from '@/lib/restaurantPath';
import { fetchRestaurantBySlug, fetchReviews } from '@/lib/serverApi';

interface RestaurantPageProps {
  params: Promise<{ slug: string }>;
}

const DESCRIPTION_PREVIEW_LENGTH = 160;

export async function generateMetadata({ params }: RestaurantPageProps): Promise<Metadata> {
  const restaurant = await fetchRestaurantBySlug((await params).slug);
  if (!restaurant) return { title: 'Restaurant not found' };

  const { description } = restaurant;
  return {
    title: restaurant.title,
    description:
      description.length > DESCRIPTION_PREVIEW_LENGTH
        ? `${description.slice(0, DESCRIPTION_PREVIEW_LENGTH - 1)}…`
        : description,
  };
}

/**
 * A restaurant's public page, at `/restaurants/<slug>`. Unknown slugs get the 404 page. Slugs
 * are case-insensitive, so an address with capitals (typed, or shared that way) finds the
 * restaurant and is permanently redirected to its one lowercase address.
 */
export default async function RestaurantPage({ params }: RestaurantPageProps) {
  const { slug } = await params;
  const restaurant = await fetchRestaurantBySlug(slug);
  if (!restaurant) notFound();
  if (restaurant.slug !== slug) permanentRedirect(restaurantPath(restaurant.slug));
  const reviews = await fetchReviews(restaurant.id);

  return (
    <Stack spacing={3}>
      <LinkButton href="/" sx={{ alignSelf: 'flex-start' }}>
        ← All restaurants
      </LinkButton>

      <Card>
        <RestaurantImage
          src={restaurant.imageUrl}
          height={{ xs: 220, md: 380 }}
          alt={restaurant.title}
        />
      </Card>

      <Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
        <Typography variant="h3" component="h1" sx={{ overflowWrap: 'anywhere' }}>
          {restaurant.title}
        </Typography>
        <RatingSummary
          ratingAvg={restaurant.ratingAvg}
          ratingCount={restaurant.ratingCount}
          size="medium"
        />
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <Chip label={CUISINE_LABELS[restaurant.cuisine]} />
          <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {restaurant.location}
          </Typography>
        </Stack>
      </Stack>

      {/* pre-line keeps the owner's paragraph breaks. */}
      <Typography sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere', maxWidth: '75ch' }}>
        {restaurant.description}
      </Typography>

      <Divider />

      <RestaurantReviews restaurantId={restaurant.id} initialReviews={reviews} />
    </Stack>
  );
}
