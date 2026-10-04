import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICommunityDocument extends Document {
  name: string;
  description: string;
  iconUrl: string;
  creatorId: Types.ObjectId;
  admins: Types.ObjectId[];
  announcementChatId: Types.ObjectId;
  groups: Types.ObjectId[];
  membersCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CommunitySchema = new Schema<ICommunityDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 1000 },
    iconUrl: { type: String, default: '' },
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    admins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    announcementChatId: { type: Schema.Types.ObjectId, ref: 'Chat' },
    groups: [{ type: Schema.Types.ObjectId, ref: 'Chat' }],
    membersCount: { type: Number, default: 1 }
  },
  { timestamps: true }
);

CommunitySchema.index({ name: 'text', description: 'text' });

export const Community = mongoose.model<ICommunityDocument>('Community', CommunitySchema);
