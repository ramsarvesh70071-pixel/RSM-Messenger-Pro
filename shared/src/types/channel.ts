import { IUser } from './user';
import { IAttachment } from './message';

export interface IChannelPost {
  _id: string;
  channelId: string;
  authorId: string | IUser;
  content: string;
  attachments?: IAttachment[];
  reactions: { userId: string; emoji: string; createdAt: Date | string }[];
  commentsCount: number;
  viewsCount: number;
  isForwarded?: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface IChannel {
  _id: string;
  name: string;
  handle: string;
  description?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  creatorId: string | IUser;
  admins: (string | IUser)[];
  followersCount: number;
  isVerified: boolean;
  isPublic: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}
