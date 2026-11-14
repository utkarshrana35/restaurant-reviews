'use client';

import {
  CUISINE_LABELS,
  CUISINES,
  RATING_MAX,
  RATING_MIN,
  type Cuisine,
  type SortOrder,
} from '@restaurant-reviews/common';
import { Box, Button, SelectField, Stack, ToggleButton, ToggleButtonGroup } from '@/components/ui';
import { DEFAULT_PREFERENCES, isDefaultPreferences, type ListPreferences } from '@/lib/listQuery';

const ANY = 'any';

const CUISINE_OPTIONS = [
  { value: ANY, label: 'Any cuisine' },
  ...CUISINES.map((cuisine) => ({ value: cuisine, label: CUISINE_LABELS[cuisine] })),
] as const;

const STARS = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => String(RATING_MIN + i));

const starLabel = (stars: string) => `${stars} ${stars === '1' ? 'star' : 'stars'}`;
const MIN_OPTIONS = [
  { value: ANY, label: 'Any' },
  ...STARS.map((stars) => ({ value: stars, label: `${starLabel(stars)} or more` })),
];
const MAX_OPTIONS = [
  { value: ANY, label: 'Any' },
  ...STARS.map((stars) => ({ value: stars, label: `${starLabel(stars)} or fewer` })),
];

const toOption = (rating: number | undefined) => (rating === undefined ? ANY : String(rating));
const fromOption = (value: string) => (value === ANY ? undefined : Number(value));

interface RestaurantFiltersProps {
  value: ListPreferences;
  onChange: (preferences: ListPreferences) => void;
}

/**
 * Cuisine and average-rating filters, and the sort order. Choosing a bound that contradicts the
 * other one clears the other one, so the combination is always valid.
 */
export default function RestaurantFilters({ value, onChange }: RestaurantFiltersProps) {
  const setMin = (option: string) => {
    const minRating = fromOption(option);
    const clash =
      minRating !== undefined && value.maxRating !== undefined && minRating > value.maxRating;
    onChange({ ...value, minRating, maxRating: clash ? undefined : value.maxRating });
  };

  const setMax = (option: string) => {
    const maxRating = fromOption(option);
    const clash =
      maxRating !== undefined && value.minRating !== undefined && maxRating < value.minRating;
    onChange({ ...value, maxRating, minRating: clash ? undefined : value.minRating });
  };

  return (
    <Stack role="search" aria-label="Filter restaurants" spacing={2}>
      <Box
        sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}
      >
        <SelectField
          label="Cuisine"
          value={value.cuisine ?? ANY}
          options={CUISINE_OPTIONS}
          onChange={(option) =>
            onChange({ ...value, cuisine: option === ANY ? undefined : (option as Cuisine) })
          }
        />
        <SelectField
          label="Minimum rating"
          value={toOption(value.minRating)}
          options={MIN_OPTIONS}
          onChange={setMin}
        />
        <SelectField
          label="Maximum rating"
          value={toOption(value.maxRating)}
          options={MAX_OPTIONS}
          onChange={setMax}
        />
      </Box>
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: 'center', justifyContent: 'space-between' }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          color="primary"
          aria-label="Sort by rating"
          value={value.sort}
          // Clicking the selected button reports null; the order stays as it is.
          onChange={(_event, sort: SortOrder | null) => sort && onChange({ ...value, sort })}
        >
          <ToggleButton value="rating_desc">Best first</ToggleButton>
          <ToggleButton value="rating_asc">Worst first</ToggleButton>
        </ToggleButtonGroup>
        <Button
          disabled={isDefaultPreferences(value)}
          onClick={() => onChange(DEFAULT_PREFERENCES)}
        >
          Reset
        </Button>
      </Stack>
    </Stack>
  );
}
