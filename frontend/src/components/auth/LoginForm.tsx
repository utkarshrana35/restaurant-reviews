'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@restaurant-reviews/common';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormTextField } from '@/components/forms';
import { Alert, Button, Stack, TextLink, Typography } from '@/components/ui';
import { toApiError } from '@/lib/apiError';
import { applyFieldErrors } from '@/lib/formErrors';
import { useLoginMutation } from '@/store/apiSlice';

/** Signs the user in. Moving on afterwards is left to the GuestOnly wrapper around the page. */
export default function LoginForm() {
  const [login, { isLoading, isSuccess }] = useLoginMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, setError } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values).unwrap();
    } catch (err) {
      const error = toApiError(err);
      const shownOnFields = applyFieldErrors(error, ['email', 'password'], setError);
      if (shownOnFields.length === 0) setFormError(error.message);
    }
  });

  // Stays disabled after success so the form cannot be resubmitted while the next page loads.
  const busy = isLoading || isSuccess;

  return (
    <Stack component="form" spacing={2.5} noValidate onSubmit={onSubmit}>
      {formError && <Alert severity="error">{formError}</Alert>}

      <FormTextField
        control={control}
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        autoFocus
        disabled={busy}
      />
      <FormTextField
        control={control}
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        disabled={busy}
      />
      <Typography variant="body2" sx={{ alignSelf: 'flex-end' }}>
        <TextLink href="/reset-password">Forgot your password?</TextLink>
      </Typography>

      <Button type="submit" variant="contained" size="large" loading={busy}>
        Sign in
      </Button>
    </Stack>
  );
}
