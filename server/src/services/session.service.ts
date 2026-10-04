import { Session, ISessionDocument } from '../models/Session.model';
import { hashToken } from '../utils/jwt';
import { SocketEmitter } from './socket-emitter.service';

interface CachedSession {
  isValid: boolean;
  userId: string;
  cachedAt: number;
}

export class SessionService {
  // 30-second in-memory LRU cache to avoid querying MongoDB on every request
  private static sessionCache: Map<string, CachedSession> = new Map();
  private static readonly CACHE_TTL_MS = 30 * 1000;

  static async validateSession(userId: string, sid: string): Promise<boolean> {
    if (!sid || !userId) return false;

    const now = Date.now();
    const cached = this.sessionCache.get(sid);

    if (cached && now - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.isValid && cached.userId === userId;
    }

    const session = await Session.findOne({
      _id: sid,
      userId,
      isValid: true,
      expiresAt: { $gt: new Date() }
    });

    const isValid = !!session;
    this.sessionCache.set(sid, {
      isValid,
      userId,
      cachedAt: now
    });

    return isValid;
  }

  static async createSession(
    userId: string,
    deviceId: string,
    refreshToken: string
  ): Promise<ISessionDocument> {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const refreshTokenHash = hashToken(refreshToken);

    const session = await Session.create({
      userId,
      deviceId,
      refreshTokenHash,
      isValid: true,
      expiresAt
    });

    this.sessionCache.set(session._id.toString(), {
      isValid: true,
      userId,
      cachedAt: Date.now()
    });

    return session;
  }

  static async revokeSession(sid: string): Promise<void> {
    this.sessionCache.delete(sid);
    const session = await Session.findByIdAndUpdate(sid, { isValid: false });
    if (session) {
      SocketEmitter.disconnectUser(session.userId.toString());
    }
  }

  static async revokeAllUserSessions(userId: string): Promise<void> {
    // Invalidate in cache
    for (const [sid, item] of this.sessionCache.entries()) {
      if (item.userId === userId) {
        this.sessionCache.delete(sid);
      }
    }

    await Session.updateMany({ userId }, { isValid: false });
    SocketEmitter.disconnectUser(userId);
  }

  /**
   * Refreshes token with refresh-token reuse detection.
   * If an old/compromised refresh token is presented, all sessions for that user are immediately revoked!
   */
  static async rotateSessionToken(
    sid: string,
    presentedRefreshToken: string,
    newRefreshToken: string
  ): Promise<ISessionDocument> {
    const presentedHash = hashToken(presentedRefreshToken);
    const session = await Session.findById(sid);

    if (!session || !session.isValid || session.expiresAt <= new Date()) {
      throw new Error('Session invalid or expired');
    }

    // Reuse Detection Guard:
    if (session.refreshTokenHash !== presentedHash) {
      // Possible token replay attack! Invalidate all sessions immediately.
      await this.revokeAllUserSessions(session.userId.toString());
      throw new Error('Security Alert: Refresh token reuse detected! All active sessions have been terminated for security.');
    }

    // Update with new token hash
    session.refreshTokenHash = hashToken(newRefreshToken);
    session.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await session.save();

    this.sessionCache.set(sid, {
      isValid: true,
      userId: session.userId.toString(),
      cachedAt: Date.now()
    });

    return session;
  }
}
