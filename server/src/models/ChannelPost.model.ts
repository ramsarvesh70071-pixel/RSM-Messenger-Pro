import mongoose, { Schema, Document, Types } from 'mongoose';
import { IAttachmentSubdoc } from './Message.model';

export interface IChannelPostDocument extends Document {
  channelId: Types.ObjectId;
  authorId: Types.ObjectId;
  content: string;
  attachments?: IAttachmentSubdoc[];
  reactions: { userId: Types.ObjectId; emoji: string; createdAt: Date }[];
  commentsCount: number;
  viewsCount: number;
  isForwarded?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ChannelPostSchema = new Schema<IChannelPostDocument>(
  {
    channelId: { type: Schema.Types.ObjectId, ref: 'Channel', required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, default: '' },
    attachments: [
      {
        url: { type: String, required: true },
        thumbnailUrl: { type: String, default: '' },
        mimeType: { type: String, required: true },
        fileName: { type: String, default: '' },
        fileSize: { type: Number, required: true },
        duration: { type: Number, default: 0 },
        width: { type: Number },
        height: { type: Number }
      }
    ],
    reactions: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        emoji: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    commentsCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },
    isForwarded: { type: Boolean, default: false }
  },
  { timestamps: true }
);

ChannelPostSchema.index({ channelId: 1, createdAt: -1 });

export const ChannelPost = mongoose.model<IChannelPostDocument>('ChannelPost', ChannelPostSchema);
