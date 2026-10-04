import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import { User } from '../models';
import { SessionService } from '../services/session.service';
import { sendError } from '../utils/response';

export interface AuthenticatedRequest extends Request {
  user?: any;
  sid?: string;
  deviceId?: string;
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendError(res, 'Authorization token missing or malformed', 401);
      return;
    }

    const token = authHeader.split(' ')[1];
    let payload: TokenPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      sendError(res, 'Invalid or expired token', 401);
      return;
    }

    // 1. Enforce real Session validation (revoke check)
    if (payload.sid) {
      const isSessionValid = await SessionService.validateSession(payload.userId, payload.sid);
      if (!isSessionValid) {
        sendError(res, 'Session has been revoked or expired. Please log in again.', 401);
        return;
      }
    }

    // 2. Enforce User account existence and suspension check
    const user = await User.findById(payload.userId);
    if (!user) {
      sendError(res, 'User account not found', 401);
      return;
    }

    if (user.isSuspended) {
      sendError(res, 'User account is suspended. Contact administration.', 403);
      return;
    }

    req.user = user;
    req.sid = payload.sid;
    req.deviceId = payload.deviceId;
    next();
  } catch (error) {
    sendError(res, 'Authentication failed', 500, error instanceof Error ? error.message : 'Unknown');
  }
};

export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'moderator')) {
    sendError(res, 'Access denied: Admin privileges required', 403);
    return;
  }
  next();
};
