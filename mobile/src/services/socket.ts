import { io, Socket } from 'socket.io-client';
import { api } from './api';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private readyCallbacks: Set<() => void> = new Set();

  onReady(cb: () => void) {
    this.readyCallbacks.add(cb);
    return () => this.readyCallbacks.delete(cb);
  }

  connect(token?: string) {
    // Re-connecting with a fresh token must replace a dead/old socket, never silently keep it
    if (this.socket?.connected) return;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    const host = api.getHost();
    const initialToken = token || api.getToken();

    this.socket = io(host, {
      // Function form => always the latest token (also after automatic reconnects)
      auth: (cb) => cb({ token: api.getToken() || initialToken }),
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      console.log('Mobile Socket connected:', this.socket?.id);
    });

    // Server sends this once rooms are joined; consumers refetch whatever they missed while offline
    this.socket.on('socket:ready', () => {
      for (const cb of this.readyCallbacks) cb();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Mobile Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.log('Mobile Socket connect_error:', err.message);
    });

    // Reattach registered listeners
    for (const [event, callbacks] of this.listeners.entries()) {
      for (const cb of callbacks) {
        this.socket.on(event, cb as any);
      }
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }

    return () => this.off(event, callback);
  }

  off(event: string, callback: (...args: any[]) => void) {
    this.listeners.get(event)?.delete(callback);
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  emit(event: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.log('Socket not connected, queued/skipped:', event);
    }
  }

  // Real-time indicators
  sendTyping(chatId: string, isTyping: boolean) {
    this.emit('chat:typing', { chatId, isTyping });
  }

  sendRecording(chatId: string, isRecording: boolean) {
    this.emit('chat:recording', { chatId, isRecording });
  }

  // WebRTC Call Signaling
  initiateCall(payload: { receiverId: string; callType: 'voice' | 'video'; chatId?: string }) {
    this.emit('call:initiate', payload);
  }

  // The server resolves the user's current call when callId is omitted
  acceptCall(payload: { callerId?: string; callId?: string; signalData?: any }) {
    this.emit('call:answer', { callId: payload.callId, sdp: payload.signalData });
  }

  rejectCall(payload: { callerId?: string; callId?: string; reason?: string }) {
    this.emit('call:reject', { callId: payload.callId, reason: payload.reason });
  }

  endCall(payload: { targetUserId?: string; callId?: string }) {
    this.emit('call:end', { callId: payload.callId });
  }
}

export const socketService = new SocketService();
