import { IUser } from './user';
import { IChat } from './chat';

export interface ICommunity {
  _id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  creatorId: string | IUser;
  admins: (string | IUser)[];
  announcementChatId: string | IChat;
  groups: (string | IChat)[];
  membersCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}
