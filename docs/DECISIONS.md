# Architectural & Design Decisions

This document records architectural, security, and technical decisions made during the execution of the master completion plan for RSM Messenger Pro.

---

## Decision 1: Environment Validation & Production Security Guards (Phase 1.1)
- **Problem**: `MOCK_OTP_ENABLED` defaulted to `true` unless explicitly set to `'false'`. The production deployment (`render.yaml`) had `MOCK_OTP_ENABLED: "true"` and hardcoded seeded admin phone credentials in documentation.
- **Decision**:
  - We use `zod` in `server/src/config/environment.ts` to strictly validate all environment variables on boot.
  - In `NODE_ENV=production`:
    - `MOCK_OTP_ENABLED` MUST be `false` (or unset, defaulting to `false`). The server refuses to boot if `MOCK_OTP_ENABLED` is `true`.
    - `JWT_SECRET` and `JWT_REFRESH_SECRET` must be at least 32 characters long and must not match development fallback strings.
    - `CORS_ORIGINS` must not be empty or `*`.
    - `MONGODB_URI` must not point to `localhost` or `127.0.0.1`.
  - In `render.yaml`, `MOCK_OTP_ENABLED` is switched to `"false"`.

---

## Decision 2: E.164 Phone Normalization & Real OTP Provider Interface (Phase 1.2)
- **Problem**: Phone numbers were stored raw without E.164 validation, allowing duplicate accounts for the same phone number (e.g. `+91 98...` vs `+9198...` vs `98...`). OTP attempts were incremented but never capped.
- **Decision**:
  - Integrate `libphonenumber-js` with default country 'IN' to strictly parse and normalize every phone number into standard international format (E.164, e.g. `+919876543210`).
  - Introduce an extensible `SmsProvider` interface supporting:
    - `MockSmsProvider` (strictly disabled in production).
    - `TwilioSmsProvider` (for global production SMS).
    - `Msg91SmsProvider` / `Fast2SmsProvider` (for India DLT production SMS).
  - Enforce maximum 5 verification attempts per OTP (after 5 failures, the OTP is destroyed).
  - Enforce rate limiting: maximum 3 OTP requests per phone number within a 10-minute window, plus a 60-second cooldown between consecutive requests.
  - Never expose the OTP code in HTTP responses unless running in non-production development mode with mock provider active.
  - Constant-time hash comparison (`crypto.timingSafeEqual`) for OTP verification to prevent timing attacks.

---

## Decision 3: Real Session Revocation, Refresh Token Reuse Detection & Socket Disconnect (Phase 1.3)
- **Problem**: Access tokens contained no session identifier (`sid`). A revoked or logged-out token remained valid for 1 hour. Refresh tokens had no reuse detection.
- **Decision**:
  - Access token payload includes `userId` and `sid` (session ID corresponding to the `Device` document `_id`).
  - Access token expiry reduced from `1h` to `15m`. Refresh token is `30d`.
  - `authenticate` middleware and WebSocket authentication verify that the session (`sid`) exists and is active.
  - An in-memory LRU session cache (`SessionCache`) with 30s TTL avoids a MongoDB query on every single request while guaranteeing immediate invalidation upon logout, revocation, or suspension.
  - Refresh token reuse detection: Each session records a hash of the latest issued refresh token. If a previously replaced token is submitted, the session is flagged as compromised and immediately terminated.
  - When a device is revoked, logged out, suspended, or deleted, all associated WebSockets are immediately disconnected via `io.in('user:<id>').disconnectSockets(true)`.

---

## Decision 4: Schema Validation Layer (Phase 1.4)
- **Problem**: Incoming controller bodies, queries, and parameters lacked schema validation, allowing mass-assignment and unexpected input shapes.
- **Decision**:
  - Implement a reusable Express middleware `validate(schema)` using `zod` to validate `req.body`, `req.query`, and `req.params`.
  - Enforce strict limits on array sizes (e.g. max 1024 members in a group, max 50 message IDs for forward/delete), string lengths (max 4096 characters for text messages), and valid MongoDB ObjectIds.
  - Strip or reject unrecognized keys.

---

