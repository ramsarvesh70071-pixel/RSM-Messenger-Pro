# RSM Messenger Socket.IO Real-Time Protocol Specification

Authentication: Pass token via `auth: { token }` in handshake or `Authorization: Bearer <token>`.
The socket connection validates active sessions against the `SessionCache`. On revocation or logout, the socket is immediately disconnected (`io.in('user:<id>').disconnectSockets()`).

---

## 1. Presence & Lifecycle Events
- **`connect`**: Client establishes connection with valid JWT. Server automatically joins the socket to `user:<userId>` and all member chat rooms `chat:<chatId>`.
- **`user:online`**: Emitted by server only to mutual contacts / shared chat members who meet user privacy settings (`online`, `lastSeen`) and are not blocked. Payload: `{ userId }`.
- **`user:offline`**: Emitted by server only to mutual contacts / shared chat members who meet privacy settings. Payload: `{ userId, lastSeen }`.

---

## 2. Typing & Activity Indicators
Requires active chat membership (verified by `assertChatMember`):
- **`chat:typing`**:
  - Client emits: `{ chatId, isTyping: boolean }`
  - Server broadcasts to `chat:<chatId>`: `{ chatId, userId, userName, isTyping }`
- **`chat:recording`**:
  - Client emits: `{ chatId, isRecording: boolean }`
  - Server broadcasts to `chat:<chatId>`: `{ chatId, userId, userName, isRecording }`

---

## 3. Server-Authoritative Messaging Events
Clients dispatch messages via `POST /api/v1/messages`. The server persists the message, processes attachments, and emits:
- **`message:new`**: Broadcast to `chat:<chatId>`. Payload: `{ message: IMessage }`.
- **`message:status`**: Broadcast when delivery state changes.
  - Payload: `{ messageId, chatId, status: 'sent' | 'delivered' | 'read', readBy: Array<{ userId, readAt }> }`
- **`message:edit`**: Broadcast when message content is updated within the 15-minute window.
  - Payload: `{ chatId, messageId, content, isEdited: true, editedAt }`
- **`message:delete`**: Broadcast when a message is deleted for everyone within the 48-hour window.
  - Payload: `{ chatId, messageId, forEveryone: true }`
- **`message:reaction`**: Broadcast when an emoji reaction is added, modified, or removed.
  - Payload: `{ chatId, messageId, reactions: Array<{ emoji, users: string[] }> }`
- **`message:pin`**: Broadcast when a message is pinned or unpinned in the chat.
  - Payload: `{ chatId, messageId, isPinned: boolean }`

---

## 4. Status (Story) Real-Time Events
- **`status:view`**: Emitted to the status author when an eligible viewer opens their status.
  - Payload: `{ statusId, viewerId, viewsCount: number }`

---

## 5. WebRTC Calling Signaling (Authoritative State Machine)
All signaling is validated against active call participant IDs:
- **`call:initiate`**:
  - Caller emits: `{ receiverId, callType: 'voice' | 'video', chatId }`
  - Server validates block list and privacy (`allowCalls`).
  - If callee is busy, server emits `call:busy` to caller.
  - Otherwise, creates `Call` log, starts 45s ring timer, and forwards `call:incoming` to callee's room `user:<receiverId>`.
- **`call:incoming`**: Received by callee. Payload: `{ callId, caller: { _id, name, avatarUrl }, callType, chatId }`.
- **`call:ringing`**: Callee emits acknowledgment that device is ringing. Server forwards to caller.
- **`call:accept` / `call:answer`**:
  - Callee accepts call. Cancels 45s timer.
  - Server transitions state to `connected`, sets `startedAt`, and notifies caller.
- **`call:reject`**: Callee declines incoming call. Server marks call `rejected` and notifies caller.
- **`call:end`**: Either peer hangs up. Server marks call `ended`, computes duration, and emits `call:ended` to both peers.
- **`call:offer`**: Caller sends WebRTC SDP offer. Forwarded to callee.
- **`call:answer`**: Callee sends WebRTC SDP answer. Forwarded to caller.
- **`call:ice`**: Peer exchanges ICE candidate. Server routes to target peer.

