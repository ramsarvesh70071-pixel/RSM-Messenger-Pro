import { io, Socket } from 'socket.io-client';
import { getStoredToken, refreshAccessToken } from './api';
import { SOCKET_URL } from './config';

type Listener = () => void;

class SocketService {
  private socket: Socket | null = null;
  private lifecycleBound = false;
  private resumeListeners = new Set<Listener>();

  /** Creates (once) and returns the shared socket. Safe to call repeatedly. */
  connect(token?: string): Socket {
    if (this.socket) {
      if (!this.socket.connected && !this.socket.active) this.socket.connect();
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      // Function form => every (re)connect attempt uses the freshest token from storage
      auth: (cb) => cb({ token: getStoredToken() || token }),
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 15000
    });

    this.socket.on('connect', () => {
      console.log('⚡ [Socket.IO] Connected:', this.socket?.id);
    });

    this.socket.on('connect_error', async (err) => {
      console.warn('⚠️ [Socket.IO] Connection error:', err.message);
      const msg = (err.message || '').toLowerCase();
      // Expired / revoked token: refresh then retry (auth is read lazily so a plain reconnect is enough)
      if (msg.includes('token') || msg.includes('session') || msg.includes('jwt') || msg.includes('auth')) {
        const fresh = await refreshAccessToken();
        if (fresh && this.socket && !this.socket.connected) {
          this.socket.connect();
        }
      }
    });

    this.bindLifecycle();
    return this.socket;
  }

  /**
   * Mobile browsers freeze/kill WebSockets when the tab is backgrounded or the network flips.
   * When the app becomes active again we reconnect immediately and let stores resync.
   */
  private bindLifecycle(): void {
    if (this.lifecycleBound || typeof window === 'undefined') return;
    this.lifecycleBound = true;

    const resume = () => {
      if (!this.socket) return;
      if (!this.socket.connected) this.socket.connect();
      this.resumeListeners.forEach((fn) => fn());
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') resume();
    });
    window.addEventListener('online', resume);
    window.addEventListener('focus', resume);
    window.addEventListener('pageshow', resume);
  }

  /** Register a callback fired when the app returns to foreground / network comes back. */
  onResume(fn: Listener): () => void {
    this.resumeListeners.add(fn);
    return () => this.resumeListeners.delete(fn);
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return Boolean(this.socket?.connected);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /** Generic emit; returns false when the socket is not connected so callers can react. */
  emit(event: string, payload?: any): boolean {
    if (!this.socket || !this.socket.connected) return false;
    this.socket.emit(event, payload);
    return true;
  }

  emitTyping(chatId: string, isTyping: boolean): void {
    this.socket?.emit('chat:typing', { chatId, isTyping });
  }

  emitRecording(chatId: string, isRecording: boolean): void {
    this.socket?.emit('chat:recording', { chatId, isRecording });
  }

  emitMessageRead(chatId: string, messageIds: string[]): void {
    this.socket?.emit('message:read', { chatId, messageIds });
  }

  emitMessageDelivered(messageIds: string[]): void {
    if (messageIds.length > 0) this.socket?.emit('message:delivered', { messageIds });
  }
}

export const socketService = new SocketService();
