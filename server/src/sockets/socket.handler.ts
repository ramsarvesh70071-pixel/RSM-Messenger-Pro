import mongoose from 'mongoose';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import { User, Chat, Call, BlockedUser, Contact, Message } from '../models';
import { SessionService } from '../services/session.service';
import { PushService } from '../services/push.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
  sid?: string;
}

interface ActiveCallSession {
  callId: string;
  callerId: string;
  receiverId: string;
  chatId?: string;
  callType: 'voice' | 'video';
  status: 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed' | 'busy';
  ringTimer?: NodeJS.Timeout;
  startedAt: number;
  connectedAt?: number;
  // Signaling buffer so a callee that accepts late (or reconnects) still gets the offer + ICE
  offer?: any;
  callerIce: any[];
}

const CALL_RING_TIMEOUT_MS = 45000;
// Grace period before a dropped socket ends a call (mobile networks blip all the time)
const CALL_DISCONNECT_GRACE_MS = 15000;

const activeCalls = new Map<string, ActiveCallSession>();
const userToCallMap = new Map<string, string>();

export const setupSocketHandlers = (io: Server): void => {
  // 1. Socket Authentication Middleware with Session Validation
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
        (socket.handshake.query?.token as string);

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const payload = verifyAccessToken(token);
      if (!payload || !payload.userId) {
        return next(new Error('Invalid token'));
      }

      // Check active session revocation (S7)
      const isSessionValid = await SessionService.validateSession(payload.userId, payload.sid);
      if (!isSessionValid) {
        return next(new Error('Session revoked or expired'));
      }

      const user = await User.findById(payload.userId);
      if (!user || user.isSuspended) {
        return next(new Error('User unauthorized or suspended'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      socket.sid = payload.sid;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  // Active connected sockets map: userId -> Set of socket IDs
  const userSocketMap = new Map<string, Set<string>>();

  // Helper to get mutual chat contacts for a user
  const getMutualContactUserIds = async (currentUserId: string): Promise<string[]> => {
    const userChats = await Chat.find({ participants: currentUserId }).select('participants');
    const participantIds = new Set<string>();
    for (const chat of userChats) {
      for (const p of chat.participants) {
        if (p.toString() !== currentUserId) {
          participantIds.add(p.toString());
        }
      }
    }
    return Array.from(participantIds);
  };

  // Helper to emit presence only to allowed contacts respecting privacy & blocks (S11)
  const emitPresenceFiltered = async (currentUserId: string, isOnline: boolean, lastSeen?: Date) => {
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) return;

    const privacy = currentUser.privacySettings || { online: 'everyone', lastSeen: 'everyone' };
    if (isOnline && privacy.online === 'nobody') return;
    if (!isOnline && privacy.lastSeen === 'nobody') return;

    const mutualUserIds = await getMutualContactUserIds(currentUserId);
    if (mutualUserIds.length === 0) return;

    // Exclude users who have blocked current user or whom current user blocked
    const blocks = await BlockedUser.find({
      $or: [
        { userId: currentUserId, blockedUserId: { $in: mutualUserIds } },
        { userId: { $in: mutualUserIds }, blockedUserId: currentUserId }
      ]
    });
    const blockedSet = new Set(
      blocks.map((b) => (b.userId.toString() === currentUserId ? b.blockedUserId.toString() : b.userId.toString()))
    );

    const eventName = isOnline ? 'user:online' : 'user:offline';
    const payload = isOnline ? { userId: currentUserId } : { userId: currentUserId, lastSeen };

    for (const targetId of mutualUserIds) {
      if (blockedSet.has(targetId)) continue;
      io.to(`user:${targetId}`).emit(eventName, payload);
    }
  };

  // Pending "user dropped off" timers keyed by userId (cancelled if the user reconnects in time)
  const disconnectGraceTimers = new Map<string, NodeJS.Timeout>();

  const isUserOnline = (id: string): boolean => (userSocketMap.get(id)?.size || 0) > 0;

  // -------------------------------------------------------------
  // CALL LIFECYCLE HELPERS (single place that tears a call down)
  // -------------------------------------------------------------
  type CallEndKind = 'ended' | 'rejected' | 'cancelled' | 'missed' | 'disconnected';

  const finishCall = async (callId: string, kind: CallEndKind, endedBy?: string) => {
    const session = activeCalls.get(callId);
    if (!session) return;

    if (session.ringTimer) clearTimeout(session.ringTimer);
    const wasConnected = session.status === 'connected';
    const durationSeconds = session.connectedAt
      ? Math.max(0, Math.round((Date.now() - session.connectedAt) / 1000))
      : 0;

    // Map the end kind to the persisted call status
    let dbStatus: 'ended' | 'rejected' | 'missed';
    if (kind === 'rejected') dbStatus = 'rejected';
    else if (kind === 'missed' || kind === 'cancelled') dbStatus = 'missed';
    else dbStatus = wasConnected ? 'ended' : 'missed';

    session.status = dbStatus;
    activeCalls.delete(callId);
    if (userToCallMap.get(session.callerId) === callId) userToCallMap.delete(session.callerId);
    if (userToCallMap.get(session.receiverId) === callId) userToCallMap.delete(session.receiverId);

    try {
      await Call.findByIdAndUpdate(callId, {
        status: dbStatus,
        endedAt: new Date(),
        durationSeconds
      });
    } catch (err) {
      console.error('[Call Signaling] Failed to persist call end:', err);
    }

    const payload = { callId, reason: kind, durationSeconds, endedBy };

    if (kind === 'rejected') {
      io.to(`user:${session.callerId}`).emit('call:rejected', {
        callId,
        receiverId: session.receiverId,
        reason: 'declined'
      });
    }
    if (kind === 'missed') {
      io.to(`user:${session.receiverId}`).emit('call:missed', { callId, callerId: session.callerId });
    }

    // Both parties (all their devices) always receive call:ended so every UI closes
    io.to(`user:${session.callerId}`).emit('call:ended', payload);
    io.to(`user:${session.receiverId}`).emit('call:ended', payload);
  };

  const endCallsForUser = async (userId: string, kind: CallEndKind) => {
    const callId = userToCallMap.get(userId);
    if (!callId) return;
    if (!activeCalls.has(callId)) {
      userToCallMap.delete(userId);
      return;
    }
    await finishCall(callId, kind, userId);
  };

  const markDeliveredOnConnect = async (userId: string) => {
    try {
      const chats = await Chat.find({ participants: userId }).select('_id');
      if (chats.length === 0) return;
      const chatIds = chats.map((c) => c._id);
      const pending = await Message.find({
        chatId: { $in: chatIds },
        senderId: { $ne: userId },
        status: 'sent',
        'deliveredTo.userId': { $ne: userId },
        deletedForUserIds: { $ne: userId }
      })
        .select('_id chatId')
        .sort({ createdAt: -1 })
        .limit(500);

      if (pending.length === 0) return;
      const deliveredAt = new Date();
      await Message.updateMany(
        { _id: { $in: pending.map((m) => m._id) } },
        { $addToSet: { deliveredTo: { userId, deliveredAt } }, $set: { status: 'delivered' } }
      );

      const grouped = new Map<string, string[]>();
      for (const m of pending) {
        const key = m.chatId.toString();
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(m._id.toString());
      }
      for (const [chatId, ids] of grouped.entries()) {
        io.to(`chat:${chatId}`).emit('message:status', {
          chatId,
          messageIds: ids,
          status: 'delivered',
          userId,
          deliveredAt
        });
      }
    } catch (err) {
      console.error('[Socket] markDeliveredOnConnect failed:', err);
    }
  };

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    console.log(`[Socket] User connected: ${userId} (Socket ID: ${socket.id})`);

    // --- Synchronous setup FIRST so that no client event is dropped while we hit the DB ---
    const isFirstSocket = !isUserOnline(userId);
    if (!userSocketMap.has(userId)) userSocketMap.set(userId, new Set());
    userSocketMap.get(userId)!.add(socket.id);

    // User reconnected in time -> cancel the pending "end call" grace timer
    const pendingGrace = disconnectGraceTimers.get(userId);
    if (pendingGrace) {
      clearTimeout(pendingGrace);
      disconnectGraceTimers.delete(userId);
    }

    socket.join(`user:${userId}`);

    // Simple event rate limiter per socket: max 60 events per 5 seconds (ICE bursts are legit)
    let eventCount = 0;
    let windowResetTime = Date.now() + 5000;
    const isRateLimited = (limit = 60): boolean => {
      const now = Date.now();
      if (now > windowResetTime) {
        eventCount = 0;
        windowResetTime = now + 5000;
      }
      eventCount++;
      return eventCount > limit;
    };

    // Verifies (and lazily joins) chat room membership. Rooms can be missed if a chat was created
    // while this socket was connecting, so fall back to the DB instead of silently dropping events.
    const ensureChatRoom = async (chatId: string): Promise<boolean> => {
      if (!chatId || !mongoose.isValidObjectId(chatId)) return false;
      if (socket.rooms.has(`chat:${chatId}`)) return true;
      const member = await Chat.exists({ _id: chatId, participants: userId });
      if (!member) return false;
      socket.join(`chat:${chatId}`);
      return true;
    };

    // -------------------------------------------------------------
    // CHAT INDICATORS: TYPING & RECORDING (Membership verified)
    // -------------------------------------------------------------
    socket.on('chat:typing', async ({ chatId, isTyping }: { chatId: string; isTyping: boolean }) => {
      if (isRateLimited()) return;
      if (!(await ensureChatRoom(chatId))) return;

      socket.to(`chat:${chatId}`).emit('chat:typing', {
        chatId,
        userId,
        userName: socket.user.name,
        isTyping: Boolean(isTyping)
      });
    });

    socket.on('chat:recording', async ({ chatId, isRecording }: { chatId: string; isRecording: boolean }) => {
      if (isRateLimited()) return;
      if (!(await ensureChatRoom(chatId))) return;

      socket.to(`chat:${chatId}`).emit('chat:recording', {
        chatId,
        userId,
        userName: socket.user.name,
        isRecording: Boolean(isRecording)
      });
    });

    // Client asks to (re)join all its rooms, e.g. after reconnect
    socket.on('chat:rejoin', async (ack?: (res: any) => void) => {
      try {
        const chats = await Chat.find({ participants: userId }).select('_id');
        chats.forEach((c) => socket.join(`chat:${c._id.toString()}`));
        if (typeof ack === 'function') ack({ ok: true, count: chats.length });
      } catch {
        if (typeof ack === 'function') ack({ ok: false });
      }
    });

    // -------------------------------------------------------------
    // REAL-TIME MESSAGING - Deprecate client-driven spoofing (S4)
    // -------------------------------------------------------------
    socket.on('message:send', () => {
      // Ignored: Messages MUST be sent via REST API (POST /api/v1/messages)
      // which performs authentication, membership verification, schema validation,
      // and server-authoritative broadcast.
      console.warn(`[Socket Security] Ignored client message:send from ${userId}. Client must use REST API.`);
    });

    // -------------------------------------------------------------
    // REAL-TIME DELIVERY & READ RECEIPTS (Phase 2.1)
    // -------------------------------------------------------------
    socket.on('message:delivered', async ({ messageIds }: { messageIds: string[] }) => {
      if (isRateLimited()) return;
      if (!Array.isArray(messageIds) || messageIds.length === 0) return;
      const validIds = messageIds.filter((id) => mongoose.isValidObjectId(id)).slice(0, 200);
      if (validIds.length === 0) return;

      try {
        // Only messages in chats this user belongs to, never their own messages
        const candidates = await Message.find({
          _id: { $in: validIds },
          senderId: { $ne: userId },
          'deliveredTo.userId': { $ne: userId },
          status: { $in: ['pending', 'sent'] }
        }).select('_id chatId');

        if (candidates.length === 0) return;

        const memberChats = await Chat.find({
          _id: { $in: Array.from(new Set(candidates.map((m) => m.chatId.toString()))) },
          participants: userId
        }).select('_id');
        const allowedChatIds = new Set(memberChats.map((c) => c._id.toString()));
        const allowed = candidates.filter((m) => allowedChatIds.has(m.chatId.toString()));
        if (allowed.length === 0) return;

        const deliveredAt = new Date();
        await Message.updateMany(
          { _id: { $in: allowed.map((m) => m._id) } },
          { $addToSet: { deliveredTo: { userId, deliveredAt } }, $set: { status: 'delivered' } }
        );

        const chatGroup = new Map<string, string[]>();
        for (const m of allowed) {
          const cId = m.chatId.toString();
          if (!chatGroup.has(cId)) chatGroup.set(cId, []);
          chatGroup.get(cId)!.push(m._id.toString());
        }
        for (const [cId, mIds] of chatGroup.entries()) {
          io.to(`chat:${cId}`).emit('message:status', {
            chatId: cId,
            messageIds: mIds,
            status: 'delivered',
            userId,
            deliveredAt
          });
        }
      } catch (err) {
        console.error('[Socket] message:delivered failed:', err);
      }
    });

    socket.on('message:read', async ({ chatId, messageIds, upToMessageId }: any) => {
      if (isRateLimited()) return;
      if (!chatId || !(await ensureChatRoom(chatId))) return;

      try {
        const query: any = {
          chatId,
          senderId: { $ne: userId },
          'readBy.userId': { $ne: userId },
          deletedForUserIds: { $ne: userId }
        };

        if (Array.isArray(messageIds) && messageIds.length > 0) {
          query._id = { $in: messageIds.filter((id: string) => mongoose.isValidObjectId(id)) };
        } else if (upToMessageId && typeof upToMessageId === 'string' && upToMessageId.length === 24) {
          query._id = { $lte: upToMessageId };
        }

        const msgs = await Message.find(query).select('_id');

        // Even if nothing new was read, make sure the unread badge is cleared for this member.
        // Isolated so a failure here can never block the read receipt below.
        try {
          await Chat.updateOne(
            { _id: chatId, 'membersMeta.userId': userId },
            { $set: { 'membersMeta.$.unreadCount': 0 } }
          );
        } catch (err) {
          console.error('[Socket] unread reset failed:', err);
        }
        // Tell the user's other devices so the badge clears everywhere
        io.to(`user:${userId}`).emit('chat:unread_cleared', { chatId });

        if (msgs.length === 0) return;

        const readAt = new Date();
        const updatedIds = msgs.map((m) => m._id);

        await Message.updateMany(
          { _id: { $in: updatedIds } },
          {
            $addToSet: { readBy: { userId, readAt } },
            $set: { status: 'read' }
          }
        );

        const user = await User.findById(userId);
        if (user?.privacySettings?.readReceipts !== false) {
          io.to(`chat:${chatId}`).emit('message:status', {
            chatId,
            messageIds: updatedIds,
            status: 'read',
            userId,
            readAt
          });
          io.to(`chat:${chatId}`).emit('message:read', {
            chatId,
            messageIds: updatedIds,
            userId,
            readAt
          });
        }
      } catch (err) {
        console.error('[Socket] message:read failed:', err);
      }
    });

    // -------------------------------------------------------------
    // WEBRTC SIGNALING FOR VOICE & VIDEO CALLS (S14 Privacy & Block Enforced)
    // -------------------------------------------------------------
    const getSessionForCaller = (callId?: string): ActiveCallSession | null => {
      const id = callId || userToCallMap.get(userId);
      const session = id ? activeCalls.get(id) : null;
      if (!session) return null;
      if (session.callerId !== userId && session.receiverId !== userId) return null;
      return session;
    };

    socket.on('call:initiate', async ({ receiverId, callType = 'voice', chatId }: any) => {
      try {
        if (!receiverId || !mongoose.isValidObjectId(receiverId)) return;
        if (receiverId === userId) {
          socket.emit('call:error', { message: 'You cannot call yourself' });
          return;
        }
        if (callType !== 'voice' && callType !== 'video') callType = 'voice';

        // 1. S14: Check blocking
        const isBlocked = await BlockedUser.findOne({
          $or: [
            { userId, blockedUserId: receiverId },
            { userId: receiverId, blockedUserId: userId }
          ]
        });

        if (isBlocked) {
          socket.emit('call:error', { message: 'Cannot place call: User unavailable' });
          return;
        }

        // 2. Check receiver privacy settings
        const receiver = await User.findById(receiverId);
        if (!receiver || receiver.isSuspended) {
          socket.emit('call:error', { message: 'User not found' });
          return;
        }

        if (receiver.privacySettings?.allowCalls === 'nobody') {
          socket.emit('call:error', { message: 'User does not accept calls' });
          return;
        }

        if (receiver.privacySettings?.allowCalls === 'contacts') {
          const isContact = await Contact.findOne({ userId: receiverId, contactUserId: userId });
          if (!isContact) {
            socket.emit('call:error', { message: 'User only accepts calls from contacts' });
            return;
          }
        }

        // 3. Self busy / receiver busy checks (drop stale mappings first)
        for (const uid of [userId, receiverId]) {
          const existing = userToCallMap.get(uid);
          if (existing && !activeCalls.has(existing)) userToCallMap.delete(uid);
        }

        if (userToCallMap.has(userId)) {
          socket.emit('call:error', { message: 'You are already in an active call' });
          return;
        }

        if (userToCallMap.has(receiverId)) {
          console.log(`[Call Signaling] Callee ${receiverId} is busy in another call`);
          socket.emit('call:busy', { receiverId, message: 'User is on another call' });

          await Call.create({
            chatId,
            callType,
            status: 'busy',
            caller: userId,
            receiver: receiverId,
            participants: [
              { userId, role: 'caller', status: 'initiated', joinedAt: new Date() },
              { userId: receiverId, role: 'callee', status: 'busy' }
            ],
            startedAt: new Date(),
            endedAt: new Date(),
            durationSeconds: 0
          });
          return;
        }

        // 4. Create Call row server-side and return callId
        const callDoc = await Call.create({
          chatId,
          callType,
          status: 'ringing',
          caller: userId,
          receiver: receiverId,
          participants: [
            { userId, role: 'caller', status: 'initiated', joinedAt: new Date() },
            { userId: receiverId, role: 'callee', status: 'ringing' }
          ],
          startedAt: new Date(),
          durationSeconds: 0
        });
        const callId = callDoc._id.toString();

        // 5. 45s ring timeout -> Missed call
        const ringTimer = setTimeout(async () => {
          const currentCall = activeCalls.get(callId);
          if (currentCall && currentCall.status === 'ringing') {
            console.log(`[Call Signaling] ring timeout for Call ${callId} -> Missed`);
            await finishCall(callId, 'missed');

            PushService.sendPushNotification({
              recipientId: receiverId,
              senderId: userId,
              type: 'call',
              title: 'Missed Call',
              body: `Missed ${callType} call from ${socket.user.name}`,
              data: { callId, callType }
            }).catch(() => {});
          }
        }, CALL_RING_TIMEOUT_MS);

        const session: ActiveCallSession = {
          callId,
          callerId: userId,
          receiverId,
          chatId,
          callType,
          status: 'ringing',
          ringTimer,
          startedAt: Date.now(),
          callerIce: []
        };

        activeCalls.set(callId, session);
        userToCallMap.set(userId, callId);
        userToCallMap.set(receiverId, callId);

        console.log(`[Call Signaling] Call ${callId} initiated by ${userId} to ${receiverId}`);

        // Notify the caller (all of their devices) of the created callId
        socket.emit('call:ringing', { callId, receiverId });

        // Notify callee on all devices
        io.to(`user:${receiverId}`).emit('call:incoming', {
          callId,
          callerId: userId,
          caller: {
            _id: socket.user._id,
            name: socket.user.name,
            avatarUrl: socket.user.avatarUrl,
            phoneNumber: socket.user.phoneNumber
          },
          callType,
          chatId
        });

        // High-priority push for callees whose app is closed
        PushService.sendPushNotification({
          recipientId: receiverId,
          senderId: userId,
          type: 'call',
          title: `Incoming ${callType} call`,
          body: `${socket.user.name} is calling you`,
          data: { callId, callType, chatId }
        }).catch(() => {});
      } catch (err) {
        console.error('[Call Signaling] call:initiate failed:', err);
        socket.emit('call:error', { message: 'Could not start the call. Please try again.' });
      }
    });

    // Caller -> callee: SDP offer (buffered so late accept / reconnect still works)
    socket.on('call:offer', ({ callId, sdp }: any) => {
      if (isRateLimited(200)) return;
      const session = getSessionForCaller(callId);
      if (!session || session.callerId !== userId || !sdp) return;

      session.offer = sdp;
      io.to(`user:${session.receiverId}`).emit('call:offer', {
        callId: session.callId,
        senderId: userId,
        sdp
      });
    });

    // Callee tells the server it accepted on THIS device and wants the buffered offer/ICE replayed
    socket.on('call:join', ({ callId }: any) => {
      const session = getSessionForCaller(callId);
      if (!session || session.receiverId !== userId) return;

      if (session.offer) {
        socket.emit('call:offer', { callId: session.callId, senderId: session.callerId, sdp: session.offer });
      }
      for (const candidate of session.callerIce) {
        socket.emit('call:ice', { callId: session.callId, senderId: session.callerId, candidate });
        socket.emit('call:ice_candidate', { callId: session.callId, senderId: session.callerId, candidate });
      }
    });

    const handleAnswer = async ({ callId, sdp }: any) => {
      const session = getSessionForCaller(callId);
      // Only the callee can answer, and only once while ringing
      if (!session || session.receiverId !== userId || session.status !== 'ringing') return;

      if (session.ringTimer) clearTimeout(session.ringTimer);
      session.status = 'connected';
      session.connectedAt = Date.now();

      // Persist first so the DB always reflects 'connected' by the time clients are told
      try {
        await Call.findByIdAndUpdate(
          session.callId,
          {
            status: 'connected',
            'participants.$[elem].status': 'connected',
            'participants.$[elem].joinedAt': new Date()
          },
          { arrayFilters: [{ 'elem.userId': userId }] }
        );
      } catch (err) {
        console.error('[Call Signaling] Failed to persist call answer:', err);
      }

      // The call may have ended while we were writing to the DB
      if (activeCalls.get(session.callId) !== session) return;

      io.to(`user:${session.callerId}`).emit('call:answered', {
        callId: session.callId,
        senderId: userId,
        sdp
      });
      io.to(`user:${session.callerId}`).emit('call:accept', {
        callId: session.callId,
        senderId: userId,
        sdp
      });

      // Multi-device: stop ringing on the receiver's other devices
      socket.to(`user:${userId}`).emit('call:state', { callId: session.callId, status: 'connected' });
    };

    socket.on('call:answer', handleAnswer);
    socket.on('call:accept', handleAnswer); // legacy alias

    const relayIce = ({ callId, candidate }: any) => {
      if (isRateLimited(300)) return;
      const session = getSessionForCaller(callId);
      if (!session || !candidate) return;

      const target = session.callerId === userId ? session.receiverId : session.callerId;

      // Buffer the caller's candidates until the callee has joined
      if (session.callerId === userId && session.status === 'ringing' && session.callerIce.length < 100) {
        session.callerIce.push(candidate);
      }

      io.to(`user:${target}`).emit('call:ice', { callId: session.callId, senderId: userId, candidate });
      io.to(`user:${target}`).emit('call:ice_candidate', { callId: session.callId, senderId: userId, candidate });
    };

    socket.on('call:ice', relayIce);
    socket.on('call:ice_candidate', relayIce); // legacy alias

    socket.on('call:reject', async ({ callId }: any) => {
      const session = getSessionForCaller(callId);
      if (!session || session.receiverId !== userId || session.status !== 'ringing') return;
      await finishCall(session.callId, 'rejected', userId);
    });

    socket.on('call:end', async ({ callId }: any) => {
      const session = getSessionForCaller(callId);
      if (!session) return;
      // Caller hanging up while it still rings = cancelled (shows as missed for the callee)
      const kind: CallEndKind =
        session.status === 'ringing' ? (session.callerId === userId ? 'cancelled' : 'rejected') : 'ended';
      await finishCall(session.callId, kind, userId);
    });

    // -------------------------------------------------------------
    // DISCONNECTION & CLEANUP
    // -------------------------------------------------------------
    socket.on('disconnect', async () => {
      const userSockets = userSocketMap.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          userSocketMap.delete(userId);

          // If the user was in a call, give them a grace window to reconnect before ending it
          if (userToCallMap.has(userId)) {
            const timer = setTimeout(() => {
              disconnectGraceTimers.delete(userId);
              if (!isUserOnline(userId)) {
                endCallsForUser(userId, 'disconnected').catch(() => {});
              }
            }, CALL_DISCONNECT_GRACE_MS);
            disconnectGraceTimers.set(userId, timer);
          }

          const lastSeen = new Date();
          if (mongoose.connection.readyState === 1) {
            await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen }).catch(() => {});
            emitPresenceFiltered(userId, false, lastSeen).catch(() => {});
          }
        }
      }
      console.log(`[Socket] User disconnected: ${userId}`);
    });

    // -------------------------------------------------------------
    // ASYNC BOOTSTRAP (handlers above are already live)
    // -------------------------------------------------------------
    (async () => {
      try {
        // Join all chat rooms where user is participant
        const userChats = await Chat.find({ participants: userId }).select('_id');
        userChats.forEach((chat) => socket.join(`chat:${chat._id.toString()}`));

        if (isFirstSocket) {
          await User.findByIdAndUpdate(userId, { isOnline: true });
          emitPresenceFiltered(userId, true).catch(() => {});
        }

        // Tell the client rooms are ready -> it should resync anything it missed while offline
        socket.emit('socket:ready', { userId, rooms: userChats.length });

        // If this user is already in/ringing for a call (reconnect), restore their call UI
        const existingCallId = userToCallMap.get(userId);
        const existing = existingCallId ? activeCalls.get(existingCallId) : null;
        if (existing && existing.receiverId === userId && existing.status === 'ringing') {
          const caller = await User.findById(existing.callerId).select('name avatarUrl phoneNumber');
          if (caller) {
            socket.emit('call:incoming', {
              callId: existing.callId,
              callerId: existing.callerId,
              caller,
              callType: existing.callType,
              chatId: existing.chatId
            });
          }
        }

        await markDeliveredOnConnect(userId);
      } catch (err) {
        console.error('[Socket] Connection bootstrap failed:', err);
      }
    })();
  });
};
