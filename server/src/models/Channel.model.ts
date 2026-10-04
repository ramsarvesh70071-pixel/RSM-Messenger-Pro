import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IChannelDocument extends Document {
  name: string;
  handle: string;
  description: string;
  avatarUrl: string;
  bannerUrl: string;
  creatorId: Types.ObjectId;
  admins: Types.ObjectId[];
  followers: Types.ObjectId[];
  followersCount: number;
  isVerified: boolean;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ChannelSchema = new Schema<IChannelDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    handle: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 30 },
    description: { type: String, default: '', maxlength: 500 },
    avatarUrl: { type: String, default: '' },
    bannerUrl: { type: String, default: '' },
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    admins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    followers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    followersCount: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: true }
  },
  { timestamps: true }
);

ChannelSchema.index({ name: 'text', description: 'text', handle: 'text' });

export const Channel = mongoose.model<IChannelDocument>('Channel', ChannelSchema);
