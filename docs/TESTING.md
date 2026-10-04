# RSM Messenger Testing Guide

## 1. Running Backend Automated Tests
RSM Messenger features an automated test suite with **61 passing tests across 7 test suites**. All tests run on an isolated in-memory MongoDB instance (`mongodb-memory-server`), ensuring zero pollution of production or development databases.

To execute the complete test suite:
```bash
cd server
npm test
```

### Test Suites Breakdown:
1. **`auth_and_messaging.test.ts` (8 tests)**: Health checks, mock OTP request/verify, JWT generation, protected user profile, chat retrieval, and ICE server STUN configurations.
2. **`security_phase1.test.ts` (9 tests)**: Phase 1 security hardening — OTP 5-attempt limit and 6th-attempt lockout, IDOR prevention on message retrieval/reaction/star/pin/disappearing-timer, session revocation instant 401, regex ReDoS safety, upload magic-byte verification, and admin self-suspension guard.
3. **`messaging_phase2.test.ts` (7 tests)**: Phase 2 message pipeline — delivery state progression (`sent` -> `delivered` -> `read`), clientMsgId idempotency, cursor pagination, 15m edit window enforcement, group admin delete-for-everyone, 5-chat forwarding limit, and in-chat search context jump.
4. **`mobile_contract.test.ts` (6 tests)**: Mobile payload compatibility — `POST /chats/direct` with `{ recipientId }`, `POST /groups` with `{ participantIds }`, `POST /status` with `{ text, mediaUrl }`, `POST /messages` with `mediaUrl`, `POST /calls/log` with `status: 'completed'`, and `PUT /devices/push-token`.
5. **`calling_phase4.test.ts` (7 tests)**: WebRTC calling — call initiation, call blocking, busy check when callee is in another call, 45s ring timeout transition to missed call, caller call-cancellation, caller hangup duration calculation, and ephemeral HMAC-SHA1 TURN credentials generation.
6. **`status_groups_phase5.test.ts` (13 tests)**: Phase 5 features — status feed without contact sync, status view counts & single-reaction constraint, quote-reply to status, group pending requests & approval flow, group ownership transfer on owner departure, 1024 member cap, community linked group visibility & join, channel posts CRUD & reactions, and contact batch sync.
7. **`admin_phase7.test.ts` (11 tests)**: Phase 7 admin operations — real storage size aggregation, user detail inspection, broadcast notification dispatch, real MongoDB ping, and report one-click moderation actions.

---

## 2. Package Typechecks & Production Builds
To verify all 4 packages (`server`, `client`, `admin`, `mobile`) build and typecheck with zero errors:

```bash
# Typecheck all packages
cd server && npx tsc --noEmit
cd ../client && npx tsc --noEmit
cd ../admin && npx tsc --noEmit
cd ../mobile && npx tsc --noEmit

# Build production bundles
cd ../client && npm run build
cd ../admin && npm run build
cd ../server && npm run build
```

---

## 3. Two-Device Manual Testing Script
For interactive testing between two browser windows:
1. Open Window A: `http://localhost:3000` (Login as Ramsarvesh: `+919876543210`)
2. Open Window B in Incognito: `http://localhost:3000` (Login as Aarav: `+919876543211`)
3. Open a direct conversation:
   - Type in Window A → Window B shows typing indicator and live message arrival (`message:new`).
   - Window B opens the chat → ticks update from single grey (`sent`) to double grey (`delivered`) to double blue (`read`).
   - Window A edits message within 15m → Window B updates live with `(edited)` tag.
   - Record voice note in Window A → live waveform meters and audio upload completes.
4. Voice / Video Calling:
   - Click phone or video icon in Window A → Window B receives `call:incoming` modal with ringtone.
   - Click Accept in Window B → WebRTC `RTCPeerConnection` establishes audio/video streams.
   - Click End → server calculates call duration and appends to call history.

