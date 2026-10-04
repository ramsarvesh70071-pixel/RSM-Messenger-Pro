import { IUser } from './user';

export type ReportTargetType = 'user' | 'message' | 'group' | 'channel';
export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';

export interface IReport {
  _id: string;
  reporterId: string | IUser;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string;
  evidenceUrls?: string[];
  status: ReportStatus;
  reviewedBy?: string | IUser;
  resolutionNotes?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}
