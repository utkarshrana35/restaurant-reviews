'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  emailSchema,
  OTP_LENGTH,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES,
  PASSWORD_MIN_LENGTH,
  resetPasswordSchema,
} from '@restaurant-reviews/common';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormTextField } from '@/components/forms';
import { Alert, Button, Stack, Typography } from '@/components/ui';
import { useCountdown } from '@/hooks/useCountdown';
import { toApiError } from '@/lib/apiError';
import { applyFieldErrors } from '@/lib/formErrors';
import { useRequestPasswordResetMutation, useResetPasswordMutation } from '@/store/apiSlice';

const FIELDS = ['email', 'otp', 'password'] as const;

/**
 * Password reset in two steps: enter the account's email to be sent a code, then enter the code
 * with a new password. Saving it signs the user in (and out everywhere else); moving on
 * afterwards is left to the GuestOnly wrapper around the page.
 */
export default function ResetPasswordForm() {
  const [requestReset, { isLoading: isSendingCode }] = useRequestPasswordResetMutation();
  const [resetPassword, { isLoading: isResetting, isSuccess }] = useResetPasswordMutation();

  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [formError, setFormError] = useState<string | null>(null);
  // The address the current code went to, and when another may be requested.
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const secondsUntilResend = useCountdown(resendAt);

  const { control, handleSubmit, trigger, getValues, setError, resetField } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: '', otp: '', password: '' },
  });

  const showApiError = (err: unknown) => {
    const error = toApiError(err);
    const shownOnFields = applyFieldErrors(error, FIELDS, setError);
    if (shownOnFields.length === 0) setFormError(error.message);
    // A problem with the address can only be fixed on the first step.
    if (shownOnFields.includes('email')) setStep('email');
  };

  const sendCode = async ({ force = false } = {}) => {
    setFormError(null);
    if (!(await trigger('email'))) return;
    const email = emailSchema.parse(getValues('email'));

    // Returning to this step and continuing with the same address reuses the code already sent.
    const alreadySent = email === codeSentTo && secondsUntilResend > 0;
    if (alreadySent && !force) {
      setStep('reset');
      return;
    }

    try {
      await requestReset({ email }).unwrap();
      setCodeSentTo(email);
      setResendAt(Date.now() + OTP_RESEND_COOLDOWN_SECONDS * 1000);
      resetField('otp');
      setStep('reset');
    } catch (err) {
      showApiError(err);
    }
  };

  const saveNewPassword = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await resetPassword(values).unwrap();
    } catch (err) {
      showApiError(err);
    }
  });

  const busy = isSendingCode || isResetting || isSuccess;

  if (step === 'email') {
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

        <Typography>
          Enter the email address you signed up with, and we will email you a code to choose a new
          password.
        </Typography>
        <FormTextField
          control={control}
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          autoFocus
          disabled={busy}
        />

        <Button type="submit" variant="contained" size="large" loading={isSendingCode}>
          Send reset code
        </Button>
      </Stack>
    );
  }

  return (
    <Stack component="form" spacing={2.5} noValidate onSubmit={saveNewPassword}>
      {formError && <Alert severity="error">{formError}</Alert>}

      <Typography>
        If <strong>{codeSentTo}</strong> has an account, we have emailed it a {OTP_LENGTH}-digit
        code. The code expires in {OTP_TTL_MINUTES} minutes.
      </Typography>

      <FormTextField
        control={control}
        name="otp"
        label="Reset code"
        autoComplete="one-time-code"
        autoFocus
        disabled={busy}
        slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: OTP_LENGTH } }}
      />
      <FormTextField
        control={control}
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        helperText={`At least ${PASSWORD_MIN_LENGTH} characters, with a letter and a number. You will be signed out on every other device.`}
        disabled={busy}
      />

      <Button type="submit" variant="contained" size="large" loading={isResetting || isSuccess}>
        Save new password
      </Button>

      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Button disabled={busy} onClick={() => setStep('email')}>
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
