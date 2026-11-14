import type { EmailMessage, EmailSender } from '../../../../application/ports/EmailSender';

/**
 * Development stand-in for a mail provider: prints the email to the server log instead of sending
 * it. Only the plain-text body is printed; the HTML body carries the same content.
 */
export class ConsoleEmailSender implements EmailSender {
  async send({ to, subject, text }: EmailMessage): Promise<void> {
    console.log(
      [
        '',
        '--- email (not sent: EMAIL_PROVIDER is console) ---',
        `To: ${to}`,
        `Subject: ${subject}`,
      ]
        .concat('', text, '--- end email ---', '')
        .join('\n'),
    );
  }
}
