/**
 * Resolves backend URLs so the app works on desktop AND on a phone opening http://<LAN-IP>:3000.
 * - Empty VITE_* values  -> same origin (Vite dev proxy / reverse proxy handles /api and /socket.io).
 * - A VITE_* value that points to "localhost" while the page is NOT opened from localhost
 *   is ignored, because on a phone "localhost" is the phone itself.
 */
const resolve = (value: string | undefined): string => {
  const v = (value || '').trim().replace(/\/$/, '');
  if (!v) return '';
  if (typeof window !== 'undefined') {
    const pageHost = window.location.hostname;
    const pageIsLocal = pageHost === 'localhost' || pageHost === '127.0.0.1';
    try {
      const target = new URL(v);
      const targetIsLocal = target.hostname === 'localhost' || target.hostname === '127.0.0.1';
      if (targetIsLocal && !pageIsLocal) return '';
    } catch {
      return '';
    }
  }
  return v;
};

const apiOrigin = resolve(import.meta.env.VITE_API_URL);
const socketOrigin = resolve(import.meta.env.VITE_SOCKET_URL) || apiOrigin;

export const API_BASE = `${apiOrigin}/api/v1`;
export const SOCKET_URL = socketOrigin || (typeof window !== 'undefined' ? window.location.origin : '/');
export const ADMIN_URL =
  (import.meta.env.VITE_ADMIN_URL as string | undefined)?.trim() ||
  (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:5173` : 'http://localhost:5173');
