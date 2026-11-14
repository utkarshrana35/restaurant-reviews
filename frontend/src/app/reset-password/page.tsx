import type { Metadata } from 'next';
import GuestOnly from '@/components/auth/GuestOnly';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';
import { FormCard, TextLink } from '@/components/ui';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ResetPasswordPage() {
  return (
    <GuestOnly redirectTo="/">
      <FormCard
        title="Reset your password"
        footer={
          <>
            Remembered it? <TextLink href="/login">Sign in</TextLink>
          </>
        }
      >
        <ResetPasswordForm />
      </FormCard>
    </GuestOnly>
  );
}
