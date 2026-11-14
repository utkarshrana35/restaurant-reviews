import { OTP_TTL_MINUTES } from '@restaurant-reviews/common';
import type { EmailMessage } from '../ports/EmailSender';
import { emailLayout, paragraph, prominentCode } from './emailLayout';

/** The email carrying a password reset code. */
export function passwordResetEmail(to: string, code: string): EmailMessage {
  const expiry = `It expires in ${OTP_TTL_MINUTES} minutes.`;
  const signOut = 'Resetting your password signs you out on every other device.';
  const ignore =
    'If you did not ask to reset your password, you can ignore this email: your password stays ' +
    'as it is.';

  return {
    to,
    subject: `${code} is your Restaurant Reviews password reset code`,
    text: [`Your password reset code is ${code}.`, expiry, signOut, '', ignore].join('\n'),
    html: emailLayout('Reset your password', [
      paragraph('Enter this code to choose a new password:'),
      prominentCode(code),
      paragraph(expiry),
      paragraph(signOut),
      paragraph(ignore, { muted: true }),
    ]),
  };
}

/**
 * Sent instead of a code when nobody has an account with the address, so the API reveals
 * nothing about which addresses have accounts.
 */
export function noAccountEmail(to: string): EmailMessage {
  const explanation =
    'Someone asked to reset the password of a Restaurant Reviews account with this email ' +
    'address, but there is no account with it. You can create one with this address instead.';
  const ignore = 'If this was not you, no action is needed.';

  return {
    to,
    subject: 'There is no Restaurant Reviews account with this email address',
    text: [explanation, '', ignore].join('\n'),
    html: emailLayout('No account with this address', [
      paragraph(explanation),
      paragraph(ignore, { muted: true }),
    ]),
  };
}
