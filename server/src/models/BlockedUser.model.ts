import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBlockedUserDocument extends Document {
  userId: Types.ObjectId;
  blockedUserId: Types.ObjectId;
  createdAt: Date;
}

const BlockedUserSchema = new Schema<IBlockedUserDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    blockedUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }
  },
  { timestamps: true }
);

BlockedUserSchema.index({ userId: 1, blockedUserId: 1 }, { unique: true });

export const BlockedUser = mongoose.model<IBlockedUserDocument>('BlockedUser', BlockedUserSchema);
export const Block = BlockedUser;
