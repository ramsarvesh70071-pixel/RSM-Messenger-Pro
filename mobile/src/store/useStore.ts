import { create } from 'zustand';
import { Vibration } from 'react-native';
import { User, Conversation, Message, CallSession, Story } from '../types';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import { StorageService } from '../services/storage';
import { NotificationService } from '../services/notification';

interface AppState {
  // Auth
  currentUser: User | null;
  token: string | null;
  isLoading: boolean;
  isRestoringAuth: boolean;
  error: string | null;

  // Preferences
  isDarkMode: boolean;
  toggleDarkMode: () => void;

  // Navigation / UI State
  activeTab: 'chats' | 'status' | 'calls' | 'settings';
  activeConversation: Conversation | null;
  activeStory: Story | null;
  activeCall: CallSession | null;
  searchQuery: string;

  // Real Dynamic Data
  conversations: Conversation[];
  messages: { [conversationId: string]: Message[] };
  registeredUsers: User[];
  onlineUserIds: Set<string>;
  typingUsers: { [chatId: string]: string }; // chatId -> userName
  recordingUsers: { [chatId: string]: string }; // chatId -> userName

  stories: Story[];
  calls: CallSession[];

  // Setters
  setActiveTab: (tab: 'chats' | 'status' | 'calls' | 'settings') => void;
  setActiveConversation: (conv: Conversation | null) => void;
  setActiveStory: (story: Story | null) => void;
  setSearchQuery: (query: string) => void;

  // Dynamic Auth Actions
  restoreAuth: () => Promise<void>;
  requestOtp: (phone: string) => Promise<{ success: boolean; message: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (data: { name?: string; about?: string }) => Promise<void>;
  fetchProfile: () => Promise<void>;

  // Dynamic Chats & Messaging
  fetchConversations: () => Promise<void>;
  fetchMessages: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, content: string, type?: Message['type'], replyTo?: Message['replyTo'], mediaUrl?: string) => Promise<void>;
  sendVoiceNote: (chatId: string, audioFile: { uri: string; durationSec: number }) => Promise<void>;
  sendImageMessage: (chatId: string, imageFile: { uri: string; name: string; type: string }) => Promise<void>;
  sendDocumentMessage: (chatId: string, docFile: { uri: string; name: string; type: string; size?: number }) => Promise<void>;
  sendLocationMessage: (chatId: string, loc: { latitude: number; longitude: number; address?: string }) => Promise<void>;
  addReaction: (messageId: string, emoji: string, chatId: string) => Promise<void>;
  toggleStarMessage: (messageId: string, chatId: string) => Promise<void>;
  deleteMessage: (messageId: string, chatId: string, forEveryone?: boolean) => Promise<void>;
  togglePinChat: (chatId: string) => Promise<void>;
  toggleMuteChat: (chatId: string) => Promise<void>;
  setDisappearingDuration: (chatId: string, durationSeconds: number) => Promise<void>;
  clearChatHistory: (chatId: string) => Promise<void>;

  // Contacts & Groups
  fetchRegisteredUsers: (query?: string) => Promise<void>;
  startConversationWithUser: (targetUser: User) => Promise<Conversation | null>;
  createNewGroup: (name: string, participantIds: string[], description?: string) => Promise<Conversation | null>;

  // Status / Stories
  fetchStories: () => Promise<void>;
  postStatusUpdate: (text: string, backgroundColor?: string, mediaUrl?: string) => Promise<void>;
  markStoryViewed: (storyId: string) => Promise<void>;

  // Calls
  fetchCallHistory: () => Promise<void>;
  startCall: (targetUser: User, type: 'voice' | 'video', chatId?: string) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;

  // Real-time Socket Setup
  initSocketListeners: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  currentUser: null,
  token: null,
  isLoading: false,
  isRestoringAuth: true,
  error: null,
  isDarkMode: false,

  activeTab: 'chats',
  activeConversation: null,
  activeStory: null,
  activeCall: null,
  searchQuery: '',

