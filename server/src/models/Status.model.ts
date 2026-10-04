import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IStatusViewSubdoc {
  userId: Types.ObjectId;
  viewedAt: Date;
}

export interface IStatusReactionSubdoc {
  userId: Types.ObjectId;
  emoji: string;
  createdAt: Date;
}

export interface IStatusDocument extends Document {
  userId: Types.ObjectId;
  type: 'text' | 'image' | 'video';
  content: string;
  caption?: string;
  backgroundColor?: string;
  fontFamily?: string;
  durationSeconds?: number;
  views: IStatusViewSubdoc[];
  reactions: IStatusReactionSubdoc[];
  privacy: 'everyone' | 'contacts' | 'nobody' | 'except' | 'only-share-with';
  allowedUserIds?: Types.ObjectId[];
  excludedUserIds?: Types.ObjectId[];
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StatusViewSchema = new Schema<IStatusViewSubdoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    viewedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const StatusReactionSchema = new Schema<IStatusReactionSubdoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const StatusSchema = new Schema<IStatusDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['text', 'image', 'video'], default: 'text' },
    content: { type: String, required: true },
    caption: { type: String, default: '' },
    backgroundColor: { type: String, default: '#075E54' },
    fontFamily: { type: String, default: 'System' },
    durationSeconds: { type: Number, default: 5 },
    views: [StatusViewSchema],
    reactions: [StatusReactionSchema],
    privacy: { type: String, enum: ['everyone', 'contacts', 'nobody', 'except', 'only-share-with'], default: 'contacts' },
    allowedUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    excludedUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
  },
  { timestamps: true }
);

StatusSchema.index({ userId: 1, createdAt: -1 });

export const Status = mongoose.model<IStatusDocument>('Status', StatusSchema);
