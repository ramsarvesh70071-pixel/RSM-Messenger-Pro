import { Response } from 'express';
import crypto from 'crypto';
import { Chat, User, Contact, Message } from '../models';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { SocketEmitter } from '../services/socket-emitter.service';
import { PushService } from '../services/push.service';

export class GroupController {
  // 1. Create a new group
  static async createGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, description = '', avatarUrl = '' } = req.body;
      const rawMemberIds = req.body.memberIds || req.body.participantIds || [];

      if (!name || name.trim() === '') {
        sendError(res, 'Group name is required', 400);
        return;
      }

      if (!Array.isArray(rawMemberIds)) {
        sendError(res, 'memberIds must be an array', 400);
        return;
      }

      const allMemberIds = Array.from(new Set([req.user._id.toString(), ...rawMemberIds.map((id: any) => id.toString())]));

      if (allMemberIds.length > 1024) {
        sendError(res, 'Group cannot exceed 1024 members', 400);
        return;
      }

      const membersMeta = allMemberIds.map((userId) => ({
        userId,
        role: userId === req.user._id.toString() ? 'owner' : 'member',
        joinedAt: new Date(),
        isMuted: false,
        isArchived: false,
        isPinned: false,
        unreadCount: 0
      }));

      const inviteCode = crypto.randomBytes(8).toString('hex');

      const group = await Chat.create({
        type: 'group',
        name: name.trim(),
        description: description.trim(),
        avatarUrl,
        inviteCode,
        participants: allMemberIds,
        membersMeta,
        pendingRequests: [],
        createdBy: req.user._id,
        groupSettings: {
          onlyAdminsCanSend: false,
          onlyAdminsCanEditInfo: false,
          approveNewMembers: false,
          announcementOnly: false
        }
      });

      // Join all members to socket room
      for (const memberId of allMemberIds) {
        SocketEmitter.joinUserToChat(memberId, group._id.toString());
      }

      // Create initial system message
      const systemMessage = await Message.create({
        chatId: group._id,
        senderId: req.user._id,
        type: 'system',
        content: `${req.user.name || 'Admin'} created group "${name.trim()}"`,
        status: 'sent'
      });

      group.lastMessage = systemMessage._id as any;
      group.lastMessageAt = new Date();
      await group.save();

      const populatedGroup = await Chat.findById(group._id)
        .populate('participants', 'name phoneNumber avatarUrl about isOnline lastSeen')
        .populate('createdBy', 'name phoneNumber avatarUrl')
        .populate('lastMessage');

      // Notify members via socket
      for (const memberId of allMemberIds) {
        SocketEmitter.emitToUser(memberId, 'chat:new', populatedGroup);
      }

      sendSuccess(res, populatedGroup, 'Group created successfully', 201);
    } catch (error) {
      sendError(res, 'Failed to create group', 500);
    }
  }

  // 2. Update Group Info (Name, Description, Avatar)
  static async updateGroupInfo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, description, avatarUrl } = req.body;

      const group = await Chat.findOne({ _id: id, type: 'group', participants: req.user._id });
      if (!group) {
        sendError(res, 'Group not found or access denied', 404);
        return;
      }

      // Check admin permission if onlyAdminsCanEditInfo is enabled
      if (group.groupSettings?.onlyAdminsCanEditInfo) {
        const memberMeta = group.membersMeta.find((m) => m.userId.toString() === req.user._id.toString());
        if (memberMeta?.role !== 'admin' && memberMeta?.role !== 'owner') {
          sendError(res, 'Only group admins can edit group info', 403);
          return;
        }
      }

      if (name) group.name = name.trim();
      if (description !== undefined) group.description = description.trim();
      if (avatarUrl !== undefined) group.avatarUrl = avatarUrl;

      await group.save();
      SocketEmitter.emitToChat(group._id.toString(), 'chat:updated', { chatId: group._id.toString() });
      sendSuccess(res, group, 'Group information updated');
    } catch (error) {
      sendError(res, 'Failed to update group information', 500);
    }
  }

  // 3. Add Members to Group (respecting allowGroupAdd privacy & push notification)
  static async addMembers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const rawMemberIds = req.body.memberIds || req.body.participantIds || [];

      if (!Array.isArray(rawMemberIds) || rawMemberIds.length === 0) {
        sendError(res, 'memberIds must be a non-empty array', 400);
        return;
      }

      const group = await Chat.findOne({ _id: id, type: 'group', participants: req.user._id });
      if (!group) {
        sendError(res, 'Group not found or access denied', 404);
        return;
      }

      // Check admin role
      const currentMeta = group.membersMeta.find((m) => m.userId.toString() === req.user._id.toString());
      if (currentMeta?.role !== 'admin' && currentMeta?.role !== 'owner') {
        sendError(res, 'Only admins can add members', 403);
        return;
      }

      const rawIds = rawMemberIds
        .map((mid: any) => mid.toString())
        .filter((newUserId: string) => !group.participants.some((p) => p.toString() === newUserId));

      if (group.participants.length + rawIds.length > 1024) {
        sendError(res, 'Group cannot exceed 1024 members', 400);
        return;
      }

      // Check privacy settings (allowGroupAdd) for candidate members
      const candidateUsers = await User.find({ _id: { $in: rawIds } }).select('_id name privacySettings');
      const allowedIds: string[] = [];
      const privacyBlockedIds: string[] = [];

      for (const candidate of candidateUsers) {
        const candId = candidate._id.toString();
        const allowGroupAdd = candidate.privacySettings?.allowGroupAdd || 'everyone';

        if (allowGroupAdd === 'nobody') {
          privacyBlockedIds.push(candId);
          continue;
        }

        if (allowGroupAdd === 'contacts') {
          const isContact = await Contact.findOne({ userId: candId, contactUserId: req.user._id });
          if (!isContact) {
            privacyBlockedIds.push(candId);
            continue;
          }
        }

        allowedIds.push(candId);
      }

      if (allowedIds.length === 0 && privacyBlockedIds.length > 0) {
        sendError(res, 'Cannot add user(s) due to their privacy settings', 403);
        return;
      }

      for (const newUserId of allowedIds) {
        group.participants.push(newUserId as any);
        group.membersMeta.push({
          userId: newUserId as any,
          role: 'member',
          joinedAt: new Date(),
          isMuted: false,
          isArchived: false,
          isPinned: false,
          unreadCount: 0
        } as any);

        SocketEmitter.joinUserToChat(newUserId, group._id.toString());

        // Send push notification: "Added you to group"
        PushService.sendPushNotification({
          recipientId: newUserId,
          senderId: req.user._id,
          type: 'group',
          title: 'Added to group',
          body: `${req.user.name || 'Admin'} added you to group "${group.name}"`,
          data: { chatId: group._id.toString() }
        });
      }

      if (allowedIds.length > 0) {
        const systemMessage = await Message.create({
          chatId: group._id,
          senderId: req.user._id,
          type: 'system',
          content: `${req.user.name || 'Admin'} added ${allowedIds.length} member(s)`,
          status: 'sent'
        });
        group.lastMessage = systemMessage._id as any;
        group.lastMessageAt = new Date();
      }

      await group.save();
      const updated = await Chat.findById(id)
        .populate('participants', 'name phoneNumber avatarUrl about isOnline lastSeen')
        .populate('lastMessage');

      for (const newUserId of allowedIds) {
        SocketEmitter.emitToUser(newUserId, 'chat:new', updated);
      }
      SocketEmitter.emitToChat(group._id.toString(), 'chat:members_added', {
        chatId: group._id,
        newMemberIds: allowedIds,
        addedBy: req.user._id
      });

      sendSuccess(
        res,
        { group: updated, addedCount: allowedIds.length, skippedPrivacyCount: privacyBlockedIds.length },
        'Members processed successfully'
      );
    } catch (error) {
      sendError(res, 'Failed to add members', 500);
    }
  }

  // 4. Remove Member or Leave Group (Ownership transfer when owner leaves)
  static async removeMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id, memberId } = req.params;
      const group = await Chat.findOne({ _id: id, type: 'group', participants: req.user._id });
      if (!group) {
        sendError(res, 'Group not found or access denied', 404);
        return;
      }

      const isSelfLeave = memberId === req.user._id.toString();
      const currentMeta = group.membersMeta.find((m) => m.userId.toString() === req.user._id.toString());

      if (!isSelfLeave && currentMeta?.role !== 'admin' && currentMeta?.role !== 'owner') {
        sendError(res, 'Only admins can remove members', 403);
        return;
      }

      const removingMeta = group.membersMeta.find((m) => m.userId.toString() === memberId);
      const isOwnerLeaving = removingMeta?.role === 'owner';

      group.participants = group.participants.filter((p) => p.toString() !== memberId) as any;
      group.membersMeta = group.membersMeta.filter((m) => m.userId.toString() !== memberId) as any;

      // Handle ownership transfer if owner leaves
      if (isOwnerLeaving && group.membersMeta.length > 0) {
        let newOwner = group.membersMeta.find((m) => m.role === 'admin');
        if (!newOwner) {
          newOwner = group.membersMeta[0];
        }
        if (newOwner) {
          newOwner.role = 'owner';
          group.createdBy = newOwner.userId;
        }
      }

      // Create system message
      const systemMessage = await Message.create({
        chatId: group._id,
        senderId: req.user._id,
        type: 'system',
        content: isSelfLeave ? 'A member left the group' : `${req.user.name || 'Admin'} removed a member`,
        status: 'sent'
      });
      group.lastMessage = systemMessage._id as any;
      group.lastMessageAt = new Date();

      await group.save();

      // Emit BEFORE the removed member leaves the room so their own client also learns about it
      SocketEmitter.emitToChat(group._id.toString(), 'chat:member_removed', {
        chatId: group._id,
        memberId,
        isSelfLeave
      });
      SocketEmitter.emitToUser(memberId, 'chat:member_removed', {
        chatId: group._id,
        memberId,
        isSelfLeave
      });
      SocketEmitter.emitToChat(group._id.toString(), 'message:new', systemMessage);
      SocketEmitter.leaveUserFromChat(memberId, group._id.toString());

      sendSuccess(res, null, isSelfLeave ? 'Left group successfully' : 'Member removed successfully');
    } catch (error) {
      sendError(res, 'Failed to remove member', 500);
    }
  }

  // 5. Promote Member to Admin
  static async promoteAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id, memberId } = req.params;
      const group = await Chat.findOne({ _id: id, type: 'group', participants: req.user._id });
      if (!group) {
        sendError(res, 'Group not found', 404);
        return;
      }

      const currentMeta = group.membersMeta.find((m) => m.userId.toString() === req.user._id.toString());
      if (currentMeta?.role !== 'owner' && currentMeta?.role !== 'admin') {
        sendError(res, 'Only owners/admins can promote members', 403);
        return;
      }

      const targetMeta = group.membersMeta.find((m) => m.userId.toString() === memberId);
      if (targetMeta) {
        targetMeta.role = 'admin';
        await group.save();
      }

      SocketEmitter.emitToChat(group._id.toString(), 'chat:updated', { chatId: group._id.toString() });
      sendSuccess(res, group, 'Member promoted to admin');
    } catch (error) {
      sendError(res, 'Failed to promote member', 500);
    }
  }

  // 6. Demote Admin to Member
  static async demoteAdmin(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id, memberId } = req.params;
      const group = await Chat.findOne({ _id: id, type: 'group', participants: req.user._id });
      if (!group) {
        sendError(res, 'Group not found', 404);
        return;
      }

      const currentMeta = group.membersMeta.find((m) => m.userId.toString() === req.user._id.toString());
      if (currentMeta?.role !== 'owner') {
        sendError(res, 'Only group owner can demote admins', 403);
        return;
      }

      const targetMeta = group.membersMeta.find((m) => m.userId.toString() === memberId);
      if (targetMeta && targetMeta.role !== 'owner') {
        targetMeta.role = 'member';
        await group.save();
      }

      SocketEmitter.emitToChat(group._id.toString(), 'chat:updated', { chatId: group._id.toString() });
      sendSuccess(res, group, 'Admin demoted to member');
    } catch (error) {
      sendError(res, 'Failed to demote admin', 500);
    }
  }

  // 7. Update Group Settings (onlyAdminsCanSend, approveNewMembers, etc.)
  static async updateGroupSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { onlyAdminsCanSend, onlyAdminsCanEditInfo, approveNewMembers, announcementOnly } = req.body;

      const group = await Chat.findOne({ _id: id, type: 'group', participants: req.user._id });
      if (!group) {
        sendError(res, 'Group not found', 404);
        return;
      }

      const currentMeta = group.membersMeta.find((m) => m.userId.toString() === req.user._id.toString());
      if (currentMeta?.role !== 'owner' && currentMeta?.role !== 'admin') {
        sendError(res, 'Only admins can modify group settings', 403);
        return;
      }

      if (!group.groupSettings) {
        group.groupSettings = {
          onlyAdminsCanSend: false,
          onlyAdminsCanEditInfo: false,
          approveNewMembers: false,
          announcementOnly: false
        };
      }

      if (onlyAdminsCanSend !== undefined) group.groupSettings.onlyAdminsCanSend = Boolean(onlyAdminsCanSend);
      if (onlyAdminsCanEditInfo !== undefined) group.groupSettings.onlyAdminsCanEditInfo = Boolean(onlyAdminsCanEditInfo);
      if (approveNewMembers !== undefined) group.groupSettings.approveNewMembers = Boolean(approveNewMembers);
      if (announcementOnly !== undefined) group.groupSettings.announcementOnly = Boolean(announcementOnly);

      await group.save();
      SocketEmitter.emitToChat(group._id.toString(), 'chat:updated', { chatId: group._id.toString() });
      sendSuccess(res, group.groupSettings, 'Group settings updated');
    } catch (error) {
      sendError(res, 'Failed to update group settings', 500);
    }
  }

  // 8. Reset Invite Link
  static async resetInviteLink(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const group = await Chat.findOne({ _id: id, type: 'group', participants: req.user._id });
      if (!group) {
        sendError(res, 'Group not found', 404);
        return;
      }

      const currentMeta = group.membersMeta.find((m) => m.userId.toString() === req.user._id.toString());
      if (currentMeta?.role !== 'owner' && currentMeta?.role !== 'admin') {
        sendError(res, 'Only admins can reset invite link', 403);
        return;
      }

      group.inviteCode = crypto.randomBytes(8).toString('hex');
      await group.save();

      sendSuccess(res, { inviteCode: group.inviteCode }, 'Invite link reset successfully');
    } catch (error) {
      sendError(res, 'Failed to reset invite link', 500);
    }
  }

  // 9. Join Group by Invite Code (Enforcing approveNewMembers)
  static async joinByInviteCode(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { code } = req.params;
      const group = await Chat.findOne({ inviteCode: code, type: 'group' });
      if (!group) {
        sendError(res, 'Invalid or expired invite link', 404);
        return;
      }

      // Check if already a member
      if (group.participants.some((p) => p.toString() === req.user._id.toString())) {
        sendSuccess(res, group, 'Already a member of this group');
        return;
      }

      // Check group capacity
      if (group.participants.length >= 1024) {
        sendError(res, 'Group is full (max 1024 members)', 400);
        return;
      }

      // Check if admin approval is required
      if (group.groupSettings?.approveNewMembers) {
        if (!group.pendingRequests) group.pendingRequests = [];
        const isPending = group.pendingRequests.some((r) => r.userId.toString() === req.user._id.toString());
        if (!isPending) {
          group.pendingRequests.push({ userId: req.user._id, requestedAt: new Date() });
          await group.save();
        }
        sendSuccess(
          res,
          { status: 'pending_approval' },
          'Your request to join has been submitted for admin approval'
        );
        return;
      }

      group.participants.push(req.user._id);
      group.membersMeta.push({
        userId: req.user._id,
        role: 'member',
        joinedAt: new Date(),
        isMuted: false,
        isArchived: false,
        isPinned: false,
        unreadCount: 0
      } as any);

      SocketEmitter.joinUserToChat(req.user._id.toString(), group._id.toString());

      const systemMessage = await Message.create({
        chatId: group._id,
        senderId: req.user._id,
        type: 'system',
        content: `${req.user.name || 'A user'} joined via invite link`,
        status: 'sent'
      });
      group.lastMessage = systemMessage._id as any;
      group.lastMessageAt = new Date();

      await group.save();
      const updated = await Chat.findById(group._id)
        .populate('participants', 'name phoneNumber avatarUrl about isOnline lastSeen')
        .populate('lastMessage');

      SocketEmitter.emitToChat(group._id.toString(), 'chat:members_added', {
        chatId: group._id,
        newMemberIds: [req.user._id.toString()],
        addedBy: req.user._id
      });

      sendSuccess(res, updated, 'Joined group successfully');
    } catch (error) {
      sendError(res, 'Failed to join group', 500);
    }
  }

  // 10. Get Pending Members (Admin only)
  static async getPendingMembers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const group = await Chat.findOne({ _id: id, type: 'group', participants: req.user._id });
      if (!group) {
        sendError(res, 'Group not found or access denied', 404);
        return;
      }

      const currentMeta = group.membersMeta.find((m) => m.userId.toString() === req.user._id.toString());
      if (currentMeta?.role !== 'admin' && currentMeta?.role !== 'owner') {
        sendError(res, 'Only admins can view pending requests', 403);
        return;
      }

      const populated = await Chat.findById(id).populate('pendingRequests.userId', 'name phoneNumber avatarUrl');
      sendSuccess(res, populated?.pendingRequests || [], 'Pending membership requests retrieved');
    } catch (error) {
      sendError(res, 'Failed to fetch pending requests', 500);
    }
  }

  // 11. Approve Member Request (Admin only)
  static async approveMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id, userId } = req.params;
      const group = await Chat.findOne({ _id: id, type: 'group', participants: req.user._id });
      if (!group) {
        sendError(res, 'Group not found or access denied', 404);
        return;
      }

      const currentMeta = group.membersMeta.find((m) => m.userId.toString() === req.user._id.toString());
      if (currentMeta?.role !== 'admin' && currentMeta?.role !== 'owner') {
        sendError(res, 'Only admins can approve membership requests', 403);
        return;
      }

      if (group.participants.length >= 1024) {
        sendError(res, 'Group cannot exceed 1024 members', 400);
        return;
      }

      // Remove from pendingRequests
      group.pendingRequests = (group.pendingRequests || []).filter((r) => r.userId.toString() !== userId);

      // Add to participants if not already added
      if (!group.participants.some((p) => p.toString() === userId)) {
        group.participants.push(userId as any);
        group.membersMeta.push({
          userId: userId as any,
          role: 'member',
          joinedAt: new Date(),
          isMuted: false,
          isArchived: false,
          isPinned: false,
          unreadCount: 0
        } as any);

        SocketEmitter.joinUserToChat(userId, group._id.toString());

        const systemMessage = await Message.create({
          chatId: group._id,
          senderId: req.user._id,
          type: 'system',
          content: `${req.user.name || 'Admin'} approved a new member`,
          status: 'sent'
        });
        group.lastMessage = systemMessage._id as any;
        group.lastMessageAt = new Date();
      }

      await group.save();
      const updated = await Chat.findById(id).populate('participants', 'name phoneNumber avatarUrl');

      SocketEmitter.emitToUser(userId, 'chat:new', updated);
      SocketEmitter.emitToChat(group._id.toString(), 'chat:members_added', {
        chatId: group._id,
        newMemberIds: [userId],
        addedBy: req.user._id
      });

      sendSuccess(res, updated, 'Member approved successfully');
    } catch (error) {
      sendError(res, 'Failed to approve member', 500);
    }
  }

  // 12. Reject Member Request (Admin only)
  static async rejectMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id, userId } = req.params;
      const group = await Chat.findOne({ _id: id, type: 'group', participants: req.user._id });
      if (!group) {
        sendError(res, 'Group not found or access denied', 404);
        return;
      }

      const currentMeta = group.membersMeta.find((m) => m.userId.toString() === req.user._id.toString());
      if (currentMeta?.role !== 'admin' && currentMeta?.role !== 'owner') {
        sendError(res, 'Only admins can reject membership requests', 403);
        return;
      }

      group.pendingRequests = (group.pendingRequests || []).filter((r) => r.userId.toString() !== userId);
      await group.save();

      sendSuccess(res, null, 'Member request rejected');
    } catch (error) {
      sendError(res, 'Failed to reject member request', 500);
    }
  }
}
