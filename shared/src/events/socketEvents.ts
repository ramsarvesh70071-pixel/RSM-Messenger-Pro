export const SOCKET_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  AUTHENTICATE: 'authenticate',
  AUTHENTICATED: 'authenticated',
  UNAUTHORIZED: 'unauthorized',

  // Presence & User Status
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  USER_LAST_SEEN: 'user:last_seen',
  USER_UPDATE: 'user:update',

  // Messaging
  MESSAGE_SEND: 'message:send',
  MESSAGE_RECEIVE: 'message:receive',
  MESSAGE_DELIVERED: 'message:delivered',
  MESSAGE_READ: 'message:read',
  MESSAGE_EDIT: 'message:edit',
  MESSAGE_DELETE: 'message:delete',
  MESSAGE_REACTION: 'message:reaction',
  MESSAGE_STARRED: 'message:starred',
  MESSAGE_PINNED: 'message:pinned',

  // Chat Indicators
  CHAT_TYPING: 'chat:typing',
  CHAT_RECORDING: 'chat:recording',
  CHAT_JOIN: 'chat:join',
  CHAT_LEAVE: 'chat:leave',

  // Group Management
  GROUP_UPDATE: 'group:update',
  GROUP_MEMBER_ADD: 'group:member_add',
  GROUP_MEMBER_REMOVE: 'group:member_remove',
  GROUP_MEMBER_PROMOTED: 'group:member_promoted',
  GROUP_MEMBER_DEMOTED: 'group:member_demoted',

  // WebRTC Calling
  CALL_INITIATE: 'call:initiate',
  CALL_INCOMING: 'call:incoming',
  CALL_ACCEPT: 'call:accept',
  CALL_REJECT: 'call:reject',
  CALL_END: 'call:end',
  CALL_OFFER: 'call:offer',
  CALL_ANSWER: 'call:answer',
  CALL_ICE_CANDIDATE: 'call:ice_candidate',
  CALL_BUSY: 'call:busy',

  // Status
  STATUS_NEW: 'status:new',
  STATUS_VIEW: 'status:view',
  STATUS_DELETE: 'status:delete'
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