  conversations: [],
  messages: {},
  registeredUsers: [],
  onlineUserIds: new Set<string>(),
  typingUsers: {},
  recordingUsers: {},
  stories: [],
  calls: [],

  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveConversation: (conv) => set({ activeConversation: conv }),
  setActiveStory: (story) => set({ activeStory: story }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  // -------------------------------------------------------------
  // AUTH ACTIONS
  // -------------------------------------------------------------
  restoreAuth: async () => {
    try {
      const savedUser = await StorageService.getUser();
      const savedToken = await StorageService.getToken();

      if (savedUser && savedToken) {
        api.setToken(savedToken);
        set({ currentUser: savedUser, token: savedToken });

        // Connect real Socket
        socketService.connect(savedToken);
        get().initSocketListeners();

        // Register push token
        NotificationService.registerForPushNotifications();

        // Load data in background
        Promise.all([
          get().fetchConversations(),
          get().fetchRegisteredUsers(),
          get().fetchStories(),
          get().fetchCallHistory(),
          get().fetchProfile(),
        ]).catch(() => {});
      }
    } catch (e) {
      console.warn('Auth restore error:', e);
    } finally {
      set({ isRestoringAuth: false });
    }
  },

  requestOtp: async (phone: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.requestOtp(phone);
      return { success: true, message: res.message || 'OTP sent successfully' };
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to send OTP';
      set({ error: msg });
      return { success: false, message: msg };
    } finally {
      set({ isLoading: false });
    }
  },

  verifyOtp: async (phone: string, otp: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.verifyOtp(phone, otp);
      if (res?.data?.accessToken) {
        const accessToken = res.data.accessToken;
        const u = res.data.user;
        api.setToken(accessToken);

        const mappedUser: User = {
          id: u._id || u.id,
          name: u.name || 'User',
          phone: u.phoneNumber || phone,
          username: u.username,
          avatar: u.avatarUrl,
          statusMessage: u.about || 'Hey there! I am using RSM Messenger.',
          isOnline: true,
        };

        set({ currentUser: mappedUser, token: accessToken, error: null });

        // Connect real Socket
        socketService.connect(accessToken);
        get().initSocketListeners();

        // Register push notifications
        NotificationService.registerForPushNotifications();

        // Fetch dynamic resources
        await Promise.all([
          get().fetchConversations(),
          get().fetchRegisteredUsers(),
          get().fetchStories(),
          get().fetchCallHistory(),
        ]);

        return true;
      }
      return false;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Verification failed';
      set({ error: msg });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    socketService.disconnect();
    api.logout().catch(() => {});
    set({
      currentUser: null,
      token: null,
      conversations: [],
      messages: {},
      registeredUsers: [],
      stories: [],
      calls: [],
      activeConversation: null,
      activeCall: null,
      activeStory: null,
    });
  },

  fetchProfile: async () => {
    try {
      const res = await api.getProfile();
      if (res?.data) {
        const u = res.data;
        const updated: User = {
          id: u._id || u.id,
          name: u.name,
          phone: u.phoneNumber,
          username: u.username,
          avatar: u.avatarUrl,
          statusMessage: u.about,
          isOnline: true,
        };
        set({ currentUser: updated });
        await StorageService.setUser(updated);
      }
    } catch (err) {
      console.log('Error fetching profile:', err);
    }
  },

  updateProfile: async (data) => {
    try {
      const res = await api.updateProfile(data);
      if (res?.data) {
        const u = res.data;
        set((state) => ({
          currentUser: state.currentUser
            ? {
                ...state.currentUser,
                name: u.name || state.currentUser.name,
                about: u.about || state.currentUser.statusMessage,
                avatar: u.avatarUrl || state.currentUser.avatar,
              }
            : null,
        }));
      }
    } catch (err) {
      console.log('Error updating profile:', err);
    }
  },

