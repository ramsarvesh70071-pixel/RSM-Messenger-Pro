import { Response } from 'express';
import { Status, Contact, BlockedUser, Chat, Message } from '../models';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { assertStatusAccess } from '../utils/auth-guards';
import { SocketEmitter } from '../services/socket-emitter.service';

export class StatusController {
  // 1. Create Status (Text, Image, Video)
  static async createStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const rawContent = req.body.content || req.body.text || req.body.mediaUrl;
      const rawType = req.body.type || (req.body.mediaUrl ? 'image' : 'text');
      const {
        caption = '',
        backgroundColor = '#075E54',
        fontFamily = 'System',
        durationSeconds = 5,
        privacy = 'contacts',
        allowedUserIds = [],
        excludedUserIds = []
      } = req.body;

      if (!rawContent || rawContent.trim() === '') {
        sendError(res, 'Content is required for status', 400);
        return;
      }

      // Default 24 hours expiration
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const status = await Status.create({
        userId: req.user._id,
        type: rawType,
        content: rawContent.trim(),
        caption,
        backgroundColor,
        fontFamily,
        durationSeconds,
        privacy,
        allowedUserIds,
        excludedUserIds,
        expiresAt,
        views: [],
        reactions: []
      });

      // Real-time: tell everyone who shares a chat with the author or has them as a contact
      try {
        const authorId = req.user._id.toString();
        const [chats, contactRows] = await Promise.all([
          Chat.find({ participants: req.user._id }).select('participants'),
          Contact.find({ contactUserId: req.user._id }).select('userId')
        ]);
        const audience = new Set<string>();
        chats.forEach((c) => c.participants.forEach((p) => audience.add(p.toString())));
        contactRows.forEach((c) => audience.add(c.userId.toString()));
        audience.delete(authorId);
        audience.forEach((uid) => SocketEmitter.emitToUser(uid, 'status:new', { userId: authorId }));
        SocketEmitter.emitToUser(authorId, 'status:new', { userId: authorId });
      } catch (emitErr) {
        console.warn('[Status] realtime emit failed:', emitErr);
      }

