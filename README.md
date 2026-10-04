# RSM Messenger - Enterprise Real-Time Messaging Platform

> A production-quality, WhatsApp-inspired real-time communication platform engineered with Node.js, Express, MongoDB, Socket.IO, WebRTC, React Native/React Web, and TypeScript.

---

## 🌟 Quick Start Guide

### 1. Prerequisites
- **Node.js** v18+ (tested on Node v24)
- **MongoDB** running locally on port 27017 (`mongodb://localhost:27017/rsm_messenger`) or MongoDB Atlas URI

### 2. Installation
Install dependencies across all workspaces (`shared`, `server`, `admin`, `client`):
```bash
# Install root orchestration tools
npm install

# Install dependencies for all subsystems
npm run install:all
```

### 3. Seed Database with Demo Accounts
Populate demo users, 1-to-1 conversations, group chats, status stories, and channels:
```bash
npm run seed
```

**Demo Accounts Available (Mock OTP: `123456`):**
1. **Ramsarvesh Maurya (Administrator):** `+919876543210`
2. **Aarav Sharma (Developer):** `+919876543211`
3. **Priya Patel (Designer):** `+919876543212`
4. **Rohan Verma (Product Manager):** `+919876543213`

### 4. Run Automated Test Suite
```bash
npm test
```

### 5. Launch All Services Simultaneously
```bash
npm run dev
```