  // -------------------------------------------------------------
  // CHATS & MESSAGES
  // -------------------------------------------------------------
  fetchConversations: async () => {
    try {
      const res = await api.getChats();
      if (res?.data && Array.isArray(res.data)) {
        const currentUserId = get().currentUser?.id;
        const mappedList: Conversation[] = res.data.map((c: any) => {
          const isGroup = c.type === 'group';
          let displayName = c.name;
          let displayAvatar = c.avatarUrl;

          if (!isGroup && c.participants) {
            const other = c.participants.find((p: any) => (p._id || p.id) !== currentUserId);
            if (other) {
              displayName = other.name || other.phoneNumber || 'User';
              displayAvatar = other.avatarUrl;
            }
          }

          const myMeta = c.membersMeta?.find((m: any) => (m.userId?._id || m.userId) === currentUserId);

          return {
            id: c._id || c.id,
            name: displayName || 'Chat',
            isGroup,
            avatar: displayAvatar,
            description: c.description,
            participants: (c.participants || []).map((p: any) => ({
              id: p._id || p.id,
              name: p.name || 'User',
              phone: p.phoneNumber || '',
              avatar: p.avatarUrl,
              isOnline: p.isOnline,
              lastSeen: p.lastSeen,
            })),
            lastMessage: c.lastMessage
              ? {
                  id: c.lastMessage._id || c.lastMessage.id,
                  content: c.lastMessage.content || '',
                  senderName:
                    (c.lastMessage.senderId?._id || c.lastMessage.senderId) === currentUserId
                      ? 'You'
                      : c.lastMessage.senderId?.name || 'Contact',
                  createdAt: new Date(c.lastMessage.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                  type: c.lastMessage.type || 'text',
                  status: c.lastMessage.status || 'read',
                }
              : undefined,
            unreadCount: myMeta?.unreadCount || 0,
            isPinned: myMeta?.isPinned || false,
            isMuted: myMeta?.isMuted || false,
            disappearingDuration: c.disappearingConfig?.durationSeconds || 0,
            updatedAt: c.lastMessageAt || c.updatedAt,
          };
        });

        set({ conversations: mappedList });
      }
    } catch (err) {
      console.log('Error fetching conversations:', err);
    }
  },

  fetchMessages: async (chatId: string) => {
    try {
      const res = await api.getMessages(chatId, 50);
      if (res?.data && Array.isArray(res.data)) {
        const currentUserId = get().currentUser?.id;
        const list: Message[] = res.data.map((m: any) => {
          const sId = m.senderId?._id || m.senderId;
          const isMe = sId === currentUserId;

          return {
            id: m._id || m.id,
            conversationId: chatId,
            senderId: sId,
            senderName: isMe ? 'You' : m.senderId?.name || 'Contact',
            senderAvatar: m.senderId?.avatarUrl,
            content: m.content || '',
            type: m.type || 'text',
            status: m.status || 'delivered',
            createdAt: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            attachments: m.attachments,
            location: m.location,
            contact: m.contact,
            reactions: (m.reactions || []).reduce((acc: any, curr: any) => {
              if (!acc[curr.emoji]) acc[curr.emoji] = [];
              acc[curr.emoji].push(curr.userId?.toString() || curr.userId);
              return acc;
            }, {}),
            replyTo: m.replyTo
              ? {
                  id: m.replyTo._id || m.replyTo.id,
                  senderName: m.replyTo.senderId?.name || 'Contact',
                  content: m.replyTo.content || '',
                }
              : undefined,
            isStarred: !!m.isStarred,
            deletedForEveryone: !!m.isDeletedForEveryone,
          };
        });

        set((state) => ({
          messages: { ...state.messages, [chatId]: list },
        }));

        // Mark read
        api.markMessagesRead(chatId).catch(() => {});
      }
    } catch (err) {
      console.log('Error fetching messages for chat:', chatId, err);
    }
  },

  sendMessage: async (chatId: string, content: string, type: Message['type'] = 'text', replyTo, mediaUrl) => {
    const user = get().currentUser;
    if (!user || (!content.trim() && !mediaUrl)) return;

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      conversationId: chatId,
      senderId: user.id,
      senderName: 'You',
      content,
      type,
      status: 'pending',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      replyTo,
    };

    set((state) => {
      const prev = state.messages[chatId] || [];
      const updatedConvs = state.conversations.map((c) => {
        if (c.id === chatId) {
          return {
            ...c,
            lastMessage: {
              id: tempId,
              content,
              senderName: 'You',
              createdAt: optimisticMsg.createdAt,
              type,
              status: 'pending' as const,
            },
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });

      return {
        messages: { ...state.messages, [chatId]: [...prev, optimisticMsg] },
        conversations: updatedConvs,
      };
    });

    try {
      const res = await api.sendMessage({
        chatId,
        content,
        type,
        replyToId: replyTo?.id,
        mediaUrl,
        clientMsgId: tempId,
      });

      if (res?.data) {
        const realMsg = res.data;
        // Replace temp message with server message
        set((state) => {
          const list = (state.messages[chatId] || []).map((m) =>
            m.id === tempId ? { ...m, id: realMsg._id || realMsg.id, status: 'sent' as const } : m
          );
          return { messages: { ...state.messages, [chatId]: list } };
        });
      }
    } catch (err) {
      console.log('Error sending message:', err);
    }
  },

  // Real voice note recording and upload
  sendVoiceNote: async (chatId: string, audioFile: { uri: string; durationSec: number }) => {
    try {
      const uploadRes = await api.uploadFile({
        uri: audioFile.uri,
        name: `voice_${Date.now()}.m4a`,
        type: 'audio/m4a',
      });

      if (uploadRes?.data?.url) {
        const att = {
          url: uploadRes.data.url,
          mimeType: 'audio/m4a',
          fileSize: uploadRes.data.fileSize || 0,
          fileName: `voice_${Date.now()}.m4a`,
          duration: audioFile.durationSec,
        };

        await api.sendMessage({
          chatId,
          content: 'Voice note',
          type: 'audio',
          attachments: [att],
          clientMsgId: `voice-${Date.now()}`,
        });

        get().fetchMessages(chatId);
      }
    } catch (e) {
      console.warn('sendVoiceNote error:', e);
    }
  },

  // Real image upload and send
  sendImageMessage: async (chatId: string, imageFile: { uri: string; name: string; type: string }) => {
    try {
      const uploadRes = await api.uploadFile(imageFile);
      if (uploadRes?.data?.url) {
        const att = {
          url: uploadRes.data.url,
          thumbnailUrl: uploadRes.data.thumbnailUrl,
          mimeType: imageFile.type,
          fileSize: uploadRes.data.fileSize || 0,
          fileName: imageFile.name,
        };

        await api.sendMessage({
          chatId,
          content: 'Photo',
          type: 'image',
          attachments: [att],
          clientMsgId: `image-${Date.now()}`,
        });

        get().fetchMessages(chatId);
      }
    } catch (e) {
      console.warn('sendImageMessage error:', e);
    }
  },

  // Real document upload and send
  sendDocumentMessage: async (chatId: string, docFile: { uri: string; name: string; type: string; size?: number }) => {
    try {
      const uploadRes = await api.uploadFile({
        uri: docFile.uri,
        name: docFile.name,
        type: docFile.type,
      });

      if (uploadRes?.data?.url) {
        const att = {
          url: uploadRes.data.url,
          mimeType: docFile.type,
          fileSize: uploadRes.data.fileSize || docFile.size || 0,
          fileName: docFile.name,
        };

        await api.sendMessage({
          chatId,
          content: docFile.name,
          type: 'document',
          attachments: [att],
          clientMsgId: `doc-${Date.now()}`,
        });

        get().fetchMessages(chatId);
      }
    } catch (e) {
      console.warn('sendDocumentMessage error:', e);
    }
  },

  // Real location send
  sendLocationMessage: async (chatId: string, loc: { latitude: number; longitude: number; address?: string }) => {
    try {
      await api.sendMessage({
        chatId,
        content: loc.address || 'Shared location',
        type: 'location',
        location: loc,
        clientMsgId: `loc-${Date.now()}`,
      });

      get().fetchMessages(chatId);
    } catch (e) {
      console.warn('sendLocationMessage error:', e);
    }
  },

  addReaction: async (messageId: string, emoji: string, chatId: string) => {
    const user = get().currentUser;
    if (!user) return;

    // Optimistic reaction
    set((state) => {
      const list = (state.messages[chatId] || []).map((m) => {
        if (m.id === messageId) {
          const rx = { ...(m.reactions || {}) };
          if (!rx[emoji]) rx[emoji] = [];
          if (!rx[emoji].includes(user.id)) {
            rx[emoji].push(user.id);
          } else {
            rx[emoji] = rx[emoji].filter((uid) => uid !== user.id);
            if (rx[emoji].length === 0) delete rx[emoji];
          }
          return { ...m, reactions: rx };
        }
        return m;
      });
      return { messages: { ...state.messages, [chatId]: list } };
    });

    try {
      await api.reactToMessage(messageId, emoji);
    } catch (err) {
      console.log('Error adding reaction:', err);
    }
  },

  toggleStarMessage: async (messageId: string, chatId: string) => {
    set((state) => {
      const list = (state.messages[chatId] || []).map((m) =>
        m.id === messageId ? { ...m, isStarred: !m.isStarred } : m
      );
      return { messages: { ...state.messages, [chatId]: list } };
    });

    try {
      await api.starMessage(messageId);
    } catch (err) {
      console.log('Error toggling star:', err);
    }
  },

  deleteMessage: async (messageId: string, chatId: string, forEveryone = true) => {
    set((state) => {
      const list = (state.messages[chatId] || []).map((m) =>
        m.id === messageId ? { ...m, content: 'This message was deleted', deletedForEveryone: true } : m
      );
      return { messages: { ...state.messages, [chatId]: list } };
    });

    try {
      if (forEveryone) {
        await api.deleteForEveryone(messageId);
      } else {
        await api.deleteForMe(messageId);
      }
    } catch (err) {
      console.log('Error deleting message:', err);
    }
  },

  togglePinChat: async (chatId: string) => {
    set((state) => {
      const updated = state.conversations.map((c) =>
        c.id === chatId ? { ...c, isPinned: !c.isPinned } : c
      );
      return { conversations: updated };
    });

    try {
      await api.togglePinChat(chatId);
    } catch (err) {
      console.log('Error toggling pin:', err);
    }
  },

  toggleMuteChat: async (chatId: string) => {
    set((state) => {
      const updated = state.conversations.map((c) =>
        c.id === chatId ? { ...c, isMuted: !c.isMuted } : c
      );
      return { conversations: updated };
    });

    try {
      await api.toggleMuteChat(chatId);
    } catch (err) {
      console.log('Error toggling mute:', err);
    }
  },

  setDisappearingDuration: async (chatId: string, durationSeconds: number) => {
    set((state) => {
      const updated = state.conversations.map((c) =>
        c.id === chatId ? { ...c, disappearingDuration: durationSeconds } : c
      );
      return { conversations: updated };
    });

    try {
      await api.setDisappearingMessages(chatId, durationSeconds);
    } catch (err) {
      console.log('Error setting disappearing duration:', err);
    }
  },

  clearChatHistory: async (chatId: string) => {
    set((state) => ({
      messages: { ...state.messages, [chatId]: [] },
    }));

    try {
      await api.clearChat(chatId);
    } catch (err) {
      console.log('Error clearing chat:', err);
    }
  },

  // -------------------------------------------------------------
  // CONTACTS & GROUPS
  // -------------------------------------------------------------
  fetchRegisteredUsers: async (query?: string) => {
    try {
      const res = await api.getUsers(query);
      if (res?.data && Array.isArray(res.data)) {
        const currentUserId = get().currentUser?.id;
        const filtered = res.data
          .filter((u: any) => (u._id || u.id) !== currentUserId)
          .map((u: any) => ({
            id: u._id || u.id,
            name: u.name || 'User',
            phone: u.phoneNumber || '',
            avatar: u.avatarUrl,
            statusMessage: u.about || 'Available',
            isOnline: u.isOnline,
            lastSeen: u.lastSeen,
          }));
        set({ registeredUsers: filtered });
      }
    } catch (err) {
      console.log('Error fetching registered users:', err);
    }
  },

  startConversationWithUser: async (targetUser: User) => {
    try {
      const res = await api.getOrCreateDirectChat(targetUser.id);
      if (res?.data?.chat) {
        const c = res.data.chat;
        const newConv: Conversation = {
          id: c._id || c.id,
          name: targetUser.name,
          isGroup: false,
          avatar: targetUser.avatar,
          participants: [get().currentUser!, targetUser],
          unreadCount: 0,
          updatedAt: new Date().toISOString(),
        };

        set((state) => {
          const exists = state.conversations.some((x) => x.id === newConv.id);
          return {
            conversations: exists ? state.conversations : [newConv, ...state.conversations],
            activeConversation: newConv,
          };
        });

        return newConv;
      }
      return null;
    } catch (err) {
      console.log('Error starting conversation:', err);
      return null;
    }
  },

  createNewGroup: async (name: string, participantIds: string[], description?: string) => {
    try {
      const res = await api.createGroup(name, participantIds, description);
      if (res?.data) {
        const g = res.data;
        const newConv: Conversation = {
          id: g._id || g.id,
          name: g.name,
          isGroup: true,
          description: g.description,
          participants: g.participants || [],
          unreadCount: 0,
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          conversations: [newConv, ...state.conversations],
          activeConversation: newConv,
        }));

        return newConv;
      }
      return null;
    } catch (err) {
      console.log('Error creating group:', err);
      return null;
    }
  },

