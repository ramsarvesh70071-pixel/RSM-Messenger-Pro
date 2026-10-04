export type PrivacyLevel = 'everyone' | 'contacts' | 'nobody';

export interface IPrivacySettings {
  lastSeen: PrivacyLevel;
  online: PrivacyLevel;
  profilePhoto: PrivacyLevel;
  about: PrivacyLevel;
  status: PrivacyLevel;
  readReceipts: boolean;
  allowGroupAdd: PrivacyLevel;
  allowCalls: PrivacyLevel;
}

export interface IUser {
  _id: string;
  phoneNumber: string;
  countryCode: string;
  name: string;
  username?: string;
  about: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastSeen: Date | string;
  isSuspended: boolean;
  role: 'user' | 'admin' | 'moderator';
  privacySettings: IPrivacySettings;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface IDevice {
  _id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  deviceType: 'ios' | 'android' | 'web' | 'desktop';
  pushToken?: string;
  lastActive: Date | string;
  ipAddress?: string;
  userAgent?: string;
  isCurrent?: boolean;
}

export interface ISession {
  _id: string;
  userId: string;
  deviceId: string;
  refreshTokenHash: string;
  isValid: boolean;
  expiresAt: Date | string;
  createdAt: Date | string;
}

export interface IContact {
  _id: string;
  userId: string;
  contactUserId?: string;
  name: string;
  phoneNumber: string;
  isRegistered: boolean;
  avatarUrl?: string;
  about?: string;
}

export interface IBlockedUser {
  _id: string;
  userId: string;
  blockedUserId: string;
  createdAt: Date | string;
}
