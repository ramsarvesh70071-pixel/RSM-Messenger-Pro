import { create } from 'zustand';
import { IUser } from '../types';
import { api } from '../services/api';
import { socketService } from '../services/socket.service';
import { useChatStore } from './useChatStore';

interface AuthState {
  user: IUser | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  mockOtpHint: string | null;
  initAuth: () => void;
  requestOtp: (phoneNumber: string) => Promise<boolean>;
  verifyOtp: (phoneNumber: string, otp: string) => Promise<boolean>;
  updateProfile: (data: { name?: string; about?: string; username?: string }) => Promise<boolean>;
  uploadAvatar: (file: File) => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  error: null,
  mockOtpHint: null,

  initAuth: () => {
    const token = localStorage.getItem('rsm_access_token');
    const userStr = localStorage.getItem('rsm_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ token, user, isLoading: false });
        socketService.connect(token);
      } catch {
        localStorage.removeItem('rsm_user');
        set({ isLoading: false });
      }
    } else {
      set({ isLoading: false });
    }
  },

  requestOtp: async (phoneNumber: string) => {
    set({ error: null });
    try {
      const res = await api.post('/auth/request-otp', { phoneNumber });
      if (res.data.data?.mockOtp) {
        set({ mockOtpHint: res.data.data.mockOtp });
      }
      return true;
    } catch (err: any) {
      set({ error: err.response?.data?.message || 'Failed to request OTP' });
      return false;
    }
  },

  verifyOtp: async (phoneNumber: string, otp: string) => {
    set({ error: null });
    try {
      const deviceId = localStorage.getItem('rsm_device_id') || `web_${Date.now()}`;
      localStorage.setItem('rsm_device_id', deviceId);

      const res = await api.post('/auth/verify-otp', {
        phoneNumber,
        otp,
        deviceId,
        deviceName: 'RSM Messenger Web/Mobile Client'
      });

      const { user, accessToken, refreshToken } = res.data.data;
      localStorage.setItem('rsm_access_token', accessToken);
      localStorage.setItem('rsm_refresh_token', refreshToken);
      localStorage.setItem('rsm_user', JSON.stringify(user));

      set({ user, token: accessToken });
      socketService.connect(accessToken);
      return true;
    } catch (err: any) {
      set({ error: err.response?.data?.message || 'Verification failed' });
      return false;
    }
  },

  updateProfile: async (data) => {
    try {
      const res = await api.put('/users/profile', data);
      const updatedUser = res.data.data;
      localStorage.setItem('rsm_user', JSON.stringify(updatedUser));
      set({ user: updatedUser });
      return true;
    } catch {
      return false;
    }
  },

  uploadAvatar: async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const updatedUser = res.data.data;
      localStorage.setItem('rsm_user', JSON.stringify(updatedUser));
      set({ user: updatedUser });
      return true;
    } catch {
      return false;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    localStorage.removeItem('rsm_access_token');
    localStorage.removeItem('rsm_refresh_token');
    localStorage.removeItem('rsm_user');
    socketService.disconnect();
    useChatStore.getState().reset();
    set({ user: null, token: null });
  }
}));

// Refresh token failed anywhere (API or socket) => clean logout
if (typeof window !== 'undefined') {
  window.addEventListener('auth-logout', () => {
    socketService.disconnect();
    useAuthStore.setState({ user: null, token: null });
  });
}
