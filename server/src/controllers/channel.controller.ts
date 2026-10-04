import { Response } from 'express';
import { Channel, ChannelPost, Report, User } from '../models';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class ChannelController {
  // 1. Create Broadcast Channel
  static async createChannel(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, handle, description = '', avatarUrl = '', bannerUrl = '' } = req.body;
      if (!name || !handle) {
        sendError(res, 'Name and handle are required', 400);
        return;
      }

      const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      const existing = await Channel.findOne({ handle: cleanHandle });
      if (existing) {
        sendError(res, 'Channel handle is already taken', 409);
        return;
      }

      const channel = await Channel.create({
        name: name.trim(),
        handle: cleanHandle,
        description: description.trim(),
        avatarUrl,
        bannerUrl,
        creatorId: req.user._id,
        admins: [req.user._id],
        followers: [req.user._id],
        followersCount: 1
      });

      sendSuccess(res, channel, 'Channel created successfully', 201);
    } catch (error) {
      sendError(res, 'Failed to create channel', 500);
    }
  }

  // 2. Discover / Get Channels with Pagination
  static async getChannels(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { search, following, limit = 20, page = 1 } = req.query;
      const query: any = {};

      if (following === 'true') {
        query.followers = req.user._id;
      } else {
        query.isPublic = true;
      }

      if (search && typeof search === 'string') {
        query.$or = [
          { name: { $regex: search.trim(), $options: 'i' } },
          { handle: { $regex: search.trim(), $options: 'i' } }
        ];
      }

      const parsedLimit = Math.min(50, Math.max(1, Number(limit) || 20));
      const parsedPage = Math.max(1, Number(page) || 1);
      const skip = (parsedPage - 1) * parsedLimit;

      const channels = await Channel.find(query)
        .sort({ followersCount: -1 })
        .skip(skip)
        .limit(parsedLimit);

      const total = await Channel.countDocuments(query);

      sendSuccess(
        res,
        {
          channels,
          page: parsedPage,
          limit: parsedLimit,
          total,
          hasMore: skip + channels.length < total
        },
        'Channels retrieved'
      );
    } catch (error) {
      sendError(res, 'Failed to fetch channels', 500);
    }
  }

  // 3. Follow / Unfollow Channel
  static async toggleFollow(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { follow } = req.body;

      const channel = await Channel.findById(id);
      if (!channel) {
        sendError(res, 'Channel not found', 404);
        return;
      }

      if (follow) {
        if (!channel.followers.some((f) => f.toString() === req.user._id.toString())) {
          channel.followers.push(req.user._id);
          channel.followersCount += 1;
        }
      } else {
        channel.followers = channel.followers.filter((f) => f.toString() !== req.user._id.toString()) as any;
        channel.followersCount = Math.max(0, channel.followersCount - 1);
      }

      await channel.save();
      sendSuccess(res, { followersCount: channel.followersCount }, follow ? 'Followed channel' : 'Unfollowed channel');
    } catch (error) {
      sendError(res, 'Failed to follow/unfollow channel', 500);
    }
  }

  // 4. Create Post in Channel (Admin only)
  static async createPost(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { content, attachments = [] } = req.body;

      const channel = await Channel.findOne({ _id: id, admins: req.user._id });
      if (!channel) {
        sendError(res, 'Channel not found or not an admin', 403);
        return;
      }

      const post = await ChannelPost.create({
        channelId: channel._id,
        authorId: req.user._id,
        content: content || '',
        attachments,
        reactions: []
      });

      const populatedPost = await ChannelPost.findById(post._id).populate('authorId', 'name avatarUrl');
      sendSuccess(res, populatedPost, 'Post published successfully', 201);
    } catch (error) {
      sendError(res, 'Failed to publish post', 500);
    }
  }

  // 5. Get Channel Posts
  static async getPosts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const posts = await ChannelPost.find({ channelId: id })
        .populate('authorId', 'name avatarUrl')
        .sort({ createdAt: -1 })
        .limit(50);

      sendSuccess(res, posts, 'Channel posts retrieved');
    } catch (error) {
      sendError(res, 'Failed to fetch posts', 500);
    }
  }

  // 6. Edit Post in Channel (Admin / Author only)
  static async editPost(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const { content } = req.body;

      const post = await ChannelPost.findById(postId);
      if (!post) {
        sendError(res, 'Post not found', 404);
        return;
      }

      const channel = await Channel.findById(post.channelId);
      const isAdmin = channel?.admins.some((a) => a.toString() === req.user._id.toString());
      const isAuthor = post.authorId.toString() === req.user._id.toString();

      if (!isAdmin && !isAuthor) {
        sendError(res, 'Only channel admins or the author can edit this post', 403);
        return;
      }

      if (content !== undefined) post.content = content.trim();
      await post.save();

      sendSuccess(res, post, 'Post edited successfully');
    } catch (error) {
      sendError(res, 'Failed to edit post', 500);
    }
  }

  // 7. Delete Post in Channel (Admin / Author only)
  static async deletePost(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const post = await ChannelPost.findById(postId);
      if (!post) {
        sendError(res, 'Post not found', 404);
        return;
      }

      const channel = await Channel.findById(post.channelId);
      const isAdmin = channel?.admins.some((a) => a.toString() === req.user._id.toString());
      const isAuthor = post.authorId.toString() === req.user._id.toString();

      if (!isAdmin && !isAuthor) {
        sendError(res, 'Only channel admins or the author can delete this post', 403);
        return;
      }

      await ChannelPost.findByIdAndDelete(postId);
      sendSuccess(res, null, 'Post deleted successfully');
    } catch (error) {
      sendError(res, 'Failed to delete post', 500);
    }
  }

  // 8. React to Channel Post
  static async reactToPost(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const { emoji } = req.body;

      if (!emoji) {
        sendError(res, 'Emoji is required', 400);
        return;
      }

      const post = await ChannelPost.findById(postId);
      if (!post) {
        sendError(res, 'Post not found', 404);
        return;
      }

      const existingIndex = post.reactions.findIndex((r) => r.userId.toString() === req.user._id.toString());
      if (existingIndex > -1) {
        post.reactions[existingIndex].emoji = emoji;
        post.reactions[existingIndex].createdAt = new Date();
      } else {
        post.reactions.push({
          userId: req.user._id,
          emoji,
          createdAt: new Date()
        });
      }

      await post.save();
      sendSuccess(res, post.reactions, 'Reaction added to channel post');
    } catch (error) {
      sendError(res, 'Failed to react to channel post', 500);
    }
  }

  // 9. Get Channel Followers (Admin only)
  static async getFollowers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const channel = await Channel.findOne({ _id: id, admins: req.user._id })
        .populate('followers', 'name phoneNumber avatarUrl about');

      if (!channel) {
        sendError(res, 'Channel not found or not an admin', 403);
        return;
      }

      sendSuccess(res, channel.followers, 'Followers retrieved');
    } catch (error) {
      sendError(res, 'Failed to fetch followers', 500);
    }
  }

  // 10. Report Channel
  static async reportChannel(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason, details = '' } = req.body;

      if (!reason) {
        sendError(res, 'Report reason is required', 400);
        return;
      }

      const channel = await Channel.findById(id);
      if (!channel) {
        sendError(res, 'Channel not found', 404);
        return;
      }

      const report = await Report.create({
        reporterId: req.user._id,
        targetType: 'channel',
        targetId: channel._id,
        reason,
        details,
        status: 'pending'
      });

      sendSuccess(res, report, 'Channel reported successfully', 201);
    } catch (error) {
      sendError(res, 'Failed to report channel', 500);
    }
  }
}
