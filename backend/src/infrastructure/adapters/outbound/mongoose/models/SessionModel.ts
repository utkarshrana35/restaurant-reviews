import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

const sessionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    // TTL index: MongoDB deletes the session once expiresAt has passed.
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true },
);

/** A session as stored. Inferred from the schema, so the two cannot drift apart. */
export type SessionRecord = InferSchemaType<typeof sessionSchema>;
export type SessionDocument = HydratedDocument<SessionRecord>;
/** The `sessions` collection: one document per signed-in device. */
export const SessionModel = model('Session', sessionSchema);
