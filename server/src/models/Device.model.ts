import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDeviceDocument extends Document {
  userId: Types.ObjectId;
  deviceId: string;
  deviceName: string;
  deviceType: 'ios' | 'android' | 'web' | 'desktop';
  pushToken?: string;
  lastActive: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceSchema = new Schema<IDeviceDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deviceId: { type: String, required: true },
    deviceName: { type: String, required: true, default: 'Mobile Device' },
    deviceType: { type: String, enum: ['ios', 'android', 'web', 'desktop'], default: 'android' },
    pushToken: { type: String, default: '' },
    lastActive: { type: Date, default: Date.now },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' }
  },
  { timestamps: true }
);

DeviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

export const Device = mongoose.model<IDeviceDocument>('Device', DeviceSchema);