  // -------------------------------------------------------------
  // STATUS / STORIES
  // -------------------------------------------------------------
  fetchStories: async () => {
    try {
      const res = await api.getStatusFeed();
      if (res?.data && Array.isArray(res.data)) {
        const mapped: Story[] = res.data.map((s: any) => ({
          id: s._id || s.id,
          userId: s.userId?._id || s.userId,
          userName: s.userId?.name || 'Contact',
          userAvatar: s.userId?.avatarUrl,
          mediaUrl: s.mediaUrl,
          mediaType: s.type || 'text',
          caption: s.content || s.caption,
          backgroundColor: s.backgroundColor || '#075E54',
          createdAt: new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          expiresAt: s.expiresAt,
          viewers: s.views?.map((v: any) => v.userId?.toString() || v.userId) || [],
        }));
        set({ stories: mapped });
      }
    } catch (err) {
      console.log('Error fetching stories:', err);
    }
  },

  postStatusUpdate: async (text: string, backgroundColor = '#075E54', mediaUrl?: string) => {
    try {
      await api.createStatus({
        type: mediaUrl ? 'image' : 'text',
        text,
        content: text,
        mediaUrl,
        backgroundColor,
      });
      await get().fetchStories();
    } catch (err) {
      console.log('Error posting status update:', err);
    }
  },

