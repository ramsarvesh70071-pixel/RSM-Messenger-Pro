import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import contactRoutes from './contact.routes';
import chatRoutes from './chat.routes';
import messageRoutes from './message.routes';
import groupRoutes from './group.routes';
import statusRoutes from './status.routes';
import callRoutes from './call.routes';
import mediaRoutes from './media.routes';
import deviceRoutes from './device.routes';
import communityRoutes from './community.routes';
import channelRoutes from './channel.routes';
import reportRoutes from './report.routes';
import adminRoutes from './admin.routes';
import { Notification } from '../models';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { sendSuccess } from '../utils/response';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/contacts', contactRoutes);
router.use('/chats', chatRoutes);
router.use('/messages', messageRoutes);
router.use('/groups', groupRoutes);
router.use('/status', statusRoutes);
router.use('/calls', callRoutes);
router.use('/media', mediaRoutes);
router.use('/devices', deviceRoutes);
router.use('/communities', communityRoutes);
router.use('/channels', channelRoutes);
router.use('/reports', reportRoutes);
router.use('/admin', adminRoutes);

// Direct /privacy route alias
router.use('/privacy', userRoutes);

// Notifications route
router.get('/notifications', authenticate, async (req: AuthenticatedRequest, res) => {
  const notifications = await Notification.find({ recipientId: req.user._id }).sort({ createdAt: -1 }).limit(50);
  sendSuccess(res, notifications, 'Notifications retrieved');
});

router.post('/notifications/read-all', authenticate, async (req: AuthenticatedRequest, res) => {
  await Notification.updateMany({ recipientId: req.user._id, isRead: false }, { $set: { isRead: true } });
  sendSuccess(res, null, 'Notifications marked as read');
});

export default router;
