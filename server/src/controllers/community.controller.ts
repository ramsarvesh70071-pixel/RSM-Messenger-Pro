import { Response } from 'express';
import { Community, Chat } from '../models';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { SocketEmitter } from '../services/socket-emitter.service';

export class CommunityController {
  // 1. Create Community
  static async createCommunity(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, description = '', iconUrl = '', initialGroupIds = [] } = req.body;
      if (!name || !name.trim()) {
        sendError(res, 'Community name is required', 400);
        return;
      }

      // Create community announcement chat
      const announcementChat = await Chat.create({
        type: 'group',
        name: `${name.trim()} Announcements`,
        description: `Official announcements for ${name.trim()}`,
        avatarUrl: iconUrl,
        participants: [req.user._id],
        membersMeta: [{ userId: req.user._id, role: 'owner', unreadCount: 0 }],
        createdBy: req.user._id,
        groupSettings: {
          onlyAdminsCanSend: true,
          onlyAdminsCanEditInfo: true,
          approveNewMembers: false,
          announcementOnly: true
        }
      });

      const community = await Community.create({
        name: name.trim(),
        description: description.trim(),
        iconUrl,
        creatorId: req.user._id,
        admins: [req.user._id],
        announcementChatId: announcementChat._id,
        groups: initialGroupIds,
        membersCount: 1
      });

      if (initialGroupIds.length > 0) {
        await Chat.updateMany({ _id: { $in: initialGroupIds } }, { $set: { communityId: community._id } });
      }

      sendSuccess(res, community, 'Community created successfully', 201);
    } catch (error) {
      sendError(res, 'Failed to create community', 500);
    }
  }

  // 2. Get Communities (Visible to creators, admins, and members of linked groups)
  static async getCommunities(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userChats = await Chat.find({
        participants: req.user._id,
        type: 'group'
      }).select('_id communityId');

      const userGroupIds = userChats.map((c) => c._id);
      const linkedCommunityIds = userChats.map((c) => c.communityId).filter(Boolean);

      const communities = await Community.find({
        $or: [
          { creatorId: req.user._id },
          { admins: req.user._id },
          { groups: { $in: userGroupIds } },
          { announcementChatId: { $in: userGroupIds } },
          { _id: { $in: linkedCommunityIds } }
        ]
      })
        .populate('groups', 'name avatarUrl membersMeta participants')
        .populate('announcementChatId', 'name avatarUrl participants')
        .sort({ updatedAt: -1 });

      // Compute dynamic membersCount from distinct participants
      const result = communities.map((comm) => {
        const doc = comm.toObject();
        const distinctMembers = new Set<string>();

        if (comm.announcementChatId && (comm.announcementChatId as any).participants) {
          (comm.announcementChatId as any).participants.forEach((p: any) =>
            distinctMembers.add(p.toString())
          );
        }

        if (Array.isArray(comm.groups)) {
          comm.groups.forEach((g: any) => {
            if (g.participants) {
              g.participants.forEach((p: any) => distinctMembers.add(p.toString()));
            }
          });
        }

        doc.membersCount = Math.max(1, distinctMembers.size);
        return doc;
      });

      sendSuccess(res, result, 'Communities retrieved');
    } catch (error) {
      sendError(res, 'Failed to fetch communities', 500);
    }
  }

  // 3. Join Community (Adds user to announcement chat)
  static async joinCommunity(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const community = await Community.findById(id).populate('announcementChatId');
      if (!community) {
        sendError(res, 'Community not found', 404);
        return;
      }

      const announcementChat = await Chat.findById(community.announcementChatId);
      if (announcementChat) {
        const userIdStr = req.user._id.toString();
        if (!announcementChat.participants.some((p) => p.toString() === userIdStr)) {
          announcementChat.participants.push(req.user._id);
          announcementChat.membersMeta.push({
            userId: req.user._id,
            role: 'member',
            joinedAt: new Date(),
            isMuted: false,
            isArchived: false,
            isPinned: false,
            unreadCount: 0
          } as any);

          await announcementChat.save();
          SocketEmitter.joinUserToChat(userIdStr, announcementChat._id.toString());
        }
      }

      community.membersCount = (community.membersCount || 1) + 1;
      await community.save();

      sendSuccess(res, community, 'Joined community successfully');
    } catch (error) {
      sendError(res, 'Failed to join community', 500);
    }
  }

  // 4. Add Groups to Community (Admin only)
  static async addGroups(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { groupIds } = req.body;

      if (!Array.isArray(groupIds) || groupIds.length === 0) {
        sendError(res, 'groupIds must be a non-empty array', 400);
        return;
      }

      const community = await Community.findOne({ _id: id, admins: req.user._id });
      if (!community) {
        sendError(res, 'Community not found or not an admin', 404);
        return;
      }

      community.groups = Array.from(new Set([...community.groups.map(String), ...groupIds.map(String)])) as any;
      await community.save();

      // Update communityId in Chat records
      await Chat.updateMany({ _id: { $in: groupIds } }, { $set: { communityId: community._id } });

      sendSuccess(res, community, 'Groups added to community');
    } catch (error) {
      sendError(res, 'Failed to add groups', 500);
    }
  }

  // 5. Remove Groups from Community (Admin only)
  static async removeGroups(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { groupIds } = req.body;

      if (!Array.isArray(groupIds) || groupIds.length === 0) {
        sendError(res, 'groupIds must be a non-empty array', 400);
        return;
      }

      const community = await Community.findOne({ _id: id, admins: req.user._id });
      if (!community) {
        sendError(res, 'Community not found or not an admin', 404);
        return;
      }

      const removeSet = new Set(groupIds.map(String));
      community.groups = community.groups.filter((g) => !removeSet.has(g.toString())) as any;
      await community.save();

      // Unset communityId on removed groups
      await Chat.updateMany({ _id: { $in: groupIds } }, { $unset: { communityId: 1 } });

      sendSuccess(res, community, 'Groups removed from community');
    } catch (error) {
      sendError(res, 'Failed to remove groups', 500);
    }
  }
}
