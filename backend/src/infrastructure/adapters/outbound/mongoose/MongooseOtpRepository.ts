import type { OtpRepository } from '../../../../application/ports/OtpRepository';
import { EmailOtp, type OtpKey } from '../../../../domain/entities/EmailOtp';
import { EmailOtpModel, type EmailOtpRecord } from './models/EmailOtpModel';
import { MongooseRepository } from './MongooseRepository';

/** Verification codes in MongoDB, expired by a TTL index. */
export class MongooseOtpRepository extends MongooseRepository implements OtpRepository {
  async find({ email, purpose }: OtpKey): Promise<EmailOtp | null> {
    const record = await this.run(() => EmailOtpModel.findOne({ email, purpose }).lean());
    return record ? this.toEntity(record) : null;
  }

  async save(otp: EmailOtp): Promise<void> {
    await this.run(() =>
      EmailOtpModel.replaceOne(
        { email: otp.email, purpose: otp.purpose },
        {
          email: otp.email,
          purpose: otp.purpose,
          codeHash: otp.codeHash,
          expiresAt: otp.expiresAt,
          attempts: otp.attempts,
          lastSentAt: otp.lastSentAt,
        },
        { upsert: true },
      ),
    );
  }

  async claimAttempt({ email, purpose }: OtpKey, maxAttempts: number): Promise<EmailOtp | null> {
    // One atomic operation: the filter and the increment cannot be interleaved by another request.
    // A retry can only count an attempt twice, which errs on the side of locking the code sooner.
    const record = await this.run(() =>
      EmailOtpModel.findOneAndUpdate(
        { email, purpose, attempts: { $lt: maxAttempts } },
        { $inc: { attempts: 1 } },
        { returnDocument: 'after' },
      ).lean(),
    );
    return record ? this.toEntity(record) : null;
  }

  async delete({ email, purpose }: OtpKey): Promise<void> {
    await this.run(() => EmailOtpModel.deleteOne({ email, purpose }));
  }

  private toEntity(record: EmailOtpRecord): EmailOtp {
    return new EmailOtp({
      email: record.email,
      purpose: record.purpose,
      codeHash: record.codeHash,
      expiresAt: record.expiresAt,
      attempts: record.attempts,
      lastSentAt: record.lastSentAt,
    });
  }
}
