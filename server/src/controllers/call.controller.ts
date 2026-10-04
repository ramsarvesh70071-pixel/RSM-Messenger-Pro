import crypto from 'crypto';
import { Response } from 'express';
import { Call, User, BlockedUser } from '../models';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { assertCallParticipant } from '../utils/auth-guards';
import { env } from '../config/environment';

export class CallController {
  // 1. Get ICE Server Configuration (STUN / TURN with time-limited HMAC credentials)
  static async getIceServers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const iceServers: RTCIceServer[] = [];

      // Add STUN servers
      for (const stunUrl of env.STUN_SERVERS) {
        if (stunUrl.trim()) {
          iceServers.push({ urls: stunUrl.trim() });
        }
      }

      // Add TURN servers if configured
      if (env.TURN_SERVERS.length > 0) {
        let username = env.TURN_USERNAME;
        let credential = env.TURN_CREDENTIAL;

        // If TURN_SECRET is configured, generate HMAC-SHA1 time-limited REST credentials (24h TTL)
        if (env.TURN_SECRET) {
          const ttlSeconds = 86400;
          const expiryTimestamp = Math.floor(Date.now() / 1000) + ttlSeconds;
          username = `${expiryTimestamp}:${req.user._id.toString()}`;
          credential = crypto
            .createHmac('sha1', env.TURN_SECRET)
            .update(username)
            .digest('base64');
        }

        if (username && credential) {
          for (const turnUrl of env.TURN_SERVERS) {
            if (turnUrl.trim()) {
              iceServers.push({
                urls: turnUrl.trim(),
                username,
                credential
              });
            }
          }
        }
      }

      sendSuccess(res, { iceServers }, 'ICE server configuration retrieved');
    } catch (error) {
      sendError(res, 'Failed to get ICE servers', 500);
    }
  }

  // 2. Create Call Log Entry
  static async createCallLog(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { receiverId, callType = 'voice', chatId, duration = 0, durationSeconds } = req.body;
      let rawStatus = req.body.status || 'initiated';
      if (rawStatus === 'completed') rawStatus = 'ended';

      if (!receiverId) {
        sendError(res, 'receiverId is required', 400);
        return;
      }

      // Check if blocked
      const isBlocked = await BlockedUser.findOne({
        $or: [
          { userId: req.user._id, blockedUserId: receiverId },
          { userId: receiverId, blockedUserId: req.user._id }
        ]
      });

      if (isBlocked) {
        sendError(res, 'Cannot call this user: Blocked', 403);
        return;
      }

      const dur = durationSeconds !== undefined ? durationSeconds : duration;

      const call = await Call.create({
        chatId,
        callType,
        status: rawStatus,
        durationSeconds: dur,
        caller: req.user._id,
        receiver: receiverId,
        participants: [
          { userId: req.user._id, role: 'caller', status: rawStatus, joinedAt: new Date() },
          { userId: receiverId, role: 'callee', status: rawStatus === 'ended' ? 'ended' : 'ringing' }
        ],
        startedAt: new Date(),
        endedAt: rawStatus === 'ended' ? new Date() : undefined
      });

      const populatedCall = await Call.findById(call._id)
        .populate('caller', 'name phoneNumber avatarUrl')
        .populate('receiver', 'name phoneNumber avatarUrl');

      sendSuccess(res, populatedCall, 'Call log created', 201);
    } catch (error) {
      sendError(res, 'Failed to create call log', 500);
    }
  }

  // 3. Update Call Status (Connected, Ended, Rejected, Missed)
  static async updateCallStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      let { status, durationSeconds = 0, duration } = req.body;
      if (status === 'completed') status = 'ended';
      const dur = durationSeconds || duration || 0;

      const call = await assertCallParticipant(id, req.user._id.toString());

      call.status = status;
      if (status === 'connected') {
        call.startedAt = new Date();
      } else if (status === 'ended' || status === 'rejected' || status === 'missed' || status === 'busy') {
        call.endedAt = new Date();
        call.durationSeconds = dur;
      }

      await call.save();
      sendSuccess(res, call, 'Call status updated');
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
        return;
      }
      sendError(res, 'Failed to update call status', 500);
    }
  }

  // 4. Get Call History
  static async getCallHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const calls = await Call.find({
        $or: [{ caller: req.user._id }, { receiver: req.user._id }],
        deletedForUserIds: { $ne: req.user._id }
      })
        .populate('caller', 'name phoneNumber avatarUrl')
        .populate('receiver', 'name phoneNumber avatarUrl')
        .sort({ createdAt: -1 })
        .limit(50);

      // Enhance with incoming / outgoing / missed status flag relative to the current user
      const formattedCalls = calls.map((c) => {
        const isCaller = c.caller._id.toString() === req.user._id.toString();
        const otherParty = isCaller ? c.receiver : c.caller;
        const isMissed = !isCaller && (c.status === 'missed' || c.status === 'rejected');

        return {
          _id: c._id,
          callType: c.callType,
          status: c.status,
          direction: isCaller ? 'outgoing' : 'incoming',
          isMissed,
          otherParty,
          durationSeconds: c.durationSeconds,
          createdAt: c.createdAt
        };
      });

      sendSuccess(res, formattedCalls, 'Call history retrieved');
    } catch (error) {
      sendError(res, 'Failed to fetch call history', 500);
    }
  }

  // 5. Delete Call Log
  static async deleteCallLog(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await assertCallParticipant(id, req.user._id.toString());

      await Call.findByIdAndUpdate(id, {
        $addToSet: { deletedForUserIds: req.user._id }
      });

      sendSuccess(res, null, 'Call log deleted');
    } catch (error: any) {
      if (error.statusCode) {
        sendError(res, error.message, error.statusCode);
        return;
      }
      sendError(res, 'Failed to delete call log', 500);
    }
  }
}
