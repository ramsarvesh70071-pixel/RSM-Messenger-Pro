import * as SecureStore from 'expo-secure-store';
import { User } from '../types';

const TOKEN_KEY = 'rsm_auth_token';
const REFRESH_TOKEN_KEY = 'rsm_refresh_token';
const DEVICE_ID_KEY = 'rsm_device_id';
const USER_KEY = 'rsm_current_user';

// Simple UUID generator fallback for mobile environment
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class StorageService {
  static async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  static async setToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (e) {
      console.warn('SecureStore setToken error:', e);
    }
  }

  static async removeToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {}
  }

  static async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  static async setRefreshToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    } catch (e) {
      console.warn('SecureStore setRefreshToken error:', e);
    }
  }

  static async removeRefreshToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } catch {}
  }

  static async getDeviceId(): Promise<string> {
    try {
      let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      if (!deviceId) {
        deviceId = `android-${generateUUID()}`;
        await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
      }
      return deviceId;
    } catch {
      return `android-${Date.now()}`;
    }
  }

  static async getUser(): Promise<User | null> {
    try {
      const raw = await SecureStore.getItemAsync(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  static async setUser(user: User): Promise<void> {
    try {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    } catch (e) {
      console.warn('SecureStore setUser error:', e);
    }
  }

  static async clearAll(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch {}
  }
}
