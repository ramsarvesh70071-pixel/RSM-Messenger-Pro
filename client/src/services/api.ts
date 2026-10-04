import axios from 'axios';
import { API_BASE } from './config';

// config.ts resolves VITE_API_URL safely (a "localhost" URL is ignored when opened from a phone)
const apiBase = API_BASE;
export const API_ORIGIN: string = apiBase.replace(/\/api\/v1$/, '');

/**
 * Turns an uploaded-file URL into something the browser can load from ANY device.
 * Server returns relative paths like /uploads/images/x.jpg; legacy rows may hold absolute localhost URLs.
 */
export const mediaUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (/^https?:\/\//i.test(url)) {
    try {
      const u = new URL(url);
      const isLocal = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
      if (isLocal && u.pathname.startsWith('/uploads') && window.location.hostname !== u.hostname) {
        return `${API_ORIGIN}${u.pathname}${u.search}`;
      }
    } catch {
      /* fall through */
    }
    return url;
  }
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const api = axios.create({
  baseURL: apiBase,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const getStoredToken = (): string | null => localStorage.getItem('rsm_access_token');

// ---- Single-flight token refresh shared by REST and Socket.IO ----
let refreshPromise: Promise<string | null> | null = null;

export const refreshAccessToken = (): Promise<string | null> => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem('rsm_refresh_token');
    const deviceId = localStorage.getItem('rsm_device_id') || 'web_mobile_client';
    if (!refreshToken) return null;
    try {
      const res = await axios.post(`${apiBase}/auth/refresh-token`, { refreshToken, deviceId });
      const { accessToken, refreshToken: newRefresh } = res.data.data;
      localStorage.setItem('rsm_access_token', accessToken);
      if (newRefresh) localStorage.setItem('rsm_refresh_token', newRefresh);
      return accessToken as string;
    } catch (err: any) {
      // Only a definitive 401/403 means the session is dead; network errors must not log the user out
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem('rsm_access_token');
        localStorage.removeItem('rsm_refresh_token');
        localStorage.removeItem('rsm_user');
        window.dispatchEvent(new Event('auth-logout'));
      }
      return null;
    } finally {
      setTimeout(() => {
        refreshPromise = null;
      }, 0);
    }
  })();

  return refreshPromise;
};

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);
