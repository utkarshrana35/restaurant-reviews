'use client';

import { usePathname } from 'next/navigation';
import { Alert, LinkButton, Skeleton, Stack, StatusAlert } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useGetMyReviewQuery } from '@/store/apiSlice';
import MyReview from './MyReview';
import ReviewForm from './ReviewForm';

interface ReviewComposerProps {
  restaurantId: string;
  /** Called after the reader writes or deletes their review. */
  onChanged: () => void;
}

/**
 * What the reader can do about reviewing this restaurant, depending on who they are: a guest is
 * asked to sign in; a reviewer sees their own review, or the form if they have not written one;
 * an owner sees nothing, since owners cannot review.
 */
export default function ReviewComposer({ restaurantId, onChanged }: ReviewComposerProps) {
  const pathname = usePathname();
  const { user, isKnown } = useAuth();
  const isReviewer = user?.role === 'reviewer';
  const mine = useGetMyReviewQuery(restaurantId, { skip: !isReviewer });

  // Without an answer about the session, the reader may be a signed-in reviewer: inviting them
  // to sign in would be wrong, so nothing is shown.
  if (!isKnown) return null;

  if (!user) {
    // Back to this restaurant's page after signing in.
    const next = encodeURIComponent(pathname);
    return (
      <Alert
        severity="info"
        action={
          <Stack direction="row" spacing={1}>
            <LinkButton href={`/login?next=${next}`} size="small">
              Sign in
            </LinkButton>
            <LinkButton href="/register" size="small">
              Register
            </LinkButton>
          </Stack>
        }
      >
        Sign in as a reviewer to share your experience.
      </Alert>
    );
  }

  if (!isReviewer) return null;

  if (mine.isLoading) return <Skeleton variant="rounded" height={160} />;
  if (mine.isError || !mine.data) {
    return (
      <StatusAlert severity="error" onRetry={() => mine.refetch()} retrying={mine.isFetching}>
        Your review could not be loaded.
      </StatusAlert>
    );
  }

  return mine.data.review ? (
    <MyReview review={mine.data.review} onDeleted={onChanged} />
  ) : (
    <ReviewForm restaurantId={restaurantId} onSaved={onChanged} />
  );
}
