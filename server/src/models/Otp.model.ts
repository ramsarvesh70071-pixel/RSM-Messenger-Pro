import mongoose, { Schema, Document } from 'mongoose';

export interface IOtpDocument extends Document {
  phoneNumber: string;
  otpHash: string;
  attempts: number;
  lastSentAt: Date;
  requestCount: number;
  windowStart: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OtpSchema = new Schema<IOtpDocument>(
  {
    phoneNumber: { type: String, required: true, index: true },
    otpHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: Date.now },
    requestCount: { type: Number, default: 1 },
    windowStart: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
  },
  { timestamps: true }
);

export const Otp = mongoose.model<IOtpDocument>('Otp', OtpSchema);
