'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  CUISINE_LABELS,
  CUISINES,
  RESTAURANT_DESCRIPTION_MAX_LENGTH,
  restaurantCreateSchema,
  slugify,
  type RestaurantCreateInput,
  type RestaurantDto,
} from '@restaurant-reviews/common';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormSelectField, FormTextField, ImageUploadField } from '@/components/forms';
import { Alert, Button, LinkButton, Stack } from '@/components/ui';
import { toApiError } from '@/lib/apiError';
import { applyFieldErrors } from '@/lib/formErrors';
import { useCreateRestaurantMutation, useUpdateRestaurantMutation } from '@/store/apiSlice';
import RestaurantSlugField from './RestaurantSlugField';

const OWNER_LIST = '/owner/restaurants';
const FIELDS = ['title', 'slug', 'location', 'description', 'cuisine', 'imageKey'] as const;

const CUISINE_OPTIONS = CUISINES.map((value) => ({ value, label: CUISINE_LABELS[value] }));

// When editing, the restaurant already has an image, so a new upload is optional: an empty
// imageKey means "keep the current one". The slug is fixed once created, so it is shown but
// neither checked nor sent: the API's update schema leaves it out. It stays in the schema as a
// plain string only because create and edit share one form shape; whatever it holds, it can
// never stop a save.
const editSchema = restaurantCreateSchema.extend({ imageKey: z.string(), slug: z.string() });

/**
 * The form for a restaurant's details. With `restaurant` it edits that one; without, it creates
 * a new one. Either way it returns to the owner's list when the save succeeds.
 */
export default function RestaurantForm({ restaurant }: { restaurant?: RestaurantDto }) {
  const router = useRouter();
  const [createRestaurant, creating] = useCreateRestaurantMutation();
  const [updateRestaurant, updating] = useUpdateRestaurantMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const {
    control,
    handleSubmit,
    getFieldState,
    getValues,
    setValue,
    setError,
    subscribe,
    // Typed explicitly because the cuisine starts out unchosen, which the submitted type forbids.
  } = useForm<RestaurantCreateInput>({
    resolver: zodResolver(restaurant ? editSchema : restaurantCreateSchema),
    defaultValues: {
      title: restaurant?.title ?? '',
      // Fixed once created; the edit form shows it but never sends it.
      slug: restaurant?.slug ?? '',
      location: restaurant?.location ?? '',
      description: restaurant?.description ?? '',
      cuisine: restaurant?.cuisine,
      imageKey: '',
    },
  });

  // While creating, the page address follows the title, until the owner types their own: once
  // it differs from the last suggestion, it is theirs and is left alone.
  const suggestedSlug = useRef('');
  useEffect(() => {
    if (restaurant) return;
    return subscribe({
      name: 'title',
      formState: { values: true },
      callback: ({ values }) => {
        if (getValues('slug') !== suggestedSlug.current) return;
        suggestedSlug.current = slugify(values.title);
        // Re-checked only if it is already showing an error, so it is not flagged mid-typing.
        setValue('slug', suggestedSlug.current, {
          shouldValidate: Boolean(getFieldState('slug').error),
        });
      },
    });
  }, [restaurant, subscribe, getValues, getFieldState, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (restaurant) {
        const { imageKey, slug: _fixed, ...details } = values;
        // Only a new upload is sent; without one the API keeps the existing image.
        const changes = imageKey ? { ...details, imageKey } : details;
        await updateRestaurant({ id: restaurant.id, changes }).unwrap();
      } else {
        await createRestaurant(values).unwrap();
      }
      router.push(OWNER_LIST);
    } catch (err) {
      const error = toApiError(err);
      const shownOnFields = applyFieldErrors(error, FIELDS, setError);
      if (shownOnFields.length === 0) setFormError(error.message);
      // A rejected upload cannot be submitted again; the owner has to pick a new file. Clearing
      // the key also takes its preview off the image field, which goes back to the saved image
      // (when editing) that a save without a new upload keeps.
      if (shownOnFields.includes('imageKey')) setValue('imageKey', '');
    }
  });

  const saved = creating.isSuccess || updating.isSuccess;
  const saving = creating.isLoading || updating.isLoading || saved;

  return (
    <Stack component="form" spacing={2.5} noValidate onSubmit={onSubmit} sx={{ maxWidth: 640 }}>
      {formError && <Alert severity="error">{formError}</Alert>}

      <FormTextField
        control={control}
        name="title"
        label="Title"
        autoFocus={!restaurant}
        disabled={saving}
      />
      <RestaurantSlugField control={control} fixedSlug={restaurant?.slug} disabled={saving} />
      <FormTextField
        control={control}
        name="location"
        label="Location"
        autoComplete="street-address"
        disabled={saving}
      />
      <FormSelectField
        control={control}
        name="cuisine"
        label="Cuisine"
        options={CUISINE_OPTIONS}
        disabled={saving}
      />
      <FormTextField
        control={control}
        name="description"
        label="Description"
        multiline
        minRows={5}
        helperText={`Up to ${RESTAURANT_DESCRIPTION_MAX_LENGTH} characters`}
        disabled={saving}
      />

      <ImageUploadField
        control={control}
        name="imageKey"
        label="Preview image"
        currentImageUrl={restaurant?.imageUrl}
        onUploadingChange={setUploading}
        disabled={saving}
      />

      {/* Full-width and stacked on phones, side by side from tablet width up. */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 2 }}>
        {/* Held while an image is uploading: saving now would submit without the new image. */}
        <Button
          type="submit"
          variant="contained"
          size="large"
          loading={saving}
          disabled={uploading}
          sx={{ whiteSpace: 'nowrap' }}
        >
          {restaurant ? 'Save changes' : 'Create restaurant'}
        </Button>
        <LinkButton href={OWNER_LIST} size="large">
          Cancel
        </LinkButton>
      </Stack>
    </Stack>
  );
}
