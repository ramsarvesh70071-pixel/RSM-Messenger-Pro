import { Response } from 'express';
import { Report } from '../models';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class ReportController {
  static async createReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { targetType, targetId, reason, details = '', evidenceUrls = [] } = req.body;
      if (!targetType || !targetId || !reason) {
        sendError(res, 'targetType, targetId, and reason are required', 400);
        return;
      }

      const report = await Report.create({
        reporterId: req.user._id,
        targetType,
        targetId,
        reason,
        details,
        evidenceUrls,
        status: 'pending'
      });

      sendSuccess(res, report, 'Report submitted for review', 201);
    } catch (error) {
      sendError(res, 'Failed to submit report', 500);
    }
  }
}
