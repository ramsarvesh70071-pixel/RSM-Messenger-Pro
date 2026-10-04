import { Platform } from 'react-native';

export const COLORS = {
  primary: '#075E54', // WhatsApp classic dark green
  primaryLight: '#128C7E', // WhatsApp teal green
  accent: '#25D366', // WhatsApp bright green
  accentBlue: '#34B7F1', // WhatsApp tick blue
  background: '#FFFFFF',
  backgroundDark: '#0B141A', // WhatsApp dark mode bg
  surfaceDark: '#111B21',
  surfaceLight: '#F0F2F5',
  cardDark: '#1F2C34',
  textPrimary: '#111B21',
  textSecondary: '#667781',
  textLight: '#E9EDEF',
  textMuted: '#8696A0',
  border: '#E9EDEF',
  borderDark: '#222D34',
  bubbleIn: '#FFFFFF',
  bubbleInDark: '#202C33',
  bubbleOut: '#D9FDD3', // WhatsApp classic outgoing green bubble
  bubbleOutDark: '#005C4B', // WhatsApp dark outgoing bubble
  danger: '#EF4444',
  warning: '#F59E0B',
};

// Production Live Cloud Backend on Render
export const DEFAULT_HOST = 'https://rsm-messenger-server.onrender.com';

export const API_BASE_URL = `${DEFAULT_HOST}/api/v1`;
export const SOCKET_URL = DEFAULT_HOST;
