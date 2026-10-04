import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IReportDocument extends Document {
  reporterId: Types.ObjectId;
  targetType: 'user' | 'message' | 'group' | 'channel';
  targetId: Types.ObjectId;
  reason: string;
  details?: string;
  evidenceUrls?: string[];
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  actionTaken?: string;
  adminNotes?: string;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReportDocument>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetType: { type: String, enum: ['user', 'message', 'group', 'channel'], required: true, index: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    reason: { type: String, required: true },
    details: { type: String, default: '' },
    evidenceUrls: [{ type: String }],
    status: {
      type: String,
      enum: ['pending', 'reviewing', 'resolved', 'dismissed'],
      default: 'pending',
      index: true
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    actionTaken: { type: String, default: 'none' },
    adminNotes: { type: String, default: '' },
    resolutionNotes: { type: String, default: '' }
  },
  { timestamps: true }
);

ReportSchema.index({ status: 1, createdAt: -1 });

export const Report = mongoose.model<IReportDocument>('Report', ReportSchema);
