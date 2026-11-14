import { ROLES } from '@restaurant-reviews/common';
import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // The unique index is the final guard against two accounts for one address.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, required: true, enum: ROLES, immutable: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

/** A user as stored. Inferred from the schema, so the two cannot drift apart. */
export type UserRecord = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserRecord>;
/** The `users` collection. */
export const UserModel = model('User', userSchema);
