import type { Metadata } from 'next';
import AccountDetails from '@/components/auth/AccountDetails';
import MyReviewsList from '@/components/reviews/MyReviewsList';
import { Stack, Typography } from '@/components/ui';

export const metadata: Metadata = { title: 'Your account' };

export default function AccountPage() {
  return (
    <Stack spacing={4}>
      <Typography variant="h4" component="h1">
        Your account
      </Typography>
      <AccountDetails />
      {/* Reviewers only; renders nothing for owners. */}
      <MyReviewsList />
    </Stack>
  );
}