  markStoryViewed: async (storyId: string) => {
    try {
      await api.viewStatus(storyId);
    } catch (err) {
      console.log('Error viewing story:', err);
    }
  },

  // -------------------------------------------------------------
  // CALLS
  // -------------------------------------------------------------
  fetchCallHistory: async () => {
    try {
      const res = await api.getCallHistory();
      if (res?.data && Array.isArray(res.data)) {
        const mappedCalls: CallSession[] = res.data.map((c: any) => ({
          id: c._id || c.id,
          caller: {
            id: c.caller?._id || c.callerId?._id || c.caller || c.callerId,
            name: c.caller?.name || c.callerId?.name || 'User',
            phone: c.caller?.phoneNumber || c.callerId?.phoneNumber || '',
            avatar: c.caller?.avatarUrl || c.callerId?.avatarUrl,
          },
          receiver: {
            id: c.receiver?._id || c.receiverId?._id || c.receiver || c.receiverId,
            name: c.receiver?.name || c.receiverId?.name || 'User',
            phone: c.receiver?.phoneNumber || c.receiverId?.phoneNumber || '',
            avatar: c.receiver?.avatarUrl || c.receiverId?.avatarUrl,
          },
          type: c.callType || c.type || 'voice',
          status: c.status || 'ended',
          duration: c.duration || c.durationSeconds,
          startTime: new Date(c.createdAt).getTime(),
        }));
        set({ calls: mappedCalls });
      }
    } catch (err) {
      console.log('Error fetching call history:', err);
    }
  },

