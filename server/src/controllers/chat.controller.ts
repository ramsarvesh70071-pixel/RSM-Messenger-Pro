import { Response } from 'express';
import { Types } from 'mongoose';
import { Chat, Message, User, BlockedUser } from '../models';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { assertChatMember, assertGroupAdmin } from '../utils/auth-guards';
import { SocketEmitter } from '../services/socket-emitter.service';

export class ChatController {
  // 1. Get all chats for the user (with sorting: pinned first, then lastMessageAt desc)
  static async getChats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { archived } = req.query;
      const isArchived = archived === 'true';

      const chats = await Chat.find({
        participants: req.user._id,
        membersMeta: {
          $elemMatch: {
            userId: req.user._id,
            isArchived
          }
        }
      })
        .populate('participants', 'name phoneNumber avatarUrl about isOnline lastSeen')
        .populate({
          path: 'lastMessage',
          populate: { path: 'senderId', select: 'name' }
        })
        .sort({ lastMessageAt: -1 });

      // Sort with pinned first for current user
      const sortedChats = chats.sort((a, b) => {
        const metaA = a.membersMeta.find((m) => m.userId.toString() === req.user._id.toString());
        const metaB = b.membersMeta.find((m) => m.userId.toString() === req.user._id.toString());
        if (metaA?.isPinned && !metaB?.isPinned) return -1;
        if (!metaA?.isPinned && metaB?.isPinned) return 1;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });

