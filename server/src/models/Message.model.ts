import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAttachmentSubdoc {
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
  fileName?: string;
  fileSize: number;
  duration?: number;
  width?: number;
  height?: number;
  waveform?: number[];
}

export interface IMessageReactionSubdoc {
  userId: Types.ObjectId;
  emoji: string;
  createdAt: Date;
}

export interface ILinkPreviewSubdoc {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
}

export interface IMessageDocument extends Document {
  chatId: Types.ObjectId;
  senderId: Types.ObjectId;
  clientMsgId?: string;
  type: 'text' | 'emoji' | 'image' | 'video' | 'audio' | 'voice' | 'document' | 'location' | 'contact' | 'system';
  content: string;
  attachments?: IAttachmentSubdoc[];
  linkPreview?: ILinkPreviewSubdoc;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  contact?: {
    name: string;
    phoneNumber: string;
    avatarUrl?: string;
    vCardData?: string;
  };
  replyTo?: {
    messageId: Types.ObjectId;
    senderId: Types.ObjectId;
    senderName: string;
    type: string;
    content: string;
    thumbnailUrl?: string;
  };
  isForwarded?: boolean;
  forwardCount?: number;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  reactions: IMessageReactionSubdoc[];
  readBy: { userId: Types.ObjectId; readAt: Date }[];
  deliveredTo: { userId: Types.ObjectId; deliveredAt: Date }[];
  isStarredBy: Types.ObjectId[];
  isPinned: boolean;
  pinnedAt?: Date;
  pinnedBy?: Types.ObjectId;
  isEdited: boolean;
  editedAt?: Date;
  isDeletedForEveryone: boolean;
  deletedForUserIds: Types.ObjectId[];
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema<IAttachmentSubdoc>(
  {
    url: { type: String, required: true },
    thumbnailUrl: { type: String, default: '' },
    mimeType: { type: String, default: 'application/octet-stream' },
    fileName: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    width: { type: Number },
    height: { type: Number },
    waveform: [{ type: Number }]
  },
  { _id: false }
);

const MessageReactionSchema = new Schema<IMessageReactionSubdoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const MessageSchema = new Schema<IMessageDocument>(
  {
    chatId: { type: Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clientMsgId: { type: String, sparse: true, index: true },
    type: {
      type: String,
      enum: ['text', 'emoji', 'image', 'video', 'audio', 'voice', 'document', 'location', 'contact', 'system'],
      default: 'text',
      index: true
    },
    content: { type: String, default: '' },
    attachments: [AttachmentSchema],
    linkPreview: {
      url: { type: String },
      title: { type: String },
      description: { type: String },
      imageUrl: { type: String },
      siteName: { type: String }
    },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      name: { type: String },
      address: { type: String }
    },
    contact: {
      name: { type: String },
      phoneNumber: { type: String },
      avatarUrl: { type: String },
      vCardData: { type: String }
    },
    replyTo: {
      messageId: { type: Schema.Types.ObjectId, ref: 'Message' },
      senderId: { type: Schema.Types.ObjectId, ref: 'User' },
      senderName: { type: String },
      type: { type: String },
      content: { type: String },
      thumbnailUrl: { type: String }
    },
    isForwarded: { type: Boolean, default: false },
    forwardCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
      default: 'sent',
      index: true
    },
    reactions: [MessageReactionSchema],
    readBy: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        readAt: { type: Date, default: Date.now }
      }
    ],
    deliveredTo: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        deliveredAt: { type: Date, default: Date.now }
      }
    ],
    isStarredBy: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
    isPinned: { type: Boolean, default: false, index: true },
    pinnedAt: { type: Date },
    pinnedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },
    isDeletedForEveryone: { type: Boolean, default: false },
    deletedForUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    expiresAt: { type: Date, index: { expires: 0 }, sparse: true }
  },
  { timestamps: true }
);

MessageSchema.index(
  { chatId: 1, senderId: 1, clientMsgId: 1 },
  { unique: true, partialFilterExpression: { clientMsgId: { $type: 'string' } } }
);
MessageSchema.index({ chatId: 1, createdAt: -1 });
MessageSchema.index({ chatId: 1, isPinned: 1 });
MessageSchema.index({ content: 'text' });

export const Message = mongoose.model<IMessageDocument>('Message', MessageSchema);
