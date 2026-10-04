export interface User {
  id: string;
  name: string;
  phone: string;
  username?: string;
  avatar?: string;
  statusMessage?: string;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface Attachment {
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  thumbnailUrl?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact' | 'system';
  status: 'sent' | 'delivered' | 'read' | 'pending';
  createdAt: string;
  clientMsgId?: string;
  attachments?: Attachment[];
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
  reactions?: { [emoji: string]: string[] }; // emoji -> array of userIds
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
  };
  isStarred?: boolean;
  deletedForEveryone?: boolean;
}

export interface Conversation {
  id: string;
  name: string;
  isGroup: boolean;
  avatar?: string;
  description?: string;
  participants: User[];
  lastMessage?: {
    id: string;
    content: string;
    senderName: string;
    createdAt: string;
    type: string;
    status: 'sent' | 'delivered' | 'read' | 'pending';
  };
  unreadCount: number;
  isPinned?: boolean;
  isMuted?: boolean;
  disappearingDuration?: number; // 0 = off, 86400 = 24h, 604800 = 7d, 7776000 = 90d
  updatedAt: string;
}

export interface CallSession {
  id: string;
  caller: User;
  receiver: User;
  type: 'voice' | 'video';
  status: 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed';
  startTime?: number;
  duration?: number;
}

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  mediaUrl?: string;
  mediaType: 'text' | 'image' | 'video';
  caption?: string;
  backgroundColor?: string;
  createdAt: string;
  expiresAt: string;
  viewers: string[];
}
