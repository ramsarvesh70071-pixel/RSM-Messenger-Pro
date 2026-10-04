import { IUser } from './user';

export type ChatType = 'direct' | 'group' | 'channel_comments';
export type GroupRole = 'owner' | 'admin' | 'member';

export interface IGroupSettings {
  onlyAdminsCanSend: boolean;
  onlyAdminsCanEditInfo: boolean;
  approveNewMembers: boolean;
  announcementOnly: boolean;
}

export interface IDisappearingMessagesConfig {
  enabled: boolean;
  durationSeconds: number; // e.g. 86400 (24h), 604800 (7d), 7776000 (90d)
}

export interface IChatMember {
  userId: string | IUser;
  role: GroupRole;
  joinedAt: Date | string;
  isMuted: boolean;
  mutedUntil?: Date | string;
  isArchived: boolean;
  isPinned: boolean;
  pinnedAt?: Date | string;
  unreadCount: number;
  lastReadMessageId?: string;
  customWallpaper?: string;
}

export interface IChat {
  _id: string;
  type: ChatType;
  name?: string; // For groups
  description?: string;
  avatarUrl?: string;
  inviteCode?: string;
  participants: (string | IUser)[];
  membersMeta: IChatMember[];
  lastMessage?: any;
  lastMessageAt?: Date | string;
  groupSettings?: IGroupSettings;
  disappearingConfig?: IDisappearingMessagesConfig;
  communityId?: string;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}
