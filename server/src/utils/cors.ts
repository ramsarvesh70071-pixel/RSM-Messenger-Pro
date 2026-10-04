import { env } from '../config/environment';

// Private-network / localhost origins (phone on the same Wi-Fi opening http://192.168.x.x:3000, etc.)
const PRIVATE_ORIGIN_REGEX =
  /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

/**
 * Decides whether a browser Origin may talk to the API / Socket.IO server.
 * - No Origin (native apps, curl) is always allowed.
 * - Explicit CORS_ORIGINS entries (or '*') are honoured everywhere.
 * - Outside production, LAN/localhost origins are allowed so mobile testing just works.
 */
export const isOriginAllowed = (origin?: string): boolean => {
  if (!origin) return true;
  if (env.CORS_ORIGINS.includes('*') || env.CORS_ORIGINS.includes(origin)) return true;
  if (env.NODE_ENV !== 'production' && PRIVATE_ORIGIN_REGEX.test(origin)) return true;
  return false;
};
