import { create } from 'zustand';
import { IChat, IMessage } from '../types';
import { api } from '../services/api';
import { socketService } from '../services/socket.service';

interface ChatState {
  chats: IChat[];
  activeChat: IChat | null;
  messages: Record<string, IMessage[]>; // chatId -> messages array
  hasMoreMessages: Record<string, boolean>;
  typingUsers: Record<string, string>; // chatId -> userName
  recordingUsers: Record<string, string>; // chatId -> userName
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  replyingTo: IMessage | null;
  searchFilter: string;
  showArchived: boolean;
  currentUserId: string | null;

  fetchChats: () => Promise<void>;
  setShowArchived: (v: boolean) => void;
  setActiveChat: (chat: IChat | null) => void;
  fetchMessages: (chatId: string) => Promise<void>;
  loadOlderMessages: (chatId: string) => Promise<void>;
  sendMessage: (payload: {
    type?: string;
    content?: string;
    attachments?: any[];
    location?: any;
    contact?: any;
  }) => Promise<void>;
  forwardMessage: (messageId: string, targetChatIds: string[]) => Promise<boolean>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  deleteMessageForMe: (messageId: string) => Promise<void>;
  deleteMessageForEveryone: (messageId: string) => Promise<void>;
  reactToMessage: (messageId: string, emoji: string) => Promise<void>;
  toggleStarMessage: (messageId: string, star: boolean) => Promise<void>;
  togglePinMessage: (messageId: string, pin: boolean) => Promise<void>;
  togglePinChat: (chatId: string, pin: boolean) => Promise<void>;
  toggleArchiveChat: (chatId: string, archive: boolean) => Promise<void>;
  clearChat: (chatId: string) => Promise<void>;
  setReplyingTo: (msg: IMessage | null) => void;
  setSearchFilter: (query: string) => void;
  setupSocketListeners: (userId: string) => void;
  teardownSocketListeners: () => void;
  resync: () => void;
  reset: () => void;
}

const CHAT_SOCKET_EVENTS = [
  'message:new',
  'message:receive',
  'message:edit',
  'message:status',
  'message:read',
  'message:delete',
  'message:reaction',
  'message:pin',
  'chat:new',
  'chat:updated',
  'chat:members_added',
  'chat:member_removed',
  'chat:unread_cleared',
  'chat:disappearing_update',
  'chat:typing',
  'chat:recording',
  'user:online',
  'user:offline',
  'socket:ready'
];

const idOf = (v: any): string => (v && typeof v === 'object' ? String(v._id || v.id || '') : String(v ?? ''));