## Decision 5: Complete IDOR Resolution (Phase 1.5)
- **Problem**: Missing chat membership verification in message reactions, stars, pins, deletes, forwards, disappearing message duration updates, and call history.
- **Decision**:
  - Implement central authorization guards `assertChatMember(chatId, userId)` and `assertMessageAccess(messageId, userId)`.
  - Guard all message mutations, forwards (verifying both source and target chats), disappearing message configuration (requiring group admin permissions if `onlyAdminsCanEditInfo` is set), and status privacy.

---

## Decision 6: Server-Authoritative WebSockets & Room Management (Phase 1.6 - 1.8)
- **Problem**: Clients could emit `message:send` directly to rooms without server persistence or membership validation. Socket rooms were only joined on initial connection. Presence was broadcast globally to all connected users.
- **Decision**:
  - Remove client-driven `message:send` socket relay. Clients send messages via REST `POST /messages`, and the server persists the message and broadcasts `message:new` with the verified database record.
  - Socket events for typing, recording, and read receipts require active membership verification in the target chat.
  - Dynamically join socket rooms (`io.in('user:<id>').socketsJoin('chat:<id>')`) upon chat creation, group creation, member addition, and invite acceptance.
  - Restrict presence broadcasts (`user:online` / `user:offline`) to mutual contacts / shared chat participants who pass privacy checks (`online`, `lastSeen`) and block filters.

---

