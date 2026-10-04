import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBackupDocument extends Document {
  userId: Types.ObjectId;
  storageProvider: 'local' | 'cloud';
  fileUrl: string;
  fileSize: number;
  totalChats: number;
  totalMessages: number;
  checksum: string;
  createdAt: Date;
}

const BackupSchema = new Schema<IBackupDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    storageProvider: { type: String, enum: ['local', 'cloud'], default: 'local' },
    fileUrl: { type: String, required: true },
    fileSize: { type: Number, required: true },
    totalChats: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },
    checksum: { type: String, default: '' }
  },
  { timestamps: true }
);

export const Backup = mongoose.model<IBackupDocument>('Backup', BackupSchema);
