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

export interface IUser {
  _id: string;
  phoneNumber: string;
  countryCode: string;
  name: string;
  username?: string;
  about: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastSeen: string;
  role: 'user' | 'admin' | 'moderator';
  privacySettings?: {
    lastSeen: 'everyone' | 'contacts' | 'nobody';
    online: 'everyone' | 'contacts' | 'nobody';
    profilePhoto: 'everyone' | 'contacts' | 'nobody';
    about: 'everyone' | 'contacts' | 'nobody';
    status: 'everyone' | 'contacts' | 'nobody';
    readReceipts: boolean;
    allowGroupAdd: 'everyone' | 'contacts' | 'nobody';
    allowCalls: 'everyone' | 'contacts' | 'nobody';
  };
}

export interface IAttachment {
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
  fileName?: string;
  fileSize: number;
  duration?: number;
  waveform?: number[];
}

export interface IReplyPreview {
  messageId: string;
  senderId: string;
  senderName: string;
  type: string;
  content: string;
  thumbnailUrl?: string;
}

export interface IMessage {
  _id: string;
  chatId: string;
  senderId: IUser | string;
  type: MessageType;
  content: string;
  attachments?: IAttachment[];
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  contact?: {
    name: string;
    phoneNumber: string;
    avatarUrl?: string;
  };
  replyTo?: IReplyPreview;
  isForwarded?: boolean;
  forwardCount?: number;
  status: MessageDeliveryStatus;
  reactions: { userId: string; emoji: string; createdAt: string }[];
  readBy: { userId: string; readAt: string }[];
  deliveredTo: { userId: string; deliveredAt: string }[];
  isStarredBy: string[];
  isPinned: boolean;
  isEdited: boolean;
  isDeletedForEveryone: boolean;
  deletedForUserIds: string[];
  clientMsgId?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IChatMember {
  userId: string;
  role: 'owner' | 'admin' | 'member';
  unreadCount: number;
  isPinned: boolean;
  isArchived: boolean;
  isMuted: boolean;
  customWallpaper?: string;
}

export interface IChat {
  _id: string;
  type: 'direct' | 'group' | 'channel_comments';
  name?: string;
  description?: string;
  avatarUrl?: string;
  inviteCode?: string;
  participants: IUser[];
  membersMeta: IChatMember[];
  lastMessage?: IMessage;
  lastMessageAt: string;
  groupSettings?: {
    onlyAdminsCanSend: boolean;
    onlyAdminsCanEditInfo: boolean;
    approveNewMembers: boolean;
    announcementOnly: boolean;
  };
  disappearingConfig?: {
    enabled: boolean;
    durationSeconds: number;
  };
  createdBy: string;
}

export interface ICall {
  _id: string;
  callType: 'voice' | 'video';
  status: 'initiated' | 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed' | 'busy';
  direction: 'incoming' | 'outgoing';
  isMissed: boolean;
  otherParty: IUser;
  durationSeconds: number;
  createdAt: string;
}

export interface IStatus {
  _id: string;
  userId: IUser;
  type: 'text' | 'image' | 'video';
  content: string;
  caption?: string;
  backgroundColor?: string;
  fontFamily?: string;
  durationSeconds?: number;
  views: { userId: IUser; viewedAt: string }[];
  reactions: { userId: string; emoji: string }[];
  expiresAt: string;
  createdAt: string;
}

export interface IStatusFeedGroup {
  user: IUser;
  statuses: IStatus[];
  allSeen: boolean;
  latestStatusAt: string;
}
