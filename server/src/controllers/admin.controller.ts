import mongoose from 'mongoose';
import { Response } from 'express';
import { User, Message, Chat, Call, Report, Device, Status, Contact, Block, AuditLog, Notification } from '../models';
import { SessionService } from '../services/session.service';
import { SocketEmitter } from '../services/socket-emitter.service';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class AdminController {
  // Helper to record administrative audit log
  private static async logAudit(
    req: AuthenticatedRequest,
    action: string,
    targetId?: string,
    targetType?: string,
    details?: any
  ): Promise<void> {
    try {
      await AuditLog.create({
        adminId: req.user._id,
        action,
        targetId,
        targetType,
        details,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
      });
    } catch (err) {
      console.error('[AdminController] Failed to record audit log:', err);
    }
  }

  // 1. Dashboard Statistics (Real storage aggregation)
  static async getDashboardStats(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        totalUsers,
        activeUsersToday,
        totalMessages,
        totalCalls,
        pendingReports,
        totalGroups,
        storageAgg
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ lastSeen: { $gte: today } }),
        Message.countDocuments(),
        Call.countDocuments(),
        Report.countDocuments({ status: 'pending' }),
        Chat.countDocuments({ type: 'group' }),
        Message.aggregate([
          { $unwind: '$attachments' },
          { $group: { _id: null, totalBytes: { $sum: '$attachments.fileSize' } } }
        ])
      ]);

      const totalStorageBytes = storageAgg[0]?.totalBytes || 0;
      const totalStorageMb = Math.round((totalStorageBytes / (1024 * 1024)) * 100) / 100;

      const stats = {
        totalUsers,
        activeUsersToday,
        totalMessages,
        totalCalls,
        pendingReports,
        totalGroups,
        storageStats: {
          totalStorageBytes,
          totalStorageMb,
          storageDriver: process.env.STORAGE_DRIVER || 'local'
        }
      };

      sendSuccess(res, stats, 'Admin dashboard stats retrieved');
    } catch (error) {
      sendError(res, 'Failed to fetch admin stats', 500);
    }
  }

  // 2. User List for Admin
  static async getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { search, page = '1', limit = '20', role, status } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      const query: any = {};
      if (search) {
        query.$or = [
          { name: { $regex: search as string, $options: 'i' } },
          { phoneNumber: { $regex: search as string, $options: 'i' } },
          { username: { $regex: search as string, $options: 'i' } }
        ];
      }

      if (role) query.role = role;
      if (status === 'suspended') query.isSuspended = true;
      if (status === 'active') query.isSuspended = false;

      const total = await User.countDocuments(query);
      const users = await User.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

      sendSuccess(res, users, 'Users retrieved', 200, {
        page: pageNum,
        limit: limitNum,
        total,
        hasMore: pageNum * limitNum < total
      });
    } catch (error) {
      sendError(res, 'Failed to fetch users', 500);
    }
  }

  // 3. User Details Page (Devices, Reports, Activity summary)
  static async getUserDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const targetUser = await User.findById(id);
      if (!targetUser) {
        sendError(res, 'User not found', 404);
        return;
      }

      const [devices, reports, chatCount, callCount] = await Promise.all([
        Device.find({ userId: id }),
        Report.find({ targetId: id, targetType: 'user' }).populate('reporterId', 'name phoneNumber'),
        Chat.countDocuments({ participants: id }),
        Call.countDocuments({ $or: [{ caller: id }, { receiver: id }] })
      ]);

      sendSuccess(
        res,
        {
          user: targetUser,
          devices,
          reports,
          activity: {
            totalChats: chatCount,
            totalCalls: callCount
          }
        },
        'User details retrieved'
      );
    } catch (error) {
      sendError(res, 'Failed to fetch user details', 500);
    }
  }

  // 4. Suspend / Unsuspend User with Admin Safety
  static async toggleSuspendUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { isSuspended, suspend, reason = 'Administrative action', durationDays } = req.body;
      const shouldSuspend = isSuspended !== undefined ? Boolean(isSuspended) : Boolean(suspend);

      if (id === req.user._id.toString()) {
        sendError(res, 'Admin safety violation: You cannot suspend your own account', 400);
        return;
      }

      const targetUser = await User.findById(id);
      if (!targetUser) {
        sendError(res, 'User not found', 404);
        return;
      }

      if (targetUser.role === 'admin') {
        sendError(res, 'Admin safety violation: Cannot suspend another administrator', 403);
        return;
      }

      targetUser.isSuspended = shouldSuspend;
      await targetUser.save();

      if (shouldSuspend) {
        // Kill all active sessions & disconnect sockets immediately
        await SessionService.revokeAllUserSessions(targetUser._id.toString());
      }

      await AdminController.logAudit(req, shouldSuspend ? 'user_suspend' : 'user_unsuspend', id, 'user', {
        reason,
        durationDays
      });

      sendSuccess(res, targetUser, shouldSuspend ? 'User suspended and sessions terminated' : 'User unsuspended');
    } catch (error) {
      sendError(res, 'Failed to update user suspension status', 500);
    }
  }

  // 5. Delete User with Admin Safety and Cascading Cleanup
  static async deleteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (id === req.user._id.toString()) {
        sendError(res, 'Admin safety violation: You cannot delete your own account', 400);
        return;
      }

      const targetUser = await User.findById(id);
      if (!targetUser) {
        sendError(res, 'User not found', 404);
        return;
      }

      if (targetUser.role === 'admin') {
        sendError(res, 'Admin safety violation: Cannot delete another administrator', 403);
        return;
      }

      // 1. Invalidate sessions and kill live sockets
      await SessionService.revokeAllUserSessions(id);
      await Device.deleteMany({ userId: id });

      // 2. Anonymize user messages
      await Message.updateMany(
        { senderId: id },
        {
          content: 'This message was sent by a deleted account',
          senderName: 'Deleted account'
        }
      );

      // 3. Remove user from all chat participants & group admin lists
      await Chat.updateMany(
        { participants: id },
        {
          $pull: { participants: id, admins: id }
        }
      );

      // 4. Delete statuses, contacts, blocks
      await Status.deleteMany({ userId: id });
      await Contact.deleteMany({ $or: [{ userId: id }, { contactUserId: id }] });
      await Block.deleteMany({ $or: [{ userId: id }, { blockedUserId: id }] });

      // 5. Delete User record
      await User.findByIdAndDelete(id);

      await AdminController.logAudit(req, 'user_delete', id, 'user', { deletedUserName: targetUser.name });

      sendSuccess(res, null, 'User and associated sessions deleted successfully');
    } catch (error) {
      sendError(res, 'Failed to delete user', 500);
    }
  }

  // 6. Get Abuse Reports
  static async getReports(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { status } = req.query;
      const query: any = {};
      if (status) query.status = status;

      const reports = await Report.find(query)
        .populate('reporterId', 'name phoneNumber avatarUrl')
        .populate('targetId')
        .populate('reviewedBy', 'name')
        .sort({ createdAt: -1 });

      sendSuccess(res, reports, 'Reports retrieved');
    } catch (error) {
      sendError(res, 'Failed to fetch reports', 500);
    }
  }

  // 7. Resolve / Dismiss Report
  static async resolveReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status, action = 'none', adminNotes } = req.body;

      const report = await Report.findById(id);
      if (!report) {
        sendError(res, 'Report not found', 404);
        return;
      }

      report.status = status;
      report.actionTaken = action;
      report.adminNotes = adminNotes;
      report.reviewedBy = req.user._id;
      report.reviewedAt = new Date();
      await report.save();

      // Execute action if requested
      if (action === 'suspend_user' && report.targetType === 'user') {
        const target = await User.findById(report.targetId);
        if (target && target.role !== 'admin') {
          target.isSuspended = true;
          await target.save();
          await SessionService.revokeAllUserSessions(target._id.toString());
        }
      } else if (action === 'delete_message' && report.targetType === 'message') {
        await Message.findByIdAndUpdate(report.targetId, {
          content: 'This message was removed by administration for policy violation',
          isDeletedForEveryone: true
        });
      }

      await AdminController.logAudit(req, 'report_resolve', id, 'report', { action, status, adminNotes });

      sendSuccess(res, report, 'Report status updated');
    } catch (error) {
      sendError(res, 'Failed to resolve report', 500);
    }
  }

  // 8. Broadcast Announcement
  static async broadcastAnnouncement(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { title, content } = req.body;
      if (!title || !content) {
        sendError(res, 'Title and content are required', 400);
        return;
      }

      const activeUsers = await User.find({ isSuspended: false }).select('_id');
      const notifications = activeUsers.map((u) => ({
        recipientId: u._id,
        senderId: req.user._id,
        type: 'system',
        title: title.trim(),
        body: content.trim()
      }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }

      await AdminController.logAudit(req, 'broadcast_announcement', undefined, 'system', {
        title,
        recipientsCount: activeUsers.length
      });

      sendSuccess(res, { recipientsCount: activeUsers.length }, 'Announcement broadcasted successfully');
    } catch (error) {
      sendError(res, 'Failed to broadcast announcement', 500);
    }
  }

  // 9. Get Audit Logs
  static async getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '50' } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      const total = await AuditLog.countDocuments();
      const logs = await AuditLog.find()
        .populate('adminId', 'name phoneNumber avatarUrl role')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

      sendSuccess(res, logs, 'Audit logs retrieved', 200, {
        page: pageNum,
        limit: limitNum,
        total,
        hasMore: pageNum * limitNum < total
      });
    } catch (error) {
      sendError(res, 'Failed to fetch audit logs', 500);
    }
  }

  // 10. Get System Health with real MongoDB ping & socket metrics
  static async getSystemHealth(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();
      const isMongoConnected = mongoose.connection.readyState === 1;

      let mongoPingMs = -1;
      if (isMongoConnected && mongoose.connection.db) {
        try {
          const start = Date.now();
          await mongoose.connection.db.admin().ping();
          mongoPingMs = Date.now() - start;
        } catch {
          mongoPingMs = -1;
        }
      }

      const connectedSockets = SocketEmitter.getConnectedSocketsCount();

      sendSuccess(
        res,
        {
          status: 'UP',
          uptimeSeconds: Math.floor(uptime),
          memoryMb: Math.round(memoryUsage.rss / (1024 * 1024)),
          database: isMongoConnected ? 'connected' : 'disconnected',
          mongoPingMs,
          connectedSockets,
          nodeVersion: process.version,
          platform: process.platform
        },
        'System health retrieved'
      );
    } catch (error) {
      sendError(res, 'Failed to fetch system health', 500);
    }
  }
}
