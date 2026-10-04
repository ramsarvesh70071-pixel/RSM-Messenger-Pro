# RSM Messenger Pro — Fix Report

## Phone par chalane ka tareeka (same Wi-Fi)
1. `npm run install:all` → `npm run seed` → `npm run dev`
2. Phone ke browser me kholein: `http://<PC-ka-LAN-IP>:3000` (OTP: `123456`).
   `client/.env` me `VITE_API_URL` / `VITE_SOCKET_URL` **khali** rakhein — Vite proxy `/api`, `/uploads`, `/socket.io` sambhalta hai.
3. **Calls (mic/camera) ke liye HTTPS chahiye.** Phone par plain `http://192.168.x.x` me browser mic/camera block karta hai.
   Options: `ngrok http 3000` / Cloudflare Tunnel (https URL), ya production me HTTPS reverse proxy.
   Desktop par `http://localhost:3000` par calls bina HTTPS ke chalte hain.
4. Production: `server/.env` me `NODE_ENV=production`, strong JWT secrets, real MongoDB, `MOCK_OTP_ENABLED=false`, aur calls ke liye TURN server (`TURN_SERVERS`, `TURN_SECRET`).

## Server
- **Message send contract**: voice notes, `fileName/fileSize`, `replyTo`, `contact`, `mentions` ab schema me accepted; reply preview server khud original message se banata hai (spoof nahi hota).
- **Socket handlers connect ke turant register** (pehle DB queries ke baad hote the → shuruaati events drop).
- **Rooms lazily join** (`ensureChatRoom`), `chat:rejoin`, `socket:ready` event har (re)connect par; connect par pending messages "delivered" mark.
- **Delivery/read receipts** membership-checked (koi bhi kisi aur ke chat ke ticks nahi badal sakta); `chat:unread_cleared` multi-device.
- **Calls**: ek hi `finishCall()` cleanup; sirf callee answer/reject kar sakta hai; caller cancel = missed; offer + ICE server par buffer (`call:join` se replay) taaki late accept par bhi call lage; disconnect par 15s grace; reconnect par `call:incoming` dobara; dono parties ko hamesha `call:ended`.
- **Group**: removed member ko bhi `chat:member_removed` milta hai (pehle room chhodne ke baad emit hota tha); `chat:updated` events.
- **Status**: naya status → `status:new` live.
- **CORS**: development me LAN/localhost origins auto-allowed (`utils/cors.ts`); Socket.IO connection-state recovery.
- **Dev OTP**: `MOCK_OTP_ENABLED` unset ho to development me ON, production me hamesha OFF.
- Naya test: `server/src/__tests__/realtime_e2e.test.ts` (10 end-to-end realtime/call scenarios).

## Web client
- **Realtime / "refresh nahi karna padega"**: nayi `useChatStore` — sab events sahi payload ke saath (edit, delete, reaction, pin, status ticks, presence, typing auto-expire), dedupe by `clientMsgId`, optimistic send (pending → sent / failed), reconnect + foreground-resume par automatic resync, debounced chat-list refresh.
- `socket.service.ts`: infinite reconnect, token har attempt par fresh, expired token par single-flight refresh, `visibilitychange/online/focus` par reconnect (mobile background kill ka main reason).
- `api.ts`: single-flight refresh (REST + socket shared), `mediaUrl()` helper, network error par logout nahi.
- Mobile layout, back button, safe-area, `dvh`, bottom nav, touch dropdowns, Forward modal, ringtone, call UI, call history refresh, PWA icons/service worker — (parallel session me hue changes; neeche "Note" dekhein).
- Call store: caller ne callId aane se pehle hang-up kiya to server par call cancel hoti hai.

## Note — verification limits
- Server tests FerretDB par chalaye gaye (real MongoDB sandbox me nahi tha): 68/71 pass. 3 fail FerretDB ki limitation se hain (`arrayFilters`, positional `$`, `$elemMatch`). Real MongoDB par `npm test` se confirm karein.
- Browser me real WebRTC audio/video aur real phone par visual check yahan nahi ho sakta tha; signaling server-side tests se verified hai.
- Expo `mobile/` app me `react-native-webrtc` nahi hai: wahan call sirf signaling/UI level par hai (audio/video ke liye dev build + react-native-webrtc chahiye).
