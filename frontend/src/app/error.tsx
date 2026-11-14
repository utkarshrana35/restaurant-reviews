'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button, LinkButton, Stack, Typography } from '@/components/ui';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Shown when a page fails to render, most often because the API could not be reached. */
export default function ErrorPage({ reset }: ErrorPageProps) {
  const router = useRouter();
  const [isRetrying, startTransition] = useTransition();

  // reset() alone only re-renders on the client; refresh() fetches the server's part again.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  return (
    <Stack spacing={2} sx={{ alignItems: 'flex-start', py: 8 }}>
      <Typography variant="h4" component="h1">
        Something went wrong
      </Typography>
      <Typography color="text.secondary">
        This page could not be loaded. Please try again in a moment.
      </Typography>
      <Stack direction="row" spacing={1}>
        <Button variant="contained" loading={isRetrying} onClick={retry}>
          Try again
        </Button>
        <LinkButton href="/">Back to restaurants</LinkButton>
      </Stack>
    </Stack>
  );
}