      sendSuccess(res, sortedChats, 'Chats retrieved successfully');
    } catch (error) {
      sendError(res, 'Failed to fetch chats', 500);
    }
  }

  // 2. Get or create a 1-to-1 Direct Chat
  static async getOrCreateDirectChat(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const targetUserId = req.body.targetUserId || req.body.recipientId;
      if (!targetUserId || targetUserId === req.user._id.toString()) {
        sendError(res, 'Invalid target user', 400);
        return;
      }

      // Check if target user exists
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        sendError(res, 'Target user not found', 404);
        return;
      }

      // Check if blocked
      const isBlocked = await BlockedUser.findOne({
        $or: [
          { userId: req.user._id, blockedUserId: targetUserId },
          { userId: targetUserId, blockedUserId: req.user._id }
        ]
      });

      // Find existing direct chat
      let chat = await Chat.findOne({
        type: 'direct',
        participants: { $all: [req.user._id, targetUserId], $size: 2 }
      })
        .populate('participants', 'name phoneNumber avatarUrl about isOnline lastSeen')
        .populate('lastMessage');

      let isNew = false;
      if (!chat) {
        isNew = true;
        chat = await Chat.create({
          type: 'direct',
          participants: [req.user._id, targetUserId],
          membersMeta: [
            { userId: req.user._id, role: 'member', unreadCount: 0 },
            { userId: targetUserId, role: 'member', unreadCount: 0 }
          ],
          createdBy: req.user._id
        });

        chat = await Chat.findById(chat._id).populate('participants', 'name phoneNumber avatarUrl about isOnline lastSeen');
      }

      if (chat) {
        // Ensure realtime rooms are joined for both users
        SocketEmitter.joinUserToChat(req.user._id.toString(), chat._id.toString());
        SocketEmitter.joinUserToChat(targetUserId.toString(), chat._id.toString());

        if (isNew) {
          SocketEmitter.emitToUser(req.user._id.toString(), 'chat:new', chat);
          SocketEmitter.emitToUser(targetUserId.toString(), 'chat:new', chat);
        }
      }

      sendSuccess(res, { chat, isBlocked: Boolean(isBlocked) }, 'Chat ready');
    } catch (error) {
      sendError(res, 'Failed to get or create chat', 500);
    }
  }

  // 3. Get single chat details
  static async getChatById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const chat = await Chat.findOne({
        _id: id,
        participants: req.user._id
      })
        .populate('participants', 'name phoneNumber avatarUrl about isOnline lastSeen')
        .populate('lastMessage');

      if (!chat) {
        sendError(res, 'Chat not found or access denied', 404);
        return;
      }

      sendSuccess(res, chat, 'Chat details retrieved');
    } catch (error) {
      sendError(res, 'Failed to fetch chat', 500);
    }
  }

  // 4. Pin / Unpin Chat
  static async togglePinChat(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { pin } = req.body;

      const chat = await Chat.findOneAndUpdate(
        { _id: id, 'membersMeta.userId': req.user._id },
        {
          $set: {
            'membersMeta.$.isPinned': Boolean(pin),
            'membersMeta.$.pinnedAt': pin ? new Date() : undefined
          }
        },
        { new: true }
      );

      sendSuccess(res, chat, pin ? 'Chat pinned' : 'Chat unpinned');
    } catch (error) {
      sendError(res, 'Failed to pin/unpin chat', 500);
    }
  }

  // 5. Archive / Unarchive Chat
  static async toggleArchiveChat(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { archive } = req.body;

      const chat = await Chat.findOneAndUpdate(
        { _id: id, 'membersMeta.userId': req.user._id },
        { $set: { 'membersMeta.$.isArchived': Boolean(archive) } },
        { new: true }
      );

      sendSuccess(res, chat, archive ? 'Chat archived' : 'Chat unarchived');
    } catch (error) {
      sendError(res, 'Failed to archive/unarchive chat', 500);
    }
  }

  // 6. Mute / Unmute Chat
  static async toggleMuteChat(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { mute, durationHours } = req.body;

      const mutedUntil = durationHours ? new Date(Date.now() + durationHours * 3600 * 1000) : undefined;

      const chat = await Chat.findOneAndUpdate(
        { _id: id, 'membersMeta.userId': req.user._id },
        {
          $set: {
            'membersMeta.$.isMuted': Boolean(mute),
            'membersMeta.$.mutedUntil': mutedUntil
          }
        },
        { new: true }
      );

      sendSuccess(res, chat, mute ? 'Chat muted' : 'Chat unmuted');
    } catch (error) {
      sendError(res, 'Failed to mute/unmute chat', 500);
    }
  }

  // 7. Clear chat messages (for current user)
  static async clearChat(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await assertChatMember(id, req.user._id.toString());

      await Chat.findOneAndUpdate(
        { _id: id, 'membersMeta.userId': req.user._id },
        { $set: { 'membersMeta.$.clearedAt': new Date(), 'membersMeta.$.unreadCount': 0 } }
      );

      // Add user to deletedForUserIds for all messages in chat
      await Message.updateMany(
        { chatId: id, deletedForUserIds: { $ne: req.user._id } },
        { $addToSet: { deletedForUserIds: req.user._id } }
      );

      sendSuccess(res, null, 'Chat cleared successfully');
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
        return;
      }
      sendError(res, 'Failed to clear chat', 500);
    }
  }

  // 8. Configure Disappearing Messages
  static async setDisappearingMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { enabled, durationSeconds = 86400 } = req.body;

      const chat = await assertChatMember(id, req.user._id.toString());
      if (chat.type === 'group' && chat.groupSettings?.onlyAdminsCanEditInfo) {
        await assertGroupAdmin(id, req.user._id.toString());
      }

      chat.disappearingConfig = {
        enabled: Boolean(enabled),
        durationSeconds: Number(durationSeconds) || 86400
      };
      await chat.save();

      SocketEmitter.emitToChat(id, 'chat:disappearing_update', {
        chatId: id,
        disappearingConfig: chat.disappearingConfig,
        updatedBy: req.user._id
      });

      sendSuccess(res, chat.disappearingConfig, 'Disappearing messages updated');
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
        return;
      }
      sendError(res, 'Failed to update disappearing messages configuration', 500);
    }
  }

  // 9. Update Chat Wallpaper
  static async updateWallpaper(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { wallpaperUrl } = req.body;

      const chat = await Chat.findOneAndUpdate(
        { _id: id, 'membersMeta.userId': req.user._id },
        { $set: { 'membersMeta.$.customWallpaper': wallpaperUrl || '' } },
        { new: true }
      );

      sendSuccess(res, chat, 'Wallpaper updated successfully');
    } catch (error) {
      sendError(res, 'Failed to update wallpaper', 500);
    }
  }
}
