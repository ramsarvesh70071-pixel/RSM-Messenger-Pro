import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUploadDocument extends Document {
  userId: Types.ObjectId;
  url: string;
  thumbnailUrl?: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  isAttached: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UploadSchema = new Schema<IUploadDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    url: { type: String, required: true, unique: true },
    thumbnailUrl: { type: String, default: '' },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    isAttached: { type: Boolean, default: false }
  },
  { timestamps: true }
);

UploadSchema.index({ createdAt: 1 });
UploadSchema.index({ isAttached: 1, createdAt: 1 });

export const Upload = mongoose.model<IUploadDocument>('Upload', UploadSchema);