  startCall: (targetUser: User, type: 'voice' | 'video', chatId?: string) => {
    const user = get().currentUser;
    if (!user) return;

    const session: CallSession = {
      id: `call-${Date.now()}`,
      caller: user,
      receiver: targetUser,
      type,
      status: 'ringing',
      startTime: Date.now(),
    };

    set({ activeCall: session });

    // Emit real signaling over socket
    socketService.initiateCall({ receiverId: targetUser.id, callType: type, chatId });

    // Log call initiation with backend
    api.logCall({ receiverId: targetUser.id, callType: type, status: 'initiated' }).catch(() => {});
  },

  acceptCall: () => {
    const call = get().activeCall;
    if (call) {
      socketService.acceptCall({ callerId: call.caller.id });
    }
    set((state) => ({
      activeCall: state.activeCall ? { ...state.activeCall, status: 'connected' } : null,
    }));
  },

  rejectCall: () => {
    const call = get().activeCall;
    if (call) {
      socketService.rejectCall({ callerId: call.caller.id, reason: 'declined' });
    }
    set({ activeCall: null });
  },

  endCall: () => {
    const call = get().activeCall;
    if (call) {
      const target = call.caller.id === get().currentUser?.id ? call.receiver : call.caller;
      socketService.endCall({ targetUserId: target.id });

      const dur = Math.round((Date.now() - (call.startTime || Date.now())) / 1000);
      api.logCall({ receiverId: target.id, callType: call.type, status: 'completed', duration: dur }).catch(() => {});

      set((state) => ({
        calls: [{ ...call, status: 'ended', duration: dur }, ...state.calls],
        activeCall: null,
      }));
    } else {
      set({ activeCall: null });
    }
  },

