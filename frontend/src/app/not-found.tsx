import { LinkButton, Stack, Typography } from '@/components/ui';

export default function NotFound() {
  return (
    <Stack spacing={2} sx={{ alignItems: 'flex-start', py: 8 }}>
      <Typography variant="h4" component="h1">
        Page not found
      </Typography>
      <Typography color="text.secondary">
        The page you are looking for does not exist or has been removed.
      </Typography>
      <LinkButton href="/" variant="contained">
        Back to restaurants
      </LinkButton>
    </Stack>
  );
}
