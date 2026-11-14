'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  emailSchema,
  OTP_LENGTH,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES,
  PASSWORD_MIN_LENGTH,
  registerSchema,
  type Role,
} from '@restaurant-reviews/common';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormRadioField, FormTextField } from '@/components/forms';
import { Alert, Button, Stack, Typography } from '@/components/ui';
import { toApiError } from '@/lib/apiError';
import { applyFieldErrors } from '@/lib/formErrors';
import { useCountdown } from '@/hooks/useCountdown';
import { useRegisterMutation, useRequestOtpMutation } from '@/store/apiSlice';

const DETAIL_FIELDS = ['name', 'email', 'password', 'role'] as const;
const ALL_FIELDS = [...DETAIL_FIELDS, 'otp'] as const;

const ROLE_OPTIONS: readonly { value: Role; label: string }[] = [
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'owner', label: 'Restaurant owner' },
];

/**
 * Registration in two steps: enter details and request an emailed code, then enter the code.
 * The account is only created by the final submit, which sends the details and the code together.
 */
export default function RegisterForm() {
  const [requestOtp, { isLoading: isSendingCode }] = useRequestOtpMutation();
  const [registerUser, { isLoading: isRegistering, isSuccess }] = useRegisterMutation();

  const [step, setStep] = useState<'details' | 'code'>('details');
  const [formError, setFormError] = useState<string | null>(null);
  // The address the current code went to, and when another may be requested.
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const secondsUntilResend = useCountdown(resendAt);

  const { control, handleSubmit, trigger, getValues, setError, resetField } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', role: 'reviewer' as Role, otp: '' },
  });

  const showApiError = (err: unknown) => {
    const error = toApiError(err);
    const shownOnFields = applyFieldErrors(error, ALL_FIELDS, setError);
    if (shownOnFields.length === 0) setFormError(error.message);
    // A problem with a detail (not the code) can only be fixed on the first step.
    if (shownOnFields.some((field) => field !== 'otp')) setStep('details');
  };

  const sendCode = async ({ force = false } = {}) => {
    setFormError(null);
    if (!(await trigger(DETAIL_FIELDS))) return;
    const email = emailSchema.parse(getValues('email'));

    // Returning to this step and continuing with the same address reuses the code already sent.
    const alreadySent = email === codeSentTo && secondsUntilResend > 0;
    if (alreadySent && !force) {
      setStep('code');
      return;
    }

    try {
      await requestOtp({ email }).unwrap();
      setCodeSentTo(email);
      setResendAt(Date.now() + OTP_RESEND_COOLDOWN_SECONDS * 1000);
      resetField('otp');
      setStep('code');
    } catch (err) {
      showApiError(err);
    }
  };

  const createAccount = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await registerUser(values).unwrap();
    } catch (err) {
      showApiError(err);
    }
  });

  const busy = isSendingCode || isRegistering || isSuccess;

  if (step === 'details') {
    return (
      <Stack
        component="form"
        spacing={2.5}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void sendCode();
        }}
      >
        {formError && <Alert severity="error">{formError}</Alert>}

        <FormTextField
          control={control}
          name="name"
          label="Name"
          autoComplete="name"
          autoFocus
          disabled={busy}
        />
        <FormTextField
          control={control}
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          disabled={busy}
        />
        <FormTextField
          control={control}
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          helperText={`At least ${PASSWORD_MIN_LENGTH} characters, with a letter and a number`}
          disabled={busy}
        />
        <FormRadioField
          control={control}
          name="role"
          label="I am a"
          options={ROLE_OPTIONS}
          disabled={busy}
        />

        <Button type="submit" variant="contained" size="large" loading={isSendingCode}>
          Send verification code
        </Button>
      </Stack>
    );
  }

  return (
    <Stack component="form" spacing={2.5} noValidate onSubmit={createAccount}>
      {formError && <Alert severity="error">{formError}</Alert>}

      <Typography>
        If <strong>{codeSentTo}</strong> can be used for a new account, we have emailed it a{' '}
        {OTP_LENGTH}-digit code. The code expires in {OTP_TTL_MINUTES} minutes.
      </Typography>

      <FormTextField
        control={control}
        name="otp"
        label="Verification code"
        autoComplete="one-time-code"
        autoFocus
        disabled={busy}
        slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: OTP_LENGTH } }}
      />

      <Button type="submit" variant="contained" size="large" loading={isRegistering || isSuccess}>
        Create account
      </Button>

      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Button disabled={busy} onClick={() => setStep('details')}>
          Back
        </Button>
        <Button
          disabled={busy || secondsUntilResend > 0}
          loading={isSendingCode}
          onClick={() => void sendCode({ force: true })}
        >
          {secondsUntilResend > 0 ? `Resend code in ${secondsUntilResend}s` : 'Resend code'}
        </Button>
      </Stack>
    </Stack>
  );
}