  // -------------------------------------------------------------
  // REAL-TIME SOCKET LISTENERS
  // -------------------------------------------------------------
  initSocketListeners: () => {
    const handleIncomingMessage = (msg: any) => {
      const chatId = msg.chatId || msg.chat;
      if (!chatId) return;

      const currentUserId = get().currentUser?.id;
      const sId = msg.senderId?._id || msg.senderId || msg.sender?._id || msg.sender;

      const formatted: Message = {
        id: msg._id || msg.id,
        conversationId: chatId,
        senderId: sId,
        senderName: sId === currentUserId ? 'You' : (msg.senderId?.name || msg.sender?.name || 'Contact'),
        senderAvatar: msg.senderId?.avatarUrl || msg.sender?.avatarUrl,
        content: msg.content || '',
        type: msg.type || 'text',
        status: 'delivered',
        createdAt: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        attachments: msg.attachments,
        location: msg.location,
        contact: msg.contact,
        reactions: (msg.reactions || []).reduce((acc: any, curr: any) => {
          if (!acc[curr.emoji]) acc[curr.emoji] = [];
          acc[curr.emoji].push(curr.userId?.toString() || curr.userId);
          return acc;
        }, {}),
        replyTo: msg.replyTo,
      };

      if (sId !== currentUserId) {
        try {
          Vibration.vibrate(100);
        } catch (_) {}
      }

      set((state) => {
        const prevMessages = state.messages[chatId] || [];
        if (prevMessages.some((m) => m.id === formatted.id)) return state;

        const updatedConvs = state.conversations.map((c) => {
          if (c.id === chatId) {
            return {
              ...c,
              lastMessage: {
                id: formatted.id,
                content: formatted.content,
                senderName: formatted.senderName,
                createdAt: formatted.createdAt,
                type: formatted.type,
                status: 'delivered' as const,
              },
              unreadCount: (state.activeConversation?.id === chatId) ? c.unreadCount : (c.unreadCount + 1),
              updatedAt: new Date().toISOString(),
            };
          }
          return c;
        });

        return {
          messages: { ...state.messages, [chatId]: [...prevMessages, formatted] },
          conversations: updatedConvs,
        };
      });
    };

    // Incoming messages
    socketService.on('message:new', handleIncomingMessage);
    socketService.on('message:receive', handleIncomingMessage);

    // Message status update (sent -> delivered -> read)
    socketService.on('message:status', ({ messageId, messageIds, status }: any) => {
      const ids: string[] = Array.isArray(messageIds) ? messageIds : messageId ? [messageId] : [];
      if (ids.length === 0) return;
      const rank: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3, failed: -1 };
      set((state) => {
        const newMessages: Record<string, Message[]> = {};
        for (const [cId, list] of Object.entries(state.messages)) {
          newMessages[cId] = list.map((m) =>
            ids.includes(m.id) && (rank[status] ?? 0) > (rank[m.status as string] ?? 0) ? { ...m, status } : m
          );
        }
        return { messages: newMessages };
      });
    });

