import { IUser } from './user';

export type StatusContentType = 'text' | 'image' | 'video';

export interface IStatusView {
  userId: string | IUser;
  viewedAt: Date | string;
}

export interface IStatusReaction {
  userId: string;
  emoji: string;
  createdAt: Date | string;
}

export interface IStatus {
  _id: string;
  userId: string | IUser;
  type: StatusContentType;
  content: string; // text or media URL
  caption?: string;
  backgroundColor?: string;
  fontFamily?: string;
  durationSeconds?: number;
  views: IStatusView[];
  reactions: IStatusReaction[];
  expiresAt: Date | string;
  createdAt: Date | string;
}
