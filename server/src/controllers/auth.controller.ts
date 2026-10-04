import { Request, Response } from 'express';
import { User, Session, Device, Message, Chat, Status, Contact, Block } from '../models';
import { OtpService } from '../services/otp.service';
import { SessionService } from '../services/session.service';
import { SocketEmitter } from '../services/socket-emitter.service';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, TokenPayload } from '../utils/jwt';
import { normalizePhoneNumber } from '../utils/phone';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import mongoose from 'mongoose';

export class AuthController {
  // 1. Request OTP for phone login / signup
  static async requestOtp(req: Request, res: Response): Promise<void> {
    try {
      const { phoneNumber, countryCode = '+91' } = req.body;
      if (!phoneNumber) {
        sendError(res, 'Phone number is required', 400);
        return;
      }

      let normalizedPhone: string;
      try {
        normalizedPhone = normalizePhoneNumber(phoneNumber, countryCode.replace('+', '') as any);
      } catch (err: any) {
        sendError(res, err.message || 'Invalid phone number format', 400);
        return;
      }

      const result = await OtpService.requestOtp(normalizedPhone);
      sendSuccess(res, result, result.message);
    } catch (error: any) {
      const status = error.message?.includes('wait') || error.message?.includes('Too many') ? 429 : 500;
      sendError(res, error.message || 'Failed to send OTP', status);
    }
  }

  // 2. Verify OTP & generate tokens + session
  static async verifyOtp(req: Request, res: Response): Promise<void> {
    try {
      const {
        phoneNumber,
        countryCode = '+91',
        otp,
        deviceId = new mongoose.Types.ObjectId().toString(),
        deviceName = 'Mobile App',
        deviceType = 'android',
        pushToken = ''
      } = req.body;

      if (!phoneNumber || !otp) {
        sendError(res, 'Phone number and OTP are required', 400);
        return;
      }

      let normalizedPhone: string;
      try {
        normalizedPhone = normalizePhoneNumber(phoneNumber, countryCode.replace('+', '') as any);
      } catch (err: any) {
        sendError(res, err.message || 'Invalid phone number format', 400);
        return;
      }

      let isValidOtp = false;
      try {
        isValidOtp = await OtpService.verifyOtp(normalizedPhone, otp.trim());
      } catch (otpErr: any) {
        sendError(res, otpErr.message || 'Invalid verification code', 400);
        return;
      }

      if (!isValidOtp) {
        sendError(res, 'Invalid or expired OTP', 400);
        return;
      }

      // Find or create user
      let user = await User.findOne({ phoneNumber: normalizedPhone });
      let isNewUser = false;

      if (!user) {
        user = await User.create({
          phoneNumber: normalizedPhone,
          countryCode,
          name: `User ${normalizedPhone.slice(-4)}`,
          about: 'Hey there! I am using RSM Messenger.'
        });
        isNewUser = true;
      }

      if (user.isSuspended) {
        sendError(res, 'This account is suspended', 403);
        return;
      }

      // Invalidate any previous session on this specific device
      await Session.deleteMany({ userId: user._id, deviceId });

      // Create new session via SessionService
      const tempToken = 'init_' + new mongoose.Types.ObjectId().toString();
      const session = await SessionService.createSession(user._id.toString(), deviceId, tempToken);

      const tokenPayload: TokenPayload = {
        userId: user._id.toString(),
        phoneNumber: user.phoneNumber,
        role: user.role,
        sid: session._id.toString(),
        deviceId
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Store real refreshToken hash in session
      await SessionService.rotateSessionToken(session._id.toString(), tempToken, refreshToken);

      // Upsert Device record
      await Device.findOneAndUpdate(
        { userId: user._id, deviceId },
        {
          deviceName,
          deviceType,
          pushToken,
          lastActive: new Date()
        },
        { upsert: true, new: true }
      );

      sendSuccess(
        res,
        {
          user,
          isNewUser,
          accessToken,
          refreshToken
        },
        'Authentication successful'
      );
    } catch (error) {
      sendError(res, 'Verification failed', 500, error instanceof Error ? error.message : 'Unknown');
    }
  }

  // 3. Refresh Access Token with Reuse Detection
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken, deviceId } = req.body;
      if (!refreshToken) {
        sendError(res, 'Refresh token is required', 400);
        return;
      }

      let payload: TokenPayload;
      try {
        payload = verifyRefreshToken(refreshToken);
      } catch {
        sendError(res, 'Invalid or expired refresh token', 401);
        return;
      }

      if (!payload.sid) {
        sendError(res, 'Malformed refresh token: missing session ID', 401);
        return;
      }

      const user = await User.findById(payload.userId);
      if (!user || user.isSuspended) {
        sendError(res, 'User account invalid or suspended', 403);
        return;
      }

      const newTokenPayload: TokenPayload = {
        userId: user._id.toString(),
        phoneNumber: user.phoneNumber,
        role: user.role,
        sid: payload.sid,
        deviceId: deviceId || payload.deviceId
      };

      const newAccessToken = generateAccessToken(newTokenPayload);
      const newRefreshToken = generateRefreshToken(newTokenPayload);

      try {
        await SessionService.rotateSessionToken(payload.sid, refreshToken, newRefreshToken);
      } catch (err: any) {
        sendError(res, err.message || 'Invalid session', 401);
        return;
      }

      sendSuccess(
        res,
        {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken
        },
        'Token refreshed successfully'
      );
    } catch (error) {
      sendError(res, 'Could not refresh token', 500, error instanceof Error ? error.message : 'Unknown');
    }
  }

  // 4. Logout (Current device session)
  static async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.sid) {
        await SessionService.revokeSession(req.sid);
      }
      if (req.user && req.deviceId) {
        await Device.deleteOne({ userId: req.user._id, deviceId: req.deviceId });
      }
      sendSuccess(res, null, 'Logged out successfully');
    } catch (error) {
      sendError(res, 'Logout failed', 500);
    }
  }

  // 5. Logout all devices
  static async logoutAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.user) {
        await SessionService.revokeAllUserSessions(req.user._id.toString());
        await Device.deleteMany({ userId: req.user._id });
      }
      sendSuccess(res, null, 'Logged out from all devices successfully');
    } catch (error) {
      sendError(res, 'Logout from all devices failed', 500);
    }
  }

  // 6. Delete account with cascading cleanup
  static async deleteAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user._id;

      // 1. Invalidate all sessions & disconnect sockets
      await SessionService.revokeAllUserSessions(userId.toString());
      await Device.deleteMany({ userId });

      // 2. Anonymize user messages to prevent broken references
      await Message.updateMany(
        { senderId: userId },
        {
          content: 'This message was sent by a deleted account',
          senderName: 'Deleted account'
        }
      );

      // 3. Remove user from chat participant lists
      await Chat.updateMany(
        { participants: userId },
        {
          $pull: { participants: userId, admins: userId }
        }
      );

      // 4. Delete user's statuses, contacts, blocks
      await Status.deleteMany({ userId });
      await Contact.deleteMany({ $or: [{ userId }, { contactUserId: userId }] });
      await Block.deleteMany({ $or: [{ userId }, { blockedUserId: userId }] });

      // 5. Delete User record
      await User.findByIdAndDelete(userId);

      sendSuccess(res, null, 'Account deleted successfully');
    } catch (error) {
      sendError(res, 'Account deletion failed', 500);
    }
  }
}
