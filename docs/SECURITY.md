# RSM Messenger Security, Encryption & Privacy Architecture

## 1. Transparency on Encryption Layers
In accordance with professional cryptographic and software engineering standards, we strictly distinguish between **Transport Encryption**, **Database/At-Rest Encryption**, and **End-to-End Encryption (E2EE)**:

### A. Transport Encryption (In-Transit)
- **Status:** **DEPLOYMENT-DEPENDENT**
- **Mechanism:** In production, clients communicate via HTTPS / TLS 1.3 for REST APIs and Secure WebSockets (`wss://`) for Socket.IO.
- **Note:** Transport encryption is provided by the deployment environment (e.g. reverse proxy, Cloudflare, AWS ALB, or Let's Encrypt certificates) and is not a built-in feature of local development Node.js HTTP servers.

### B. Database & Storage Encryption (At-Rest)
- **Status:** **DEPLOYMENT-DEPENDENT**
- **Mechanism:** MongoDB Enterprise Encryption at Rest (WiredTiger AES-256) and host filesystem volume encryption (LUKS / BitLocker / AWS KMS).
- **Note:** At-rest encryption depends on the database host or cloud provider (e.g., MongoDB Atlas encrypted storage volumes).

### C. End-to-End Encryption (E2EE)
- **Status:** **NOT IMPLEMENTED / ROADMAP**
- **Truthful Architecture Explanation:** The current production release does **not** perform client-side Signal Protocol Double Ratchet end-to-end encryption. The `Message` schema stores text contents and attachment references on the server. This design enables server-side full-text search indexing, server-side media processing (Sharp thumbnails), and abuse moderation workflows.
- **Future E2EE Roadmap:** Full E2EE requires audited client-side Signal Protocol libraries (`libsignal`), client-side identity key pairs, signed prekeys, one-time prekeys, Double Ratchet session state, and treating the server as an untrusted blind relay.

---

## 2. Authentication & Session Security (Verified & Hardened)
- **Passwordless OTP:** Normalised to international E.164 format via `libphonenumber-js`. Rate-limited to 3 requests per 10 minutes per phone, with 60-second resend cooldown.
- **OTP Brute-Force Defense:** Hard limit of 5 verification attempts. On the 6th failure, the OTP is destroyed. Verification uses constant-time hash comparison (`crypto.timingSafeEqual`).
- **Access Tokens:** Signed with HMAC-SHA256 (`JWT_SECRET`), valid for 15 minutes. Contains user ID and session ID (`sid`).
- **Refresh Token Rotation & Reuse Detection:** Each session records the SHA-256 hash of the latest issued refresh token. If a previously consumed refresh token is presented, the entire device session is immediately terminated.
- **Real-Time Device Revocation:** Active sessions are tracked in MongoDB and validated via an in-memory LRU cache (`SessionCache`). When a session is revoked or logged out, the cache is invalidated, subsequent requests receive HTTP 401, and all connected WebSockets are immediately closed (`io.in('user:<id>').disconnectSockets()`).

---

## 3. IDOR Prevention & Authorization Guards
All sensitive operations enforce strict chat membership and message access verification:
- `assertChatMember(chatId, userId)`: Verifies membership before allowing message retrieval, typing indicators, recording notices, read receipts, and disappearing message configuration.
- `assertMessageAccess(messageId, userId)`: Verifies membership before message reactions, star/unstar, and pin/unpin.
- **Message Forwarding:** Verifies access to the source message and active membership in all destination chats (capped at 5 chats).
- **Call Security:** `call:initiate` strictly verifies neither party is blocked and the callee has `allowCalls` enabled.

---

## 4. Input Validation & Upload Protection
- **Zod Schema Validation:** Every controller endpoint validates request bodies, queries, and route parameters against strict schemas, stripping unrecognized keys.
- **File Upload Security:** Uploaded files undergo magic-byte verification using `file-type` to prevent MIME-type spoofing. Strict size limits are enforced (images: 10 MB, audio: 25 MB, video: 64 MB, documents: 50 MB).
- **Regex Safety:** Search queries are sanitized (`escapeRegex`) and capped in length to prevent ReDoS (Regular Expression Denial of Service) vulnerabilities.

---

## 5. Privacy Rules Enforced on Backend
Privacy settings are strictly applied on the server:
1. **Profile Photo & About:** Filtered based on user settings (`everyone`, `contacts`, `nobody`).
2. **Online Status & Last Seen:** Filtered according to user privacy preferences and block lists.
3. **Presence Privacy:** Socket presence updates (`user:online` / `user:offline`) are emitted only to users who share a mutual conversation or contact record and meet privacy criteria.
4. **Blocking Policy:** If User A blocks User B, User B cannot message, call, or view statuses of User A. Block checks fail silently without leaking block status to the blocked party.

