import { Response } from 'express';
import { User, BlockedUser, Contact } from '../models';
import { StorageService } from '../services/storage.service';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { escapeRegex } from '../utils/regex';

export class UserController {
  // 1. Get current user's profile
  static async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = await User.findById(req.user._id);
      sendSuccess(res, user, 'Profile retrieved successfully');
    } catch (error) {
      sendError(res, 'Failed to fetch profile', 500);
    }
  }

  // 2. Update current profile (Name, About, Username)
  static async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, about, username } = req.body;
      const updates: any = {};

      if (name) updates.name = name.trim();
      if (about !== undefined) updates.about = about.trim();

      if (username) {
        const cleanUsername = username.trim().toLowerCase();
        // Check uniqueness if changed
        const existing = await User.findOne({ username: cleanUsername, _id: { $ne: req.user._id } });
        if (existing) {
          sendError(res, 'Username already taken', 409);
          return;
        }
        updates.username = cleanUsername;
      }

      const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
      sendSuccess(res, updatedUser, 'Profile updated successfully');
    } catch (error) {
      sendError(res, 'Failed to update profile', 500);
    }
  }

  // 3. Upload Profile Photo / Avatar
  static async uploadAvatar(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.file) {
        sendError(res, 'Image file is required', 400);
        return;
      }

      const fileResult = await StorageService.uploadFile(req.file, 'avatars');
      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { avatarUrl: fileResult.thumbnailUrl || fileResult.url },
        { new: true }
      );

      sendSuccess(res, updatedUser, 'Profile photo updated successfully');
    } catch (error) {
      sendError(res, 'Failed to upload profile photo', 500);
    }
  }

  // 4. Get Privacy Settings
  static async getPrivacySettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = await User.findById(req.user._id);
      sendSuccess(res, user?.privacySettings, 'Privacy settings retrieved');
    } catch (error) {
      sendError(res, 'Failed to get privacy settings', 500);
    }
  }

  // 5. Update Privacy Settings
  static async updatePrivacySettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { lastSeen, online, profilePhoto, about, status, readReceipts, allowGroupAdd, allowCalls } = req.body;
      const updates: any = {};

      if (lastSeen) updates['privacySettings.lastSeen'] = lastSeen;
      if (online) updates['privacySettings.online'] = online;
      if (profilePhoto) updates['privacySettings.profilePhoto'] = profilePhoto;
      if (about) updates['privacySettings.about'] = about;
      if (status) updates['privacySettings.status'] = status;
      if (readReceipts !== undefined) updates['privacySettings.readReceipts'] = Boolean(readReceipts);
      if (allowGroupAdd) updates['privacySettings.allowGroupAdd'] = allowGroupAdd;
      if (allowCalls) updates['privacySettings.allowCalls'] = allowCalls;

      const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true });
      sendSuccess(res, user?.privacySettings, 'Privacy settings updated successfully');
    } catch (error) {
      sendError(res, 'Failed to update privacy settings', 500);
    }
  }

  // 6. Block a user
  static async blockUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { targetUserId } = req.body;
      if (!targetUserId || targetUserId === req.user._id.toString()) {
        sendError(res, 'Invalid target user', 400);
        return;
      }

      await BlockedUser.findOneAndUpdate(
        { userId: req.user._id, blockedUserId: targetUserId },
        { userId: req.user._id, blockedUserId: targetUserId },
        { upsert: true }
      );

      sendSuccess(res, null, 'User blocked successfully');
    } catch (error) {
      sendError(res, 'Failed to block user', 500);
    }
  }

  // 7. Unblock a user
  static async unblockUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { targetUserId } = req.params;
      await BlockedUser.findOneAndDelete({ userId: req.user._id, blockedUserId: targetUserId });
      sendSuccess(res, null, 'User unblocked successfully');
    } catch (error) {
      sendError(res, 'Failed to unblock user', 500);
    }
  }

  // 8. Get list of blocked users
  static async getBlockedUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const blocked = await BlockedUser.find({ userId: req.user._id }).populate('blockedUserId', 'name phoneNumber avatarUrl');
      sendSuccess(res, blocked, 'Blocked users retrieved');
    } catch (error) {
      sendError(res, 'Failed to retrieve blocked users', 500);
    }
  }

  // 9. Get User By ID (With Backend Privacy Filtering Applied!)
  static async getUserById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const targetUser = await User.findById(id);

      if (!targetUser) {
        sendError(res, 'User not found', 404);
        return;
      }

      // Check if targetUser has blocked current user (avoid leaking block, just hide info)
      const isBlocked = await BlockedUser.findOne({ userId: targetUser._id, blockedUserId: req.user._id });

      // Check if current user is in target user's contacts
      const isContact = await Contact.findOne({ userId: targetUser._id, contactUserId: req.user._id });

      const privacy = targetUser.privacySettings;
      const safeProfile: any = {
        _id: targetUser._id,
        name: targetUser.name,
        username: targetUser.username
      };

      if (!isBlocked) {
        // Profile Photo Privacy
        if (privacy.profilePhoto === 'everyone' || (privacy.profilePhoto === 'contacts' && isContact)) {
          safeProfile.avatarUrl = targetUser.avatarUrl;
        }

        // About Privacy
        if (privacy.about === 'everyone' || (privacy.about === 'contacts' && isContact)) {
          safeProfile.about = targetUser.about;
        }

        // Online Status Privacy
        if (privacy.online === 'everyone' || (privacy.online === 'contacts' && isContact)) {
          safeProfile.isOnline = targetUser.isOnline;
        }

        // Last Seen Privacy
        if (privacy.lastSeen === 'everyone' || (privacy.lastSeen === 'contacts' && isContact)) {
          safeProfile.lastSeen = targetUser.lastSeen;
        }
      }

      sendSuccess(res, safeProfile, 'User profile retrieved');
    } catch (error) {
      sendError(res, 'Failed to fetch user', 500);
    }
  }

  // 10. Search and list users
  static async searchUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { q, limit = 50 } = req.query;
      const query: any = {
        _id: { $ne: req.user._id },
        isSuspended: { $ne: true }
      };

      if (q && typeof q === 'string' && q.trim()) {
        const safeQuery = escapeRegex(q.trim());
        const regex = new RegExp(safeQuery, 'i');
        query.$or = [{ name: regex }, { phoneNumber: regex }, { username: regex }];
      }

      const users = await User.find(query)
        .select('_id name phoneNumber username about avatarUrl isOnline lastSeen')
        .limit(Number(limit))
        .sort({ isOnline: -1, name: 1 });

      sendSuccess(res, users, 'Users retrieved successfully');
    } catch (error) {
      sendError(res, 'Failed to fetch users', 500);
    }
  }
}

