import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { DEFAULT_HOST } from '../config/constants';
import { StorageService } from './storage';

class ApiService {
  private client: AxiosInstance;
  private currentHost: string = DEFAULT_HOST;
  private authToken: string | null = null;
  private refreshTokenPromise: Promise<string | null> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: `${this.currentHost}/api/v1`,
      timeout: 30000, // 30s for Render cold start tolerance
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request Interceptor: Attach Auth Token and Device ID
    this.client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
      if (!this.authToken) {
        this.authToken = await StorageService.getToken();
      }
      if (this.authToken) {
        config.headers.Authorization = `Bearer ${this.authToken}`;
      }
      return config;
    });

    // Response Interceptor: Single-flight Refresh Token Rotation
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/')) {
          originalRequest._retry = true;

          try {
            // Single-flight refresh token mutex
            if (!this.refreshTokenPromise) {
              this.refreshTokenPromise = this.refreshAccessToken();
            }
            const newToken = await this.refreshTokenPromise;
            this.refreshTokenPromise = null;

            if (newToken) {
              this.authToken = newToken;
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.client(originalRequest);
            }
          } catch (refreshErr) {
            this.refreshTokenPromise = null;
            await StorageService.clearAll();
            this.authToken = null;
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private async refreshAccessToken(): Promise<string | null> {
    const refreshToken = await StorageService.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const deviceId = await StorageService.getDeviceId();
      const res = await axios.post(`${this.currentHost}/api/v1/auth/refresh-token`, {
        refreshToken,
        deviceId,
      });

      if (res.data?.success && res.data?.data?.accessToken) {
        const newAccessToken = res.data.data.accessToken;
        const newRefreshToken = res.data.data.refreshToken || refreshToken;
        await StorageService.setToken(newAccessToken);
        await StorageService.setRefreshToken(newRefreshToken);
        this.authToken = newAccessToken;
        return newAccessToken;
      }
    } catch {
      await StorageService.clearAll();
    }
    return null;
  }

  public setHost(host: string) {
    this.currentHost = host.trim().replace(/\/+$/, '');
    this.client.defaults.baseURL = `${this.currentHost}/api/v1`;
  }

  public getHost(): string {
    return this.currentHost;
  }

  public setToken(token: string | null) {
    this.authToken = token;
    if (token) {
      StorageService.setToken(token);
    } else {
      StorageService.removeToken();
    }
  }

  public getToken(): string | null {
    return this.authToken;
  }

  // -------------------------------------------------------------
  // AUTH
  // -------------------------------------------------------------
  async requestOtp(phoneNumber: string, countryCode = '+91') {
    const res = await this.client.post('/auth/request-otp', { phoneNumber, countryCode });
    return res.data;
  }

  async verifyOtp(phoneNumber: string, otp: string, countryCode = '+91') {
    const deviceId = await StorageService.getDeviceId();
    const res = await this.client.post('/auth/verify-otp', {
      phoneNumber,
      otp,
      countryCode,
      deviceId,
      deviceName: 'RSM Messenger Android',
      deviceType: 'android',
    });

    if (res.data?.success && res.data?.data) {
      const { accessToken, refreshToken, user } = res.data.data;
      if (accessToken) {
        this.setToken(accessToken);
        await StorageService.setToken(accessToken);
      }
      if (refreshToken) {
        await StorageService.setRefreshToken(refreshToken);
      }
      if (user) {
        await StorageService.setUser(user);
      }
    }
    return res.data;
  }

  async logout() {
    try {
      const deviceId = await StorageService.getDeviceId();
      await this.client.post('/auth/logout', { deviceId });
    } catch {}
    await StorageService.clearAll();
    this.authToken = null;
  }

  async getProfile() {
    const res = await this.client.get('/users/profile');
    return res.data;
  }

  async updateProfile(data: { name?: string; about?: string; username?: string; avatarUrl?: string }) {
    const res = await this.client.put('/users/profile', data);
    return res.data;
  }

  // -------------------------------------------------------------
  // USERS & CONTACTS
  // -------------------------------------------------------------
  async getUsers(searchQuery?: string) {
    const res = await this.client.get('/users', {
      params: searchQuery ? { q: searchQuery } : {},
    });
    return res.data;
  }

  async getUserById(userId: string) {
    const res = await this.client.get(`/users/${userId}`);
    return res.data;
  }

  async syncContacts(phoneNumbers: string[]) {
    const res = await this.client.post('/contacts/sync', { phoneNumbers });
    return res.data;
  }

  async getContacts() {
    const res = await this.client.get('/contacts');
    return res.data;
  }

  async getBlockedUsers() {
    const res = await this.client.get('/users/blocked');
    return res.data;
  }

  async blockUser(userId: string, reason?: string) {
    const res = await this.client.post('/users/block', { targetUserId: userId, reason });
    return res.data;
  }

  async unblockUser(userId: string) {
    const res = await this.client.delete(`/users/block/${userId}`);
    return res.data;
  }

  async getPrivacySettings() {
    const res = await this.client.get('/users/privacy');
    return res.data;
  }

  async updatePrivacySettings(settings: Record<string, any>) {
    const res = await this.client.put('/users/privacy', settings);
    return res.data;
  }

  // -------------------------------------------------------------
  // CHATS & CONVERSATIONS
  // -------------------------------------------------------------
  async getChats(archived = false) {
    const res = await this.client.get('/chats', { params: { archived } });
    return res.data;
  }

  async getOrCreateDirectChat(recipientId: string) {
    // Aligns with server accepting both recipientId and targetUserId
    const res = await this.client.post('/chats/direct', {
      recipientId,
      targetUserId: recipientId,
    });
    return res.data;
  }

  async createGroup(name: string, participantIds: string[], description?: string) {
    // Aligns with server accepting both participantIds and memberIds
    const res = await this.client.post('/groups', {
      name,
      participantIds,
      memberIds: participantIds,
      description,
    });
    return res.data;
  }

  async getGroupDetails(groupId: string) {
    const res = await this.client.get(`/groups/${groupId}`);
    return res.data;
  }

  async addGroupMember(groupId: string, userId: string) {
    const res = await this.client.post(`/groups/${groupId}/members`, { userId });
    return res.data;
  }

  async removeGroupMember(groupId: string, userId: string) {
    const res = await this.client.delete(`/groups/${groupId}/members/${userId}`);
    return res.data;
  }

  async setMemberRole(groupId: string, userId: string, role: 'admin' | 'member') {
    const res = await this.client.put(`/groups/${groupId}/members/${userId}/role`, { role });
    return res.data;
  }

  async updateGroupSettings(groupId: string, settings: Record<string, any>) {
    const res = await this.client.put(`/groups/${groupId}/settings`, settings);
    return res.data;
  }

  async leaveGroup(groupId: string) {
    const res = await this.client.post(`/groups/${groupId}/leave`);
    return res.data;
  }

  async togglePinChat(chatId: string) {
    const res = await this.client.post(`/chats/${chatId}/pin`);
    return res.data;
  }

  async toggleMuteChat(chatId: string, duration?: string) {
    const res = await this.client.post(`/chats/${chatId}/mute`, { duration });
    return res.data;
  }

  async toggleArchiveChat(chatId: string) {
    const res = await this.client.post(`/chats/${chatId}/archive`);
    return res.data;
  }

  async setDisappearingMessages(chatId: string, durationSeconds: number) {
    const res = await this.client.post(`/chats/${chatId}/disappearing`, { durationSeconds });
    return res.data;
  }

  async clearChat(chatId: string) {
    const res = await this.client.post(`/chats/${chatId}/clear`);
    return res.data;
  }

  // -------------------------------------------------------------
  // MESSAGES
  // -------------------------------------------------------------
  async getMessages(chatId: string, limit = 30, before?: string) {
    const res = await this.client.get(`/messages/chat/${chatId}`, {
      params: { limit, before },
    });
    return res.data;
  }

  async getMessageContext(chatId: string, messageId: string) {
    const res = await this.client.get(`/messages/chat/${chatId}/context/${messageId}`);
    return res.data;
  }

  async sendMessage(payload: {
    chatId: string;
    content: string;
    type?: string;
    replyToId?: string;
    mediaUrl?: string;
    attachments?: any[];
    location?: { latitude: number; longitude: number; name?: string; address?: string };
    contact?: { name: string; phoneNumber: string; avatarUrl?: string };
    clientMsgId?: string;
  }) {
    const res = await this.client.post('/messages', {
      chatId: payload.chatId,
      content: payload.content,
      type: payload.type || 'text',
      replyToId: payload.replyToId,
      mediaUrl: payload.mediaUrl,
      attachments: payload.attachments,
      location: payload.location,
      contact: payload.contact,
      clientMsgId: payload.clientMsgId,
    });
    return res.data;
  }

  async editMessage(messageId: string, content: string) {
    const res = await this.client.put(`/messages/${messageId}`, { content });
    return res.data;
  }

  async reactToMessage(messageId: string, emoji: string) {
    const res = await this.client.post(`/messages/${messageId}/react`, { emoji });
    return res.data;
  }

  async starMessage(messageId: string) {
    const res = await this.client.post(`/messages/${messageId}/star`);
    return res.data;
  }

  async getStarredMessages() {
    const res = await this.client.get('/messages/starred');
    return res.data;
  }

  async deleteForMe(messageId: string) {
    const res = await this.client.delete(`/messages/${messageId}/me`);
    return res.data;
  }

  async deleteForEveryone(messageId: string) {
    const res = await this.client.delete(`/messages/${messageId}/everyone`);
    return res.data;
  }

  async forwardMessage(messageIds: string[], targetChatIds: string[]) {
    const res = await this.client.post('/messages/forward', { messageIds, targetChatIds });
    return res.data;
  }

  async markMessagesRead(chatId: string, messageId?: string) {
    const res = await this.client.post('/messages/read', { chatId, messageId });
    return res.data;
  }

  async markMessagesDelivered(messageIds: string[]) {
    const res = await this.client.post('/messages/delivered', { messageIds });
    return res.data;
  }

  async searchMessages(query: string, chatId?: string) {
    const res = await this.client.get('/messages/search', {
      params: { q: query, chatId },
    });
    return res.data;
  }

  // -------------------------------------------------------------
  // STATUS / STORIES
  // -------------------------------------------------------------
  async getStatusFeed() {
    const res = await this.client.get('/status/feed');
    return res.data;
  }

  async getMyStatuses() {
    const res = await this.client.get('/status/my');
    return res.data;
  }

  async createStatus(data: {
    type: 'text' | 'image' | 'video';
    text?: string;
    content?: string;
    mediaUrl?: string;
    backgroundColor?: string;
  }) {
    // Aligns with server accepting both text/content
    const res = await this.client.post('/status', {
      ...data,
      content: data.content || data.text,
      text: data.text || data.content,
    });
    return res.data;
  }

  async viewStatus(statusId: string) {
    const res = await this.client.post(`/status/${statusId}/view`);
    return res.data;
  }

  async deleteStatus(statusId: string) {
    const res = await this.client.delete(`/status/${statusId}`);
    return res.data;
  }

  // -------------------------------------------------------------
  // CALLS
  // -------------------------------------------------------------
  async getIceServers() {
    const res = await this.client.get('/calls/ice-servers');
    return res.data;
  }

  async getCallHistory() {
    const res = await this.client.get('/calls/history');
    return res.data;
  }

  async logCall(payload: {
    receiverId: string;
    callType: 'voice' | 'video';
    status?: string;
    duration?: number;
    durationSeconds?: number;
  }) {
    const res = await this.client.post('/calls/log', {
      ...payload,
      duration: payload.duration || payload.durationSeconds,
      durationSeconds: payload.durationSeconds || payload.duration,
    });
    return res.data;
  }

  async updateCallStatus(callId: string, status: string, durationSeconds?: number) {
    const res = await this.client.put(`/calls/log/${callId}`, { status, durationSeconds });
    return res.data;
  }

  async deleteCallLog(callId: string) {
    const res = await this.client.delete(`/calls/log/${callId}`);
    return res.data;
  }

  // -------------------------------------------------------------
  // MEDIA UPLOAD
  // -------------------------------------------------------------
  async uploadFile(file: { uri: string; name: string; type: string }) {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);

    const res = await this.client.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  }

  // -------------------------------------------------------------
  // DEVICES & PUSH TOKENS
  // -------------------------------------------------------------
  async getDevices() {
    const res = await this.client.get('/devices');
    return res.data;
  }

  async revokeDevice(deviceId: string) {
    const res = await this.client.delete(`/devices/${deviceId}`);
    return res.data;
  }

  async updatePushToken(pushToken: string) {
    const deviceId = await StorageService.getDeviceId();
    const res = await this.client.put('/devices/push-token', {
      pushToken,
      deviceId,
      deviceName: 'RSM Messenger Android',
      deviceType: 'android',
    });
    return res.data;
  }
}

export const api = new ApiService();
