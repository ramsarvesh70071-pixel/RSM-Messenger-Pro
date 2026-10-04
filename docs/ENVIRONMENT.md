# RSM Messenger Environment Variables Reference

| Variable Name | Required | Default Value | Description |
|---|---|---|---|
| `PORT` | No | `5000` | HTTP & WebSocket server port |
| `NODE_ENV` | No | `development` | Runtime environment (`development`, `production`, `test`) |
| `APP_NAME` | No | `RSM Messenger` | Display name of the application |
| `MONGODB_URI` | **Yes** | `mongodb://localhost:27017/rsm_messenger` | MongoDB connection URI |
| `JWT_SECRET` | **Yes** | Dev secret string | HMAC-SHA256 secret for 1h access tokens |
| `JWT_REFRESH_SECRET` | **Yes** | Dev secret string | HMAC-SHA256 secret for 30d refresh tokens |
| `MOCK_OTP_ENABLED` | No | `true` | When true, mock OTP provider is used for free testing |
| `MOCK_OTP_CODE` | No | `123456` | Static OTP code when mock mode is enabled |
| `STORAGE_DRIVER` | No | `local` | Media storage driver (`local`, `s3`) |
| `UPLOAD_DIR` | No | `./uploads` | Destination directory for uploaded media |
| `MAX_FILE_SIZE_MB` | No | `50` | Maximum file size in MB for uploads |
| `STUN_SERVERS` | No | `stun:stun.l.google.com:19302` | Comma-separated public STUN servers for WebRTC |
| `TURN_SERVERS` | No | `""` | Comma-separated TURN server URLs for strict NATs |
| `TURN_USERNAME` | No | `""` | Username for TURN server authentication |
| `TURN_CREDENTIAL` | No | `""` | Password/credential for TURN server authentication |
| `PUSH_PROVIDER` | No | `mock` | Push notification service driver (`mock`, `fcm`, `apns`) |
