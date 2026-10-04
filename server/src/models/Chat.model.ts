import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IChatMemberSubdoc {
  userId: Types.ObjectId;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
  isMuted: boolean;
  mutedUntil?: Date;
  isArchived: boolean;
  isPinned: boolean;
  pinnedAt?: Date;
  unreadCount: number;
  lastReadMessageId?: Types.ObjectId;
  customWallpaper?: string;
  clearedAt?: Date;
}

export interface IPendingRequestSubdoc {
  userId: Types.ObjectId;
  requestedAt: Date;
}

export interface IChatDocument extends Document {
  type: 'direct' | 'group' | 'channel_comments';
  name?: string;
  description?: string;
  avatarUrl?: string;
  inviteCode?: string;
  participants: Types.ObjectId[];
  membersMeta: IChatMemberSubdoc[];
  pendingRequests?: IPendingRequestSubdoc[];
  lastMessage?: Types.ObjectId;
  lastMessageAt: Date;
  groupSettings?: {
    onlyAdminsCanSend: boolean;
    onlyAdminsCanEditInfo: boolean;
    approveNewMembers: boolean;
    announcementOnly: boolean;
  };
  disappearingConfig?: {
    enabled: boolean;
    durationSeconds: number;
  };
  communityId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ChatMemberSchema = new Schema<IChatMemberSubdoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
    isMuted: { type: Boolean, default: false },
    mutedUntil: { type: Date },
    isArchived: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date },
    unreadCount: { type: Number, default: 0 },
    lastReadMessageId: { type: Schema.Types.ObjectId, ref: 'Message' },
    customWallpaper: { type: String, default: '' },
    clearedAt: { type: Date }
  },
  { _id: false }
);

const ChatSchema = new Schema<IChatDocument>(
  {
    type: { type: String, enum: ['direct', 'group', 'channel_comments'], default: 'direct', index: true },
    name: { type: String, trim: true },
    description: { type: String, trim: true, default: '' },
    avatarUrl: { type: String, default: '' },
    inviteCode: { type: String, unique: true, sparse: true },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
    membersMeta: [ChatMemberSchema],
    pendingRequests: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        requestedAt: { type: Date, default: Date.now }
      }
    ],
    lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    groupSettings: {
      onlyAdminsCanSend: { type: Boolean, default: false },
      onlyAdminsCanEditInfo: { type: Boolean, default: false },
      approveNewMembers: { type: Boolean, default: false },
      announcementOnly: { type: Boolean, default: false }
    },
    disappearingConfig: {
      enabled: { type: Boolean, default: false },
      durationSeconds: { type: Number, default: 86400 } // 24 hours default
    },
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', sparse: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

ChatSchema.index({ participants: 1, type: 1 });
ChatSchema.index({ 'membersMeta.userId': 1 });
ChatSchema.index({ lastMessageAt: -1 });

export const Chat = mongoose.model<IChatDocument>('Chat', ChatSchema);