    // Edited messages
    socketService.on('message:edit', ({ chatId, messageId, content }: any) => {
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: (state.messages[chatId] || []).map((m) =>
            m.id === messageId ? { ...m, content, isEdited: true } : m
          ),
        },
      }));
    });

    // Refetch everything missed while the socket was down
    socketService.onReady(() => {
      get().fetchConversations?.();
    });

    // Message read up to messageId
    socketService.on('message:read', ({ chatId, upToMessageId }: any) => {
      set((state) => {
        const list = (state.messages[chatId] || []).map((m) => ({
          ...m,
          status: 'read' as const,
        }));
        return { messages: { ...state.messages, [chatId]: list } };
      });
    });

    // Message reaction updated
    socketService.on('message:reaction', ({ chatId, messageId, emoji, userId }: any) => {
      set((state) => {
        const list = (state.messages[chatId] || []).map((m) => {
          if (m.id === messageId) {
            const rx = { ...(m.reactions || {}) };
            if (!rx[emoji]) rx[emoji] = [];
            if (!rx[emoji].includes(userId)) rx[emoji].push(userId);
            return { ...m, reactions: rx };
          }
          return m;
        });
        return { messages: { ...state.messages, [chatId]: list } };
      });
    });

    // Message deleted
    socketService.on('message:delete', ({ chatId, messageId }: any) => {
      set((state) => {
        const list = (state.messages[chatId] || []).map((m) =>
          m.id === messageId ? { ...m, content: 'This message was deleted', deletedForEveryone: true } : m
        );
        return { messages: { ...state.messages, [chatId]: list } };
      });
    });

    // New conversation created
    socketService.on('chat:new', () => {
      get().fetchConversations();
    });

    // Typing indicator
    socketService.on('chat:typing', ({ chatId, userName, isTyping }: any) => {
      set((state) => {
        const next = { ...state.typingUsers };
        if (isTyping) next[chatId] = userName;
        else delete next[chatId];
        return { typingUsers: next };
      });
    });

    // Audio recording indicator
    socketService.on('chat:recording', ({ chatId, userName, isRecording }: any) => {
      set((state) => {
        const next = { ...state.recordingUsers };
        if (isRecording) next[chatId] = userName;
        else delete next[chatId];
        return { recordingUsers: next };
      });
    });

    // Presence
    socketService.on('user:online', ({ userId }: any) => {
      set((state) => {
        const copy = new Set(state.onlineUserIds);
        copy.add(userId);
        return { onlineUserIds: copy };
      });
    });

    socketService.on('user:offline', ({ userId }: any) => {
      set((state) => {
        const copy = new Set(state.onlineUserIds);
        copy.delete(userId);
        return { onlineUserIds: copy };
      });
    });

    // Call signaling
    socketService.on('call:incoming', ({ callId, caller, callType, chatId }: any) => {
      const user = get().currentUser;
      if (!user) return;

      const session: CallSession = {
        id: callId || `call-${Date.now()}`,
        caller: {
          id: caller._id || caller.id,
          name: caller.name,
          phone: caller.phoneNumber,
          avatar: caller.avatarUrl,
        },
        receiver: user,
        type: callType || 'voice',
        status: 'ringing',
        startTime: Date.now(),
      };

      set({ activeCall: session });
    });

    socketService.on('call:answered', () => {
      set((state) => ({
        activeCall: state.activeCall ? { ...state.activeCall, status: 'connected' } : null,
      }));
    });

    socketService.on('call:ended', () => {
      set({ activeCall: null });
      get().fetchCallHistory();
    });

    socketService.on('call:rejected', () => {
      set({ activeCall: null });
      get().fetchCallHistory();
    });

    socketService.on('call:busy', () => {
      set((state) => ({
        activeCall: state.activeCall ? { ...state.activeCall, status: 'missed' } : null,
      }));
      setTimeout(() => set({ activeCall: null }), 2000);
    });
  },
}));
