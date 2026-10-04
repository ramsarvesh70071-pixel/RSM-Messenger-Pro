import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAuditLogDocument extends Document {
  adminId: Types.ObjectId;
  action: string;
  targetId?: string;
  targetType?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLogDocument>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, index: true },
    targetId: { type: String, index: true },
    targetType: { type: String, index: true },
    details: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AuditLog = mongoose.model<IAuditLogDocument>('AuditLog', AuditLogSchema);