      sendSuccess(res, status, 'Status posted successfully', 201);
    } catch (error) {
      sendError(res, 'Failed to post status', 500);
    }
  }

  // 2. Get Status Feed (Statuses from contacts and mutual chat participants)
  static async getFeedStatuses(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Find user contacts
      const contacts = await Contact.find({ userId: req.user._id, isRegistered: true }).select('contactUserId');
      const contactUserIds: string[] = contacts
        .map((c) => c.contactUserId?.toString())
        .filter((id): id is string => Boolean(id));

      // Find mutual chat participants so feed is not empty even without contact sync
      const userChats = await Chat.find({ participants: req.user._id }).select('participants');
      const chatParticipantIds: string[] = userChats
        .flatMap((c) => c.participants.map((p) => p.toString()))
        .filter((id) => id !== req.user._id.toString());

      const allCandidateIds: string[] = Array.from(new Set([...contactUserIds, ...chatParticipantIds]));

      // Exclude blocked users
      const blocked = await BlockedUser.find({
        $or: [{ userId: req.user._id }, { blockedUserId: req.user._id }]
      });
      const blockedUserIds = new Set<string>(
        blocked.map((b) => (b.userId.toString() === req.user._id.toString() ? b.blockedUserId.toString() : b.userId.toString()))
      );

      const eligibleUserIds = allCandidateIds.filter((id) => !blockedUserIds.has(id));

      const statuses = await Status.find({
        userId: { $in: eligibleUserIds },
        expiresAt: { $gt: new Date() }
      })
        .populate('userId', 'name phoneNumber avatarUrl')
        .sort({ createdAt: -1 });

      // Filter by privacy settings
      const visibleStatuses = statuses.filter((st) => {
        if (st.privacy === 'everyone' || st.privacy === 'contacts') return true;
        if (st.privacy === 'only-share-with') {
          return st.allowedUserIds?.some((id: any) => id.toString() === req.user._id.toString());
        }
        if (st.privacy === 'except') {
          return !st.excludedUserIds?.some((id: any) => id.toString() === req.user._id.toString());
        }
        return false;
      });

      // Group statuses by user
      const userStatusMap = new Map();
      visibleStatuses.forEach((st) => {
        const uId = (st.userId as any)._id.toString();
        if (!userStatusMap.has(uId)) {
          userStatusMap.set(uId, {
            user: st.userId,
            statuses: [],
            allSeen: true,
            latestStatusAt: st.createdAt
          });
        }
        const userGroup = userStatusMap.get(uId);
        userGroup.statuses.push(st);

        const hasSeen = st.views.some((v) => v.userId.toString() === req.user._id.toString());
        if (!hasSeen) {
          userGroup.allSeen = false;
        }
      });

      sendSuccess(res, Array.from(userStatusMap.values()), 'Status feed retrieved');
    } catch (error) {
      sendError(res, 'Failed to fetch status feed', 500);
    }
  }

  // 3. Get My Statuses (With viewer details)
  static async getMyStatuses(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const myStatuses = await Status.find({
        userId: req.user._id,
        expiresAt: { $gt: new Date() }
      })
        .populate('views.userId', 'name phoneNumber avatarUrl')
        .populate('reactions.userId', 'name avatarUrl')
        .sort({ createdAt: -1 });

      sendSuccess(res, myStatuses, 'My statuses retrieved');
    } catch (error) {
      sendError(res, 'Failed to fetch your statuses', 500);
    }
  }

  // 4. View a status (Record seen with read receipt check & IDOR protection)
  static async viewStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const status = await assertStatusAccess(id, req.user._id.toString());

      // Check if current user has read receipts enabled
      if (req.user.privacySettings?.readReceipts !== false) {
        const alreadyViewed = status.views.some((v) => v.userId.toString() === req.user._id.toString());
        if (!alreadyViewed) {
          status.views.push({
            userId: req.user._id,
            viewedAt: new Date()
          });
          await status.save();

          // Live view-count event to status author
          SocketEmitter.emitToUser(status.userId.toString(), 'status:view', {
            statusId: status._id,
            viewerId: req.user._id,
            viewerName: req.user.name,
            viewCount: status.views.length
          });
        }
      }

      sendSuccess(res, null, 'Status viewed');
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
        return;
      }
      sendError(res, 'Failed to record status view', 500);
    }
  }

  // 5. Reply to a status (Creates a quoted chat message)
  static async replyToStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { content } = req.body;

      if (!content || !content.trim()) {
        sendError(res, 'Reply message content is required', 400);
        return;
      }

      const status = await assertStatusAccess(id, req.user._id.toString());
      const targetUserId = status.userId.toString();

      // Find or create direct chat
      let directChat = await Chat.findOne({
        type: 'direct',
        participants: { $all: [req.user._id, targetUserId], $size: 2 }
      });

      if (!directChat) {
        directChat = await Chat.create({
          type: 'direct',
          participants: [req.user._id, targetUserId],
          membersMeta: [
            { userId: req.user._id, role: 'member', unreadCount: 0 },
            { userId: targetUserId, role: 'member', unreadCount: 1 }
          ],
          createdBy: req.user._id
        });
        SocketEmitter.joinUserToChat(req.user._id.toString(), directChat._id.toString());
        SocketEmitter.joinUserToChat(targetUserId, directChat._id.toString());
      }

      const replyContent = status.caption || (status.type === 'text' ? status.content : `[${status.type} Status]`);

      const message = await Message.create({
        chatId: directChat._id,
        senderId: req.user._id,
        type: 'text',
        content: content.trim(),
        replyTo: {
          messageId: status._id,
          content: replyContent,
          senderName: 'Status Update'
        },
        status: 'sent'
      });

      directChat.lastMessage = message._id as any;
      directChat.lastMessageAt = new Date();
      await directChat.save();

      const populatedMessage = await Message.findById(message._id)
        .populate('senderId', 'name phoneNumber avatarUrl');

      SocketEmitter.emitToChat(directChat._id.toString(), 'message:new', populatedMessage);

      sendSuccess(res, { chat: directChat, message: populatedMessage }, 'Reply sent successfully', 201);
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
        return;
      }
      sendError(res, 'Failed to send reply to status', 500);
    }
  }

  // 6. React to a status (IDOR protected, one reaction per user)
  static async reactToStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { emoji } = req.body;

      if (!emoji) {
        sendError(res, 'Emoji is required', 400);
        return;
      }

      const status = await assertStatusAccess(id, req.user._id.toString());

      const existingIndex = status.reactions.findIndex((r) => r.userId.toString() === req.user._id.toString());
      if (existingIndex > -1) {
        status.reactions[existingIndex].emoji = emoji;
        status.reactions[existingIndex].createdAt = new Date();
      } else {
        status.reactions.push({
          userId: req.user._id,
          emoji,
          createdAt: new Date()
        });
      }

      await status.save();
      sendSuccess(res, status.reactions, 'Reaction added to status');
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
        return;
      }
      sendError(res, 'Failed to react to status', 500);
    }
  }

  // 7. Delete a status
  static async deleteStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await Status.findOneAndDelete({ _id: id, userId: req.user._id });
      sendSuccess(res, null, 'Status deleted successfully');
    } catch (error) {
      sendError(res, 'Failed to delete status', 500);
    }
  }
}
