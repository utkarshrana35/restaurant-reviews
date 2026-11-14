/** An email ready to send. */
export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text body, shown by clients that do not render HTML. */
  text: string;
  /** HTML body. Carries the same content as `text`. */
  html: string;
}

/** Delivers email. Implemented for the console, SMTP and SES. */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
