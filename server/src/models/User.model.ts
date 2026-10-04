import mongoose, { Schema, Document } from 'mongoose';

export interface IPrivacySettingsSubdoc {
  lastSeen: 'everyone' | 'contacts' | 'nobody';
  online: 'everyone' | 'contacts' | 'nobody';
  profilePhoto: 'everyone' | 'contacts' | 'nobody';
  about: 'everyone' | 'contacts' | 'nobody';
  status: 'everyone' | 'contacts' | 'nobody';
  readReceipts: boolean;
  allowGroupAdd: 'everyone' | 'contacts' | 'nobody';
  allowCalls: 'everyone' | 'contacts' | 'nobody';
}

export interface IUserDocument extends Document {
  phoneNumber: string;
  countryCode: string;
  name: string;
  username?: string;
  about: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastSeen: Date;
  isSuspended: boolean;
  role: 'user' | 'admin' | 'moderator';
  privacySettings: IPrivacySettingsSubdoc;
  createdAt: Date;
  updatedAt: Date;
}

const PrivacySettingsSchema = new Schema<IPrivacySettingsSubdoc>(
  {
    lastSeen: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' },
    online: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' },
    profilePhoto: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' },
    about: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' },
    status: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'contacts' },
    readReceipts: { type: Boolean, default: true },
    allowGroupAdd: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' },
    allowCalls: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' }
  },
  { _id: false }
);

const UserSchema = new Schema<IUserDocument>(
  {
    phoneNumber: { type: String, required: true, unique: true, index: true, trim: true },
    countryCode: { type: String, required: true, default: '+91' },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    username: { type: String, unique: true, sparse: true, trim: true, lowercase: true, minlength: 3, maxlength: 30 },
    about: { type: String, default: 'Hey there! I am using RSM Messenger.', maxlength: 140 },
    avatarUrl: { type: String, default: '' },
    isOnline: { type: Boolean, default: false, index: true },
    lastSeen: { type: Date, default: Date.now },
    isSuspended: { type: Boolean, default: false, index: true },
    role: { type: String, enum: ['user', 'admin', 'moderator'], default: 'user' },
    privacySettings: { type: PrivacySettingsSchema, default: () => ({}) }
  },
  { timestamps: true }
);

UserSchema.index({ name: 'text', about: 'text', username: 'text' });

export const User = mongoose.model<IUserDocument>('User', UserSchema);
