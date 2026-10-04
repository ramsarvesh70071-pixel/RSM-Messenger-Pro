import { IUser } from './user';

export type CallType = 'voice' | 'video';
export type CallStatus = 'initiated' | 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed' | 'busy';

export interface ICallParticipant {
  userId: string | IUser;
  role: 'caller' | 'callee';
  status: CallStatus;
  joinedAt?: Date | string;
  leftAt?: Date | string;
}

export interface ICall {
  _id: string;
  chatId?: string;
  callType: CallType;
  status: CallStatus;
  caller: string | IUser;
  receiver: string | IUser;
  participants: ICallParticipant[];
  startedAt?: Date | string;
  endedAt?: Date | string;
  durationSeconds?: number;
  createdAt: Date | string;
}

export interface IRtcIceCandidate {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

export interface IRtcSessionDescription {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp: string;
}
