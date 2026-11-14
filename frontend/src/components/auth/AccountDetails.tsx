'use client';

import { Chip, Stack, Typography } from '@/components/ui';
import RequireAuth from './RequireAuth';

const ROLE_LABELS = { reviewer: 'Reviewer', owner: 'Restaurant owner' } as const;

/** The signed-in user's name, email and account type. */
export default function AccountDetails() {
  return (
    <RequireAuth>
      {(user) => (
        <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
          <Typography variant="h5" component="h2">
            {user.name}
          </Typography>
          <Typography color="text.secondary">{user.email}</Typography>
          <Chip label={ROLE_LABELS[user.role]} color="primary" variant="outlined" />
        </Stack>
      )}
    </RequireAuth>
  );
}
