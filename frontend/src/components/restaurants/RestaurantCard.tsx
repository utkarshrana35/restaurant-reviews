import { CUISINE_LABELS, type RestaurantDto } from '@restaurant-reviews/common';
import { Card, CardContent, CardLink, Chip, Stack, Typography } from '@/components/ui';
import { restaurantPath } from '@/lib/restaurantPath';
import RatingSummary from './RatingSummary';
import RestaurantImage from './RestaurantImage';

/** One restaurant in the public list. The whole card links to its detail page. */
export default function RestaurantCard({ restaurant }: { restaurant: RestaurantDto }) {
  return (
    <Card sx={{ display: 'flex', flexDirection: 'column' }}>
      <CardLink href={restaurantPath(restaurant.slug)}>
        <RestaurantImage src={restaurant.imageUrl} height={180} />
        <CardContent sx={{ flexGrow: 1, width: '100%' }}>
          <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
            {/* Rendered as text: a title containing markup is shown, never executed. */}
            <Typography variant="h6" component="h2" sx={{ overflowWrap: 'anywhere' }}>
              {restaurant.title}
            </Typography>
            <RatingSummary ratingAvg={restaurant.ratingAvg} ratingCount={restaurant.ratingCount} />
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {restaurant.location}
            </Typography>
            <Chip size="small" label={CUISINE_LABELS[restaurant.cuisine]} />
          </Stack>
        </CardContent>
      </CardLink>
    </Card>
  );
}
