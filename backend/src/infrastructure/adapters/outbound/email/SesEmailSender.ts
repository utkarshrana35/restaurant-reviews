import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import type { EmailMessage, EmailSender } from '../../../../application/ports/EmailSender';

/** Where SES sends from. */
export interface SesConfig {
  region: string;
  /** Must be an address or domain verified in SES. */
  from: string;
}

const CHARSET = 'UTF-8';

/**
 * Sends through Amazon SES. Credentials come from the AWS SDK's default chain (environment
 * variables, shared config, or the role attached to the instance, task or function), so none are
 * handled here.
 */
export class SesEmailSender implements EmailSender {
  private readonly client: SESv2Client;

  constructor(private readonly config: SesConfig) {
    this.client = new SESv2Client({ region: config.region });
  }

  async send({ to, subject, text, html }: EmailMessage): Promise<void> {
    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.config.from,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: CHARSET },
            Body: {
              Text: { Data: text, Charset: CHARSET },
              Html: { Data: html, Charset: CHARSET },
            },
          },
        },
      }),
    );
  }
}
