# RSM Messenger Architecture & System Design

## 1. Overview
**RSM Messenger** is an enterprise-grade, high-scale, real-time messaging platform inspired by WhatsApp. It features passwordless phone authentication, WebSocket-based bi-directional messaging, WebRTC encrypted voice and video calling, rich media handling with thumbnail generation, ephemeral/disappearing messages, 24-hour stories (Status), channels, communities, and an administrative control panel.

---

## 2. High-Level Architecture Diagram

```
+-------------------------------------------------------------------------+
|                              CLIENT APPS                                |
|  - React Native (iOS & Android)                                         |
|  - React / Web Client (http://localhost:3000)                           |
|  - React Admin Console (http://localhost:5173)                          |
+-------------------+---------------------------------+-------------------+
                    | REST APIs                       | WebSockets / STUN
                    v                                 v
+-------------------------------------------------------------------------+
|                          NODE.JS EXPRESS SERVER                         |
|  - REST Endpoints (/api/v1/*)                                           |
|  - Socket.IO Real-Time Gateway (Bi-directional pub/sub)                 |
|  - JWT Access & Refresh Token Rotation with Session Manager             |
|  - Sharp Image Resizer & Thumbnail Engine                               |
|  - WebRTC ICE Candidate & SDP Signaling Gateway                         |
+-------------------+---------------------------------+-------------------+
                    | Mongoose ORM                    | Local / Cloud S3
                    v                                 v
+-----------------------------+     +-------------------------------------+
|        MONGODB DB           |     |        STORAGE LAYER                |
|  - Indexed Collections      |     |  - Local File Storage (/uploads)    |
|  - TTL Self-Expiring Status |     |  - Pluggable AWS S3 / MinIO Driver  |
|  - Multi-Device Sessions    |     +-------------------------------------+
+-----------------------------+
```

---

## 3. Core Subsystems

### A. Authentication & Session Management
- **Passwordless OTP:** Users authenticate using phone number + OTP verification normalized to international E.164 standard.
- **Development Mock Mode:** Built-in zero-cost mock OTP provider (`123456`) strictly disabled in production. Pluggable provider abstraction supports Twilio, MSG91 (DLT template), and Fast2SMS for production.
- **JWT & Session Security:** Short-lived JWT Access Tokens (15m) containing `sid` paired with persistent, rotatable Refresh Tokens (30d) tied to distinct device fingerprints with refresh token reuse detection.
- **Multi-Device Support:** Users can login on multiple devices simultaneously. Revoking a session invalidates the in-memory `SessionCache` and immediately force-disconnects that device's WebSockets.

### B. Real-Time Messaging Engine (Socket.IO)
- **Presence & Delivery Status:** Filtered online/offline presence updates (restricted to mutual contacts / shared chat members respecting privacy settings), typing indicators, audio recording indicators, and delivery transitions: sent (`✓`), delivered (`✓✓`), and read (`✓✓` blue ticks).
- **Idempotency:** Client message IDs (`clientMsgId`) enforced with partial unique MongoDB index preventing duplicate sends on reconnect.
- **Rich Message Types:** Text, emoji, image, video, audio voice notes with real `MediaRecorder` waveform amplitude visualization, documents, location coordinates, contact vCards, and system event notices.
- **Message Operations:** WhatsApp-style quote-reply, 1-to-many forwarding (capped at 5 chats), star/pin messages within chats, edit sent messages (15m window), delete for me, and delete for everyone (48h window).

### C. WebRTC Voice & Video Calling
- **Socket.IO Signaling:** Authoritative state machine (`initiated` -> `ringing` -> `connected` -> `ended` / `rejected` / `busy` / `missed`).
- **Busy State & Ring Timeout:** Automatic busy rejection if callee is in another call; 45-second ring timeout automatically transitions unaccepted calls to missed state and logs call duration computed from server timestamps.
- **STUN/TURN Configuration:** Default Google STUN servers with ephemeral HMAC-SHA1 time-limited TURN REST credentials generated via `/api/v1/calls/ice-servers`.

### D. Stories (Status) Subsystem
- **Ephemeral 24-Hour Expiration:** Uses MongoDB native TTL indexes (`expiresAt`) for automatic garbage collection.
- **Viewer Tracking & Reactions:** Tracks status views and single emoji reaction per user; supports direct quote-reply (`POST /status/:id/reply`) creating a chat conversation.

