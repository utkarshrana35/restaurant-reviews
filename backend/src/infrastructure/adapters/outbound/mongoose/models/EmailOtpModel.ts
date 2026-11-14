import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

const emailOtpSchema = new Schema({
  email: { type: String, required: true },
  purpose: { type: String, required: true, enum: ['registration', 'password_reset'] as const },
  codeHash: { type: String, required: true },
  // TTL index: MongoDB deletes the document once expiresAt has passed.
  expiresAt: { type: Date, required: true, expires: 0 },
  attempts: { type: Number, required: true, default: 0 },
  lastSentAt: { type: Date, required: true },
});

// At most one code per address for each purpose.
emailOtpSchema.index({ email: 1, purpose: 1 }, { unique: true });

/** A verification code as stored. Inferred from the schema, so the two cannot drift apart. */
export type EmailOtpRecord = InferSchemaType<typeof emailOtpSchema>;
export type EmailOtpDocument = HydratedDocument<EmailOtpRecord>;
/** The `emailotps` collection: at most one active code per email and purpose. */
export const EmailOtpModel = model('EmailOtp', emailOtpSchema);
