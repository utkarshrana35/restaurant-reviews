import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailMessage, EmailSender } from '../../../../application/ports/EmailSender';

/** The SMTP server and sender address. */
export interface SmtpConfig {
  host: string;
  port: number;
  /** Credentials, for servers that require signing in. Both parts or none. */
  auth?: { user: string; pass: string };
  from: string;
}

/** Sends email through an SMTP server. */
export class SmtpEmailSender implements EmailSender {
  private readonly transporter: Transporter;

  constructor(private readonly config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      // 465 is implicit TLS; other ports upgrade with STARTTLS when the server offers it.
      secure: config.port === 465,
      auth: config.auth,
    });
  }

  async send({ to, subject, text, html }: EmailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.config.from, to, subject, text, html });
  }
}
