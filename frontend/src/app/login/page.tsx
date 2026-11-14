import type { Metadata } from 'next';
import GuestOnly from '@/components/auth/GuestOnly';
import LoginForm from '@/components/auth/LoginForm';
import { FormCard, TextLink } from '@/components/ui';
import { safeRedirect } from '@/lib/safeRedirect';

export const metadata: Metadata = { title: 'Sign in' };

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;

  return (
    <GuestOnly redirectTo={safeRedirect(next)}>
      <FormCard
        title="Sign in"
        footer={
          <>
            New here? <TextLink href="/register">Create an account</TextLink>
          </>
        }
      >
        <LoginForm />
      </FormCard>
    </GuestOnly>
  );
}
