import { Response } from 'express';
import { Message, Chat, BlockedUser } from '../models';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { PushService } from '../services/push.service';
import { SocketEmitter } from '../services/socket-emitter.service';
import { assertChatMember, assertMessageAccess, ForbiddenError } from '../utils/auth-guards';
import { escapeRegex } from '../utils/regex';

export class MessageController {
  // 1. Get messages for a chat with cursor pagination (before=<messageId>&limit=30)
  static async getMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { chatId } = req.params;
      const { before, limit = '30' } = req.query;
      const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 30, 1), 100);

      // Verify membership (IDOR guard)
      const chat = await assertChatMember(chatId, req.user._id.toString());

      // Check member's clearedAt timestamp
      const memberMeta = chat.membersMeta.find((m) => m.userId.toString() === req.user._id.toString());
      const clearedAt = memberMeta?.clearedAt;

      const query: any = {
        chatId,
        deletedForUserIds: { $ne: req.user._id }
      };

      if (clearedAt) {
        query.createdAt = { $gt: clearedAt };
      }

      if (before) {
        if (typeof before === 'string' && before.length === 24) {
          query._id = { $lt: before };
        } else {
          query.createdAt = { ...query.createdAt, $lt: new Date(before as string) };
        }
      }

      // Fetch one extra to know if hasMore is true
      const messages = await Message.find(query)
        .populate('senderId', 'name phoneNumber avatarUrl')
        .populate('reactions.userId', 'name avatarUrl')
        .sort({ _id: -1 })
        .limit(limitNum + 1);

      const hasMore = messages.length > limitNum;
      if (hasMore) {
        messages.pop();
      }

      // Reverse to chronological order (oldest to newest) for client display
      messages.reverse();

      sendSuccess(
        res,
        messages,
        'Messages retrieved',
        200,
        {
          hasMore,
          limit: limitNum,
          nextCursor: messages.length > 0 ? messages[0]._id : null
        }
      );
    } catch (error: any) {
      const status = error instanceof ForbiddenError ? error.statusCode : 500;
      sendError(res, error.message || 'Failed to fetch messages', status);
    }
  }

  // 2. Send Message (Server-Authoritative)
  static async sendMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        chatId,
        type = 'text',
        content = '',
        attachments,
        mediaUrl,
        location,
        contact,
        replyTo,
        replyToId,
        clientMsgId
      } = req.body;

      // IDOR check: Sender must be an active chat participant
      const chat = await assertChatMember(chatId, req.user._id.toString());

      // Group permission check: onlyAdminsCanSend
      if (chat.type === 'group' && chat.groupSettings?.onlyAdminsCanSend) {
        const memberMeta = chat.membersMeta.find((m) => m.userId.toString() === req.user._id.toString());
        if (memberMeta?.role !== 'admin' && memberMeta?.role !== 'owner') {
          sendError(res, 'Only admins are permitted to send messages in this group', 403);
          return;
        }
      }

      // Direct chat blocked check
      if (chat.type === 'direct') {
        const otherParticipant = chat.participants.find((p) => p.toString() !== req.user._id.toString());
        if (otherParticipant) {
          const isBlocked = await BlockedUser.findOne({
            $or: [
              { userId: req.user._id, blockedUserId: otherParticipant },
              { userId: otherParticipant, blockedUserId: req.user._id }
            ]
          });
          if (isBlocked) {
            sendError(res, 'Message could not be delivered due to blocking', 403);
            return;
          }
        }
      }

      // Normalize attachments (accept fileName/fileSize and legacy filename/sizeBytes) so metadata isn't lost
      let finalAttachments = (attachments || []).map((a: any) => ({
        url: a.url,
        thumbnailUrl: a.thumbnailUrl || '',
        mimeType: a.mimeType || 'application/octet-stream',
        fileName: a.fileName || a.filename || '',
        fileSize: a.fileSize ?? a.sizeBytes ?? 0,
        duration: a.duration ?? 0,
        width: a.width,
        height: a.height,
        waveform: a.waveform || []
      }));
      if (mediaUrl && (!finalAttachments || finalAttachments.length === 0)) {
        finalAttachments = [
          {
            url: mediaUrl,
            mimeType:
              type === 'audio'
                ? 'audio/mpeg'
                : type === 'video'
                ? 'video/mp4'
                : type === 'document'
                ? 'application/pdf'
                : 'image/jpeg',
            fileSize: 0,
            fileName: `${type}_attachment`
          }
        ];
      }

      // Check for clientMsgId idempotency (Phase 2.2)
      if (clientMsgId) {
        const existing = await Message.findOne({
          chatId,
          senderId: req.user._id,
          clientMsgId
        })
          .populate('senderId', 'name phoneNumber avatarUrl')
          .populate('replyTo');

        if (existing) {
          sendSuccess(res, existing, 'Message already sent (idempotent)', 200);
          return;
        }
      }

      // Build the reply preview server-side from the real original message (client data is never trusted)
      let replyPreview: any;
      const replyMsgId = replyToId || replyTo?.messageId;
      if (replyMsgId) {
        const original = await Message.findOne({ _id: replyMsgId, chatId }).populate('senderId', 'name');
        if (original) {
          const originalSender: any = original.senderId;
          replyPreview = {
            messageId: original._id,
            senderId: originalSender?._id || original.senderId,
            senderName: originalSender?.name || 'User',
            type: original.type,
            content: original.isDeletedForEveryone ? 'This message was deleted' : (original.content || '').slice(0, 200),
            thumbnailUrl: original.attachments?.[0]?.thumbnailUrl || ''
          };
        }
      }

      // Disappearing message expiration
      let expiresAt: Date | undefined;
      if (chat.disappearingConfig?.enabled && chat.disappearingConfig.durationSeconds > 0) {
        expiresAt = new Date(Date.now() + chat.disappearingConfig.durationSeconds * 1000);
      }

      const message = await Message.create({
        chatId,
        senderId: req.user._id,
        type,
        content: content || (type !== 'text' ? `${type} attachment` : ''),
        attachments: finalAttachments,
        location,
        contact,
        replyTo: replyPreview,
        status: 'sent',
        reactions: [],
        deliveredTo: [],
        readBy: [{ userId: req.user._id, readAt: new Date() }],
        clientMsgId,
        expiresAt
      });

      // Update chat's last message and lastMessageAt
      chat.lastMessage = message._id as any;
      chat.lastMessageAt = new Date();

      // Increment unread count for other members
      chat.membersMeta.forEach((member) => {
        if (member.userId.toString() !== req.user._id.toString()) {
          member.unreadCount = (member.unreadCount || 0) + 1;
        }
      });
      await chat.save();

      const populatedMessage = await Message.findById(message._id)
        .populate('senderId', 'name phoneNumber avatarUrl')
        .populate('replyTo');

      // Server-Authoritative Broadcast over WebSockets
      SocketEmitter.emitToChat(chatId, 'message:new', populatedMessage);
      // Also emit message:receive for legacy mobile client compatibility
      SocketEmitter.emitToChat(chatId, 'message:receive', {
        chatId,
        ...populatedMessage?.toObject()
      });

      // Trigger push notification to other participants (honoring mute, but mentions bypass mute)
      const otherUserIds = chat.participants.filter((p) => p.toString() !== req.user._id.toString());
      const rawMentions: string[] = Array.isArray(req.body.mentions) ? req.body.mentions.map(String) : [];

      for (const recipientId of otherUserIds) {
        const rIdStr = recipientId.toString();
        const memberMeta = chat.membersMeta.find((m) => m.userId.toString() === rIdStr);
        const isMentioned = rawMentions.includes(rIdStr) || (chat.type === 'group' && content.includes(`@${rIdStr}`));

        // Skip push if muted and not mentioned
        if (memberMeta?.isMuted && !isMentioned) {
          continue;
        }

        const notificationTitle =
          isMentioned && chat.type === 'group'
            ? `${req.user.name} mentioned you in ${chat.name}`
            : chat.type === 'group'
            ? `${chat.name} (${req.user.name})`
            : req.user.name;

        PushService.sendPushNotification({
          recipientId: rIdStr,
          senderId: req.user._id.toString(),
          type: 'message',
          title: notificationTitle,
          body: type === 'text' ? content : `Sent a ${type} message`,
          data: { chatId: chat._id.toString(), messageId: message._id.toString() }
        });
      }

      sendSuccess(res, populatedMessage, 'Message sent successfully', 201);
    } catch (error: any) {
      const status = error instanceof ForbiddenError ? error.statusCode : 500;
      sendError(res, error.message || 'Failed to send message', status);
    }
  }

  // 3. Edit Message (Within 15 minutes, author only)
  static async editMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { content } = req.body;

      const { message, chat } = await assertMessageAccess(id, req.user._id.toString());

      if (message.senderId.toString() !== req.user._id.toString()) {
        sendError(res, 'Access denied: You can only edit your own messages', 403);
        return;
      }

      if (message.isDeletedForEveryone) {
        sendError(res, 'Cannot edit a deleted message', 400);
        return;
      }

      // Enforce 15-minute time limit for edits (WhatsApp standard)
      const elapsedMs = Date.now() - new Date(message.createdAt).getTime();
      const MAX_EDIT_TIME_MS = 15 * 60 * 1000;
      if (elapsedMs > MAX_EDIT_TIME_MS) {
        sendError(res, 'Message edit window expired (15 minutes limit)', 400);
        return;
      }

      message.content = content.trim();
      message.isEdited = true;
      message.editedAt = new Date();
      await message.save();

      // Emit server-authoritative edit event
      SocketEmitter.emitToChat(chat._id.toString(), 'message:edit', {
        chatId: chat._id.toString(),
        messageId: message._id,
        content: message.content,
        isEdited: true,
        editedAt: message.editedAt
      });

      sendSuccess(res, message, 'Message edited successfully');
    } catch (error: any) {
      const status = error instanceof ForbiddenError ? error.statusCode : 500;
      sendError(res, error.message || 'Failed to edit message', status);
    }
  }

  // 4. Delete for me (IDOR Protected)
  static async deleteForMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await assertMessageAccess(id, req.user._id.toString());

      await Message.findByIdAndUpdate(id, {
        $addToSet: { deletedForUserIds: req.user._id }
      });

      sendSuccess(res, null, 'Message deleted for you');
    } catch (error: any) {
      const status = error instanceof ForbiddenError ? error.statusCode : 500;
      sendError(res, error.message || 'Failed to delete message', status);
    }
  }

  // 5. Delete for everyone (Author or Group Admin, within 2 days)
  static async deleteForEveryone(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { message, chat } = await assertMessageAccess(id, req.user._id.toString());

      const isAuthor = message.senderId.toString() === req.user._id.toString();
      const isGroupAdmin =
        chat.type === 'group' &&
        (chat.createdBy.toString() === req.user._id.toString() ||
          chat.membersMeta.some(
            (m) => m.userId.toString() === req.user._id.toString() && (m.role === 'admin' || m.role === 'owner')
          ));

      if (!isAuthor && !isGroupAdmin) {
        sendError(res, 'Access denied: Only message author or group admin can delete for everyone', 403);
        return;
      }

      // Enforce 2 days time limit for author delete-for-everyone (WhatsApp standard)
      if (isAuthor && !isGroupAdmin) {
        const elapsedMs = Date.now() - new Date(message.createdAt).getTime();
        const MAX_DELETE_TIME_MS = 2 * 24 * 60 * 60 * 1000;
        if (elapsedMs > MAX_DELETE_TIME_MS) {
          sendError(res, 'Message delete-for-everyone window expired (2 days limit)', 400);
          return;
        }
      }

      message.content = 'This message was deleted';
      message.attachments = [];
      message.location = undefined;
      message.contact = undefined;
      message.isDeletedForEveryone = true;
      await message.save();

      // Emit server-authoritative delete event
      SocketEmitter.emitToChat(chat._id.toString(), 'message:delete', {
        chatId: chat._id.toString(),
        messageId: message._id,
        forEveryone: true
      });

      sendSuccess(res, message, 'Message deleted for everyone');
    } catch (error: any) {
      const status = error instanceof ForbiddenError ? error.statusCode : 500;
      sendError(res, error.message || 'Failed to delete message for everyone', status);
    }
  }

  // 6. React to message (IDOR Protected & Server Emitted)
  static async reactToMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { emoji } = req.body;

      const { message, chat } = await assertMessageAccess(id, req.user._id.toString());

      // Remove any existing reaction from this user
      message.reactions = message.reactions.filter((r) => r.userId.toString() !== req.user._id.toString()) as any;

      if (emoji && emoji.trim() !== '') {
        message.reactions.push({
          userId: req.user._id,
          emoji: emoji.trim(),
          createdAt: new Date()
        });
      }

      await message.save();

      // Server-authoritative reaction event
      SocketEmitter.emitToChat(chat._id.toString(), 'message:reaction', {
        chatId: chat._id.toString(),
        messageId: message._id,
        userId: req.user._id,
        emoji: emoji?.trim() || '',
        reactions: message.reactions
      });

      sendSuccess(res, message.reactions, 'Reaction updated');
    } catch (error: any) {
      const status = error instanceof ForbiddenError ? error.statusCode : 500;
      sendError(res, error.message || 'Failed to update reaction', status);
    }
  }

  // 7. Star / Unstar Message (IDOR Protected)
  static async toggleStarMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { star } = req.body;

      const { message } = await assertMessageAccess(id, req.user._id.toString());

      const update = star
        ? { $addToSet: { isStarredBy: req.user._id } }
        : { $pull: { isStarredBy: req.user._id } };

      const updated = await Message.findByIdAndUpdate(message._id, update, { new: true });
      sendSuccess(res, updated, star ? 'Message starred' : 'Message unstarred');
    } catch (error: any) {
      const status = error instanceof ForbiddenError ? error.statusCode : 500;
      sendError(res, error.message || 'Failed to star/unstar message', status);
    }
  }

  // 8. Get Starred Messages for user (Restricted to chats user still belongs to)
  static async getStarredMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userChats = await Chat.find({ participants: req.user._id }).select('_id');
      const chatIds = userChats.map((c) => c._id);

      const messages = await Message.find({
        isStarredBy: req.user._id,
        chatId: { $in: chatIds },
        deletedForUserIds: { $ne: req.user._id }
      })
        .populate('senderId', 'name phoneNumber avatarUrl')
        .populate('chatId', 'name type')
        .sort({ createdAt: -1 });

      sendSuccess(res, messages, 'Starred messages retrieved');
    } catch (error) {
      sendError(res, 'Failed to fetch starred messages', 500);
    }
  }

  // 9. Pin / Unpin message within chat (IDOR Protected)
  static async togglePinMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { pin } = req.body;

      const { message, chat } = await assertMessageAccess(id, req.user._id.toString());

      message.isPinned = Boolean(pin);
      message.pinnedAt = pin ? new Date() : undefined;
      message.pinnedBy = pin ? req.user._id : undefined;
      await message.save();

      // Emit server pin event
      SocketEmitter.emitToChat(chat._id.toString(), 'message:pin', {
        chatId: chat._id.toString(),
        messageId: message._id,
        isPinned: message.isPinned
      });

      sendSuccess(res, message, pin ? 'Message pinned' : 'Message unpinned');
    } catch (error: any) {
      const status = error instanceof ForbiddenError ? error.statusCode : 500;
      sendError(res, error.message || 'Failed to pin/unpin message', status);
    }
  }

  // 10. Forward Messages (Guarded on source AND target chats, max 5 chats)
  static async forwardMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { messageIds, targetChatIds } = req.body;
      if (!Array.isArray(messageIds) || !Array.isArray(targetChatIds)) {
        sendError(res, 'messageIds and targetChatIds must be arrays', 400);
        return;
      }

      if (targetChatIds.length > 5) {
        sendError(res, 'Messages can only be forwarded to a maximum of 5 chats at once', 400);
        return;
      }

      // 1. Verify user has access to all original messages
      for (const msgId of messageIds) {
        await assertMessageAccess(msgId, req.user._id.toString());
      }

      // 2. Verify user is a member of every target chat
      for (const targetChatId of targetChatIds) {
        await assertChatMember(targetChatId, req.user._id.toString());
      }

      const originalMessages = await Message.find({ _id: { $in: messageIds } });
      const forwardedResults = [];

      for (const targetChatId of targetChatIds) {
        for (const orig of originalMessages) {
          const fwd = await Message.create({
            chatId: targetChatId,
            senderId: req.user._id,
            type: orig.type,
            content: orig.content,
            attachments: orig.attachments,
            location: orig.location,
            contact: orig.contact,
            isForwarded: true,
            forwardCount: (orig.forwardCount || 0) + 1,
            status: 'sent',
            reactions: []
          });

          await Chat.findByIdAndUpdate(targetChatId, {
            lastMessage: fwd._id,
            lastMessageAt: new Date()
          });

          const populatedFwd = await Message.findById(fwd._id).populate('senderId', 'name phoneNumber avatarUrl');
          SocketEmitter.emitToChat(targetChatId, 'message:new', populatedFwd);
          forwardedResults.push(populatedFwd);
        }
      }

      sendSuccess(res, forwardedResults, 'Messages forwarded successfully');
    } catch (error: any) {
      const status = error instanceof ForbiddenError ? error.statusCode : 500;
      sendError(res, error.message || 'Failed to forward messages', status);
    }
  }

  // 11. Search messages with safe regex escaping and strict chat isolation
  static async searchMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { query, chatId } = req.query;
      if (!query || typeof query !== 'string') {
        sendError(res, 'Search query is required', 400);
        return;
      }

      const safeQuery = escapeRegex(query.trim());
      const filter: any = {
        deletedForUserIds: { $ne: req.user._id },
        content: { $regex: safeQuery, $options: 'i' }
      };

      if (chatId) {
        // Enforce membership on the specified chatId
        await assertChatMember(chatId as string, req.user._id.toString());
        filter.chatId = chatId;
      } else {
        // Restrict search strictly to member chats
        const userChats = await Chat.find({ participants: req.user._id }).select('_id');
        filter.chatId = { $in: userChats.map((c) => c._id) };
      }

      const results = await Message.find(filter)
        .populate('senderId', 'name phoneNumber avatarUrl')
        .populate('chatId', 'name type')
        .sort({ createdAt: -1 })
        .limit(50);

      sendSuccess(res, results, 'Search results');
    } catch (error: any) {
      const status = error instanceof ForbiddenError ? error.statusCode : 500;
      sendError(res, error.message || 'Search failed', status);
    }
  }

  // 12. Mark messages as read (Phase 2.1)
  static async markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { chatId, upToMessageId, messageIds } = req.body;
      if (!chatId) {
        sendError(res, 'chatId is required', 400);
        return;
      }

      await assertChatMember(chatId, req.user._id.toString());

      const query: any = {
        chatId,
        senderId: { $ne: req.user._id },
        'readBy.userId': { $ne: req.user._id },
        deletedForUserIds: { $ne: req.user._id }
      };

      if (Array.isArray(messageIds) && messageIds.length > 0) {
        query._id = { $in: messageIds };
      } else if (upToMessageId && typeof upToMessageId === 'string' && upToMessageId.length === 24) {
        query._id = { $lte: upToMessageId };
      }

      const messagesToMark = await Message.find(query).select('_id senderId');
      const readAt = new Date();

      // Reset unread count for the caller in this chat
      await Chat.updateOne(
        { _id: chatId, 'membersMeta.userId': req.user._id },
        { $set: { 'membersMeta.$.unreadCount': 0 } }
      );

      if (messagesToMark.length > 0) {
        const updatedIds = messagesToMark.map((m) => m._id);

        await Message.updateMany(
          { _id: { $in: updatedIds } },
          {
            $addToSet: { readBy: { userId: req.user._id, readAt } },
            $set: { status: 'read' }
          }
        );

        // Check read receipts privacy
        if (req.user.privacySettings?.readReceipts !== false) {
          SocketEmitter.emitToChat(chatId, 'message:status', {
            chatId,
            messageIds: updatedIds,
            status: 'read',
            userId: req.user._id,
            readAt
          });
          SocketEmitter.emitToChat(chatId, 'message:read', {
            chatId,
            messageIds: updatedIds,
            userId: req.user._id,
            readAt
          });
        }
      }

      sendSuccess(res, { markedCount: messagesToMark.length }, 'Messages marked as read');
    } catch (error: any) {
      const status = error instanceof ForbiddenError ? error.statusCode : 500;
      sendError(res, error.message || 'Failed to mark messages as read', status);
    }
  }

  // 13. Mark messages as delivered (Phase 2.1)
  static async markDelivered(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { messageIds } = req.body;
      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        sendError(res, 'messageIds must be a non-empty array', 400);
        return;
      }

      const deliveredAt = new Date();
      await Message.updateMany(
        {
          _id: { $in: messageIds },
          'deliveredTo.userId': { $ne: req.user._id },
          status: { $in: ['pending', 'sent'] }
        },
        {
          $addToSet: { deliveredTo: { userId: req.user._id, deliveredAt } },
          $set: { status: 'delivered' }
        }
      );

      // Emit status updates to relevant chats
      const messages = await Message.find({ _id: { $in: messageIds } }).select('chatId _id');
      const chatGroup = new Map<string, string[]>();
      for (const m of messages) {
        const cId = m.chatId.toString();
        if (!chatGroup.has(cId)) chatGroup.set(cId, []);
        chatGroup.get(cId)!.push(m._id.toString());
      }

      for (const [cId, mIds] of chatGroup.entries()) {
        SocketEmitter.emitToChat(cId, 'message:status', {
          chatId: cId,
          messageIds: mIds,
          status: 'delivered',
          userId: req.user._id,
          deliveredAt
        });
      }

      sendSuccess(res, null, 'Messages marked as delivered');
    } catch (error: any) {
      sendError(res, error.message || 'Failed to mark messages as delivered', 500);
    }
  }

  // 14. Jump to message context (Phase 2.8)
  static async getMessageContext(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { chatId, messageId } = req.params;
      await assertChatMember(chatId, req.user._id.toString());
      await assertMessageAccess(messageId, req.user._id.toString());

      // Fetch 15 messages before and 15 messages after
      const beforeMessages = await Message.find({
        chatId,
        _id: { $lt: messageId },
        deletedForUserIds: { $ne: req.user._id }
      })
        .sort({ _id: -1 })
        .limit(15)
        .populate('senderId', 'name phoneNumber avatarUrl');

      const targetMessage = await Message.findById(messageId)
        .populate('senderId', 'name phoneNumber avatarUrl')
        .populate('replyTo');

      const afterMessages = await Message.find({
        chatId,
        _id: { $gt: messageId },
        deletedForUserIds: { $ne: req.user._id }
      })
        .sort({ _id: 1 })
        .limit(15)
        .populate('senderId', 'name phoneNumber avatarUrl');

      const combined = [
        ...beforeMessages.reverse(),
        targetMessage,
        ...afterMessages
      ].filter(Boolean);

      sendSuccess(res, combined, 'Message context retrieved');
    } catch (error: any) {
      const status = error instanceof ForbiddenError ? error.statusCode : 500;
      sendError(res, error.message || 'Failed to fetch message context', status);
    }
  }
}