## Decision 7: Message Delivery Pipeline, Idempotency & Time Limits (Phase 2)
- **Problem**: Message delivery was unverified; fetching chat history blindly marked all messages as read; retries created duplicate messages; edits and deletes had no time limits.
- **Decision**:
  - Implement three distinct delivery states: `sent` (persisted) -> `delivered` (recipient connected or history fetched) -> `read` (chat opened and explicitly acknowledged via `POST /chats/:id/read`).
  - Added unique partial index `{ chatId: 1, senderId: 1, clientMsgId: 1 }` ensuring client retries are strictly idempotent.
  - WhatsApp-aligned time limits: message editing is restricted to 15 minutes; message deletion for everyone is restricted to 48 hours (group admins can delete any member's message).
  - Replaced slow `skip` + `countDocuments` pagination with cursor pagination (`before=<messageId>&limit=30`).
  - Added context jump endpoint `GET /messages/:id/context` to load surrounding messages when jumping from search results.

---

## Decision 8: Mobile Contract Alignment, Persistent Secure Storage & Hardware Integrations (Phase 3)
- **Problem**: Mobile client sent mismatched request shapes causing silent failures (`recipientId` vs `targetUserId`, `participantIds` vs `memberIds`, `mediaUrl` vs `attachments[]`); app lacked token persistence, hardware media pickers, and push token registration.
- **Decision**:
  - Backend controllers updated to accept both legacy and mobile contract payload keys.
  - Replaced hardcoded device IDs with UUID-based device IDs persisted in `expo-secure-store`.
  - Added `PUT /devices/push-token` endpoint and integrated `expo-notifications` push token registration.
  - Implemented real hardware media pickers using `expo-image-picker`, `expo-document-picker`, `expo-av`, `expo-location`, `expo-contacts`, `expo-file-system`, and `expo-sharing`.
  - Added 9 missing screens: Starred Messages, Archived Chats, Group Info/Settings, Privacy Settings, Blocked Users, Linked Devices, Communities, Channels, and Disappearing Messages.

---

## Decision 9: Authoritative WebRTC Calling State Machine & Ephemeral TURN Credentials (Phase 4)
- **Problem**: Web calling used a fake `simulated_local_webrtc_sdp` string and local `setTimeout`; server trusted client-reported durations; no busy check; no 45s ring timeout.
- **Decision**:
  - Replaced fake SDP with real `RTCPeerConnection` in `client/src/store/useCallStore.ts` and `<video>`/`<audio>` stream rendering in `client/src/components/CallModal.tsx`.
  - Implemented server-authoritative call signaling state machine (`initiated` -> `ringing` -> `connected` -> `ended` / `rejected` / `busy` / `missed`).
  - Server verifies caller is not blocked and callee has `allowCalls` enabled; returns `call:busy` if callee is already on an active call.
  - 45-second ring timeout automatically transitions unaccepted calls to `missed` status, dispatches high-priority push notifications, and logs call duration computed from server timestamps.
  - Implemented ephemeral HMAC-SHA1 time-limited TURN REST credentials in `GET /api/v1/calls/ice-servers`.

---

## Decision 10: Mutual-Chat Status Visibility & Group Join Approvals (Phase 5)
- **Problem**: Status stories were invisible unless explicit contact sync was executed; group `approveNewMembers` setting was stored but never enforced; group owner leaving caused orphaned groups.
- **Decision**:
  - Status feed queries both explicit contacts and mutual chat participants, respecting block lists and privacy settings.
  - Added `POST /status/:id/reply` creating a direct quote-reply chat message.
  - Implemented group pending join request workflow (`pendingRequests`, `GET /groups/:id/pending-members`, `POST /approve-member`, `POST /reject-member`).
  - Added automatic group ownership transfer to the oldest co-admin (or oldest member) when the owner leaves.
  - Enforced `MAX_GROUP_MEMBERS = 1024` on member additions and invite link joins.
  - Added `@mention` support in group messages that bypasses chat mute.

---

## Decision 11: Real MediaRecorder Voice Notes & PWA Service Worker (Phase 6)
- **Problem**: Web client voice notes used a hardcoded `/uploads/audio/sample_voice.mp3` file; no browser notifications or offline caching; demo accounts were exposed in production builds.
- **Decision**:
  - Replaced hardcoded sample audio with HTML5 `MediaRecorder` API and Web Audio API (`AudioContext`, `AnalyserNode`) for live waveform metering and real audio upload.
  - Added PWA web app manifest (`manifest.json`) and service worker (`sw.js`) for offline shell caching and background push notification handling.
  - Dynamic unread count in `document.title` and native browser Notification API permissions.
  - Guarded quick-login demo accounts with `import.meta.env.DEV` to prevent demo account exposure in production builds.
  - Replaced hardcoded Unsplash default avatar with dynamic SVG initials avatar generator.

---

## Decision 12: Real Storage Aggregation, User Details & Broadcast Announcements (Phase 7)
- **Problem**: Admin stats estimated storage as `messages * 0.15 MB`; admin lacked user detail inspection, broadcast tools, and real MongoDB connectivity checks.
- **Decision**:
  - Replaced estimated storage size with MongoDB aggregation pipeline computing the actual byte sum of `attachments.fileSize`.
  - Added `GET /api/v1/admin/users/:id/details` inspecting user devices, abuse reports, and conversation activity without exposing message contents.
  - Added `POST /api/v1/admin/broadcast` dispatching system notifications to all active users.
  - Added real MongoDB ping (`admin().ping()`) and connected WebSocket count to `GET /api/v1/admin/health`.
  - Enabled one-click report resolution with `suspend_user` and `delete_message` actions, logged to the `AuditLog` collection.

---

## Decision 13: CI/CD Pipeline, Health Mongo Ping & Resilient Database Reconnection (Phase 8)
- **Problem**: No GitHub Actions CI; `/health` endpoint only checked Mongoose connection state without verifying actual database responsiveness; Mongo connection failed fast on boot without retry; root install/build scripts omitted packages.
- **Decision**:
  - Created `.github/workflows/ci.yml` running typechecks across all 4 packages (`server`, `client`, `admin`, `mobile`), automated tests with coverage, and production bundle builds.
  - Updated `/health` endpoint to perform real `mongoose.connection.db.admin().ping()` and report round-trip latency (`mongoPingMs`).
  - Implemented exponential backoff reconnection logic (up to 5 retries with capped 10s backoff) in `connectDatabase`.
  - Aligned rate limit defaults (1000 requests / 15 min) between `.env.example` and `environment.ts`.
  - Updated root `package.json` scripts (`install:all` includes `shared` and `mobile`; `build:all` includes `client`).

---

## Decision 14: Documentation Honesty & E2EE / SFU Scope Demarcation (Phase 9)
- **Problem**: Previous documentation claimed "End-to-End Encryption ready", "Encryption at rest ACTIVE", "TLS 1.3 ACTIVE", and other marketing statements that overstated active code features.
- **Decision**:
  - Explicitly mark features in documentation as **Works**, **Needs external service** (naming the required credentials), or **Not implemented**.
  - Document that true Signal Protocol E2EE requires client-side asymmetric key generation, signed prekeys, Double Ratchet session state, and blind server relays, which is marked as **Not implemented / Roadmap**.
  - Document that transport encryption (TLS) and storage encryption at rest are **deployment-dependent** infrastructure configurations, not code properties.

