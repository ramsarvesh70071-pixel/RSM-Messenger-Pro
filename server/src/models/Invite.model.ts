import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IInviteDocument extends Document {
  code: string;
  targetType: 'group' | 'channel';
  targetId: Types.ObjectId;
  createdBy: Types.ObjectId;
  usageCount: number;
  maxUses?: number;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
}

const InviteSchema = new Schema<IInviteDocument>(
  {
    code: { type: String, required: true, unique: true, index: true },
    targetType: { type: String, enum: ['group', 'channel'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    usageCount: { type: Number, default: 0 },
    maxUses: { type: Number },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Invite = mongoose.model<IInviteDocument>('Invite', InviteSchema);
