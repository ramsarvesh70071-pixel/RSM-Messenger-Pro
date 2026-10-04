import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICallParticipantSubdoc {
  userId: Types.ObjectId;
  role: 'caller' | 'callee';
  status: 'initiated' | 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed' | 'busy';
  joinedAt?: Date;
  leftAt?: Date;
}

export interface ICallDocument extends Document {
  chatId?: Types.ObjectId;
  callType: 'voice' | 'video';
  status: 'initiated' | 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed' | 'busy';
  caller: Types.ObjectId;
  receiver: Types.ObjectId;
  participants: ICallParticipantSubdoc[];
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds: number;
  deletedForUserIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const CallParticipantSchema = new Schema<ICallParticipantSubdoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['caller', 'callee'], required: true },
    status: {
      type: String,
      enum: ['initiated', 'ringing', 'connected', 'ended', 'rejected', 'missed', 'busy'],
      default: 'initiated'
    },
    joinedAt: { type: Date },
    leftAt: { type: Date }
  },
  { _id: false }
);

const CallSchema = new Schema<ICallDocument>(
  {
    chatId: { type: Schema.Types.ObjectId, ref: 'Chat' },
    callType: { type: String, enum: ['voice', 'video'], required: true },
    status: {
      type: String,
      enum: ['initiated', 'ringing', 'connected', 'ended', 'rejected', 'missed', 'busy'],
      default: 'initiated',
      index: true
    },
    caller: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiver: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    participants: [CallParticipantSchema],
    startedAt: { type: Date },
    endedAt: { type: Date },
    durationSeconds: { type: Number, default: 0 },
    deletedForUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

CallSchema.virtual('duration').get(function () {
  return this.durationSeconds;
});

CallSchema.index({ caller: 1, createdAt: -1 });
CallSchema.index({ receiver: 1, createdAt: -1 });

export const Call = mongoose.model<ICallDocument>('Call', CallSchema);
