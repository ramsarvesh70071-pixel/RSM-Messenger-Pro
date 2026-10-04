import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INotificationDocument extends Document {
  recipientId: Types.ObjectId;
  senderId?: Types.ObjectId;
  type: 'message' | 'group' | 'group_mention' | 'reply' | 'call' | 'status_reaction' | 'system';
  title: string;
  body: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: ['message', 'group', 'group_mention', 'reply', 'call', 'status_reaction', 'system'],
      required: true
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

NotificationSchema.index({ recipientId: 1, createdAt: -1 });

export const Notification = mongoose.model<INotificationDocument>('Notification', NotificationSchema);
