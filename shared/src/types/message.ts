import { IUser } from './user';

export type MessageType =
  | 'text'
  | 'emoji'
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'document'
  | 'location'
  | 'contact'
  | 'system';

export type MessageDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface IAttachment {
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
  fileName?: string;
  fileSize: number;
  duration?: number; // audio/video/voice duration in seconds
  width?: number;
  height?: number;
  waveform?: number[]; // Audio waveform amplitude samples [0-100]
}

export interface ILocationData {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface IContactCard {
  name: string;
  phoneNumber: string;
  avatarUrl?: string;
  vCardData?: string;
}

export interface IMessageReaction {
  userId: string;
  emoji: string;
  createdAt: Date | string;
}

export interface IReplyMessagePreview {
  _id: string;
  senderId: string;
  senderName: string;
  type: MessageType;
  content: string;
  thumbnailUrl?: string;
}

export interface IMessage {
  _id: string;
  chatId: string;
  senderId: string | IUser;
  type: MessageType;
  content: string;
  attachments?: IAttachment[];
  location?: ILocationData;
  contact?: IContactCard;
  replyTo?: IReplyMessagePreview;
  isForwarded?: boolean;
  forwardCount?: number;
  status: MessageDeliveryStatus;
  reactions: IMessageReaction[];
  readBy: { userId: string; readAt: Date | string }[];
  deliveredTo: { userId: string; deliveredAt: Date | string }[];
  isStarredBy: string[]; // userIds
  isPinned: boolean;
  pinnedAt?: Date | string;
  pinnedBy?: string;
  isEdited: boolean;
  editedAt?: Date | string;
  isDeletedForEveryone: boolean;
  deletedForUserIds: string[];
  expiresAt?: Date | string; // For disappearing messages
  createdAt: Date | string;
  updatedAt: Date | string;
}
