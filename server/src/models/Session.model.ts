import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISessionDocument extends Document {
  userId: Types.ObjectId;
  deviceId: string;
  refreshTokenHash: string;
  isValid: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISessionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deviceId: { type: String, required: true, index: true },
    refreshTokenHash: { type: String, required: true },
    isValid: { type: Boolean, default: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
  },
  { timestamps: true }
);

SessionSchema.index({ userId: 1, isValid: 1 });

export const Session = mongoose.model<ISessionDocument>('Session', SessionSchema);