const newClientMsgId = () =>
  `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

// Coalesce bursts of fetchChats() calls (every incoming message used to trigger one)
let fetchChatsTimer: ReturnType<typeof setTimeout> | null = null;
let fetchChatsInFlight = false;
let fetchChatsQueued = false;

const initialState = {
  chats: [] as IChat[],
  activeChat: null as IChat | null,
  messages: {} as Record<string, IMessage[]>,
  hasMoreMessages: {} as Record<string, boolean>,
  typingUsers: {} as Record<string, string>,
  recordingUsers: {} as Record<string, string>,
  isLoadingChats: false,
  isLoadingMessages: false,
  replyingTo: null as IMessage | null,
  searchFilter: '',
  showArchived: false,
  currentUserId: null as string | null
};

export const useChatStore = create<ChatState>((set, get) => {
  /** Replace/insert a message in a chat list without ever creating duplicates. */
  const upsertMessage = (msg: IMessage) => {
    const chatId = idOf(msg.chatId);
    set((state) => {
      const list = state.messages[chatId] || [];
      const idx = list.findIndex(
        (m) => m._id === msg._id || (msg.clientMsgId && m.clientMsgId && m.clientMsgId === msg.clientMsgId)
      );
      let next: IMessage[];
      if (idx >= 0) {
        next = list.slice();
        // Keep newer local status (e.g. 'read') if the incoming copy is older
        next[idx] = { ...next[idx], ...msg };
      } else {
        next = [...list, msg];
      }
      return { messages: { ...state.messages, [chatId]: next } };
    });
  };

  const patchMessage = (chatId: string, messageId: string, patch: Partial<IMessage>) => {
    set((state) => {
      const list = state.messages[chatId];
      if (!list) return {};
      return {
        messages: {
          ...state.messages,
          [chatId]: list.map((m) => (m._id === messageId ? { ...m, ...patch } : m))
        }
      };
    });
  };

  return {
    ...initialState,

    setReplyingTo: (msg) => set({ replyingTo: msg }),
    setSearchFilter: (query) => set({ searchFilter: query }),

    reset: () => {
      if (fetchChatsTimer) clearTimeout(fetchChatsTimer);
      fetchChatsTimer = null;
      set({ ...initialState });
    },

    setShowArchived: (v) => {
      set({ showArchived: v });
      get().fetchChats();
    },

    fetchChats: async () => {
      if (fetchChatsInFlight) {
        fetchChatsQueued = true;
        return;
      }
      fetchChatsInFlight = true;
      if (get().chats.length === 0) set({ isLoadingChats: true });
      try {
        const res = await api.get('/chats', { params: { archived: get().showArchived } });
        const chats: IChat[] = res.data.data;
        set((state) => {
          // Keep the open chat object fresh (online status, members, etc.)
          const active = state.activeChat ? chats.find((c) => c._id === state.activeChat!._id) : null;
          return {
            chats,
            isLoadingChats: false,
            activeChat: state.activeChat ? active || state.activeChat : null
          };
        });
      } catch {
        set({ isLoadingChats: false });
      } finally {
        fetchChatsInFlight = false;
        if (fetchChatsQueued) {
          fetchChatsQueued = false;
          get().fetchChats();
        }
      }
    },

    setActiveChat: (chat) => {
      set({ activeChat: chat, replyingTo: null });
      if (chat) {
        // Optimistically clear unread badge locally
        const uid = get().currentUserId;
        set((state) => ({
          chats: state.chats.map((c) =>
            c._id === chat._id
              ? {
                  ...c,
                  membersMeta: c.membersMeta.map((m) =>
                    idOf(m.userId) === uid ? { ...m, unreadCount: 0 } : m
                  )
                }
              : c
          )
        }));
        get().fetchMessages(chat._id);
      }
    },

    fetchMessages: async (chatId: string) => {
      if (!get().messages[chatId]) set({ isLoadingMessages: true });
      try {
        const res = await api.get(`/messages/chat/${chatId}`, { params: { limit: 50 } });
        const fetched: IMessage[] = res.data.data;
        const hasMore = Boolean(res.data.pagination?.hasMore);

        set((state) => {
          // Merge: keep any optimistic (pending) messages that the server hasn't confirmed yet
          const pending = (state.messages[chatId] || []).filter(
            (m) =>
              (m.status === 'pending' || m.status === 'failed') &&
              !fetched.some((f) => f._id === m._id || (f.clientMsgId && f.clientMsgId === m.clientMsgId))
          );
          return {
            messages: { ...state.messages, [chatId]: [...fetched, ...pending] },
            hasMoreMessages: { ...state.hasMoreMessages, [chatId]: hasMore },
            isLoadingMessages: false
          };
        });

        // Only mark INCOMING, not-yet-read messages as read
        const uid = get().currentUserId;
        const unread = fetched.filter((m) => {
          if (idOf(m.senderId) === uid) return false;
          return !(m.readBy || []).some((r) => idOf(r.userId) === uid);
        });
        if (unread.length > 0 || get().activeChat?._id === chatId) {
          socketService.emitMessageRead(chatId, unread.map((m) => m._id));
        }
      } catch {
        set({ isLoadingMessages: false });
      }
    },

    loadOlderMessages: async (chatId: string) => {
      const list = get().messages[chatId] || [];
      const oldest = list.find((m) => !m._id.startsWith('local_'));
      if (!oldest || !get().hasMoreMessages[chatId]) return;
      try {
        const res = await api.get(`/messages/chat/${chatId}`, { params: { before: oldest._id, limit: 50 } });
        const older: IMessage[] = res.data.data;
        set((state) => ({
          messages: { ...state.messages, [chatId]: [...older, ...(state.messages[chatId] || [])] },
          hasMoreMessages: { ...state.hasMoreMessages, [chatId]: Boolean(res.data.pagination?.hasMore) }
        }));
      } catch {
        /* ignore */
      }
    },

    sendMessage: async (payload) => {
      const { activeChat, replyingTo, currentUserId } = get();
      if (!activeChat) return;
      const chatId = activeChat._id;
      const clientMsgId = newClientMsgId();
      const localId = `local_${clientMsgId}`;

      // 1) Optimistic bubble appears instantly
      const optimistic: IMessage = {
        _id: localId,
        chatId,
        senderId: currentUserId || '',
        type: (payload.type as any) || 'text',
        content: payload.content || '',
        attachments: payload.attachments,
        location: payload.location,
        contact: payload.contact,
        replyTo: replyingTo
          ? {
              messageId: replyingTo._id,
              senderId: idOf(replyingTo.senderId),
              senderName: typeof replyingTo.senderId === 'object' ? (replyingTo.senderId as any).name : 'User',
              type: replyingTo.type,
              content: replyingTo.content,
              thumbnailUrl: replyingTo.attachments?.[0]?.thumbnailUrl
            }
          : undefined,
        status: 'pending',
        reactions: [],
        readBy: [],
        deliveredTo: [],
        isStarredBy: [],
        isPinned: false,
        isEdited: false,
        isDeletedForEveryone: false,
        deletedForUserIds: [],
        clientMsgId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      upsertMessage(optimistic);
      set({ replyingTo: null });

      try {
        const res = await api.post('/messages', {
          chatId,
          type: payload.type || 'text',
          content: payload.content || '',
          attachments: payload.attachments,
          location: payload.location,
          contact: payload.contact,
          replyToId: replyingTo?._id,
          clientMsgId
        });
        const saved: IMessage = res.data.data;

        // 2) Swap the optimistic bubble for the saved one (socket may already have delivered it)
        set((state) => {
          const list = (state.messages[chatId] || []).filter((m) => m._id !== localId);
          const exists = list.some((m) => m._id === saved._id);
          return {
            messages: {
              ...state.messages,
              [chatId]: exists ? list.map((m) => (m._id === saved._id ? { ...m, ...saved } : m)) : [...list, saved]
            }
          };
        });
        get().fetchChats();
      } catch (err) {
        console.error('Failed to send message:', err);
        patchMessage(chatId, localId, { status: 'failed' });
      }
    },

    forwardMessage: async (messageId, targetChatIds) => {
      try {
        await api.post('/messages/forward', { messageIds: [messageId], targetChatIds });
        get().fetchChats();
        return true;
      } catch {
        return false;
      }
    },

    editMessage: async (messageId: string, newContent: string) => {
      const { activeChat } = get();
      if (!activeChat) return;
      try {
        const res = await api.put(`/messages/${messageId}`, { content: newContent });
        patchMessage(activeChat._id, messageId, { content: res.data.data.content, isEdited: true });
      } catch (err) {
        console.error('Failed to edit message:', err);
      }
    },

    deleteMessageForMe: async (messageId: string) => {
      const { activeChat } = get();
      if (!activeChat) return;
      try {
        await api.delete(`/messages/${messageId}/me`);
        set((state) => ({
          messages: {
            ...state.messages,
            [activeChat._id]: (state.messages[activeChat._id] || []).filter((m) => m._id !== messageId)
          }
        }));
        get().fetchChats();
      } catch (err) {
        console.error('Failed to delete message for me:', err);
      }
    },

    deleteMessageForEveryone: async (messageId: string) => {
      const { activeChat } = get();
      if (!activeChat) return;
      try {
        await api.delete(`/messages/${messageId}/everyone`);
        patchMessage(activeChat._id, messageId, { content: 'This message was deleted', isDeletedForEveryone: true });
        get().fetchChats();
      } catch (err) {
        console.error('Failed to delete message for everyone:', err);
      }
    },

    reactToMessage: async (messageId: string, emoji: string) => {
      const { activeChat } = get();
      if (!activeChat) return;
      try {
        const res = await api.post(`/messages/${messageId}/react`, { emoji });
        patchMessage(activeChat._id, messageId, { reactions: res.data.data });
      } catch (err) {
        console.error('Failed to react:', err);
      }
    },

    toggleStarMessage: async (messageId: string, star: boolean) => {
      const { activeChat, currentUserId } = get();
      if (!activeChat) return;
      try {
        await api.post(`/messages/${messageId}/star`, { star });
        const list = get().messages[activeChat._id] || [];
        const msg = list.find((m) => m._id === messageId);
        if (msg && currentUserId) {
          const stars = (msg.isStarredBy || []).map(String).filter((id) => id !== currentUserId);
          patchMessage(activeChat._id, messageId, { isStarredBy: star ? [...stars, currentUserId] : stars });
        }
      } catch {}
    },

    togglePinMessage: async (messageId: string, pin: boolean) => {
      const { activeChat } = get();
      if (!activeChat) return;
      try {
        await api.post(`/messages/${messageId}/pin`, { pin });
        // Only one pinned message at a time in the UI
        set((state) => ({
          messages: {
            ...state.messages,
            [activeChat._id]: (state.messages[activeChat._id] || []).map((m) =>
              m._id === messageId ? { ...m, isPinned: pin } : pin ? { ...m, isPinned: false } : m
            )
          }
        }));
      } catch {}
    },

    togglePinChat: async (chatId: string, pin: boolean) => {
      try {
        await api.post(`/chats/${chatId}/pin`, { pin });
        get().fetchChats();
      } catch {}
    },

    toggleArchiveChat: async (chatId: string, archive: boolean) => {
      try {
        await api.post(`/chats/${chatId}/archive`, { archive });
        if (get().activeChat?._id === chatId) set({ activeChat: null });
        get().fetchChats();
      } catch {}
    },

    clearChat: async (chatId: string) => {
      try {
        await api.post(`/chats/${chatId}/clear`);
        set((state) => ({ messages: { ...state.messages, [chatId]: [] } }));
        get().fetchChats();
      } catch {}
    },

    /** Re-fetch everything that may have changed while the socket was down. */
    resync: () => {
      if (fetchChatsTimer) clearTimeout(fetchChatsTimer);
      fetchChatsTimer = setTimeout(() => {
        get().fetchChats();
        const active = get().activeChat;
        if (active) get().fetchMessages(active._id);
      }, 150);
    },

    teardownSocketListeners: () => {
      const socket = socketService.getSocket();
      if (!socket) return;
      CHAT_SOCKET_EVENTS.forEach((e) => socket.off(e));
    },

    setupSocketListeners: (userId: string) => {
      const socket = socketService.getSocket();
      if (!socket) return;
      set({ currentUserId: userId });

      // Remove old handlers first so re-running this never double-binds
      CHAT_SOCKET_EVENTS.forEach((e) => socket.off(e));

      const scheduleChatsRefresh = () => {
        if (fetchChatsTimer) clearTimeout(fetchChatsTimer);
        fetchChatsTimer = setTimeout(() => get().fetchChats(), 250);
      };

      // ---- Incoming messages ----
      socket.on('message:new', (msg: IMessage) => {
        const chatId = idOf(msg.chatId);
        const mine = idOf(msg.senderId) === userId;
        upsertMessage({ ...msg, chatId });

        if (!mine) {
          // Tell the sender it reached us
          socketService.emitMessageDelivered([msg._id]);

          const { activeChat } = get();
          const viewing = activeChat?._id === chatId && document.visibilityState === 'visible';
          if (viewing) {
            socketService.emitMessageRead(chatId, [msg._id]);
          } else if (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted' &&
            document.hidden
          ) {
            const senderName = typeof msg.senderId === 'object' ? (msg.senderId as any).name : 'New message';
            try {
              new Notification(senderName, { body: msg.content || 'Sent media', icon: '/icon-192.png' });
            } catch {}
          }
        }
        scheduleChatsRefresh();
      });

      // Server's edit payload: { chatId, messageId, content, isEdited, editedAt }
      socket.on('message:edit', (p: any) => {
        const chatId = idOf(p.chatId);
        const messageId = idOf(p.messageId || p._id);
        patchMessage(chatId, messageId, { content: p.content, isEdited: true });
        scheduleChatsRefresh();
      });

      socket.on('message:status', ({ chatId, messageIds, status }: any) => {
        if (!chatId || !Array.isArray(messageIds)) return;
        const rank: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3, failed: -1 };
        set((state) => ({
          messages: {
            ...state.messages,
            [chatId]: (state.messages[chatId] || []).map((m) =>
              messageIds.includes(m._id) && (rank[status] ?? 0) > (rank[m.status] ?? 0) ? { ...m, status } : m
            )
          }
        }));
      });

      socket.on('message:delete', ({ chatId, messageId }: any) => {
        patchMessage(idOf(chatId), idOf(messageId), { content: 'This message was deleted', isDeletedForEveryone: true });
        scheduleChatsRefresh();
      });

      socket.on('message:reaction', ({ chatId, messageId, reactions }: any) => {
        patchMessage(idOf(chatId), idOf(messageId), { reactions });
      });

      socket.on('message:pin', ({ chatId, messageId, isPinned }: any) => {
        const cId = idOf(chatId);
        const mId = idOf(messageId);
        set((state) => ({
          messages: {
            ...state.messages,
            [cId]: (state.messages[cId] || []).map((m) =>
              m._id === mId ? { ...m, isPinned } : isPinned ? { ...m, isPinned: false } : m
            )
          }
        }));
      });

      // ---- Chat list changes ----
      socket.on('chat:new', () => scheduleChatsRefresh());
      socket.on('chat:updated', () => scheduleChatsRefresh());
      socket.on('chat:members_added', () => scheduleChatsRefresh());
      socket.on('chat:disappearing_update', () => scheduleChatsRefresh());

      socket.on('chat:member_removed', ({ chatId, memberId }: any) => {
        const cId = idOf(chatId);
        if (idOf(memberId) === userId) {
          // I was removed / I left: drop the chat locally
          set((state) => ({
            chats: state.chats.filter((c) => c._id !== cId),
            activeChat: state.activeChat?._id === cId ? null : state.activeChat
          }));
        }
        scheduleChatsRefresh();
      });

      socket.on('chat:unread_cleared', ({ chatId }: any) => {
        set((state) => ({
          chats: state.chats.map((c) =>
            c._id === chatId
              ? { ...c, membersMeta: c.membersMeta.map((m) => (idOf(m.userId) === userId ? { ...m, unreadCount: 0 } : m)) }
              : c
          )
        }));
      });

      // ---- Presence: update online dot / last seen everywhere without a refetch ----
      const applyPresence = (targetId: string, patch: { isOnline: boolean; lastSeen?: string }) => {
        set((state) => {
          const patchUser = (u: any) => (u && u._id === targetId ? { ...u, ...patch } : u);
          return {
            chats: state.chats.map((c) => ({ ...c, participants: c.participants.map(patchUser) })),
            activeChat: state.activeChat
              ? { ...state.activeChat, participants: state.activeChat.participants.map(patchUser) }
              : null
          };
        });
      };
      socket.on('user:online', ({ userId: id }: any) => applyPresence(idOf(id), { isOnline: true }));
      socket.on('user:offline', ({ userId: id, lastSeen }: any) =>
        applyPresence(idOf(id), { isOnline: false, lastSeen: lastSeen ? new Date(lastSeen).toISOString() : undefined })
      );

      // ---- Typing / recording indicators (auto-expire so they can never stick) ----
      const timers: Record<string, ReturnType<typeof setTimeout>> = {};
      const setIndicator = (kind: 'typingUsers' | 'recordingUsers', chatId: string, name: string, on: boolean) => {
        const key = `${kind}:${chatId}`;
        if (timers[key]) clearTimeout(timers[key]);
        set((state) => {
          const next = { ...state[kind] };
          if (on) next[chatId] = name;
          else delete next[chatId];
          return { [kind]: next } as any;
        });
        if (on) {
          timers[key] = setTimeout(() => setIndicator(kind, chatId, name, false), 5000);
        }
      };
      socket.on('chat:typing', ({ chatId, userName, isTyping }: any) => setIndicator('typingUsers', chatId, userName, Boolean(isTyping)));
      socket.on('chat:recording', ({ chatId, userName, isRecording }: any) =>
        setIndicator('recordingUsers', chatId, userName, Boolean(isRecording))
      );

      // ---- Resync after every (re)connect, so nothing needs a manual refresh ----
      socket.on('socket:ready', () => get().resync());
    }
  };
});
