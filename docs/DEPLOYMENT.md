# RSM Messenger Production Deployment Guide

This guide provides end-to-end instructions for deploying RSM Messenger Pro to production infrastructure, including Render, MongoDB Atlas, AWS S3/Cloudflare R2, Coturn TURN server, and production SMS/Push providers.

---

## 1. Environment Variables Reference Table

Configure these environment variables in your production environment (Render dashboard, AWS Secrets Manager, or production `.env` file):

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | **Yes** | `production` | Must be `production` |
| `PORT` | No | `5000` | HTTP/WebSocket listening port |
| `APP_NAME` | No | `RSM Messenger` | Application display name |
| `APP_URL` | **Yes** | — | Fully qualified public server URL (e.g. `https://api.messenger.domain.com`) |
| `CLIENT_URL` | **Yes** | — | Web client URL (e.g. `https://messenger.domain.com`) |
| `ADMIN_URL` | **Yes** | — | Admin dashboard URL (e.g. `https://admin.messenger.domain.com`) |
| `MONGODB_URI` | **Yes** | — | MongoDB Atlas Replica Set connection string (cannot be localhost in prod) |
| `JWT_SECRET` | **Yes** | — | Strong random secret (min 32 chars) for 15-minute access tokens |
| `JWT_REFRESH_SECRET` | **Yes** | — | Strong random secret (min 32 chars) for 30-day refresh tokens |
| `JWT_EXPIRES_IN` | No | `15m` | Access token lifespan |
| `JWT_REFRESH_EXPIRES_IN` | No | `30d` | Refresh token lifespan |
| `MOCK_OTP_ENABLED` | **Yes** | `false` | **MUST** be `false` in production. Server refuses to boot if true! |
| `SMS_PROVIDER` | **Yes** | `twilio` | Production SMS provider: `twilio`, `msg91`, or `fast2sms` |
| `TWILIO_ACCOUNT_SID` | If Twilio | — | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | If Twilio | — | Twilio Auth Token |
| `TWILIO_PHONE_NUMBER` | If Twilio | — | Twilio E.164 phone number |
| `MSG91_AUTH_KEY` | If MSG91 | — | MSG91 API Auth Key |
| `MSG91_TEMPLATE_ID` | If MSG91 | — | Approved DLT registered SMS template ID (India) |
| `FAST2SMS_API_KEY` | If Fast2SMS| — | Fast2SMS API Key |
| `STORAGE_DRIVER` | No | `local` | `local` (stored on server volume) or `s3` (cloud object storage) |
| `AWS_ACCESS_KEY_ID` | If S3 | — | AWS IAM Access Key ID / Cloudflare R2 Token |
| `AWS_SECRET_ACCESS_KEY`| If S3 | — | AWS IAM Secret Access Key |
| `AWS_REGION` | If S3 | `us-east-1`| AWS Region or `auto` for Cloudflare R2 |
| `AWS_S3_BUCKET` | If S3 | — | S3 Bucket name |
| `AWS_S3_ENDPOINT` | If MinIO/R2| — | Custom S3 endpoint URL |
| `STUN_SERVERS` | No | Google STUN | Comma-separated STUN server URIs |
| `TURN_SERVERS` | Recommended | — | Coturn TURN server URI (e.g. `turn:turn.domain.com:3478`) |
| `TURN_SECRET` | Recommended | — | Ephemeral HMAC-SHA1 shared secret for dynamic REST credentials |
| `PUSH_PROVIDER` | No | `expo` | `expo`, `fcm`, or `apns` |
| `CORS_ORIGINS` | **Yes** | — | Comma-separated allowed frontend origins (no wildcards allowed in prod) |
| `RATE_LIMIT_WINDOW_MS`| No | `900000` | 15 minutes (in ms) |
| `RATE_LIMIT_MAX_REQUESTS`| No| `1000` | Max requests per IP per window |

---

## 2. MongoDB Atlas Configuration
1. Create a cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (M10+ recommended for production workloads with replica set support).
2. Under **Network Access**, whitelist your hosting provider IP addresses (or `0.0.0.0/0` if using dynamic cloud IP with strong password authentication).
3. Under **Database Access**, create a user with `readWriteAnyDatabase` privileges.
4. Obtain the connection string:
   ```text
   mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/rsm_messenger?retryWrites=true&w=majority
   ```
5. Set `MONGODB_URI` in production environment settings.

---

## 3. Render Deployment
1. Connect your GitHub repository to [Render](https://render.com).
2. Deploy the server as a **Web Service**:
   - **Environment:** Docker (`server/Dockerfile`) or Node (`npm run start` inside `server/`)
   - **Instance Type:** Standard (Paid instance recommended to avoid 50s cold-start delays).
   - **Health Check Path:** `/health`
   - **Environment Variables:** Set all required variables from the table above.
3. Deploy the web client as a **Static Site**:
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Publish Directory:** `dist`
   - **Environment Variables:** `VITE_API_URL=https://your-api.onrender.com/api/v1`, `VITE_SOCKET_URL=https://your-api.onrender.com`
4. Deploy the admin panel as a **Static Site**:
   - **Root Directory:** `admin`
   - **Build Command:** `npm run build`
   - **Publish Directory:** `dist`
   - **Environment Variables:** `VITE_API_URL=https://your-api.onrender.com/api/v1`

---

## 4. Coturn (TURN Server) Setup for WebRTC
STUN allows peers to discover public IPs, but strict symmetric NATs (common on cellular mobile networks) require a TURN relay:
1. Provision an Ubuntu VPS (AWS EC2 / DigitalOcean Droplet).
2. Install Coturn:
   ```bash
   sudo apt update && sudo apt install coturn -y
   ```
3. Edit `/etc/turnserver.conf`:
   ```conf
   listening-port=3478
   tls-listening-port=5349
   realm=turn.yourdomain.com
   use-auth-secret
   static-auth-secret=YOUR_STRONG_GENERATED_SECRET_KEY
   cert=/etc/letsencrypt/live/turn.yourdomain.com/fullchain.pem
   pkey=/etc/letsencrypt/live/turn.yourdomain.com/privkey.pem
   no-loopback-peers
   no-multicast-peers
   ```
4. Start coturn: `sudo systemctl restart coturn`.
5. Set `TURN_SERVERS=turn:turn.yourdomain.com:3478` and `TURN_SECRET=YOUR_STRONG_GENERATED_SECRET_KEY` on your backend server. The `/api/v1/calls/ice-servers` endpoint will generate time-limited HMAC credentials automatically.

---

## 5. SMS Gateway Setup (India / Global)
- **Twilio (Global):** Sign up on Twilio, purchase an SMS-enabled number, set `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.
- **MSG91 (India DLT):**
  1. Complete Principal Entity DLT registration on Vilpower / Jio DLT.
  2. Register sender ID and approved SMS template: `Your RSM Messenger code is {#var#}. Expires in 5 minutes.`
  3. Set `SMS_PROVIDER=msg91`, `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`.

---

## 6. Mobile Release Build (Expo & Android APK)
1. Configure `mobile/app.json` with production bundle identifier.
2. Build standalone release APK using EAS:
   ```bash
   cd mobile
   npx eas-cli build -p android --profile production
   ```
3. Or build locally with Gradle using your production release keystore:
   ```bash
   cd mobile/android
   ./gradlew assembleRelease
   ```

