import { OTP_TTL_MINUTES } from '@restaurant-reviews/common';
import type { EmailMessage } from '../ports/EmailSender';
import { emailLayout, paragraph, prominentCode } from './emailLayout';

/** The email carrying a registration verification code. */
export function otpEmail(to: string, code: string): EmailMessage {
  const expiry = `It expires in ${OTP_TTL_MINUTES} minutes.`;
  const ignore = 'If you did not try to create an account, you can ignore this email.';

  return {
    to,
    subject: `${code} is your Restaurant Reviews verification code`,
    text: [`Your verification code is ${code}.`, expiry, '', ignore].join('\n'),
    html: emailLayout('Confirm your email address', [
      paragraph('Enter this code to finish creating your account:'),
      prominentCode(code),
      paragraph(expiry),
      paragraph(ignore, { muted: true }),
    ]),
  };
}

/** Sent instead of a code when the address already has an account, so the API reveals nothing. */
export function alreadyRegisteredEmail(to: string): EmailMessage {
  const explanation =
    'Someone tried to create a Restaurant Reviews account with this email address, ' +
    'but an account already exists. You can sign in with your existing password.';
  const ignore = 'If this was not you, no action is needed.';

  return {
    to,
    subject: 'You already have a Restaurant Reviews account',
    text: [explanation, '', ignore].join('\n'),
    html: emailLayout('You already have an account', [
      paragraph(explanation),
      paragraph(ignore, { muted: true }),
    ]),
  };
}
