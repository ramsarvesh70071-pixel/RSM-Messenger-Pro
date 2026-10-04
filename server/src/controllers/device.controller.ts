import { Response } from 'express';
import { Device, Session } from '../models';
import { SessionService } from '../services/session.service';
import { SocketEmitter } from '../services/socket-emitter.service';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class DeviceController {
  // 1. Get linked devices
  static async getDevices(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const devices = await Device.find({ userId: req.user._id }).sort({ lastActive: -1 });
      const formatted = devices.map((d) => ({
        _id: d._id,
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        deviceType: d.deviceType,
        lastActive: d.lastActive,
        isCurrent: d.deviceId === req.deviceId
      }));

      sendSuccess(res, formatted, 'Linked devices retrieved');
    } catch (error) {
      sendError(res, 'Failed to fetch linked devices', 500);
    }
  }

  // 2. Logout / Revoke a device
  static async logoutDevice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { deviceId } = req.params;
      const sessions = await Session.find({ userId: req.user._id, deviceId });

      for (const session of sessions) {
        await SessionService.revokeSession(session._id.toString());
      }

      await Session.deleteMany({ userId: req.user._id, deviceId });
      await Device.deleteOne({ userId: req.user._id, deviceId });

      // Disconnect socket for the user
      SocketEmitter.disconnectUser(req.user._id.toString());

      sendSuccess(res, null, 'Device session revoked successfully');
    } catch (error) {
      sendError(res, 'Failed to logout device', 500);
    }
  }

  // 3. Register / update push notification token (Phase 3.5 requirement)
  static async updatePushToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { pushToken, deviceId, deviceName, deviceType } = req.body;
      const activeDeviceId = deviceId || req.deviceId;

      if (!pushToken) {
        sendError(res, 'pushToken is required', 400);
        return;
      }

      await Device.findOneAndUpdate(
        { userId: req.user._id, deviceId: activeDeviceId },
        {
          pushToken,
          ...(deviceName && { deviceName }),
          ...(deviceType && { deviceType }),
          lastActive: new Date()
        },
        { upsert: true, new: true }
      );

      sendSuccess(res, null, 'Push token updated successfully');
    } catch (error) {
      sendError(res, 'Failed to update push token', 500);
    }
  }
}
