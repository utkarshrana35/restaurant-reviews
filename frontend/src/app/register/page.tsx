import type { Metadata } from 'next';
import GuestOnly from '@/components/auth/GuestOnly';
import RegisterForm from '@/components/auth/RegisterForm';
import { FormCard, TextLink } from '@/components/ui';

export const metadata: Metadata = { title: 'Create an account' };

export default function RegisterPage() {
  return (
    <GuestOnly redirectTo="/">
      <FormCard
        title="Create an account"
        footer={
          <>
            Already have an account? <TextLink href="/login">Sign in</TextLink>
          </>
        }
      >
        <RegisterForm />
      </FormCard>
    </GuestOnly>
  );
}
