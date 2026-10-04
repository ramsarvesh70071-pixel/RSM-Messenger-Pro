import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IContactDocument extends Document {
  userId: Types.ObjectId;
  contactUserId?: Types.ObjectId;
  name: string;
  phoneNumber: string;
  isRegistered: boolean;
  avatarUrl?: string;
  about?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContactSchema = new Schema<IContactDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contactUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    isRegistered: { type: Boolean, default: false },
    avatarUrl: { type: String, default: '' },
    about: { type: String, default: '' }
  },
  { timestamps: true }
);

ContactSchema.index({ userId: 1, phoneNumber: 1 }, { unique: true });
ContactSchema.index({ name: 'text', phoneNumber: 'text' });

export const Contact = mongoose.model<IContactDocument>('Contact', ContactSchema);
