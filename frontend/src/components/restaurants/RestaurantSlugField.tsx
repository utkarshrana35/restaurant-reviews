'use client';

import { RESTAURANT_SLUG_MAX_LENGTH, type RestaurantCreateInput } from '@restaurant-reviews/common';
import { useWatch, type Control } from 'react-hook-form';
import { FormTextField } from '@/components/forms';
import { TextField } from '@/components/ui';
import { restaurantPath } from '@/lib/restaurantPath';

interface RestaurantSlugFieldProps {
  control: Control<RestaurantCreateInput>;
  /** Set when editing: the slug is then shown, but can no longer be changed. */
  fixedSlug?: string;
  disabled?: boolean;
}

/**
 * The restaurant's page address. When creating, the owner chooses it, with the resulting URL
 * shown underneath as they type. When editing, it is shown read-only: links to the restaurant
 * keep working because it never changes.
 *
 * Watches only the slug, so typing in it re-renders this field and not the whole form.
 */
export default function RestaurantSlugField({
  control,
  fixedSlug,
  disabled,
}: RestaurantSlugFieldProps) {
  // Shown as it will be saved: the slug schema trims and lowercases what the owner types.
  const slug = useWatch({ control, name: 'slug' }).trim().toLowerCase();

  if (fixedSlug !== undefined) {
    return (
      <TextField
        fullWidth
        label="Page address"
        value={restaurantPath(fixedSlug)}
        helperText="Set when the restaurant was created, so links to it keep working."
        slotProps={{ input: { readOnly: true } }}
      />
    );
  }

  return (
    <FormTextField
      control={control}
      name="slug"
      label="Page address"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      slotProps={{ htmlInput: { maxLength: RESTAURANT_SLUG_MAX_LENGTH } }}
      helperText={`Your page will be ${slug ? restaurantPath(slug) : `${restaurantPath('')}…`}. It cannot be changed later.`}
      disabled={disabled}
    />
  );
}