This starts:
- 🚀 **Backend Server:** [http://localhost:5000](http://localhost:5000)
- 💬 **Messenger Web Client:** [http://localhost:3000](http://localhost:3000)
- 🛡️ **Admin Dashboard:** [http://localhost:5173](http://localhost:5173)

---

## 🏗️ Project Architecture

```
/RSM-Messenger
├── /client          # Cross-platform React / React Native Web mobile client (Port 3000)
│   └── src/
│       ├── components/  # MessageBubble, VoicePlayer, ChatHeader, ChatInput, CallModal, etc.
│       ├── screens/     # Chats, Status, Communities, Channels, Calls, Auth
│       ├── services/    # Axios API client, Socket.IO client, WebRTC adapter
│       └── store/       # Zustand stores (useAuthStore, useChatStore, useCallStore, useStatusStore)
│
├── /server          # Express & Socket.IO real-time backend API (Port 5000)
│   └── src/
│       ├── config/      # Environment & Mongoose database connection
│       ├── controllers/ # Auth, User, Contact, Chat, Message, Group, Status, Call, Admin
│       ├── middleware/  # JWT Auth, Rate limiting, Error handler, Multer memory upload
│       ├── models/      # 28 Mongoose models (User, Chat, Message, Call, Status, etc.)
│       ├── routes/      # Clean REST endpoints under /api/v1/*
│       ├── services/    # Mock OTP & SMS abstraction, Local & S3 storage, Push notifications
│       ├── sockets/     # Real-time WebSocket handlers & WebRTC signaling
│       └── utils/       # JWT tokens, response helpers, database seed script
│
├── /admin           # Web Admin Dashboard (Port 5173)
│   └── src/
│       ├── pages/       # Dashboard Overview, Users Directory, Trust & Safety Reports, Health
│       └── services/    # Admin Axios API client with role-based JWT auth
│
├── /shared          # Shared TypeScript models, contracts, DTOs, and socket events
│
└── /docs            # Technical architecture, API reference, Database, Security, Testing guides
```

---

## 📊 Complete Feature Audit & Reality Status

Every feature below is honestly classified as:
- **Works**: Tested and functional in code without external dependencies.
- **Needs external service**: Implementation exists in code, requires third-party API keys/infrastructure in production.
- **Not implemented**: Open roadmap item; not faked in production paths.

| Feature Category | Feature Description | Status | Verification & Notes |
|---|---|---|---|
| **Authentication** | Passwordless Phone Registration & Login | **Works** | E.164 normalization, OTP expiration & max 5 attempts |
| **Authentication** | Development Mock OTP Provider (`123456`) | **Works** | Dev-only; disabled in production |
| **Authentication** | Production SMS Gateway Provider | **Needs external service** | Requires Twilio / MSG91 / Fast2SMS API keys & DLT registration |
| **Authentication** | JWT Access (15m) & Refresh (30d) Rotation | **Works** | Reuse detection & cryptographically secure session rotation |
| **Authentication** | Remote Device Revocation / Logout All | **Works** | `SessionCache` invalidation + real-time WebSocket force-disconnect |
| **Messaging** | 1-to-1 Real-Time Private Messaging | **Works** | Server-persisted `message:new` event with socket delivery |
| **Messaging** | Delivery States (`sent` → `delivered` → `read`) | **Works** | Real-time ticks; respects user read receipts privacy |
| **Messaging** | Client Message Idempotency | **Works** | Unique partial index `(chatId, senderId, clientMsgId)` |
| **Messaging** | Message Edit (15m limit) & Delete Everyone (48h) | **Works** | Enforced by server timestamps; group admins can delete any message |
| **Messaging** | Star & Pin Messages within Chat | **Works** | IDOR-protected; pinned banners and starred views |
| **Messaging** | Quote-Reply & 1-to-Many Forwarding | **Works** | Quoted preview card; forward limited to max 5 chats |
| **Messaging** | Persistence & Search in MongoDB | **Works** | Cursor pagination (`before=<id>`) & context jump |
| **Messaging** | Voice Notes (Web & Mobile) | **Works** | Real HTML5 `MediaRecorder` + Web Audio API waveform metering |
| **Messaging** | Photo, Video & Document Attachments | **Works** | Magic-byte verification (`file-type`), size limits & Sharp thumbnails |
| **Messaging** | Location Sharing & Contact vCards | **Works** | Normalized coordinates & vCard parsing |
| **Messaging** | Disappearing Messages (Self-Destruct) | **Works** | Native MongoDB TTL index expiration |
| **Messaging** | End-to-End Encryption (Signal Protocol) | **Not implemented** | Stored server-side for search/moderation; Signal Double Ratchet is on roadmap |
| **Group System** | Group Creation, Photo & Description | **Works** | Supports up to 1024 members |
| **Group System** | Multi-Admin Roles & Permissions | **Works** | Promote admin, demote, remove member, owner leave transfer |
| **Group System** | Announcement Mode (Admins only send) | **Works** | Strictly verified on backend before message persistence |
| **Group System** | Member Approval Workflow | **Works** | `approveNewMembers` pending request queue & admin approval |
| **Group System** | System Notification Messages | **Works** | Group events (add, remove, leave, admin change, settings) |
| **Status / Stories** | 24-Hour Ephemeral Stories (Status) | **Works** | Text/media status with 24h TTL auto-delete |
| **Status / Stories** | Mutual Chat & Contact Visibility | **Works** | Shows stories from shared chat participants & contacts |
| **Status / Stories** | Viewer Tracking & Direct Quote-Reply | **Works** | Real-time viewer count event & `POST /status/:id/reply` |
| **Calling** | 1-to-1 WebRTC Voice & Video Calling | **Works** | Authoritative signaling state machine, busy check & 45s ring timeout |
| **Calling** | Call Logs (Incoming/Outgoing/Missed) | **Works** | Server-calculated durations & missed call push triggers |
| **Calling** | Symmetric NAT TURN Traversal | **Needs external service** | Ephemeral HMAC-SHA1 credentials generated; requires Coturn server |
| **Calling** | Group / Multi-Party Calling | **Not implemented** | P2P mesh cannot scale past 3-4 peers; requires SFU (LiveKit/mediasoup) |
| **Communities** | WhatsApp-style Community Hubs | **Works** | Linked group visibility, join community, dynamic member count |
| **Channels** | One-to-Many Broadcast Channels | **Works** | Post creation, editing, deletion, emoji reactions & follower list |
| **Privacy & Safety** | Backend Enforced Privacy Rules | **Works** | Profile photo, about, last seen, online status filtered on server |
| **Privacy & Safety** | User Blocking (Zero Block Leakage) | **Works** | Blocks messages, calls, stories, and presence updates |
| **Privacy & Safety** | Abuse Reporting & One-Click Moderation | **Works** | Report triage with evidence viewer and admin suspend/delete actions |
| **Admin Console** | React Web Admin Dashboard | **Works** | User management, user details, audit logs, MongoDB latency ping |
| **Admin Console** | System Broadcast Announcements | **Works** | Generates system notifications for all active users |
| **Push Notifications**| Push Notification Relay | **Needs external service** | Expo push service implemented; requires FCM / APNs credentials |
| **Cloud Storage** | Local Sharp Image Engine | **Works** | Thumbnails and file compression in `./uploads` |
| **Cloud Storage** | S3 / MinIO Object Storage | **Needs external service** | Requires AWS S3 / Cloudflare R2 bucket credentials |

---

## 🔒 Security & Privacy Notice
RSM Messenger distinguishes between:
1. **Transport Encryption:** TLS 1.3 / HTTPS & WSS for active connections (**Deployment-Dependent**: configured via reverse proxy / hosting platform).
2. **At-Rest Encryption:** MongoDB storage engine encryption (**Deployment-Dependent**: configured via host or MongoDB Atlas).
3. **End-to-End Encryption (E2EE):** **Not Implemented**. The current release stores messages on the server to support server-side search indexing and media processing. Signal Protocol client-side Double Ratchet encryption is planned for a dedicated future release.

